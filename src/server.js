// server.js — หน้ากาก web app + API สั่ง automation
require('./filelog').install(); // ดักทุก console + crash เขียนลง logs/server.log (ก่อน log แรก)
const express = require('express');
const path = require('path');
const { fillBooking, checkLogin, setReceiptWidth } = require('./automation');
const pool = require('./pool');
const { logUsage } = require('./logger');
const { createCollector } = require('./timing');
const { uploadLogs } = require('../scripts/upload-logs');
const { PARK, POOL_SIZE, MAX_PENDING, TIME_SLOTS, SLOT_CLOSE_BUFFER_MIN, VEHICLE_TYPES, TRAVELER_TYPES } = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ส่ง config ให้หน้ากากไป render ตัวเลือก
app.get('/api/config', (req, res) => {
  res.json({ park: PARK.name, timeSlots: TIME_SLOTS, slotCloseBufferMin: SLOT_CLOSE_BUFFER_MIN, vehicles: VEHICLE_TYPES, travelers: TRAVELER_TYPES });
});

// ขนาดกระดาษใบเสร็จ (mm) — จนท.เลือกตอนเปิดระบบ (ครั้งเดียวต่อการ start; รีเซ็ตเป็น null เมื่อ start ใหม่)
// null = ยังไม่เลือก → หน้ากากเด้ง modal ถาม. เก็บ in-memory พอ (ปริ้นไป default printer ที่ จนท.ตั้งให้ตรงขนาด)
let receiptWidth = null;
app.get('/api/paper-size', (req, res) => res.json({ width: receiptWidth }));
app.post('/api/paper-size', (req, res) => {
  receiptWidth = req.body.width === 57 ? 57 : 80;
  setReceiptWidth(receiptWidth); // ส่งให้ automation ฉีดเข้าหน้าตั๋ว
  res.json({ ok: true, width: receiptWidth });
});

// เช็กว่า session ยังเข้าระบบ DNP อยู่ไหม (ให้หน้ากากโชว์ไฟสถานะ)
// cache ผลไว้ 5 นาที — ไม่งั้นทุกครั้งที่รีเฟรชหน้าจะเปิด headless browser เช็กใหม่ = ช้า
// ?force=1 (ปุ่มเช็กซ้ำ) = ข้าม cache ตรวจใหม่จริง
let loginCache = { value: null, at: 0 };
const LOGIN_TTL = 5 * 60 * 1000;
app.get('/api/login-status', async (req, res) => {
  const fresh = loginCache.value !== null && Date.now() - loginCache.at < LOGIN_TTL;
  if (req.query.force !== '1' && fresh) {
    return res.json({ loggedIn: loginCache.value, cached: true });
  }
  const loggedIn = await checkLogin();
  loginCache = { value: loggedIn, at: Date.now() };
  res.json({ loggedIn });
});

// สถานะ warm pool ให้หน้ากากโชว์ว่าอุ่นแท็บไว้กี่ใบแล้ว (1/3, 2/3, 3/3)
// bookDate + slots มาจาก pool (data-driven จาก DNP จริง) — หน้ากากเอา slots ไปโชว์เฉพาะรอบที่เปิด
// pending = ใบจริงที่ดักรอจ่ายค้างอยู่ (#5) — prune ก่อนนับ เอาใบที่ จนท.ปิดหน้าต่างไปแล้วออก
app.get('/api/pool-status', (req, res) => {
  prunePending();
  res.json({ ...pool.status(), size: POOL_SIZE, pending: pendingTabs.length, maxPending: MAX_PENDING });
});

// ปิดระบบจากปุ่มบนหน้ากาก (เคส A: หน้าต่างดำยังเปิด) — แทนการกด Ctrl+C เอง
// ⚠️ มีใบจริงค้างรอจ่ายอยู่ = ห้ามปิด (เงินยังไม่จ่าย ปิดแล้วใบหาย) → ตอบ blocked ให้หน้ากากเตือน
// ลำดับ: ตอบ res ก่อน → ส่ง log ขึ้น Drive → shutdown() เก็บ browser → process.exit(0)
//        (exit 0 = ปิดปกติ → 2-START.bat ไม่ pause → หน้าต่างดำปิดเอง)
app.post('/api/shutdown', async (req, res) => {
  prunePending();
  if (pendingTabs.length > 0) {
    return res.json({ ok: false, error: `ยังมีใบรอจ่ายค้างอยู่ ${pendingTabs.length} ใบ — จ่ายเงิน/ปิดหน้าต่างใบนั้นให้เสร็จก่อนปิดระบบนะคะ (กันใบหาย เงินหาย)` });
  }
  res.json({ ok: true, message: 'กำลังปิดระบบ... ปิดแท็บนี้ได้เลยค่ะ' });
  console.log('Shutdown requested from web UI');
  await uploadLogs().catch(() => {}); // best-effort ส่ง log ก่อนตาย
  shutdown('WEB-SHUTDOWN');
});

// กันงานค้างล็อกทั้งระบบ: watchdog จับ "ค้างจริง" — ไม่มีความคืบหน้า (กรอกคนถัดไปไม่ขยับ) เกิน 2 นาที
// ⚠️ เดิมเป็น timeout ตายตัว 2 นาทีครอบทั้งงาน → กลุ่มใหญ่ 30-40 คน (~3.5วิ/คน = เกิน 2 นาทีแน่)
//    โดนตัดทั้งที่ยังกรอกอยู่ = อาการ "เด้งออก/รีเซตเอง" ที่ด่านเจอ (แก้ 5/7/69)
//    เปลี่ยนเป็นนับจาก "ความคืบหน้าล่าสุด" แทน — จองกี่คนก็ไม่โดนตัดตราบใดที่ยังกรอกอยู่
const BOOK_STALL_MS = Number(process.env.BOOK_STALL_MS) || 2 * 60 * 1000; // env ไว้ให้เทสย่นเวลา
function withStallGuard(promise, ms, lastActivity) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setInterval(() => {
      if (Date.now() - lastActivity.at > ms) {
        reject(new Error('ระบบ DNP ไม่ตอบสนอง (ค้างเกิน 2 นาที) — ลองกดจองใหม่อีกครั้งนะคะ'));
      }
    }, Math.min(5000, ms / 4));
  });
  return Promise.race([promise, guard]).finally(() => clearInterval(timer));
}

// ความคืบหน้าการจองที่กำลังวิ่งอยู่ — หน้ากาก poll ไปโชว์ "คนที่ 3/7" บน popup (จนท.เห็นว่าไม่ค้าง)
// เก็บใบเดียวพอ (running กันจองซ้อนอยู่แล้ว). done+result ไว้ให้หน้ากากกู้ผลลัพธ์
// กรณีจองนานจน Chrome ตัด fetch (~5 นาที) — งานฝั่งนี้ยังวิ่งต่อ หน้ากากสลับมารอผลทางนี้แทน
let bookProgress = null;
app.get('/api/book-progress', (req, res) => res.json(bookProgress || { idle: true }));

let running = false;
let pendingTabs = []; // คิวใบ "จริง" ที่ดักรอจ่ายค้างอยู่ (#5) — จองใบใหม่ไม่ปิดใบเก่า สูงสุด MAX_PENDING ใบ
let lastDryTab = null; // ใบ "โหมดทดสอบ" ล่าสุด — แยกจากใบจริง ไม่เข้าคิว (ปิดอันเก่าทันที กันสะสม)

// เอาใบที่ จนท.ปิดหน้าต่างเบราว์เซอร์ไปแล้ว (= จ่ายเสร็จ) ออกจากคิว — เหลือแต่ใบที่ยังเปิดค้างรอจ่าย
// นี่คือกลไก "ไม่ต้องกดปิดในระบบ": ปิดหน้าต่างใบที่จ่ายเสร็จตามธรรมชาติ ระบบเอาออกเอง
// ⚠️ เช็ก page.isClosed() เป็นหลัก — ห้ามพึ่ง browser.isConnected() อย่างเดียว:
//    Playwright launch() ถือ connection ไว้ → จนท.ปิดหน้าต่างแล้ว browser process ยังไม่ตาย
//    isConnected ค้าง true ตลอด คิวไม่มีวันว่าง กดใบที่ 4 ไม่ได้ (พิสูจน์ใน scripts/test-window-close.js)
//    คง isConnected ไว้เป็น backup เผื่อ browser ตายจริง (crash/kill) — เอาออกถ้า "ปิดหน้าต่าง หรือ หลุด"
// ⚠️ ใบที่หลุดต้อง browser.close() ปิด process ด้วย — ไม่งั้น Playwright ถือ process ไว้ค้างใน Dock
//    กลายเป็น orphan สะสมกิน RAM (ปิดหน้าต่าง = แค่ปิด "หน้าต่าง" ไม่ใช่ฆ่า browser process)
function prunePending() {
  pendingTabs = pendingTabs.filter((t) => {
    const alive = !t.page.isClosed() && t.browser.isConnected();
    if (!alive) t.browser.close().catch(() => {}); // หลุดแล้ว — ฆ่า process ทิ้ง กัน orphan
    return alive;
  });
}

app.post('/api/book', async (req, res) => {
  if (running) return res.json({ ok: false, error: 'มีงานกำลังทำอยู่ รอสักครู่นะคะ' });
  running = true;
  const { dryRun, ...params } = req.body;
  const startedAt = Date.now();
  const elapsed = () => +((Date.now() - startedAt) / 1000).toFixed(1);
  // ใบจริง: เช็กเพดานคิวก่อนเริ่ม — prune เอาใบที่จ่ายเสร็จ (ปิดหน้าต่างแล้ว) ออกก่อนนับ
  // ครบ MAX_PENDING = เตือน ไม่ปิดอะไร (ปลอดภัย กันปิดใบที่ยังจ่ายไม่เสร็จ เงินหาย)
  if (!dryRun) {
    prunePending();
    if (pendingTabs.length >= MAX_PENDING) {
      running = false;
      return res.json({ ok: false, error: `ดักใบรอจ่ายไว้ครบ ${MAX_PENDING} ใบแล้วค่ะ — ปิดหน้าต่างใบที่จ่ายเสร็จก่อน แล้วค่อยจองใบใหม่นะคะ` });
    }
  }
  let tab = null;
  const timing = createCollector({ dryRun: !!dryRun }); // จับเวลาแต่ละ step ลง timing.csv (วิเคราะห์คอขวด)
  // progress ใบนี้ — startedAt ให้หน้ากากเช็กว่าเป็น "งานของตัวเอง" (ไม่ใช่ค้างจากใบก่อน)
  // at = เวลาความคืบหน้าล่าสุด (watchdog ใช้จับค้าง), current/total = กรอกถึงคนที่เท่าไหร่
  const totalTravelers = (params.travelers || []).reduce((s, t) => s + (t.count || 0), 0);
  const progress = { startedAt, at: startedAt, current: 0, total: totalTravelers, stage: 'prepare', done: false, result: null };
  bookProgress = progress;
  const onProgress = (p) => Object.assign(progress, p, { at: Date.now() });
  try {
    const acqStart = Date.now();
    tab = await pool.acquire(params.date, console.log); // หยิบแท็บ warm (หรือ warm สดถ้าไม่มี)
    timing.mark('acquire', Date.now() - acqStart, ''); // warm hit = ~0, cold (pool ว่าง) = ~6000ms
    onProgress({ stage: 'fill' }); // acquire เสร็จ (cold อาจกิน ~7วิ) — รีเซ็ต watchdog ก่อนเริ่มกรอก
    const r = await withStallGuard(
      fillBooking(tab.page, params, { dryRun: !!dryRun, timing, onProgress }),
      BOOK_STALL_MS, progress);
    // สำเร็จ — ใบใหม่ขึ้นจอแล้ว
    //  ทดสอบ: ปิดใบทดสอบเก่าทันที (ไม่เข้าคิว ไม่สะสม)
    //  จริง: ดักไว้ในคิว ไม่ปิดใบเก่า — จนท.กรอกใบถัดไปได้เลยระหว่างคนแรกจ่าย (#5)
    if (dryRun) {
      if (lastDryTab) lastDryTab.browser.close().catch(() => {});
      lastDryTab = tab;
    } else {
      pendingTabs.push(tab);
    }
    const msg = dryRun
      ? `โหมดทดสอบ: กรอกครบ ${r.total} คนแล้ว (ไม่กดต่อไป) — ดูในเบราว์เซอร์ที่เปิดขึ้นได้เลยค่ะ`
      : `กรอกครบ ${r.total} คน ถึงหน้าสรุปแล้ว — ตรวจยอดในเบราว์เซอร์ที่เปิดขึ้น แล้วกดจ่ายเองได้เลยค่ะ`;
    logUsage(params, { durationSec: elapsed(), ok: true, total: r.total, dryRun: !!dryRun });
    Object.assign(progress, { done: true, result: { ok: true, total: r.total, message: msg } });
    res.json({ ok: true, total: r.total, message: msg });
  } catch (e) {
    logUsage(params, { durationSec: elapsed(), ok: false, error: e.message, dryRun: !!dryRun });
    Object.assign(progress, { done: true, result: { ok: false, error: e.message } });
    res.json({ ok: false, error: e.message });
    // ปิดแท็บที่กรอกค้างครึ่งทาง ใน 1 นาที (ให้ดู error ก่อน) — ใบเก่าในคิวยังคงไว้ครบ
    if (tab?.browser) setTimeout(() => tab.browser.close().catch(() => {}), 60000);
  } finally {
    running = false;
    // เขียน timing ท้ายสุด (ครอบทั้งสำเร็จ/พลาด) — total นับจาก params เผื่อ fail กลางคัน
    timing.flush({ total: (params.travelers || []).reduce((s, t) => s + (t.count || 0), 0) });
  }
});

const PORT = process.env.PORT || 5179;
app.listen(PORT, () => {
  console.log(`\nErawan booking ready -> http://localhost:${PORT}\n   (Press Ctrl+C to stop)\n`);
  pool.init(console.log); // เริ่มอุ่นเครื่อง warm pool ทันที (เปิดแท็บกดการ์ด+เลือกวันนี้รอไว้)
});

// graceful shutdown — ปิด browser ทั้งหมด (warm pool + ใบจริง/ทดสอบที่ค้างรอจ่าย) ก่อนตาย
// กัน chromium orphan ค้างกิน RAM สะสมจากการปิด-เปิดโปรแกรมหลายรอบที่เครื่องด่าน
// หมายเหตุ: Windows กด Ctrl+C ได้ / ปิดหน้าต่าง cmd ตรงๆ อาจไม่ trigger (best-effort)
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received - closing browsers...`);
  setTimeout(() => process.exit(0), 5000).unref(); // safety: ถ้า close ค้าง บังคับออกใน 5 วิ
  for (const t of [...pendingTabs, lastDryTab]) {
    if (t?.browser) await t.browser.close().catch(() => {});
  }
  await pool.drain().catch(() => {});
  console.log('Cleanup done. Bye.');
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
