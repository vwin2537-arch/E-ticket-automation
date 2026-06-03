// inspect-afterdate.js — เลือกวันด้วยปฏิทินจริง แล้วดูตัวเลือกที่โหลดตามมา
const { chromium } = require('playwright');
const path = require('path');
const { pickDate } = require('../src/datepicker');

const FORM_URL = 'https://e-ticket.dnp.go.th/homePage/ticketDetail/493';
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');
const SHOT = (n) => path.join(__dirname, '..', 'auth', n);
const TEST_DATE = '2026-06-01';

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
  await page.goto(FORM_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  await pickDate(page, 'เลือกวันเข้าพื้นที่', TEST_DATE);
  await page.waitForTimeout(2500);

  const dateVal = await page.locator('input[placeholder="เลือกวันเข้าพื้นที่"]').first().inputValue().catch(() => '');
  console.log('ค่าในช่องวันที่:', JSON.stringify(dateVal));

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
  await page.screenshot({ path: SHOT('shot-afterdate.png'), fullPage: true });
  console.log('\n📸 shot-afterdate.png');

  await browser.close();
})();
