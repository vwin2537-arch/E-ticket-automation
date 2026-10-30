// ทดลอง (31/10/69): เปิดหน้าจองเลือก "วันนี้ + รอบบ่าย" ค้างไว้ก่อน DNP ปิดรอบ → หลังปิดแล้วกรอก 1 คน + กด "ต่อไป"
// ดูว่า DNP ยอมไปหน้าสรุปไหม (ถ้ายอม = ค้างหน้าต่างไว้ใช้หลังรอบปิดได้) · ⚠️ หยุดที่หน้าสรุป ห้ามกดเช็คเอาท์/จ่าย
// ใช้: node scripts/exp-hold-after-close.js            ← ของจริง (รัน ~14:45 รอจน DNP ปิดรอบบ่ายเอง)
//      node scripts/exp-hold-after-close.js --dry      ← ซ้อมสคริปต์ กรอกครบแต่ไม่กด "ต่อไป" (--date YYYY-MM-DD --no-wait)
const fs = require('fs');
const path = require('path');
const { warmTab, readTimeSlots, todayISO } = require('../src/automation');
const { thaiNames } = require('../src/names');

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const DRY = process.argv.includes('--dry');
const NO_WAIT = process.argv.includes('--no-wait');
const DATE = arg('--date') || todayISO();
const SLOT = '11:45 - 15:30';
const GIVE_UP = '15:30'; // DNP ยังไม่ปิดรอบบ่ายถึงตอนนี้ = ทดลองไม่ได้ เลิก
const OUT = path.join(__dirname, '..', 'logs', `exp-hold-${DATE}`);
fs.mkdirSync(OUT, { recursive: true });

const hhmmss = () => new Date().toTimeString().slice(0, 8);
const log = (m) => { const l = `${hhmmss()} ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, 'result.txt'), l + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// สถานะช่อง el-select (ค่าที่เลือก + รอบ disabled ไหม) อ่านผ่าน __vue__
const selState = (page, ph, i = 0) => page.evaluate(({ ph, i }) => {
  const el = document.querySelectorAll(`input[placeholder="${ph}"]`)[i];
  const vm = el && el.closest('.el-select') && el.closest('.el-select').__vue__;
  if (!vm) return null;
  return { value: vm.value ? String(vm.selectedLabel || vm.value) : '', options: (vm.options || []).map((o) => `${o.currentLabel}${o.disabled ? '[ปิด]' : ''}`) };
}, { ph, i });

// เลือกค่าใน el-select ผ่าน __vue__ (เหมือน pickDirect) — คืน ok/notfound/disabled/notready
const pick = (page, ph, i, text, exact = false) => page.evaluate(({ ph, i, text, exact }) => {
  const el = document.querySelectorAll(`input[placeholder="${ph}"]`)[i];
  const vm = el && el.closest('.el-select') && el.closest('.el-select').__vue__;
  if (!vm || !vm.options || !vm.options.length) return 'notready';
  const opt = vm.options.find((o) => { const t = String(o.currentLabel || '').trim(); return exact ? t === text : t.includes(text); });
  if (!opt) return 'notfound';
  if (opt.disabled || opt.groupDisabled) return 'disabled';
  vm.handleOptionSelect(opt, true);
  return 'ok';
}, { ph, i, text, exact });

const typeInto = async (page, ph, text) => {
  const inp = page.locator(`input[placeholder="${ph}"]`).first();
  await inp.click();
  await inp.pressSequentially(text, { delay: 5 });
  await inp.press('Tab');
};

(async () => {
  log(`== เริ่ม ${DRY ? '(ซ้อม --dry)' : '(ของจริง)'} วัน ${DATE} รอบ ${SLOT}`);

  // 1) หน้าค้าง: เลือกวัน + รอบบ่าย ไว้ก่อนปิด
  const held = await warmTab(DATE, { headless: true, log: () => {} });
  let r = 'notready';
  for (let k = 0; k < 20 && r === 'notready'; k++) { r = await pick(held.page, 'เลือกเวลา', 0, SLOT); if (r === 'notready') await sleep(300); }
  await sleep(800);
  log(`หน้าค้าง: เลือกรอบ → ${r} · ${JSON.stringify(await selState(held.page, 'เลือกเวลา'))}`);
  if (r !== 'ok') { log('❌ เลือกรอบไม่ได้ตั้งแต่แรก (รอบปิดไปแล้ว?) — ทดลองไม่ได้'); await held.browser.close(); return; }

  // 2) รอจน DNP ปิดรอบบ่ายจริง — เปิดหน้าใหม่เช็คทุก ~1 นาที (หน้าใหม่ = สถานะจริงจาก DNP)
  if (!NO_WAIT) {
    for (;;) {
      if (hhmmss().slice(0, 5) >= GIVE_UP) { log(`❌ ถึง ${GIVE_UP} DNP ยังไม่ปิดรอบบ่าย — เลิก`); await held.browser.close(); return; }
      let slots = [];
      try {
        const fresh = await warmTab(DATE, { headless: true, log: () => {} });
        slots = await readTimeSlots(fresh.page);
        await fresh.browser.close();
      } catch (e) { log(`เช็คหน้าใหม่พลาด: ${e.message}`); }
      const s = slots.find((x) => x.text.replace(/\s/g, '') === SLOT.replace(/\s/g, ''));
      log(`เช็ครอบปิด (หน้าใหม่): ${JSON.stringify(slots)} · หน้าค้าง=${JSON.stringify(await selState(held.page, 'เลือกเวลา'))}`);
      if (s && s.disabled) { log(`🔒 DNP ปิดรอบบ่ายแล้ว (ตรวจพบ ${hhmmss()})`); break; }
      await sleep(60000);
    }
    await sleep(60000); // ให้พ้นช่วงปิดชัวร์ๆ
  }

  // 3) หลังปิด: หน้าค้างยังมีรอบบ่ายอยู่ไหม → กรอก 1 คน
  log(`หน้าค้างหลังปิด: ${JSON.stringify(await selState(held.page, 'เลือกเวลา'))}`);
  log(`รถ → ${await pick(held.page, 'เลือกประเภทยานพาหนะ', 0, 'รถยนต์ 4 ล้อ')}`);
  await sleep(300);
  await typeInto(held.page, 'เลขทะเบียน', '-');
  log(`ประเภทคน → ${await pick(held.page, 'ประเภทผู้เดินทาง', 0, 'ผู้ใหญ่ชาวไทย')}`);
  await sleep(300);
  log(`สัญชาติ → ${await pick(held.page, 'สัญชาติ', 0, 'Thai', true)}`);
  await sleep(300);
  await typeInto(held.page, 'ชื่อ - นามสกุล', thaiNames(1)[0]);
  await sleep(500);
  await held.page.screenshot({ path: path.join(OUT, '1-filled.png'), fullPage: true });
  log('กรอกครบ (1-filled.png)');
  if (DRY) { log('--dry: ไม่กด "ต่อไป" จบ'); await held.browser.close(); return; }

  // 4) กด "ต่อไป" → ดูว่าไปหน้าสรุปได้ไหม (ห้ามกดเช็คเอาท์)
  await held.page.getByRole('button', { name: 'ต่อไป' }).click();
  const reached = await held.page.getByRole('button', { name: /เช็คเอาท์/ })
    .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  const msgs = await held.page.evaluate(() => [...document.querySelectorAll('.el-message, .el-notification, .el-message-box, .swal2-popup')]
    .map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  await held.page.screenshot({ path: path.join(OUT, '2-after-next.png'), fullPage: true });
  log(`กด "ต่อไป": ${reached ? '✅ ไปถึงหน้าสรุป (DNP ยอม)' : '❌ ไม่ถึงหน้าสรุป'} · url=${new URL(held.page.url()).pathname} · ข้อความ=${JSON.stringify(msgs)} (2-after-next.png)`);
  log('จบ — ไม่ได้กดเช็คเอาท์/จ่าย');
  await held.browser.close();
})().catch((e) => { log(`ERR ${e.message}`); process.exit(1); });
