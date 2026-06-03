// debug-vehicle.js — รัน scenario พี่วิน (1 คัน default + คนไทย 1) ซ้ำหลายรอบ ดู flaky
const { runBooking } = require('../src/automation');

const params = {
  date: '2026-06-02',
  timeSlot: '08:00 - 11:45',
  vehicles: [{ match: 'รถยนต์ 4 ล้อ', plate: '-' }],
  travelers: [{ match: 'ผู้ใหญ่ชาวไทย', nationality: 'Thai', count: 1 }],
};

(async () => {
  for (let round = 1; round <= 3; round++) {
    try {
      const r = await runBooking(params, { headless: true, dryRun: true, log: () => {} });
      const veh = await r.page.locator('input[placeholder="เลือกประเภทยานพาหนะ"]').first().inputValue();
      const time = await r.page.locator('input[placeholder="เลือกเวลา"]').first().inputValue();
      const flag = veh.includes('รถยนต์ 4 ล้อ') ? '✅' : '❌ เพี้ยน!';
      console.log(`รอบ ${round}: ยานพาหนะ="${veh}" | เวลา="${time}" ${flag}`);
      await r.browser.close();
    } catch (e) {
      console.log(`รอบ ${round}: ❌ ERROR ${e.message}`);
      if (e.browser) await e.browser.close();
    }
  }
})();
