// logfiles.js — ที่อยู่ไฟล์ log แยกรายเดือน (logs/2026-10_usage.csv) — ใช้ร่วม logger/timing/filelog/upload-logs
// เดิมไฟล์เดียวสะสมตั้งแต่ มิ.ย. จนโต ~15.6MB (29/10/69) → แยกเดือนละไฟล์ เปิด pivot ได้ทั้งเดือน + ส่ง Drive เฉพาะส่วนใหม่
// ⚠️ ไม่ลบไฟล์เก่าในเครื่อง — พี่วินเก็บไว้ทำผลงานวัดประสิทธิภาพระบบ (~10MB/ปี)
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const KINDS = ['usage.csv', 'timing.csv', 'server.log'];
const MONTH_FILE_RE = /^\d{4}-\d{2}_(usage\.csv|timing\.csv|server\.log)$/;

const month = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthFile = (kind, d) => path.join(LOG_DIR, `${month(d)}_${kind}`);

module.exports = { LOG_DIR, KINDS, MONTH_FILE_RE, monthFile };
