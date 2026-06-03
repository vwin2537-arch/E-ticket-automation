// pool.js — คลังแท็บ "อุ่นเครื่อง" (warm): เปิด browser กดการ์ด+เลือกวันนี้รอไว้ล่วงหน้า
// พอ จนท.กดยืนยัน → acquire() หยิบแท็บที่พร้อมมากรอกทันที (ข้าม ~6 วิแรก) แล้วเติม pool คืนพื้นหลัง
// ใช้ได้เฉพาะ "วันนี้" (นทท.ที่ด่านเข้าวันนี้เกือบ 100%) — จองวันอื่น = warm สดทีละครั้ง (cold)

const { warmTab, todayISO } = require('./automation');
const { POOL_SIZE } = require('./config');

let pool = [];        // [{ browser, context, page, date, warmedAt }] — แท็บพร้อมใช้
let warming = 0;      // กำลัง warm อยู่กี่แท็บ (กันเปิดเกิน POOL_SIZE)
let lastError = null; // error ล่าสุดตอน warm (เช่น session หมด) — หยุดเติมรัวๆ ถ้าพัง
let logFn = console.log;

// warm หนึ่งแท็บใส่ pool — ไม่ throw (เก็บ error ไว้ใน lastError ให้ refill เห็น)
async function warmOne() {
  warming++;
  try {
    const tab = await warmTab(todayISO(), { log: logFn });
    pool.push(tab);
    lastError = null;
    logFn(`warm ready (pool=${pool.length}/${POOL_SIZE})`);
  } catch (e) {
    lastError = e;
    logFn(`warm failed: ${e.message}`);
  } finally {
    warming--;
  }
}

// เติม pool ให้ครบ POOL_SIZE — ทีละแท็บ (ไม่ยิงพร้อมกันถล่ม DNP) หยุดทันทีถ้า warm พัง (กัน loop รัว)
async function refill() {
  while (pool.length + warming < POOL_SIZE) {
    await warmOne();
    if (lastError) break; // เช่น session หมด — รอ จนท.แก้ก่อน อย่าวน warm พังซ้ำๆ
  }
}

// เริ่ม warm pool ตอน server start — ไม่ await (เติมพื้นหลัง ใบแรกพร้อมหลังแท็บแรกเสร็จ ~6 วิ)
function init(log = console.log) {
  logFn = log;
  refill();
}

// หยิบแท็บ warm มาใช้ คืน { browser, context, page, date }
//  - date = วันนี้ + มีแท็บพร้อม → หยิบจาก pool ทันที แล้วเติมคืนพื้นหลัง
//  - ไม่มีพร้อม / จองวันอื่น → warm สดเลย (รอ ~6 วิ เหมือนเดิม) — กรณีหายาก
async function acquire(date, log = console.log) {
  logFn = log;
  const today = todayISO();

  // ทิ้งแท็บที่ค้างข้ามวัน (warm "เมื่อวาน" ใช้ไม่ได้แล้ว) — กันกรอกผิดวัน
  pool = pool.filter((t) => {
    if (t.date !== today) { t.browser.close().catch(() => {}); return false; }
    return true;
  });

  if (date === today && pool.length > 0) {
    const tab = pool.shift();
    refill();            // เติมคืนพื้นหลังทันที (ระหว่าง จนท.จ่ายเงินใบนี้)
    return tab;
  }
  // cold path: ไม่มี warm พร้อม หรือจองวันอื่น
  const tab = await warmTab(date, { log });
  if (date === today) refill(); // วันนี้แต่ pool หมด → เติมเผื่อใบถัดไป
  return tab;
}

// ปิดทุกแท็บใน pool (ตอนปิด server / ล้าง pool) — best-effort
async function drain() {
  const tabs = pool;
  pool = [];
  await Promise.all(tabs.map((t) => t.browser.close().catch(() => {})));
}

const status = () => ({ ready: pool.length, warming, lastError: lastError?.message || null });

module.exports = { init, acquire, drain, status };
