// server.js — หน้ากาก web app + API สั่ง automation
const express = require('express');
const path = require('path');
const { fillBooking, checkLogin, todayISO } = require('./automation');
const pool = require('./pool');
const { logUsage } = require('./logger');
const { PARK, POOL_SIZE, TIME_SLOTS, VEHICLE_TYPES, TRAVELER_TYPES } = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ส่ง config ให้หน้ากากไป render ตัวเลือก
app.get('/api/config', (req, res) => {
  res.json({ park: PARK.name, timeSlots: TIME_SLOTS, vehicles: VEHICLE_TYPES, travelers: TRAVELER_TYPES });
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
// warm อุ่นไว้ "เฉพาะวันนี้" — ส่ง today ไปให้หน้ากากเทียบกับวันที่เลือก
app.get('/api/pool-status', (req, res) => {
  res.json({ ...pool.status(), size: POOL_SIZE, today: todayISO() });
});

let running = false;
let lastTab = null; // แท็บใบล่าสุดที่กรอกเสร็จ (ค้างหน้าสรุปรอจ่าย) — ปิดเมื่อใบใหม่สำเร็จ
app.post('/api/book', async (req, res) => {
  if (running) return res.json({ ok: false, error: 'มีงานกำลังทำอยู่ รอสักครู่นะคะ' });
  running = true;
  const { dryRun, ...params } = req.body;
  const startedAt = Date.now();
  const elapsed = () => +((Date.now() - startedAt) / 1000).toFixed(1);
  const prevTab = lastTab; // ใบก่อนหน้า — จ่ายเสร็จแล้ว/ถูกทิ้ง ปิดเมื่อใบใหม่ขึ้นจอ
  let tab = null;
  try {
    tab = await pool.acquire(params.date, console.log); // หยิบแท็บ warm (หรือ warm สดถ้าไม่มี)
    const r = await fillBooking(tab.page, params, { dryRun: !!dryRun });
    // สำเร็จ — ใบใหม่ขึ้นจอแล้ว ปิดใบเก่าที่ถูกแทน (จ่ายเสร็จ/กรอกผิดแล้วทิ้ง)
    if (prevTab) prevTab.browser.close().catch(() => {});
    lastTab = tab;
    const msg = dryRun
      ? `โหมดทดสอบ: กรอกครบ ${r.total} คนแล้ว (ไม่กดต่อไป) — ดูในเบราว์เซอร์ที่เปิดขึ้นได้เลยค่ะ`
      : `กรอกครบ ${r.total} คน ถึงหน้าสรุปแล้ว — ตรวจยอดในเบราว์เซอร์ที่เปิดขึ้น แล้วกดจ่ายเองได้เลยค่ะ`;
    logUsage(params, { durationSec: elapsed(), ok: true, total: r.total, dryRun: !!dryRun });
    res.json({ ok: true, total: r.total, message: msg });
  } catch (e) {
    logUsage(params, { durationSec: elapsed(), ok: false, error: e.message, dryRun: !!dryRun });
    res.json({ ok: false, error: e.message });
    // ปิดแท็บที่กรอกค้างครึ่งทาง ใน 1 นาที (ให้ดู error ก่อน) — prevTab ใบเก่ายังคงไว้
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
