// inspect-poppers.js — ส่องทุก dropdown popper + ทดลองว่า "ประเภทผู้เดินทาง" ผูกกับสัญชาติไหม
const { chromium } = require('playwright');
const path = require('path');

const FORM_URL = 'https://e-ticket.dnp.go.th/homePage/ticketDetail/493';
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');

function dumpAllPoppers(page) {
  return page.evaluate(() => {
    const lists = Array.from(document.querySelectorAll('.el-select-dropdown__list'));
    return lists.map((ul, i) => {
      const items = Array.from(ul.querySelectorAll('.el-select-dropdown__item'))
        .map((li) => (li.textContent || '').trim()).filter(Boolean);
      return { popperIndex: i, count: items.length, sample: items.slice(0, 8) };
    });
  });
}

async function clickSelect(page, placeholder) {
  await page.locator(`input[placeholder="${placeholder}"]`).first().click();
  await page.waitForTimeout(700);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();
  await page.goto(FORM_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  console.log('\n===== ทุก popper ตอนเริ่ม (ก่อนคลิกอะไร) =====');
  console.log(JSON.stringify(await dumpAllPoppers(page), null, 2));

  // คลิกประเภทยานพาหนะ
  await clickSelect(page, 'เลือกประเภทยานพาหนะ');
  console.log('\n===== หลังคลิก "ประเภทยานพาหนะ" =====');
  console.log(JSON.stringify(await dumpAllPoppers(page), null, 2));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  // ลองเลือกสัญชาติ = Thai ก่อน แล้วดูประเภทผู้เดินทาง
  await clickSelect(page, 'สัญชาติ');
  const thai = page.locator('.el-select-dropdown:visible .el-select-dropdown__item', { hasText: 'Thai' }).first();
  await thai.click().catch((e) => console.log('คลิก Thai ไม่ได้:', e.message));
  await page.waitForTimeout(800);
  console.log('\n>>> เลือกสัญชาติ Thai แล้ว');

  await clickSelect(page, 'ประเภทผู้เดินทาง');
  console.log('\n===== หลังเลือกสัญชาติ Thai แล้วคลิก "ประเภทผู้เดินทาง" =====');
  console.log(JSON.stringify(await dumpAllPoppers(page), null, 2));

  await browser.close();
})();
