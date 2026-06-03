const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 700, height: 1300 } });
  await p.goto('http://localhost:5179', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);

  // เพิ่มคันที่ 2 = มอเตอร์ไซค์
  await p.locator('#addVeh').click();
  await p.waitForTimeout(300);
  await p.locator('.veh select').nth(1).selectOption('รถจักรยานยนต์');

  // ใส่คน: ผู้ใหญ่ไทย 3, ผู้ใหญ่ต่างชาติ 3
  const inputs = p.locator('.trav input[type=number]');
  await inputs.nth(0).fill('3'); await inputs.nth(0).dispatchEvent('input');
  await inputs.nth(2).fill('3'); await inputs.nth(2).dispatchEvent('input');
  await p.waitForTimeout(400);

  await p.screenshot({ path: path.join(__dirname, '..', 'auth', 'shot-ui.png'), fullPage: true });
  console.log('คน:', await p.locator('#cntPeople').textContent());
  console.log('ยอดรวม:', await p.locator('#sum').textContent(),
    'บาท (คาดหวัง 3×60 + 3×300 + รถ30 + มอไซค์20 = 1130)');
  await b.close();
})();
