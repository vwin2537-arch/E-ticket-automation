// diag-selectopt.js — ยืนยัน "กลไก" ของ sel_type คนที่ 2+ ที่ช้า ~2.4 วิ (ไม่จอง ไม่จ่าย)
// warm วันนี้ → เลือกเวลา → กรอกคนที่ 1 → กด "เพิ่มผู้เดินทาง" → กรอกคนที่ 2 (จุดที่ช้า)
// selectOption เวอร์ชันนี้จับเวลาแยก phase + นับ attempt + ดู click พลาดไหม → รู้ว่าเป็น
//   (a) click พลาด→retry 900ms / (b) commit-poll หมดเวลา 1000ms / (c) Playwright auto-wait รอ element
// รัน: node scripts/diag-selectopt.js
const { warmTab, bookDate } = require('../src/automation');
const { TRAVELER_TYPES } = require('../src/config');
const { thaiNames } = require('../src/names');

// คัดลอกจาก automation.selectOption + ฝังเครื่องวัด (ไม่แตะของจริง)
async function selectOptionTimed(page, placeholder, index, matchText, { exact = false } = {}) {
  const input = page.locator(`input[placeholder="${placeholder}"]`).nth(index);
  const matcher = exact ? new RegExp(`^\\s*${matchText}\\s*$`) : matchText;
  const T0 = Date.now();
  const log = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const a0 = Date.now();
    await input.scrollIntoViewIfNeeded();
    const tScroll = Date.now();
    await input.click();
    const tClick = Date.now();
    if (tClick - a0 > 1000) console.log(`     [แยกเฟส] scroll=${tScroll - a0}ms  click=${tClick - tScroll}ms`);
    const popper = page.locator('.el-select-dropdown:visible').last();
    await popper.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    const tPopper = Date.now();
    const item = popper.locator('.el-select-dropdown__item', { hasText: matcher }).first();
    const cls = await item.getAttribute('class').catch(() => null);
    if (cls && cls.includes('is-disabled')) { console.log('  DISABLED option'); return; }

    let clickFailed = false, clickErr = '';
    try {
      await item.scrollIntoViewIfNeeded({ timeout: 3000 });
      await item.click({ timeout: 3000 });
    } catch (e) { clickFailed = true; clickErr = e.message.split('\n')[0]; }
    const tItemClick = Date.now();

    if (clickFailed) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(900);
      log.push({ attempt, click_ms: tClick - a0, popperWait_ms: tPopper - tClick,
        itemClick_ms: tItemClick - tPopper, FAILED: clickErr, retryWait_ms: 900 });
      continue;
    }
    let ok = false, polls = 0;
    for (let i = 0; i < 20; i++) {
      polls++;
      const val = (await input.inputValue().catch(() => '')).trim();
      if (val && (exact ? val === matchText : val.includes(matchText))) { ok = true; break; }
      await page.waitForTimeout(50);
    }
    const tCommit = Date.now();
    log.push({ attempt, click_ms: tClick - a0, popperWait_ms: tPopper - tClick,
      itemClick_ms: tItemClick - tPopper, commitPoll_ms: tCommit - tItemClick, polls, ok });
    if (ok) break;
  }
  console.log(`  >> [${placeholder} #${index}] รวม ${Date.now() - T0}ms / ${log.length} attempt`);
  for (const p of log) console.log('     ', JSON.stringify(p));
}

// candidate FIX — เปิด dropdown ด้วย force click (ข้าม actionability wait ~2วิ) แล้ว verify commit ติดจริง
async function selectOptionForce(page, placeholder, index, matchText, { exact = false } = {}) {
  const input = page.locator(`input[placeholder="${placeholder}"]`).nth(index);
  const matcher = exact ? new RegExp(`^\\s*${matchText}\\s*$`) : matchText;
  const T0 = Date.now();
  await input.click({ force: true }); // ← ข้าม actionability check (ไม่รอ element นิ่ง)
  const tClick = Date.now();
  const popper = page.locator('.el-select-dropdown:visible').last();
  await popper.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  const item = popper.locator('.el-select-dropdown__item', { hasText: matcher }).first();
  await item.click({ timeout: 3000, force: true });
  let ok = false;
  for (let i = 0; i < 20; i++) {
    const val = (await input.inputValue().catch(() => '')).trim();
    if (val && (exact ? val === matchText : val.includes(matchText))) { ok = true; break; }
    await page.waitForTimeout(50);
  }
  console.log(`  >> [FORCE ${placeholder} #${index}] รวม ${Date.now() - T0}ms  click=${tClick - T0}ms  commit=${ok ? 'ติด✓' : 'ไม่ติด✗'}`);
}

(async () => {
  // รับวันจาก argv (เลย cutoff วันนี้ปิด → ใช้พรุ่งนี้ที่มีรอบเปิด เหมือนที่ จนท. play)
  const date = process.argv[2] || bookDate();
  console.log(`Warming ${date}...`);
  const warm = await warmTab(date, { log: console.log });
  const page = warm.page;
  try {
    const slot = (warm.timeSlots.find((s) => !s.disabled) || warm.timeSlots[0] || {}).text;
    if (!slot) throw new Error('ไม่มีรอบเวลาเปิดให้เลือก (DNP ปิดวันนี้แล้ว) — ลองรันใหม่ก่อน cutoff');
    console.log(`\nUsing time slot: ${slot}`);
    await selectOptionTimed(page, 'เลือกเวลา', 0, slot);

    const tt = TRAVELER_TYPES.find((t) => t.nationality === 'Thai') || TRAVELER_TYPES[0];
    console.log('\n--- Traveler #1: sel_type (แถวที่มีอยู่แล้ว = ควรเร็ว ~570ms) ---');
    await selectOptionTimed(page, 'ประเภทผู้เดินทาง', 0, tt.match);
    // กรอกคนที่ 1 ให้ครบ (สัญชาติ+ชื่อ) — ฟอร์ม DNP ไม่ยอมเพิ่มคนถ้าคนเดิมไม่ครบ
    await selectOptionTimed(page, 'สัญชาติ', 0, 'Thai', { exact: true });
    const n1 = page.locator('input[placeholder="ชื่อ - นามสกุล"]').nth(0);
    await n1.click(); await n1.pressSequentially(thaiNames(1)[0], { delay: 5 }); await n1.press('Tab');

    // ===== PROBE: มี network call ยิงระหว่าง 2 วินาทีที่แถวใหม่ค้างไหม? =====
    // ถ้ามี = options โหลดจาก DNP (เน็ต) / ถ้าไม่มี = timer/debounce ในหน้า DNP เอง (เร่งไม่ได้ทั้งคู่)
    let gapStart = 0;
    const onReq = (r) => { if (gapStart) console.log(`     [network +${Date.now() - gapStart}ms] ${r.method()} ${r.url().slice(0, 80)}`); };
    page.on('request', onReq);

    console.log('\nกด "เพิ่มผู้เดินทาง" + รอช่องคนที่ 2 โผล่...');
    await page.getByRole('button', { name: 'เพิ่มผู้เดินทาง' }).click();
    await page.locator('input[placeholder="ประเภทผู้เดินทาง"]').nth(1).waitFor({ state: 'visible', timeout: 3000 });

    console.log('\n--- Traveler #2: sel_type (แถวเพิ่งสร้าง) + ดู network ระหว่าง gap ---');
    gapStart = Date.now();
    await selectOptionTimed(page, 'ประเภทผู้เดินทาง', 1, tt.match);
    gapStart = 0;
    page.off('request', onReq);

    console.log('\nเสร็จ — ปิด browser');
  } catch (e) {
    console.log('ERROR:', e.message);
  } finally {
    await warm.browser.close().catch(() => {});
    process.exit(0);
  }
})();
