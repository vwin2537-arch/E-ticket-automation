// datepicker.js — เลือกวันใน Element UI date picker อย่างถูกวิธี (คลิกปฏิทินจริง)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// pickDate(page, inputPlaceholder, 'YYYY-MM-DD')
async function pickDate(page, placeholder, isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const targetYear = y, targetMonthIdx = m - 1, targetDay = d;

  await page.locator(`input[placeholder="${placeholder}"]`).first().click();

  // panel ที่ visible (ของ date picker ที่เพิ่งเปิด)
  const panel = page.locator('.el-date-picker.el-popper:visible, .el-picker-panel.el-date-picker:visible').first();
  // รอ panel ปฏิทินโผล่จริง (ไปต่อทันทีที่พร้อม เร็วกว่ารอเผื่อเวลา)
  await panel.locator('.el-date-picker__header-label').first().waitFor({ state: 'visible', timeout: 5000 });

  // นำทางเดือน/ปี จนตรงเป้าหมาย (กันลูปไม่เกิน 60 รอบ)
  for (let i = 0; i < 60; i++) {
    const labels = await panel.locator('.el-date-picker__header-label').allInnerTexts();
    if (labels.length < 2) break;
    const curYear = parseInt(labels[0], 10);
    const curMonthIdx = MONTHS.findIndex((mn) => labels[1].trim().startsWith(mn));
    if (curYear === targetYear && curMonthIdx === targetMonthIdx) break;

    const cur = curYear * 12 + curMonthIdx;
    const tgt = targetYear * 12 + targetMonthIdx;
    if (tgt < cur) {
      await panel.locator('button.el-date-picker__prev-btn.el-icon-arrow-left').click();
    } else {
      await panel.locator('button.el-date-picker__next-btn.el-icon-arrow-right').click();
    }
    await page.waitForTimeout(150);
  }

  // หา cell ของวันที่เป้าหมายในเดือนปัจจุบัน (ไม่เอา prev/next month)
  const dayCell = panel.locator('.el-date-table td:not(.prev-month):not(.next-month)', { hasText: new RegExp(`^\\s*${targetDay}\\s*$`) }).first();
  const cls = (await dayCell.getAttribute('class').catch(() => '')) || '';
  if (cls.includes('disabled') || !cls.includes('available')) {
    await page.keyboard.press('Escape').catch(() => {});
    throw new Error(`วันที่ ${isoDate} จองไม่ได้ (ระบบปิดรับ/โควต้าเต็ม/เกิน 7 วัน) — ลองวันอื่นนะคะ`);
  }
  await dayCell.click();
  await page.waitForTimeout(150);
}

module.exports = { pickDate };
