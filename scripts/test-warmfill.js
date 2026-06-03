// test-warmfill.js (ชั่วคราว) — เทสแยกเฟส warmTab (อุ่นเครื่อง) + fillBooking (กรอกจริง)
// จับเวลาแต่ละเฟส เพื่อดูว่า "เวลาที่ จนท.ต้องรอจริง" (Phase B) สั้นกว่า total เดิมแค่ไหน
// ใช้พรุ่งนี้เป็นวันจอง (วันนี้เลย cutoff 15:30 แล้ว) — dryRun ไม่กดต่อไป ไม่จ่าย
const { warmTab, fillBooking } = require('../src/automation');

const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); })();

const params = {
  date: tomorrow,
  timeSlot: '08:00 - 11:45',
  vehicles: [{ match: 'รถยนต์ 4 ล้อ', plate: 'กข 1234' }],
  travelers: [{ match: 'ผู้ใหญ่ชาวไทย', nationality: 'Thai', count: 2 }],
};

(async () => {
  console.log(`\n🎟️  เทส warm+fill วันจอง ${tomorrow} (dryRun)\n`);
  const tA = Date.now();
  const warm = await warmTab(params.date, { log: (m) => console.log('  [warm]', m) });
  const phaseA = ((Date.now() - tA) / 1000).toFixed(1);
  console.log(`\n⏱️  Phase A (อุ่นเครื่อง: เปิด→การ์ด→เลือกวัน) = ${phaseA} วิ\n`);

  const tB = Date.now();
  try {
    const r = await fillBooking(warm.page, params, { dryRun: true, log: (m) => console.log('  [fill]', m) });
    const phaseB = ((Date.now() - tB) / 1000).toFixed(1);
    console.log(`\n⏱️  Phase B (กรอกจริง: เวลา/รถ/คน — จนท.รอแค่นี้) = ${phaseB} วิ`);
    console.log(`⏱️  รวม = ${((Date.now() - tA) / 1000).toFixed(1)} วิ | ผล: ${r.total} คน, ภาพ ${r.screenshot}`);
    console.log(`\n✅ ผ่าน — pool จะทำ Phase A ล่วงหน้า เหลือให้ จนท.รอแค่ Phase B (~${phaseB} วิ)\n`);
  } catch (e) {
    console.log(`\n❌ fillBooking error: ${e.message}\n`);
  } finally {
    await warm.browser.close().catch(() => {});
  }
  process.exit(0);
})();
