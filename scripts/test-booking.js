// test-booking.js — ทดสอบ automation แบบ dryRun (ไม่กดต่อไป ไม่จองจริง)
const { runBooking } = require('../src/automation');

(async () => {
  const params = {
    date: process.argv[2] || '2026-06-01',
    timeSlot: '08:00 - 11:45',
    vehicles: [
      { match: 'รถยนต์ 4 ล้อ', plate: 'กข1234' },
      { match: 'รถจักรยานยนต์', plate: 'ขค5678' },
    ],
    travelers: [
      { match: 'ผู้ใหญ่ชาวไทย', nationality: 'Thai', count: 2 },
      { match: 'ผู้ใหญ่ชาวต่างชาติ', nationality: 'American', count: 1 },
    ],
  };
  try {
    const r = await runBooking(params, { headless: true, dryRun: !process.argv.includes('--go') });
    console.log('\n✅ สำเร็จ! กรอก', r.total, 'คน');
    await r.browser.close();
  } catch (e) {
    console.log('\n❌ ผิดพลาด:', e.message);
    if (e.browser) await e.browser.close();
    process.exit(1);
  }
})();
