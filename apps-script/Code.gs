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
    if (body.mode === 'append') return json(appendLog(root, body)); // แอปมือถือ (dnp-eticket-mobile)
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

// แอปมือถือ: ส่งเฉพาะบรรทัดใหม่ทุก 30 นาที → ต่อท้ายไฟล์วันเดียวกัน (mobile-<รหัสเครื่อง>/2026-10-27.csv)
// secret ฝังใน APK (แกะได้) → จำกัดให้เขียนได้แค่โฟลเดอร์ mobile-* + ชื่อไฟล์วันที่ + ขนาดไม่เกิน 1MB
function appendLog(root, body) {
  const machine = String(body.machine || '');
  const name = String(body.file || '');
  const content = String(body.content || '');
  if (!/^mobile-[A-Za-z0-9-]{1,40}$/.test(machine)) return { ok: false, error: 'bad machine' };
  if (!/^\d{4}-\d{2}-\d{2}\.csv$/.test(name)) return { ok: false, error: 'bad file' };
  if (!content || content.length > 1000000) return { ok: false, error: 'bad size' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // กันส่งซ้อนแล้วเขียนทับกัน
  try {
    const sub = getOrCreateFolder(root, machine);
    const it = sub.getFilesByName(name);
    if (it.hasNext()) {
      const f = it.next();
      f.setContent(f.getBlob().getDataAsString('UTF-8') + content);
    } else {
      sub.createFile(name, content, MimeType.CSV);
    }
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
