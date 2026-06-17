// timing.js — จับเวลาแต่ละ step ของการกรอกฟอร์ม เพื่อหา "คอขวด" ว่าเวลาหมดไปกับอะไร
// long format: 1 แถว = 1 step ของ 1 booking → รองรับผู้เดินทางกี่คนก็ได้ (group ด้วย bookingId)
// เปิดด้วย Excel/pivot ได้เลย. ไม่แตะ logic การกรอก — แค่คร่อม Date.now() วัดเวลา (overhead ~0)
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'timing.csv');
const HEADERS = ['เวลา', 'bookingId', 'โหมด', 'รวมคน', 'step', 'คนที่', 'ms'];

// escape ค่าให้ปลอดภัยใน CSV (เหมือน logger.js)
const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// วันเวลาท้องถิ่น YYYY-MM-DD HH:mm:ss
function localStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// collector ต่อ 1 booking — สะสม row ใน memory แล้ว flush ทีเดียวจบ booking
// meta = { dryRun, total } (total ใส่ตอน flush ได้ เผื่อยังไม่รู้ตอนสร้าง)
function createCollector(meta = {}) {
  const rows = [];
  const id = meta.bookingId || String(Date.now());
  return {
    // บันทึก step ที่วัดเวลาเอง (idx = คนที่/คันที่ ถ้าไม่เกี่ยวเว้นว่าง)
    mark(step, ms, idx) { rows.push({ step, ms: Math.round(ms), idx }); },
    // ห่อ async fn วัดเวลาให้อัตโนมัติ — คืนค่าที่ fn คืน, error โยนต่อ (แต่ยัง mark เวลาที่ใช้ไป)
    async wrap(step, idx, fn) {
      const s = Date.now();
      try { return await fn(); }
      finally { this.mark(step, Date.now() - s, idx); }
    },
    flush(extra = {}) { writeTiming({ ...meta, ...extra, bookingId: id }, rows); },
  };
}

function writeTiming(meta, rows) {
  try {
    if (!rows.length) return;
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const isNew = !fs.existsSync(LOG_FILE);
    const stamp = localStamp(new Date());
    const mode = meta.dryRun ? 'ทดสอบ' : 'จริง';
    let out = '';
    if (isNew) out += '﻿' + HEADERS.map(cell).join(',') + '\n'; // BOM ให้ Excel อ่านไทยไม่เพี้ยน
    for (const r of rows) {
      out += [stamp, meta.bookingId, mode, meta.total ?? '', r.step, r.idx ?? '', r.ms]
        .map(cell).join(',') + '\n';
    }
    fs.appendFileSync(LOG_FILE, out, 'utf8');
  } catch (e) {
    console.error('Failed to write timing:', e.message); // เขียนพลาดต้องไม่ทำให้จองพัง
  }
}

module.exports = { createCollector, writeTiming, LOG_FILE };
