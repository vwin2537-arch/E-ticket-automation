// upload-logs.js — ส่ง log ขึ้น Google Drive ผ่าน Apps Script web app
// เรียกจาก: server.js (ตอนเปิดระบบ + ทุก 30 นาที + ปุ่มปิด /api/shutdown) + RESET-Windows.bat (กู้ระบบ)
// best-effort: ส่งไม่ได้ (เน็ตล่ม / ยังไม่ตั้ง url) ก็ไม่ throw — ปิด/กู้ระบบต่อได้ ไม่ค้าง
//
// ส่งแบบเดียวกับแอปมือถือ (29/10/69): ไฟล์รายเดือน logs/YYYY-MM_<ชนิด> → ส่งเฉพาะ byte ใหม่ (mode=append)
// → Drive ต่อท้ายไฟล์ชื่อเดียวกันในโฟลเดอร์ชื่อเครื่อง (เช่น DESKTOP-3TEOMCJ/2026-10_usage.csv) = 1 ไฟล์/ชนิด/เดือน
// เดิมส่งทั้งก้อนสะสมทุกครั้ง → โต ~15.6MB ส่งไม่ทัน timeout + Drive มีไฟล์ซ้ำเต็มโฟลเดอร์
// ส่ง from/to (ตำแหน่ง byte) ไปด้วย → Apps Script ข้ามก้อนที่เคยต่อท้ายแล้ว (กันซ้ำตอนคำตอบหายกลางทาง)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { LOG_UPLOAD } = require('../src/config');
const { LOG_DIR, KINDS, MONTH_FILE_RE } = require('../src/logfiles');

const STATE_FILE = path.join(LOG_DIR, 'upload-state.json'); // { sent: { "<ไฟล์>": bytes }, lastAt: ms }
const LEGACY_DIR = path.join(LOG_DIR, 'legacy');
const CHUNK_BYTES = 900 * 1024; // Apps Script รับ ≤1,000,000 ตัวอักษร/ครั้ง
const TIMEOUT_MS = 60000; // วัด 29/10/69: Apps Script ~2 วิ + ~1.2 วิ/MB

function readState() {
  try { const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); return { sent: s.sent || {}, lastAt: s.lastAt || 0 }; }
  catch { return { sent: {}, lastAt: 0 }; }
}
const writeState = (s) => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch {} };
const machineName = () => (os.hostname() || 'unknown').replace(/[^\w.-]/g, '_');

async function post(body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(LOG_UPLOAD.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: LOG_UPLOAD.secret, machine: machineName(), ...body }),
      signal: ctrl.signal,
    });
    const txt = await res.text();
    let j = {};
    try { j = JSON.parse(txt); } catch {}
    return { status: res.status, ok: res.ok && j.ok === true, j, txt };
  } finally {
    clearTimeout(timer);
  }
}

// ไฟล์สะสมแบบเก่า (logs/usage.csv ฯลฯ ก่อน 29/10/69) — ส่งทั้งก้อนแบบเดิมครั้งสุดท้าย แล้วย้ายเก็บ logs/legacy/ (ไม่ลบ)
async function uploadLegacy(log) {
  const files = {};
  for (const f of KINDS) {
    const p = path.join(LOG_DIR, f);
    if (fs.existsSync(p)) { try { files[f] = fs.readFileSync(p, 'utf8'); } catch {} }
  }
  if (!Object.keys(files).length) return true;
  const r = await post({ sentAt: new Date().toISOString(), files });
  log(`[log-upload] legacy -> ${r.status} ${r.txt.slice(0, 100)}`);
  const saved = r.j.saved || [];
  if (!r.ok || !Object.keys(files).every((f) => saved.some((s) => s.endsWith('_' + f)))) return false;
  fs.mkdirSync(LEGACY_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  for (const f of Object.keys(files)) {
    try { fs.renameSync(path.join(LOG_DIR, f), path.join(LEGACY_DIR, `until-${stamp}_${f}`)); } catch {}
  }
  return true;
}

// ส่งก้อนใหม่ของไฟล์เดียว — ตัดก้อนที่ขึ้นบรรทัดใหม่ (ไม่ผ่ากลางตัวอักษรไทย UTF-8)
async function uploadFile(name, state, log) {
  const p = path.join(LOG_DIR, name);
  const size = fs.statSync(p).size;
  let sent = state.sent[name] || 0;
  if (sent > size) sent = 0; // ไฟล์ถูกแทนที่/สั้นลง — ส่งใหม่ทั้งไฟล์ (Apps Script ข้ามส่วนที่มีแล้วให้)
  if (sent === size) return true;
  const fd = fs.openSync(p, 'r');
  try {
    while (sent < size) {
      const buf = Buffer.alloc(Math.min(CHUNK_BYTES, size - sent));
      fs.readSync(fd, buf, 0, buf.length, sent);
      let len = buf.length;
      if (sent + len < size) { const nl = buf.lastIndexOf(0x0a); if (nl >= 0) len = nl + 1; }
      const content = buf.subarray(0, len).toString('utf8');
      const r = await post({ mode: 'append', file: name, content, from: sent, to: sent + len });
      if (!r.ok || r.j.chars !== content.length) {
        log(`[log-upload] ${name} failed -> ${r.status} ${r.txt.slice(0, 100)}`);
        return false; // รอบหน้าส่งต่อจากจุดเดิม
      }
      // ก้อนซ้ำที่คร่อมจุดที่ Drive มีแล้ว (state หาย + มีบรรทัดใหม่) → ถอยไปส่งต่อจาก sentTo ไม่งั้นส่วนเกินหาย
      if (r.j.dup && typeof r.j.sentTo === 'number' && r.j.sentTo > sent && r.j.sentTo < sent + len) sent = r.j.sentTo;
      else sent += len;
      state.sent[name] = sent;
      writeState(state);
    }
    log(`[log-upload] ${name} sent (${machineName()}) up to ${sent} bytes`);
    return true;
  } finally {
    fs.closeSync(fd);
  }
}

let legacyTried = false;
async function uploadLogs(log = console.log) {
  if (!LOG_UPLOAD.url) { log('[log-upload] APPS_SCRIPT url not set - skip'); return false; }
  try {
    // legacy ส่งไม่ผ่าน (ก้อนใหญ่ เน็ตช้า) ห้ามขวางไฟล์รายเดือน · ลองครั้งเดียวต่อการเปิดระบบ (ก้อน 16MB ไม่ยิงซ้ำทุก 30 นาที)
    let legacyOk = true;
    if (!legacyTried) { legacyTried = true; legacyOk = await uploadLegacy(log); }
    const state = readState();
    const names = fs.existsSync(LOG_DIR) ? fs.readdirSync(LOG_DIR).filter((f) => MONTH_FILE_RE.test(f)).sort() : [];
    for (const name of names) {
      if (!(await uploadFile(name, state, log))) return false;
    }
    state.lastAt = Date.now();
    writeState(state);
    return legacyOk;
  } catch (e) {
    log(`[log-upload] failed (best-effort): ${e.message}`);
    return false;
  }
}

module.exports = { uploadLogs };

// รันตรงจาก CLI: RESET-Windows.bat / กู้ระบบ.command เรียก `node scripts/upload-logs.js`
if (require.main === module) {
  uploadLogs().finally(() => process.exit(0));
}
