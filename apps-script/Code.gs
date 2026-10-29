/**
 * Apps Script — รับ log จากเครื่องด่าน เขียนลง Google Drive folder ของพี่วิน
 * ใช้คู่กับ scripts/upload-logs.js (ฝั่ง Node บนเครื่องด่าน)
 *
 * วิธี deploy ดูที่ apps-script/README-deploy.md
 * สรุปสั้น: วาง 2 ค่าข้างล่าง → Deploy > New deployment > Web app
 *           > Execute as: Me / Who has access: Anyone > Copy Web app URL
 *           > เอา URL ไปวางใน src/config.js (LOG_UPLOAD.url)
 */

// ===== ตั้งค่า 2 ตัวนี้ก่อน deploy =====
const FOLDER_ID = '179_pmAkn1ZWrUr2jiEDwRXBqRxOuaCm4'; // โฟลเดอร์ Erawan-Logs ใน Drive พี่วิน (สร้างให้แล้ว)
const SECRET = 'erawan-log-2569'; // ต้องตรงกับ LOG_UPLOAD.secret ใน src/config.js
// =======================================

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json({ ok: false, error: 'bad secret' });

    const root = DriveApp.getFolderById(FOLDER_ID);
    if (body.mode === 'append') return json(appendLog(root, body)); // แอปมือถือ + PC (ส่งเฉพาะส่วนใหม่)
    const machine = String(body.machine || 'unknown').replace(/[^\w.-]/g, '_');
    const sub = getOrCreateFolder(root, machine); // แยกโฟลเดอร์ตามเครื่องด่าน
    const stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');

    const saved = [];
    const files = body.files || {};
    for (const name in files) {
      const fname = stamp + '_' + name; // เช่น 20260613_211700_usage.csv
      sub.createFile(fname, files[name], 'text/plain');
      saved.push(fname);
    }
    return json({ ok: true, machine: machine, saved: saved });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ส่งเฉพาะบรรทัดใหม่ → ต่อท้ายไฟล์ชื่อเดียวกัน
//   แอปมือถือ (ทุก 30 นาที): mobile-<รหัสเครื่อง>/2026-10-27.csv
//   PC ด่าน (29/10/69, ทุก 30 นาที): <ชื่อเครื่อง>/2026-10_usage.csv · _timing.csv · _server.log (เดือนละไฟล์)
// secret ฝังใน APK (แกะได้) — mode เต็มด้านบนใช้ secret เดียวกันเขียนได้ทุกชื่อเครื่องอยู่แล้ว
// → ที่นี่จำกัดชื่อไฟล์ตามรูปแบบ + ขนาดไม่เกิน 1MB/ครั้ง
// from/to (byte) = ช่วงของไฟล์ในเครื่องที่ก้อนนี้เป็น — จำ to ล่าสุดต่อไฟล์ใน Script Properties
// from < ที่จำไว้ = ก้อนนี้เคยต่อท้ายแล้ว (คำตอบหายกลางทาง client ส่งซ้ำ — เจอบล็อกซ้ำใน log 29/10) → ตอบ ok+sentTo ไม่เขียนซ้ำ
// client เก่าที่ไม่ส่ง from (แอป ≤ v1.5) ทำงานแบบเดิม
const APPEND_FILE_RE = /^(\d{4}-\d{2}-\d{2}\.csv|\d{4}-\d{2}_(usage|timing)\.csv|\d{4}-\d{2}_server\.log)$/;

function appendLog(root, body) {
  const machine = String(body.machine || '');
  const name = String(body.file || '');
  const content = String(body.content || '');
  if (!/^[\w.-]{1,60}$/.test(machine)) return { ok: false, error: 'bad machine' };
  if (!APPEND_FILE_RE.test(name)) return { ok: false, error: 'bad file' };
  if (!content || content.length > 1000000) return { ok: false, error: 'bad size' };
  const hasRange = typeof body.from === 'number' && typeof body.to === 'number';

  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // กันส่งซ้อนแล้วเขียนทับกัน
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'sent:' + machine + '/' + name;
    const stored = Number(props.getProperty(key) || 0);
    if (hasRange && body.from < stored) {
      // sentTo = ต่อท้ายไว้ถึง byte ไหนแล้ว — ก้อนนี้คร่อมจุดนั้น (client ลืมว่าส่งถึงไหน แต่มีบรรทัดใหม่ต่อท้าย)
      // client ต้องส่งใหม่ตั้งแต่ sentTo ไม่งั้นส่วนเกินหายเงียบ
      return { ok: true, machine: machine, file: name, chars: content.length, dup: true, sentTo: stored };
    }
    const sub = getOrCreateFolder(root, machine);
    const it = sub.getFilesByName(name);
    if (it.hasNext()) {
      const f = it.next();
      f.setContent(f.getBlob().getDataAsString('UTF-8') + content);
    } else {
      sub.createFile(name, content, /\.csv$/.test(name) ? MimeType.CSV : MimeType.PLAIN_TEXT);
    }
    if (hasRange) props.setProperty(key, String(body.to));
    return { ok: true, machine: machine, file: name, chars: content.length };
  } finally {
    lock.releaseLock();
  }
}

// หาโฟลเดอร์ย่อยตามชื่อเครื่อง ถ้าไม่มีก็สร้าง
function getOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
