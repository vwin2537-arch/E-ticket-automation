// filelog.js — tee console output ลงไฟล์ logs/server.log (รวม error/crash) เพื่อส่งให้พี่วินดูบัคทางไกล
// ที่มา: console.log/error เดิมหายไปกับหน้าต่างดำตอนปิด — ติดตามบัคไม่ได้ถ้าไม่ได้นั่งหน้าเครื่อง
// คู่กับ usage.csv (log การจอง) → server.log = log การทำงาน/crash ของ server
// install() เรียกครั้งเดียวตอน server start (ก่อน log แรก) — โชว์บนจอเหมือนเดิม + ต่อท้ายไฟล์ไปด้วย
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const SERVER_LOG = path.join(LOG_DIR, 'server.log');

// วันเวลาท้องถิ่น YYYY-MM-DD HH:mm:ss (ฟอร์แมตเดียวกับ logger.js)
function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fmtArg(a) {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.stack || a.message;
  try { return JSON.stringify(a); } catch { return String(a); }
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

  const orig = { log: console.log.bind(console), error: console.error.bind(console) };
  const write = (level, args) => {
    try { fs.appendFileSync(SERVER_LOG, `[${ts()}] ${level} ${args.map(fmtArg).join(' ')}\n`); } catch {}
  };
  console.log = (...a) => { orig.log(...a); write('INFO ', a); };
  console.error = (...a) => { orig.error(...a); write('ERROR', a); };

  // ดัก crash ที่ไม่ได้ catch — นี่คือบัคที่ทำให้ระบบ "เออเรอเงียบ" ที่พี่วินอยากเห็นที่สุด
  // log ก่อนแล้ว exit(1) → .bat เห็น errorlevel ค้างจอให้อ่าน + RESET.bat กวาด orphan ทีหลัง
  const onCrash = (kind) => (err) => {
    write('CRASH', [kind, err?.stack || String(err)]);
    orig.error(`\n[CRASH:${kind}]`, err);
    process.exit(1);
  };
  process.on('uncaughtException', onCrash('uncaughtException'));
  process.on('unhandledRejection', onCrash('unhandledRejection'));
}

module.exports = { install, SERVER_LOG };
