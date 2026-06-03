// logger.js — เก็บ log การใช้งานลง CSV (เปิดด้วย Excel ได้เลย) ไว้ทำรายงานสรุป
// เขียนต่อท้ายทุกครั้งที่กด "ยืนยัน" ทั้งสำเร็จ/ล้มเหลว ทั้งทดสอบ/จริง
const fs = require('fs');
const path = require('path');
const { VEHICLE_TYPES, TRAVELER_TYPES } = require('./config');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'usage.csv');

const HEADERS = ['วันเวลาที่ใช้', 'วันที่จอง', 'รอบเวลา', 'จำนวนคน', 'จำนวนรถ',
  'ประเภทรถ', 'ยอดเงิน(บาท)', 'เวลาที่ใช้(วินาที)', 'โหมด', 'ผล', 'หมายเหตุ',
  'คนไทย', 'ต่างชาติ', 'รายละเอียดผู้เดินทาง'];

// escape ค่าให้ปลอดภัยในไฟล์ CSV (มี comma / quote / ขึ้นบรรทัด)
const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// วันเวลาท้องถิ่นรูปแบบ YYYY-MM-DD HH:mm:ss
function localStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// แยกผู้เดินทางเป็น ไทย/ต่างชาติ + สรุปรายละเอียดประเภท (เช่น "ผู้ใหญ่ไทย×3, เด็กต่างชาติ×2")
// สัญชาติยึดจาก config (TRAVELER_TYPES) เป็นหลัก เผื่อ frontend ไม่ได้ส่ง nationality มา
function travelerBreakdown(params) {
  let thai = 0, foreign = 0;
  const parts = [];
  for (const t of (params.travelers || [])) {
    if (!t.count) continue;
    const cfg = TRAVELER_TYPES.find((x) => x.match === t.match);
    const nat = (t.nationality ?? cfg?.nationality) === 'Thai' ? 'thai' : 'foreign';
    if (nat === 'thai') thai += t.count; else foreign += t.count;
    parts.push(`${cfg?.label || t.match || '?'}×${t.count}`);
  }
  return { thai, foreign, detail: parts.join(', ') };
}

// อัพเดทแถว header ของไฟล์เดิมให้ตรงกับ HEADERS ปัจจุบัน (กรณีเพิ่ม column ใหม่)
// แถวข้อมูลเก่ายังอยู่ครบ — column ใหม่จะว่างไว้สำหรับแถวเก่า (Excel เปิดได้ปกติ)
function ensureHeader() {
  const want = HEADERS.map(cell).join(',');
  const raw = fs.readFileSync(LOG_FILE, 'utf8');
  const bom = raw.charCodeAt(0) === 0xFEFF ? '﻿' : '';
  const body = bom ? raw.slice(1) : raw;
  const nl = body.indexOf('\n');
  const firstLine = (nl >= 0 ? body.slice(0, nl) : body).replace(/\r$/, '');
  if (firstLine === want) return; // header ตรงแล้ว ไม่ต้องทำอะไร
  const rest = nl >= 0 ? body.slice(nl + 1) : '';
  fs.writeFileSync(LOG_FILE, bom + want + '\n' + rest, 'utf8');
}

// คำนวณยอดเงินรวมจาก params (คน: ใช้ราคาที่ frontend ส่งมา, รถ: lookup จาก config)
function calcTotal(params) {
  const ppl = (params.travelers || []).reduce((s, t) => s + (t.count || 0) * (t.price || 0), 0);
  const veh = (params.vehicles || []).reduce((s, v) => {
    const c = VEHICLE_TYPES.find((x) => x.match === v.match);
    return s + (c ? c.price : 0);
  }, 0);
  return ppl + veh;
}

/**
 * logUsage(params, meta)
 * params = { date, timeSlot, vehicles:[{match,plate}], travelers:[{match,count,price}] }
 * meta   = { durationSec, ok, total, error, dryRun }
 */
function logUsage(params, meta = {}) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const isNew = !fs.existsSync(LOG_FILE);

    const people = meta.total ?? (params.travelers || []).reduce((s, t) => s + (t.count || 0), 0);
    const vehicles = params.vehicles || [];
    const tb = travelerBreakdown(params);
    const row = [
      localStamp(new Date()),
      params.date || '',
      params.timeSlot || '',
      people,
      vehicles.length,
      vehicles.map((v) => v.match).join('; '),
      calcTotal(params),
      meta.durationSec ?? '',
      meta.dryRun ? 'ทดสอบ' : 'จริง',
      meta.ok ? 'สำเร็จ' : 'ล้มเหลว',
      meta.error || '',
      tb.thai,
      tb.foreign,
      tb.detail,
    ].map(cell).join(',');

    // ไฟล์ใหม่: ใส่ BOM (﻿) ให้ Excel เปิดภาษาไทยไม่เพี้ยน + แถว header
    // ไฟล์เดิม: อัพเดท header ถ้ามี column ใหม่ (ไม่งั้น column ใหม่จะไม่มีหัวตาราง)
    let out = '';
    if (isNew) out += '﻿' + HEADERS.map(cell).join(',') + '\n';
    else ensureHeader();
    out += row + '\n';
    fs.appendFileSync(LOG_FILE, out, 'utf8');
  } catch (e) {
    // เขียน log พลาดต้องไม่ทำให้การจองพัง — แค่เตือนใน console
    console.error('Failed to write log:', e.message);
  }
}

module.exports = { logUsage, LOG_FILE };
