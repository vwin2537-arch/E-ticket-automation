// upload-logs.js — ส่ง log ขึ้น Google Drive ผ่าน Apps Script web app
// เรียกจาก: server.js (/api/shutdown เมื่อกดปุ่มปิดในหน้ากาก) + RESET-Windows.bat (กู้ระบบ)
// best-effort: ส่งไม่ได้ (เน็ตล่ม / ยังไม่ตั้ง url) ก็ไม่ throw — ปิด/กู้ระบบต่อได้ ไม่ค้าง
// Drive จะแยกโฟลเดอร์ตามชื่อเครื่อง (os.hostname) → รองรับหลายด่าน ไฟล์ไม่ปนกัน
const fs = require('fs');
const os = require('os');
const path = require('path');
const { LOG_UPLOAD } = require('../src/config');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const FILES = ['usage.csv', 'server.log', 'timing.csv']; // log การจอง + การทำงาน/crash + จับเวลา step
const TIMEOUT_MS = 10000;

async function uploadLogs(log = console.log) {
  if (!LOG_UPLOAD.url) { log('[log-upload] APPS_SCRIPT url not set - skip'); return false; }

  const machine = (os.hostname() || 'unknown').replace(/[^\w.-]/g, '_');
  const files = {};
  for (const f of FILES) {
    const p = path.join(LOG_DIR, f);
    if (fs.existsSync(p)) { try { files[f] = fs.readFileSync(p, 'utf8'); } catch {} }
  }
  if (!Object.keys(files).length) { log('[log-upload] no log files yet - skip'); return false; }

  const payload = { secret: LOG_UPLOAD.secret, machine, sentAt: new Date().toISOString(), files };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(LOG_UPLOAD.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const txt = (await res.text()).slice(0, 100);
    log(`[log-upload] sent (${machine}) -> ${res.status} ${txt}`);
    return res.ok;
  } catch (e) {
    log(`[log-upload] failed (best-effort): ${e.message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { uploadLogs };

// รันตรงจาก CLI: RESET-Windows.bat / กู้ระบบ.command เรียก `node scripts/upload-logs.js`
if (require.main === module) {
  uploadLogs().finally(() => process.exit(0));
}
