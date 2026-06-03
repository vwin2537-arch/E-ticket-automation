// test-serverpath.js (ชั่วคราว debug) — เลียนแบบ "หน้ากากกดยืนยัน" เป๊ะ:
// pool.init (warm วันนี้) → acquire (หยิบ warm tab) → fillBooking — ต่างจาก test-warmfill ที่เรียก warmTab ตรงๆ
// เป้า: หา bug ที่เกิดเฉพาะ server/pool path (วันนี้ + warm standby) ที่ test เดิมไม่ครอบ
const pool = require('../src/pool');
const { fillBooking, todayISO } = require('../src/automation');

const params = {
  date: todayISO(),                 // วันนี้ (เหมือนหน้ากาก) — ใช้ warm pool
  timeSlot: '11:45 - 15:30',        // รอบบ่าย (ยังเปิด — ตัดเรื่องรอบเช้าปิด 11:45 ออก)
  vehicles: [{ match: 'รถยนต์ 4 ล้อ', plate: 'กข 1234' }],
  travelers: [{ match: 'ผู้ใหญ่ชาวไทย', nationality: 'Thai', count: 2 }],
};

(async () => {
  console.log(`\n🔍 reproduce server path — วันนี้ ${params.date} รอบ ${params.timeSlot}\n`);
  console.log('1) pool.init — warm pool (เหมือน server start)...');
  pool.init((m) => console.log('   [pool]', m));

  // รอ warm แท็บแรกพร้อม (หรือ error)
  for (let i = 0; i < 60; i++) {
    const s = pool.status();
    if (s.ready >= 1 || s.lastError) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const s = pool.status();
  console.log('   pool status:', JSON.stringify(s));
  if (s.lastError) { console.log('\n❌ warm พังตั้งแต่แรก:', s.lastError); process.exit(1); }

  console.log('\n2) acquire — หยิบ warm tab (เหมือนกดยืนยัน)...');
  const tab = await pool.acquire(params.date, (m) => console.log('   [acq]', m));
  console.log('   ได้ tab date =', tab.date, '| warmedAt =', new Date(tab.warmedAt).toLocaleTimeString());

  console.log('\n3) fillBooking (dryRun) บน warm tab...');
  try {
    const r = await fillBooking(tab.page, params, { dryRun: true, log: (m) => console.log('   [fill]', m) });
    console.log(`\n✅ กรอกได้! ${r.total} คน — แปลว่า server path ก็โอเค (bug อยู่ที่อื่น)`);
  } catch (e) {
    console.log(`\n❌ fillBooking error: ${e.message}`);
    console.log('   → เจอบัค! fillBooking บน warm tab ล้มเหลว (ที่ test-warmfill ไม่เจอเพราะ warmTab สดกว่า)');
  } finally {
    await pool.drain().catch(() => {});
    process.exit(0);
  }
})();
