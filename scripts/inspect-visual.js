// inspect-visual.js — ดัก API + ถ่ายภาพตอนเปิด dropdown จริง
const { chromium } = require('playwright');
const path = require('path');

const FORM_URL = 'https://e-ticket.dnp.go.th/homePage/ticketDetail/493';
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');
const SHOT = (n) => path.join(__dirname, '..', 'auth', n);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();

  // ดักจับ JSON response ที่อาจมี options
  page.on('response', async (res) => {
    const ct = res.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      const body = await res.text();
      if (/บาท|ผู้เดินทาง|adult|child|ผู้ใหญ่|เด็ก|รถ|ราคา|price|vehicle|traveler/i.test(body)) {
        console.log('\n🌐 API:', res.url());
        console.log('   body (500 ตัวอักษรแรก):', body.slice(0, 500));
      }
    } catch (e) {}
  });

  await page.goto(FORM_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // คลิกประเภทผู้เดินทาง + ถ่ายภาพ
  await page.locator('input[placeholder="ประเภทผู้เดินทาง"]').first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SHOT('shot-traveler.png'), fullPage: true });
  console.log('\n📸 shot-traveler.png');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // คลิกประเภทยานพาหนะ + ถ่ายภาพ
  await page.locator('input[placeholder="เลือกประเภทยานพาหนะ"]').first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SHOT('shot-vehicle.png'), fullPage: true });
  console.log('📸 shot-vehicle.png');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // คลิกเวลา + ถ่ายภาพ
  await page.locator('input[placeholder="เลือกเวลา"]').first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SHOT('shot-time.png'), fullPage: true });
  console.log('📸 shot-time.png');

  await browser.close();
})();
