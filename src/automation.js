// automation.js — กรอกฟอร์มจอง DNP แทนเรา หยุดที่หน้าสรุปก่อนจ่ายเงิน
const { chromium } = require('playwright');
const path = require('path');
const { PARK, VEHICLE_TYPES, TRAVELER_TYPES, TIME_SLOTS, SLOT_CLOSE_BUFFER_MIN } = require('./config');
const { pickDate } = require('./datepicker');
const { thaiNames, interNames } = require('./names');

const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');
const SHOT = (n) => path.join(__dirname, '..', 'auth', n);

// แปลงชื่อไทย -> อังกฤษ สำหรับโชว์ใน console (Windows cmd วาดไทยไม่ได้) — ไม่เจอก็คืนค่าเดิม
const enVehicle = (m) => VEHICLE_TYPES.find((x) => x.match === m)?.en || m;
const enTraveler = (m) => TRAVELER_TYPES.find((x) => x.match === m)?.en || m;

// เลือก option ใน el-select (Element UI) ตัวที่ index — คลิกเปิด คลิกตัวเลือก
// แล้ว verify ค่าที่เลือก ถ้ายังไม่โหลด/ผิด จะลองใหม่ (กัน race condition ตอน options โหลดช้า)
async function selectOption(page, placeholder, index, matchText, { exact = false } = {}) {
  const input = page.locator(`input[placeholder="${placeholder}"]`).nth(index);
  const matcher = exact ? new RegExp(`^\\s*${matchText}\\s*$`) : matchText;

  for (let attempt = 0; attempt < 3; attempt++) {
    await input.scrollIntoViewIfNeeded();
    await input.click();
    const popper = page.locator('.el-select-dropdown:visible').last();
    // รอ dropdown โผล่จริง แทนการรอเผื่อเวลา (ไปต่อทันทีที่ตัวเลือกพร้อม)
    await popper.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    const item = popper.locator('.el-select-dropdown__item', { hasText: matcher }).first();
    try {
      await item.scrollIntoViewIfNeeded({ timeout: 3000 });
      await item.click({ timeout: 3000 });
    } catch (e) {
      // ตัวเลือกยังไม่โหลด — ปิด dropdown รอแล้วลองใหม่
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(900);
      continue;
    }
    // รอจนค่าที่เลือกโชว์ในช่องจริง (poll แทนรอเวลาตายตัว 200+600) — ผ่านทันทีที่ Vue commit
    // เน็ตไว = ~50-150ms, เน็ตช้า = รอสูงสุด ~1 วิ/รอบ แล้วค่อยลองเปิด dropdown ใหม่
    let ok = false;
    for (let i = 0; i < 20; i++) {
      const val = (await input.inputValue().catch(() => '')).trim();
      if (val && (exact ? val === matchText : val.includes(matchText))) { ok = true; break; }
      await page.waitForTimeout(50);
    }
    if (ok) return;
  }
  throw new Error(`เลือก "${matchText}" ไม่สำเร็จ (ลอง 3 ครั้งแล้ว) — ระบบอาจช้า ลองกดใหม่นะคะ`);
}

// ซุกหน้าต่างเล็กๆ มุมล่างขวาตอนกรอก — render ยังทำงาน (ไม่ minimize) เลยเร็ว + รบกวนสายตาน้อย
// (minimize ทำให้ Chrome throttle ช้า 5 เท่า / ดันนอกจอ Mac ดึงกลับ — เลยใช้ "เล็ก+มุม" แทน)
async function tuckWindow(page) {
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: 1180, top: 720, width: 380, height: 260 } });
  } catch (e) {
    // best-effort — ถ้าย้ายไม่ได้ หน้าต่างยังโผล่ปกติแต่ระบบทำงานต่อได้
  }
}

// เด้งหน้าต่างที่ย่อไว้กลับขึ้นมาให้พี่วินเห็น + โฟกัส — ใช้ CDP (cross-platform)
async function revealWindow(page) {
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { left: 60, top: 40, width: 1400, height: 1000, windowState: 'normal' },
    });
    await page.bringToFront();
  } catch (e) {
    // best-effort — ถ้าดึงไม่ได้ หน้าต่างยังย่ออยู่แต่ระบบยังทำงานต่อได้
  }
}

// แปลงวันที่ "วันนี้" ตามเวลาท้องถิ่นเป็น YYYY-MM-DD (กัน timezone เพี้ยนช่วงเช้ามืด)
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// วันเป้าหมายที่ควรจอง/อุ่น pool — ฉลาดตามเวลา:
//  - ก่อน cutoff (เวลาสิ้นสุดรอบสุดท้าย − buffer = 15:20) → "วันนี้"
//  - เลย cutoff (วันนี้ปิดรับแล้ว) → "พรุ่งนี้" (นทท.ช่วง 15:20–เที่ยงคืน จองของพรุ่งนี้)
//  - เลยเที่ยงคืน วันใหม่เริ่ม → กลับมาเป็น "วันนี้" อัตโนมัติ
function bookDate() {
  const last = TIME_SLOTS[TIME_SLOTS.length - 1];           // รอบสุดท้าย เช่น '11:45 - 15:30'
  const [h, m] = last.split('-').pop().trim().split(':').map(Number);
  const cutoffMin = h * 60 + m - SLOT_CLOSE_BUFFER_MIN;     // 15:30 − 10 = 15:20
  const now = new Date();
  const d = new Date();
  if (now.getHours() * 60 + now.getMinutes() >= cutoffMin) d.setDate(d.getDate() + 1);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// เปิด chromium + flags กัน throttle, Windows ดันนอกจอ (ซ่อนสนิท) — ดู note บน tuckWindow
function launchBrowser(headless = false) {
  const isWin = process.platform === 'win32';
  return chromium.launch({
    headless,
    args: headless ? [] : [
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      ...(isWin ? ['--window-position=-32000,-32000'] : []),
    ],
  });
}

/**
 * warmTab(date, opts) — Phase A "อุ่นเครื่อง": เปิด browser → คลิกการ์ด → เลือกวัน
 * คืน { browser, context, page, date, warmedAt } พร้อมให้ fillBooking กรอกต่อ (ซ่อนนอกจอ)
 * ถ้า session หมด/วัน disabled → ปิด browser แล้ว throw (ไม่ทิ้ง browser ค้าง)
 */
async function warmTab(date, opts = {}) {
  const { headless = false, log = console.log } = opts;
  const isWin = process.platform === 'win32';
  const browser = await launchBrowser(headless);
  const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  if (!headless && !isWin) await tuckWindow(page); // Mac: ซุกเล็กมุมจอ (Windows ดันนอกจอผ่าน arg แล้ว)

  try {
    // 1) เข้าหน้าแรก → คลิกการ์ดอุทยาน (ต้องผ่าน path นี้ ไม่งั้นโควต้า=0)
    log('Opening home page...');
    await page.goto(PARK.homeUrl, { waitUntil: 'domcontentloaded' });
    // รอจน login พร้อม (เจอ "ออกจากระบบ") แทนการรอเผื่อเวลา
    const loggedIn = await page.getByText('ออกจากระบบ').first()
      .waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!loggedIn) {
      throw new Error('ดูเหมือน session หมดอายุ — รัน "npm run login" เพื่อ login ใหม่นะคะ');
    }
    await page.locator(`text=${PARK.name}`).first().click();
    // รอ context อุทยานโหลดเสร็จ (API) + ช่องวันที่พร้อม — ไปต่อทันทีที่พร้อม
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('input[placeholder="เลือกวันเข้าพื้นที่"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // 2) เลือกวัน (ปฏิทินจริง) — โยน error ถ้าวัน disabled
    log(`Selecting date ${date}...`);
    await pickDate(page, 'เลือกวันเข้าพื้นที่', date);
    // รอตัวเลือก (เวลา/รถ/ผู้เดินทาง) โหลดจาก API หลังเลือกวัน — จบ warm พร้อม standby
    await page.waitForLoadState('networkidle').catch(() => {});

    return { browser, context, page, date, warmedAt: Date.now() };
  } catch (err) {
    await browser.close().catch(() => {}); // warm พลาด — ไม่ทิ้ง browser ค้าง
    throw err;
  }
}

/**
 * fillBooking(page, params, opts) — Phase B "กรอกจริง" บน page ที่ warm มาแล้ว (เลือกวันเสร็จ)
 * params = { timeSlot, vehicles:[{match,plate}], travelers:[{match,nationality,count}] }
 * opts   = { dryRun=false, log=console.log }
 * คืน { ok, total, screenshot } — ไม่ปิด browser ถ้าสำเร็จ (ให้พี่วินตรวจ+จ่ายต่อ)
 */
async function fillBooking(page, params, opts = {}) {
  const { dryRun = false, log = console.log } = opts;

  try {
    // 3) เลือกเวลา
    log(`Selecting time slot ${params.timeSlot}...`);
    try {
      await selectOption(page, 'เลือกเวลา', 0, params.timeSlot);
    } catch (e) {
      // เลือกเวลาไม่ได้ = รอบนี้หายจาก dropdown (DNP ปิดรอบ/ใกล้หมดเวลา) ไม่ใช่ "ระบบช้า" — บอกให้ชัด
      throw new Error(`เลือกรอบเวลา "${params.timeSlot}" ไม่ได้ — รอบนี้อาจปิดรับแล้ว (ใกล้/เลยเวลาสิ้นสุดรอบ) ลองเลือกรอบอื่นนะคะ`);
    }

    // 4) ยานพาหนะ — กรอกคันปัจจุบันครบก่อน ค่อยกด "เพิ่มประเภทยานพาหนะ" คันถัดไป
    const vehicles = params.vehicles || [];
    if (vehicles.length === 0) throw new Error('ยังไม่ได้เลือกยานพาหนะเลยค่ะ');
    log(`Vehicles: ${vehicles.length}`);
    for (let i = 0; i < vehicles.length; i++) {
      if (i > 0) {
        await page.getByRole('button', { name: 'เพิ่มประเภทยานพาหนะ' }).click();
        // รอช่องคันใหม่ render แทนรอเวลาตายตัว (auto-wait)
        await page.locator('input[placeholder="เลือกประเภทยานพาหนะ"]').nth(i).waitFor({ state: 'visible', timeout: 3000 });
      }
      log(`  Vehicle #${i + 1}: ${enVehicle(vehicles[i].match)} (${vehicles[i].plate})`);
      await selectOption(page, 'เลือกประเภทยานพาหนะ', i, vehicles[i].match);
      // พิมพ์ทะเบียนแบบ type จริง เพื่อให้ Vue รับค่า (เหมือนช่องชื่อ)
      const plateInput = page.locator('input[placeholder="เลขทะเบียน"]').nth(i);
      await plateInput.click();
      await plateInput.pressSequentially(vehicles[i].plate || '-', { delay: 5 });
      await plateInput.press('Tab');
    }

    // 5) ผู้เดินทาง — กระจายเป็นรายคน
    const flat = [];
    for (const t of params.travelers) {
      for (let i = 0; i < t.count; i++) flat.push(t);
    }
    const total = flat.length;
    if (total === 0) throw new Error('ยังไม่ได้ระบุจำนวนผู้เดินทางเลยค่ะ');
    log(`Travelers: ${total}`);

    // กรอกทีละคน — กรอกคนปัจจุบันให้ครบก่อน ค่อยกด "เพิ่มผู้เดินทาง" สร้างคนถัดไป
    for (let i = 0; i < total; i++) {
      if (i > 0) {
        await page.getByRole('button', { name: 'เพิ่มผู้เดินทาง' }).click();
        // รอช่องคนใหม่ render แทนรอเวลาตายตัว (auto-wait)
        await page.locator('input[placeholder="ประเภทผู้เดินทาง"]').nth(i).waitFor({ state: 'visible', timeout: 3000 });
      }
      const t = flat[i];
      const name = t.nationality === 'Thai' ? thaiNames(1)[0] : interNames(1)[0];
      log(`  Traveler #${i + 1}: ${enTraveler(t.match)} (${t.nationality})`);
      await selectOption(page, 'ประเภทผู้เดินทาง', i, t.match);
      await selectOption(page, 'สัญชาติ', i, t.nationality, { exact: true });
      // พิมพ์ชื่อแบบ type จริง เพื่อให้ Vue รับรู้ค่า (fill เฉยๆ ไม่ trigger)
      const nameInput = page.locator('input[placeholder="ชื่อ - นามสกุล"]').nth(i);
      await nameInput.click();
      await nameInput.pressSequentially(name, { delay: 5 });
      await nameInput.press('Tab');
      await page.waitForTimeout(200);
    }

    // 6) กรอกครบ — screenshot ต้องทำหลัง revealWindow เสมอ
    //    (ตอนหน้าต่างถูกย่อ Chrome หยุด render → page.screenshot จะค้างรอ fonts จน timeout)
    log('All fields filled.');

    if (dryRun) {
      log('Dry-run mode: stopping before the Next button.');
      await revealWindow(page); // เด้งหน้าต่างกลับมา (render ทำงาน) ก่อนถ่ายภาพ
      await page.screenshot({ path: SHOT('shot-filled.png'), fullPage: true });
      log('Saved screenshot: shot-filled.png');
      return { ok: true, total, screenshot: SHOT('shot-filled.png'), dryRun: true };
    }

    // 7) กด "ต่อไป" ไปหน้าสรุป แล้วหยุด (ให้พี่วินตรวจ+จ่ายเอง)
    log('Clicking Next -> summary page...');
    await page.getByRole('button', { name: 'ต่อไป' }).click();
    await page.waitForTimeout(3000);
    await revealWindow(page); // เด้งหน้าต่างขึ้นมาให้พี่วินตรวจ+จ่าย (ก่อนถ่ายภาพ)
    await page.screenshot({ path: SHOT('shot-summary.png'), fullPage: true });
    log('Reached summary page (shot-summary.png). Please review and pay.');

    return { ok: true, total, screenshot: SHOT('shot-summary.png') };
  } catch (err) {
    await revealWindow(page).catch(() => {}); // เกิดข้อผิดพลาด — เด้งหน้าต่างให้พี่วินเห็นสถานะ
    await page.screenshot({ path: SHOT('shot-error.png'), fullPage: true }).catch(() => {});
    err.screenshot = SHOT('shot-error.png');
    throw err;
  }
}

/**
 * runBooking(params, opts) — warm + fill ในชุดเดียว (cold path / สคริปต์เทส)
 * server ปกติใช้ pool.acquire() + fillBooking() แทน เพื่อข้าม ~6 วิแรก
 * params = { date, timeSlot, vehicles, travelers }, opts = { headless, dryRun, log }
 * คืน { ok, total, screenshot, browser, page } — ไม่ปิด browser ถ้าสำเร็จ
 */
async function runBooking(params, opts = {}) {
  const warm = await warmTab(params.date, opts);
  try {
    const r = await fillBooking(warm.page, params, opts);
    return { ...r, browser: warm.browser, page: warm.page };
  } catch (err) {
    err.browser = warm.browser; // ให้ caller ปิด browser ที่ค้าง (สคริปต์เทส/cold path)
    throw err;
  }
}

/**
 * checkLogin() — เช็กเงียบๆ (headless) ว่า session ยังเข้าระบบ DNP อยู่ไหม
 * คืน true ถ้าเจอปุ่ม "ออกจากระบบ" ในหน้าแรก, false ถ้าหลุด/ไม่มี session
 */
async function checkLogin() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: STATE_PATH });
    const page = await context.newPage();
    await page.goto(PARK.homeUrl, { waitUntil: 'domcontentloaded' });
    return await page.getByText('ออกจากระบบ').first()
      .waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false);
  } catch {
    return false; // ไม่มีไฟล์ session / เปิดไม่ได้ = ถือว่ายังไม่ login
  } finally {
    await browser?.close().catch(() => {});
  }
}

module.exports = { runBooking, warmTab, fillBooking, checkLogin, todayISO, bookDate };
