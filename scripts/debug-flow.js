const { chromium } = require('playwright');
const path = require('path');
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');
const SHOT = (n) => path.join(__dirname, '..', 'auth', n);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();

  await page.goto('https://e-ticket.dnp.go.th/homePage', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // คลิกการ์ดอุทยานเอราวัณ
  await page.locator('text=อุทยานแห่งชาติเอราวัณ').first().click();
  await page.waitForTimeout(3000);
  console.log('URL หลังคลิกการ์ด:', page.url());

  // เปิดปฏิทิน ดูว่าวันไหน enabled
  await page.locator('input[placeholder="เลือกวันเข้าพื้นที่"]').first().click();
  await page.waitForTimeout(900);

  const info = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('.el-picker-panel')).filter((p) => p.offsetParent !== null);
    return panels.map((p) => {
      const labels = Array.from(p.querySelectorAll('.el-date-picker__header-label')).map((e) => e.textContent.trim());
      const avail = Array.from(p.querySelectorAll('td.available:not(.disabled)')).map((td) => ({ cls: td.className, txt: td.textContent.trim() }));
      return { labels, availableCount: avail.length, available: avail.slice(0, 40) };
    });
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: SHOT('shot-flow-cal.png') });
  await browser.close();
})();
