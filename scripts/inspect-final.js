// inspect-final.js — flow เต็ม: คลิกการ์ด → เลือกวัน available → dump ทุก dropdown
const { chromium } = require('playwright');
const path = require('path');
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');
const SHOT = (n) => path.join(__dirname, '..', 'auth', n);

function dumpOpenPopper(page) {
  return page.evaluate(() => {
    const dds = Array.from(document.querySelectorAll('.el-select-dropdown'))
      .filter((d) => d.style.display !== 'none' && d.offsetParent !== null);
    const out = [];
    dds.forEach((d) => d.querySelectorAll('.el-select-dropdown__item').forEach((li) => {
      const t = (li.textContent || '').trim(); if (t) out.push(t);
    }));
    return out;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();

  await page.goto('https://e-ticket.dnp.go.th/homePage', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.locator('text=อุทยานแห่งชาติเอราวัณ').first().click();
  await page.waitForTimeout(3000);

  // เปิดปฏิทิน เลือกวัน available ตัวแรกในตาราง (ไม่ใช่ปี)
  await page.locator('input[placeholder="เลือกวันเข้าพื้นที่"]').first().click();
  await page.waitForTimeout(800);
  const dayCell = page.locator('.el-date-table td.available:not(.disabled)').first();
  const dayTxt = (await dayCell.textContent().catch(() => '?')).trim();
  await dayCell.click();
  await page.waitForTimeout(2500);
  console.log('เลือกวันที่:', dayTxt);
  const dateVal = await page.locator('input[placeholder="เลือกวันเข้าพื้นที่"]').first().inputValue().catch(() => '');
  console.log('ค่าในช่อง:', JSON.stringify(dateVal));

  await page.locator('input[placeholder="เลือกเวลา"]').first().click();
  await page.waitForTimeout(900);
  console.log('\n===== เลือกเวลา =====', JSON.stringify(await dumpOpenPopper(page)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  await page.locator('input[placeholder="เลือกประเภทยานพาหนะ"]').first().click();
  await page.waitForTimeout(900);
  console.log('\n===== ประเภทยานพาหนะ =====', JSON.stringify(await dumpOpenPopper(page)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  await page.locator('input[placeholder="ประเภทผู้เดินทาง"]').first().click();
  await page.waitForTimeout(900);
  console.log('\n===== ประเภทผู้เดินทาง =====', JSON.stringify(await dumpOpenPopper(page)));
  await page.screenshot({ path: SHOT('shot-final.png'), fullPage: true });

  await browser.close();
})();
