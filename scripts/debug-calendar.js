const { chromium } = require('playwright');
const path = require('path');
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');
const FORM_URL = 'https://e-ticket.dnp.go.th/homePage/ticketDetail/493';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  await page.goto(FORM_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  await page.locator('input[placeholder="เลือกวันเข้าพื้นที่"]').first().click();
  await page.waitForTimeout(800);

  const info = await page.evaluate(() => {
    // หา panel ที่ visible
    const panels = Array.from(document.querySelectorAll('.el-picker-panel'))
      .filter((p) => p.offsetParent !== null);
    return panels.map((p) => {
      const labels = Array.from(p.querySelectorAll('.el-date-picker__header-label')).map((e) => e.textContent.trim());
      const cells = Array.from(p.querySelectorAll('td')).map((td) => ({
        cls: td.className, txt: (td.textContent || '').trim(),
      })).filter((c) => c.txt);
      return { labels, sampleCells: cells.slice(0, 50) };
    });
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
