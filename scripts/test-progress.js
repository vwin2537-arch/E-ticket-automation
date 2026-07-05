// test-progress.js — เทส watchdog จับค้าง + progress "คนที่ 3/7" (แก้บั๊กกลุ่มใหญ่ 30-40 คนโดนตัดที่ 2 นาที)
// MOCK pool.acquire + fillBooking + logger — ไม่ยิง DNP จริง ไม่เปิด browser ไม่เขียน usage.csv
// เคสที่เทส:
//   1. progress ไหลจริง: fillBooking รายงานทีละคน → /api/book-progress เห็น current ขยับ + done+result ตอนจบ
//   2. งานยาวกว่า stall window แต่ "ยังคืบหน้า" → ต้องไม่โดนตัด (นี่คือบั๊กเดิม: timeout ตายตัวตัดกลางคัน)
//   3. งานค้างจริง (ไม่มี progress เลย) → watchdog ตัด + running ปลดล็อก จองใบถัดไปได้
// รัน: node scripts/test-progress.js
const http = require('http');
const automation = require('../src/automation');
const pool = require('../src/pool');
const logger = require('../src/logger');

// --- mock (patch ก่อน require server — server destructure ตอน require) ---
let mockFill = async () => ({ ok: true, total: 1 });
pool.init = () => {};
pool.acquire = async () => ({
  browser: { isConnected: () => true, close: async () => {} },
  page: { isClosed: () => false },
  date: '2099-01-01',
});
automation.fillBooking = (page, params, opts) => mockFill(page, params, opts);
automation.checkLogin = async () => true;
logger.logUsage = () => {};

process.env.PORT = '5189';
process.env.BOOK_STALL_MS = '1200'; // ย่น watchdog เหลือ 1.2 วิ (ของจริง 2 นาที) ให้เทสจบไว
require('../src/server');

const BASE = 'http://localhost:5189';
function post(path, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(BASE + path,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject); req.write(data); req.end();
  });
}
function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve(JSON.parse(d))); })
      .on('error', reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bookBody = (count) => ({
  date: '2099-01-01', timeSlot: '08:00', dryRun: true,
  vehicles: [{ match: 'รถยนต์', plate: '1กข1234' }],
  travelers: [{ match: 'ผู้ใหญ่', nationality: 'Thai', count }],
});

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

(async () => {
  await sleep(300); // รอ server listen

  // --- เคส 1+2: 7 คน คนละ 300ms = ~2.1 วิ ยาวกว่า stall window (1.2 วิ) แต่คืบหน้าตลอด ---
  console.log('Case 1+2: long booking WITH progress must survive watchdog');
  mockFill = async (page, params, opts) => {
    const total = params.travelers.reduce((s, t) => s + t.count, 0);
    for (let i = 0; i < total; i++) {
      opts.onProgress?.({ current: i, total, stage: 'traveler' });
      await sleep(300);
    }
    opts.onProgress?.({ current: total, total, stage: 'summary' });
    return { ok: true, total };
  };
  const bookP = post('/api/book', bookBody(7));
  const seen = [];
  const poller = setInterval(async () => {
    const p = await get('/api/book-progress').catch(() => null);
    if (p && !p.idle && !p.done) seen.push(`${p.current}/${p.total}`);
  }, 150);
  const r1 = await bookP;
  clearInterval(poller);
  check('booking longer than stall window succeeds', r1.ok === true, JSON.stringify(r1));
  check('total = 7', r1.total === 7, JSON.stringify(r1));
  const uniq = [...new Set(seen)];
  check('progress advanced (saw multiple x/7 values)', uniq.length >= 3, `saw: ${uniq.join(', ')}`);
  check('all progress totals = 7', seen.every((s) => s.endsWith('/7')), `saw: ${uniq.join(', ')}`);
  const done1 = await get('/api/book-progress');
  check('endpoint shows done + recoverable result', done1.done === true && done1.result?.ok === true, JSON.stringify(done1));

  // --- เคส 3: ค้างจริง ไม่มี progress เลย → watchdog ต้องตัด ---
  console.log('Case 3: stalled booking (no progress) must be cut by watchdog');
  mockFill = async () => { await sleep(60000); return { ok: true, total: 1 }; }; // แกล้งค้าง 60 วิ
  const t0 = Date.now();
  const r3 = await post('/api/book', bookBody(1));
  const secs = (Date.now() - t0) / 1000;
  check('stalled booking rejected', r3.ok === false, JSON.stringify(r3));
  check('error message mentions unresponsive', /ไม่ตอบสนอง/.test(r3.error || ''), r3.error);
  check(`cut near stall window (~1.2s, took ${secs.toFixed(1)}s)`, secs >= 1 && secs < 5);

  // --- เคส 3 ต่อ: running ปลดล็อกแล้ว จองใบใหม่ได้ ---
  mockFill = async () => ({ ok: true, total: 1 });
  const r4 = await post('/api/book', bookBody(1));
  check('next booking works after watchdog cut (running unlocked)', r4.ok === true, JSON.stringify(r4));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
