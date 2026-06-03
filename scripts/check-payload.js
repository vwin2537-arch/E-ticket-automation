const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5179', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);

  // จำลองพี่วิน: เพิ่มคันที่ 2 แล้วเปลี่ยนเป็นมอเตอร์ไซค์ ไม่ใส่ทะเบียนทั้งคู่
  await p.locator('#addVeh').click();
  await p.waitForTimeout(200);
  await p.locator('.veh select').nth(1).selectOption('รถจักรยานยนต์');
  await p.waitForTimeout(200);

  const payload = await p.evaluate(() => collectVehicles());
  console.log('หน้ากากส่งยานพาหนะ:', JSON.stringify(payload, null, 2));
  await b.close();
})();
