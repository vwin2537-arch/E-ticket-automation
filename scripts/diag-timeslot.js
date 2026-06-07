// diag-timeslot.js — ตรวจรอบเวลาในระบบ DNP แบบอ่านอย่างเดียว (ไม่จอง ไม่กดต่อไป)
// เปิดแท็บ เลือกวันที่ที่ส่งมา แล้ว dump ทุก option ในรอบเวลา: ข้อความ + class + disabled?
// ใช้: node scripts/diag-timeslot.js 2026-06-07
const { warmTab } = require('../src/automation');

(async () => {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  console.log(`Diagnosing time slots for date=${date} ...`);
  let warm;
  try {
    warm = await warmTab(date, { headless: true });
    const page = warm.page;

    // เปิด dropdown เวลา
    const input = page.locator('input[placeholder="เลือกเวลา"]').first();
    await input.click();
    await page.waitForTimeout(1200); // เผื่อ options render เข้า portal ใต้ body

    const dropdowns = await page.locator('.el-select-dropdown').count();
    console.log(`\n.el-select-dropdown wrappers on page: ${dropdowns}`);

    // ค้นทั้งหน้า (Element UI append dropdown ไว้ใต้ body เป็น portal)
    const items = page.locator('.el-select-dropdown__item');
    const n = await items.count();
    console.log(`\nFound ${n} time option(s):`);
    for (let i = 0; i < n; i++) {
      const it = items.nth(i);
      const text = (await it.innerText().catch(() => '')).trim();
      const cls = (await it.getAttribute('class').catch(() => '')) || '';
      const disabled = cls.includes('is-disabled');
      // อ่านโค้ดของแต่ละตัวอักษร dash เพื่อเทียบกับ config (เผื่อเป็น en-dash/nbhyphen)
      const codes = [...text].map((c) => c.charCodeAt(0)).join(' ');
      console.log(`  [${i}] "${text}"  disabled=${disabled}  class="${cls}"`);
      console.log(`       charCodes: ${codes}`);
    }
  } catch (e) {
    console.error('DIAG ERROR:', e.message);
  } finally {
    await warm?.browser.close().catch(() => {});
  }
})();
