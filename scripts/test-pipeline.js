// test-pipeline.js — เทส #5 pipeline จองดักหลายใบ (prune / เพดาน / ไม่ปิดใบเก่า)
// MOCK pool.acquire + fillBooking + logger — ไม่ยิง DNP จริง ไม่เปิด browser ไม่เขียน usage.csv
// design ปัจจุบัน: prune ใช้ page.isClosed() เป็นหลัก (จนท.ปิดหน้าต่าง = จ่ายเสร็จ → หลุดคิวเอง)
// ⚠️ สำคัญ: ปิดหน้าต่างจริงทำให้ page.isClosed()→true แต่ browser.isConnected() ยังค้าง true
//    (Playwright launch() ถือ connection ไว้ — พิสูจน์ใน scripts/test-window-close.js)
//    mock ข้างล่างจึงแยก windowClosed (ปิดหน้าต่าง) ออกจาก browserDead (browser ตายจริง/crash)
// รัน: node scripts/test-pipeline.js
const http = require('http');
const automation = require('../src/automation');
const pool = require('../src/pool');
const logger = require('../src/logger');

// --- mock: แท็บปลอม จำลอง จนท.ปิดหน้าต่าง (windowClosed) แยกจาก browser ตาย (browserDead) + spy ว่าโดน close ไหม ---
const tabs = [];
function makeTab(label) {
  const tab = {
    label, windowClosed: false, browserDead: false, closed: false,
    browser: {
      // ปิดหน้าต่างไม่ทำให้ isConnected เป็น false — เป็น false เฉพาะตอน browser ตายจริง
      isConnected: () => !tab.browserDead,
      close: async () => { tab.closed = true; tab.browserDead = true; },
    },
    // ปิดหน้าต่าง = page ปิดทันที (สัญญาณจริงที่ prune ควรเช็ก)
    page: { isClosed: () => tab.windowClosed || tab.browserDead },
    date: '2099-01-01',
  };
  tabs.push(tab);
  return tab;
}

// patch ก่อน require server (server destructure fillBooking/checkLogin ตอน require — ต้องทันก่อน)
pool.init = () => {};                                  // อย่า warm จริง (กันเปิด browser)
pool.acquire = async () => makeTab(`tab#${tabs.length + 1}`);
automation.fillBooking = async () => ({ ok: true, total: 2 }); // จำลองกรอกสำเร็จ ไม่แตะ DNP
automation.checkLogin = async () => true;
logger.logUsage = () => {};                            // กันเขียน usage.csv จริง

process.env.PORT = '5188';
require('../src/server');

function book(dryRun = false) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      date: '2099-01-01', timeSlot: '08:00', dryRun,
      vehicles: [{ match: 'รถยนต์', plate: '1กข1234' }],
      travelers: [{ match: 'ผู้ใหญ่', nationality: 'Thai', count: 1 }],
    });
    const req = http.request('http://localhost:5188/api/book',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}
function poolStatus() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:5188/api/pool-status',
      (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve(JSON.parse(d))); })
      .on('error', reject);
  });
}

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}  ${extra}`); fail++; }
};

(async () => {
  await new Promise((r) => setTimeout(r, 600)); // รอ server listen

  console.log('\n[1] จองใบจริง 3 ใบติด — ดักเข้าคิว ไม่ปิดใบเก่า');
  const r1 = await book(), r2 = await book(), r3 = await book();
  check('ใบ 1-3 สำเร็จ', r1.ok && r2.ok && r3.ok, JSON.stringify([r1.ok, r2.ok, r3.ok]));
  const realTabs = tabs.slice(0, 3);
  check('ใบจริง 3 ใบไม่มีใบไหนโดนปิด (กันเงินหาย)', realTabs.every((t) => !t.closed),
    realTabs.map((t) => t.closed).join(','));
  let st = await poolStatus();
  check('pool-status pending = 3', st.pending === 3, `got ${st.pending}`);
  check('pool-status maxPending = 3', st.maxPending === 3, `got ${st.maxPending}`);

  console.log('\n[2] เพดานเต็ม — ใบที่ 4 ต้องโดนเตือน (ไม่ acquire ไม่ปิดอะไร)');
  const tabsBefore = tabs.length;
  const r4 = await book();
  check('ใบ 4 ถูกปฏิเสธ (ok:false)', !r4.ok, JSON.stringify(r4));
  check('error บอกว่าครบ 3 ใบ', /ครบ 3 ใบ/.test(r4.error || ''), r4.error);
  check('ไม่ acquire แท็บใหม่ (ไม่เปลือง)', tabs.length === tabsBefore, `${tabsBefore}→${tabs.length}`);
  check('ใบจริงเดิม 3 ใบยังไม่โดนปิด', realTabs.every((t) => !t.closed));

  console.log('\n[3] prune — จนท.ปิดหน้าต่างใบที่จ่ายเสร็จ → หลุดคิวเอง');
  // จำลองจริง: ปิดหน้าต่าง = page ปิด แต่ browser ยัง connected (ดักบั๊กที่เคยพึ่ง isConnected อย่างเดียว)
  realTabs[0].windowClosed = true;
  check('(sanity) ปิดหน้าต่างแล้ว browser ยัง isConnected=true', realTabs[0].browser.isConnected() === true);
  st = await poolStatus();
  check('pending ลดเหลือ 2 อัตโนมัติ', st.pending === 2, `got ${st.pending}`);
  check('browser ใบที่ปิดถูก close() ด้วย (กัน orphan ค้าง Dock)', realTabs[0].closed === true,
    `closed=${realTabs[0].closed}`);

  console.log('\n[4] มีที่ว่างแล้ว — จองใบใหม่ได้อีก');
  const r5 = await book();
  check('ใบใหม่สำเร็จ', r5.ok, JSON.stringify(r5));
  st = await poolStatus();
  check('pending กลับเป็น 3', st.pending === 3, `got ${st.pending}`);

  console.log('\n[5] dryRun ไม่เข้าคิว pending + ไม่กระทบใบจริง');
  const rd1 = await book(true);
  check('dryRun ใบ 1 สำเร็จ', rd1.ok, JSON.stringify(rd1));
  const dry1 = tabs[tabs.length - 1]; // แท็บ dryRun ใบแรก
  st = await poolStatus();
  check('pending ยังเป็น 3 (dryRun ไม่นับ)', st.pending === 3, `got ${st.pending}`);
  const rd2 = await book(true);
  check('dryRun ใบ 2 สำเร็จ', rd2.ok);
  check('ใบ dryRun เก่าโดนปิด (ไม่สะสม)', dry1.closed, `closed=${dry1.closed}`);
  // ใบจริงที่ยังอยู่ในคิว = index 1,2 (tab#2,#3) + index 3 (tab#4 ใบใหม่จาก [4]) — ห้ามโดนปิดจาก dryRun
  check('ใบจริงในคิวยังไม่โดนปิดจาก dryRun', tabs.slice(1, 4).every((t) => !t.closed),
    tabs.slice(1, 4).map((t) => `${t.label}:${t.closed}`).join(' '));

  console.log(`\n=== ${pass} ผ่าน / ${fail} ไม่ผ่าน ===`);
  process.exit(fail === 0 ? 0 : 1);
})();
