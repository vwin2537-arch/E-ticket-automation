// login.js — เปิดเบราว์เซอร์ให้พี่วิน login เอง 1 ครั้ง แล้ว save session ไว้ใช้ซ้ำ
const { chromium } = require('playwright');
const path = require('path');

const HOME_URL = 'https://e-ticket.dnp.go.th/homePage';
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\nOpened e-ticket.dnp.go.th — please log in (username / password) in the window that opened.');
  console.log('   (Auto-checking. When the "Logout" menu appears, the session is saved automatically.)\n');

  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });

  // รอจนเจอเมนู "ออกจากระบบ" = login สำเร็จ (poll สูงสุด 5 นาที)
  const deadline = Date.now() + 5 * 60 * 1000;
  let loggedIn = false;
  while (Date.now() < deadline) {
    const found = await page.getByText('ออกจากระบบ').count().catch(() => 0);
    if (found > 0) { loggedIn = true; break; }
    await page.waitForTimeout(2000);
  }

  if (!loggedIn) {
    console.log('Timed out after 5 minutes without detecting login — please run again.');
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: STATE_PATH });
  console.log('\nLogin success! Session saved to auth/storageState.json');
  console.log('   You can close the browser window now.\n');
  await browser.close();
  process.exit(0);
})();
