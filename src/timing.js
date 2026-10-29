// timing.js — จับเวลาแต่ละ step ของการกรอกฟอร์ม เพื่อหา "คอขวด" ว่าเวลาหมดไปกับอะไร
// 1 แถว = 1 booking: รวมวินาที + แยกขั้น (รวมทุกคน) เช่น "acquire0.0 time_slot0.1 sel_nat1.2 ..." (แบบ log มือถือ)
// เดิม long format 1 แถว/step/คน → ไฟล์โต ~100KB/วัน (7.9MB ใน 4 เดือน) · วิเคราะห์คอขวดเสร็จแล้ว (28/10/69) ไม่ต้องละเอียดขนาดนั้น
// ไม่แตะ logic การกรอก — แค่คร่อม Date.now() วัดเวลา (overhead ~0)
const fs = require('fs');
const { LOG_DIR, monthFile } = require('./logfiles'); // logs/YYYY-MM_timing.csv เดือนละไฟล์

const HEADERS = ['เวลา', 'bookingId', 'โหมด', 'รวมคน', 'รวม(วินาที)', 'แยกขั้น(วินาที)'];

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
    const file = monthFile('timing.csv');
    const isNew = !fs.existsSync(file);
    const mode = meta.dryRun ? 'ทดสอบ' : 'จริง';
    const byStep = new Map(); // รวม ms ต่อ step ตามลำดับที่เจอครั้งแรก
    for (const r of rows) byStep.set(r.step, (byStep.get(r.step) || 0) + r.ms);
    const sec = (ms) => (ms / 1000).toFixed(1);
    const totalMs = rows.reduce((s, r) => s + r.ms, 0);
    const steps = [...byStep].map(([k, ms]) => `${k}${sec(ms)}`).join(' ');
    let out = '';
    if (isNew) out += '﻿' + HEADERS.map(cell).join(',') + '\n'; // BOM ให้ Excel อ่านไทยไม่เพี้ยน
    out += [localStamp(new Date()), meta.bookingId, mode, meta.total ?? '', sec(totalMs), steps].map(cell).join(',') + '\n';
    fs.appendFileSync(file, out, 'utf8');
  } catch (e) {
    console.error('Failed to write timing:', e.message); // เขียนพลาดต้องไม่ทำให้จองพัง
  }
}

module.exports = { createCollector, writeTiming };
