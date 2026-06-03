// server.js — หน้ากาก web app + API สั่ง automation
const express = require('express');
const path = require('path');
const { fillBooking, checkLogin, bookDate } = require('./automation');
const pool = require('./pool');
const { logUsage } = require('./logger');
const { PARK, POOL_SIZE, MAX_PENDING, TIME_SLOTS, SLOT_CLOSE_BUFFER_MIN, VEHICLE_TYPES, TRAVELER_TYPES } = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ส่ง config ให้หน้ากากไป render ตัวเลือก
app.get('/api/config', (req, res) => {
  res.json({ park: PARK.name, timeSlots: TIME_SLOTS, slotCloseBufferMin: SLOT_CLOSE_BUFFER_MIN, vehicles: VEHICLE_TYPES, travelers: TRAVELER_TYPES });
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
// warm อุ่นไว้ "วันเป้าหมาย" (วันนี้ก่อน 15:20 / พรุ่งนี้หลัง 15:20) — ส่ง bookDate ให้หน้ากากเทียบ
// pending = ใบจริงที่ดักรอจ่ายค้างอยู่ (#5) — prune ก่อนนับ เอาใบที่ จนท.ปิดหน้าต่างไปแล้วออก
app.get('/api/pool-status', (req, res) => {
  prunePending();
  res.json({ ...pool.status(), size: POOL_SIZE, bookDate: bookDate(), pending: pendingTabs.length, maxPending: MAX_PENDING });
});

// กันงานค้างล็อกทั้งระบบ: ถ้า fillBooking ค้าง (DNP ไม่ตอบ) ครอบด้วย timeout
// ตั้ง 2 นาที — หน้างานกลุ่มใหญ่สุด ~รถตู้ 20 คน (~60 วิ) กรุ๊ปใหญ่จริงจองจากบ้าน + เผื่อเน็ตช้า/buffer
// ถ้าเกินนี้ถือว่า DNP ค้างจริง → โยน error ปลดล็อกให้กดใหม่ได้ (ปรับค่าที่ค่าเดียวด้านล่าง)
const BOOK_TIMEOUT_MS = 2 * 60 * 1000;
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('ระบบ DNP ไม่ตอบสนอง (เกิน 2 นาที) — ลองกดจองใหม่อีกครั้งนะคะ')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

let running = false;
let pendingTabs = []; // คิวใบ "จริง" ที่ดักรอจ่ายค้างอยู่ (#5) — จองใบใหม่ไม่ปิดใบเก่า สูงสุด MAX_PENDING ใบ
let lastDryTab = null; // ใบ "โหมดทดสอบ" ล่าสุด — แยกจากใบจริง ไม่เข้าคิว (ปิดอันเก่าทันที กันสะสม)

// เอาใบที่ จนท.ปิดหน้าต่างเบราว์เซอร์ไปแล้ว (= จ่ายเสร็จ) ออกจากคิว — เหลือแต่ใบที่ยังเปิดค้างรอจ่าย
// นี่คือกลไก "ไม่ต้องกดปิดในระบบ": ปิดหน้าต่างใบที่จ่ายเสร็จตามธรรมชาติ ระบบเห็น disconnect เอาออกเอง
function prunePending() {
  pendingTabs = pendingTabs.filter((t) => t.browser.isConnected());
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
  try {
    tab = await pool.acquire(params.date, console.log); // หยิบแท็บ warm (หรือ warm สดถ้าไม่มี)
    const r = await withTimeout(fillBooking(tab.page, params, { dryRun: !!dryRun }), BOOK_TIMEOUT_MS);
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
    res.json({ ok: true, total: r.total, message: msg });
  } catch (e) {
    logUsage(params, { durationSec: elapsed(), ok: false, error: e.message, dryRun: !!dryRun });
    res.json({ ok: false, error: e.message });
    // ปิดแท็บที่กรอกค้างครึ่งทาง ใน 1 นาที (ให้ดู error ก่อน) — ใบเก่าในคิวยังคงไว้ครบ
    if (tab?.browser) setTimeout(() => tab.browser.close().catch(() => {}), 60000);
  } finally {
    running = false;
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
