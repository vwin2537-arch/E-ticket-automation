// test-pipeline.js — ทดสอบ logic "จองดักไว้หลายใบ" (pendingTabs/MAX_PENDING/คืน slot)
// โดย MOCK browser + pool + fillBooking — ไม่ยิง DNP จริง ไม่เปิด browser ไม่เขียน usage.csv
// รัน: node scripts/test-pipeline.js
const http = require('http');
const automation = require('../src/automation');
const pool = require('../src/pool');
const logger = require('../src/logger');

// --- mock: แท็บปลอม ที่เก็บ callback disconnected ไว้ จำลอง จนท.กากบาทปิดหน้าต่างได้ ---
const tabs = [];
function makeTab() {
  let onDisc = null;
  const browser = {
    on: (ev, cb) => { if (ev === 'disconnected') onDisc = cb; },
    close: async () => {},
    fireDisconnect: () => onDisc && onDisc(), // จำลองปิดหน้าต่าง
  };
  const tab = { browser, page: {}, date: '2026-06-03' };
  tabs.push(tab);
  return tab;
}

// patch ก่อน require server (server destructure ตอน require — ต้อง patch ให้ทันก่อน)
pool.init = () => {};                                  // อย่า warm จริง (กันเปิด browser)
pool.acquire = async () => makeTab();                  // คืนแท็บปลอมทันที
automation.fillBooking = async () => ({ ok: true, total: 2 }); // จำลองกรอกสำเร็จ ไม่แตะ DNP
automation.checkLogin = async () => true;
logger.logUsage = () => {};                            // กันเขียน usage.csv จริง

process.env.PORT = '5191';
require('../src/server');

// ยิง POST /api/book หนึ่งครั้ง (รอ response — server เป็น sequential ด้วย running lock)
function book() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      date: '2026-06-03', timeSlot: '08:00',
      vehicles: [{ match: 'รถยนต์', plate: '1กข1234' }],
      travelers: [{ match: 'ผู้ใหญ่', nationality: 'Thai', count: 1 }],
    });
    const req = http.request('http://localhost:5191/api/book',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

const pass = (cond) => cond ? 'PASS ✅' : 'FAIL ❌';

(async () => {
  await new Promise((r) => setTimeout(r, 600)); // รอ server listen

  // 1) จอง 3 ใบติดกัน — ควรสำเร็จหมด (ค้างรอจ่ายพร้อมกันได้ 3)
  const r = [await book(), await book(), await book()];
  console.log('จอง 3 ใบแรก ok:', r.map((x) => x.ok), pass(r.every((x) => x.ok)));

  // 2) ใบที่ 4 — ควรโดน guard เด้ง "ครบ 3 ใบ" (ok:false)
  const fourth = await book();
  console.log('ใบที่ 4 →', JSON.stringify(fourth));
  console.log('  ควร false + ข้อความครบ 3 ใบ:', pass(fourth.ok === false && /3 ใบ/.test(fourth.error || '')));

  // 3) จำลอง จนท.จ่ายเสร็จ กากบาทปิดหน้าต่างใบแรก → ควรคืน slot
  tabs[0].browser.fireDisconnect();
  await new Promise((r) => setTimeout(r, 50));

  // 4) จองใบใหม่ — ควรได้อีกครั้ง (มี slot ว่างแล้ว)
  const fifth = await book();
  console.log('ใบใหม่หลังปิดใบ 1 →', JSON.stringify(fifth));
  console.log('  ควร true (slot ว่างคืนมา):', pass(fifth.ok === true));

  // 5) ใบถัดไป — เต็ม 3 อีก ควรโดน guard เด้งอีก
  const sixth = await book();
  console.log('ใบถัดไป (เต็มอีก) →', pass(sixth.ok === false));

  process.exit(0);
})();
