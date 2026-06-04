// test-window-close.js — พิสูจน์ว่า browser.isConnected() ตรวจจับ "ปิดหน้าต่าง" ได้จริงไหม
// เลียนแบบวิธีเปิด browser ของ warmTab (headful + flags เดียวกัน) แต่เปิดหน้าเปล่า ไม่แตะ DNP
// เทียบ 2 สัญญาณ: (A) browser.isConnected() แบบ poll (วิธีปัจจุบันใน prunePending)
//                  (B) page 'close' event + browser 'disconnected' event (วิธีที่เสนอแก้)
const { chromium } = require('playwright');

function launchLikeWarm() {
  return chromium.launch({
    headless: false,
    args: [
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
    ],
  });
}

(async () => {
  const browser = await launchLikeWarm();
  const context = await browser.newContext({ viewport: { width: 600, height: 400 } });
  const page = await context.newPage();
  await page.goto('about:blank');

  let pageCloseFired = false;
  let browserDisconnectedFired = false;
  page.once('close', () => { pageCloseFired = true; console.log('[event] page "close" fired'); });
  browser.once('disconnected', () => { browserDisconnectedFired = true; console.log('[event] browser "disconnected" fired'); });

  console.log('start: isConnected =', browser.isConnected());

  // จำลอง "เจ้าหน้าที่ปิดหน้าต่าง" = ปิด page (tab สุดท้ายของ browser นี้)
  console.log('--> simulating user closing the window (page.close)...');
  await page.close({ runBeforeUnload: false });

  // วัดสัญญาณทันที + หลังหน่วง (browser process อาจใช้เวลาสักครู่กว่าจะ exit)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let elapsed = 0;
  for (const at of [0, 300, 1000, 2500]) {
    await sleep(at - elapsed);
    elapsed = at;
    console.log(
      `t+${at}ms: isConnected=${browser.isConnected()}  page.isClosed()=${page.isClosed()}  pageClose=${pageCloseFired}`
    );
  }

  console.log('\nVERDICT:');
  console.log('  OLD prunePending (isConnected) detects close? ->', browser.isConnected() === false);
  console.log('  FIX page.isClosed() detects close?            ->', page.isClosed() === true);

  await browser.close().catch(() => {});
  process.exit(0);
})();
