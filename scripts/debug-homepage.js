const { chromium } = require('playwright');
const path = require('path');
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');
const SHOT = (n) => path.join(__dirname, '..', 'auth', n);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();

  await page.goto('https://e-ticket.dnp.go.th/homePage', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SHOT('shot-home.png'), fullPage: true });

  // ดู link/การ์ด ที่มีคำว่า เอราวัณ
  const found = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('a, button, [class*=card], [class*=item], div'));
    return all
      .map((el) => ({ tag: el.tagName, href: el.getAttribute('href'), txt: (el.textContent || '').trim().slice(0, 40) }))
      .filter((e) => /เอราวัณ|493/.test(e.txt) || (e.href && /493|ticket/.test(e.href)))
      .slice(0, 15);
  });
  console.log('เจอที่เกี่ยวกับเอราวัณ/493:', JSON.stringify(found, null, 2));
  console.log('URL ปัจจุบัน:', page.url());
  console.log('📸 shot-home.png');
  await browser.close();
})();
