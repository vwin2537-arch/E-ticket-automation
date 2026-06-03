// inspect-dropdowns.js — คลิกเปิด dropdown แต่ละตัวเพื่อดูตัวเลือกจริง
const { chromium } = require('playwright');
const path = require('path');

const FORM_URL = 'https://e-ticket.dnp.go.th/homePage/ticketDetail/493';
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');

async function openAndDump(page, placeholder) {
  // คลิกที่ input ของ el-select ตาม placeholder เพื่อเปิด dropdown
  const input = page.locator(`input[placeholder="${placeholder}"]`).first();
  await input.click();
  await page.waitForTimeout(800);
  // อ่าน item ที่ visible อยู่ใน dropdown ที่เพิ่งเปิด
  const items = await page.evaluate(() => {
    const dropdowns = Array.from(document.querySelectorAll('.el-select-dropdown'))
      .filter((d) => d.style.display !== 'none' && d.offsetParent !== null);
    const result = [];
    dropdowns.forEach((d) => {
      d.querySelectorAll('.el-select-dropdown__item').forEach((li) => {
        const t = (li.textContent || '').trim();
        if (t) result.push(t);
      });
    });
    return result;
  });
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  return items;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();
  await page.goto(FORM_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const vehicle = await openAndDump(page, 'เลือกประเภทยานพาหนะ');
  console.log('\n===== ประเภทยานพาหนะ =====');
  console.log(JSON.stringify(vehicle, null, 2));

  const travelerType = await openAndDump(page, 'ประเภทผู้เดินทาง');
  console.log('\n===== ประเภทผู้เดินทาง =====');
  console.log(JSON.stringify(travelerType, null, 2));

  const time = await openAndDump(page, 'เลือกเวลา');
  console.log('\n===== เลือกเวลา =====');
  console.log(JSON.stringify(time, null, 2));

  // สัญชาติ: dump เฉพาะ 15 ตัวแรก (เยอะมาก)
  const nat = await openAndDump(page, 'สัญชาติ');
  console.log('\n===== สัญชาติ (15 ตัวแรก จากทั้งหมด ' + nat.length + ') =====');
  console.log(JSON.stringify(nat.slice(0, 15), null, 2));

  await browser.close();
})();
