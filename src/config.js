// config.js — ข้อมูลตัวเลือกของฟอร์ม DNP (ส่องมาจากระบบจริง 31 พ.ค. 2026)
// ใช้ร่วมกันทั้ง backend (automation) และ frontend (หน้ากาก)

const PARK = {
  name: 'อุทยานแห่งชาติเอราวัณ',
  homeUrl: 'https://e-ticket.dnp.go.th/homePage',
};

// จำนวนแท็บ "อุ่นเครื่อง" (warm) ที่เปิดรอไว้ล่วงหน้า — กดการ์ด+เลือกวันนี้เสร็จแล้ว standby นอกจอ
// พอ จนท.กดยืนยัน หยิบมากรอกได้เลย ไม่ต้องรอ ~6 วิ (เปิดหน้า+คลิกการ์ด+เลือกวัน)
// 3 = เผื่อกรณีกรอกผิดต้องทิ้งใบเก่ากรอกใหม่ pool จะได้ไม่สะดุด (RAM 16GB รับไหว)
const POOL_SIZE = 3;

// จำนวนใบ "จริง" ที่ดักรอจ่ายค้างไว้พร้อมกันได้สูงสุด (pipeline หลายใบ — #5)
// จองใบใหม่ไม่ปิดใบเก่า → จนท.กรอกใบถัดไปได้เลยระหว่างคนแรกกำลังจ่าย
// ใบจ่ายเสร็จ จนท.ปิดหน้าต่างเบราว์เซอร์เอง → ระบบเห็น disconnect แล้วเอาออกจากคิวอัตโนมัติ
// ครบเพดานแล้วกดจองอีก = เตือน (ไม่ปิดอัตโนมัติ กันปิดใบที่ยังจ่ายไม่เสร็จ เงินหาย)
const MAX_PENDING = 3;

// ช่วงเวลา
const TIME_SLOTS = ['08:00 - 11:45', '11:45 - 15:30'];

// ปิดรอบในหน้ากากก่อนเวลาสิ้นสุดจริง N นาที — DNP เอา option รอบออกก่อนเวลาเป๊ะ
// ใช้ค่าเดียวกันทั้ง 2 เรื่อง: (1) ปิดรอบใน dropdown (2) ตัดสิน "วันนี้ปิดรับแล้ว → เด้งไปจองพรุ่งนี้"
// (warm pool + default วันในหน้ากาก ดึงค่านี้ผ่าน /api/config จะได้ consistent ทั้งระบบ)
const SLOT_CLOSE_BUFFER_MIN = 10;

// ประเภทยานพาหนะ (match = ข้อความเฉพาะที่ใช้ค้นหาใน dropdown)
// en = ชื่ออังกฤษไว้โชว์ใน console (หน้าต่างดำ Windows วาดไทยไม่ได้)
const VEHICLE_TYPES = [
  { match: 'ไม่มียานพาหนะ', label: 'ไม่มียานพาหนะ', price: 0, en: 'No vehicle' },
  { match: 'รถจักรยาน', label: 'รถจักรยาน', price: 0, en: 'Bicycle' },
  { match: 'รถจักรยานยนต์', label: 'รถจักรยานยนต์', price: 20, en: 'Motorcycle' },
  { match: 'รถยนต์ 4 ล้อ', label: 'รถยนต์ 4 ล้อ/ส่วนบุคคล', price: 30, en: 'Car (4-wheel)' },
  { match: 'รถยนต์ 6 ล้อ', label: 'รถยนต์ 6 ล้อ', price: 100, en: 'Truck (6-wheel)' },
  { match: 'รถยนต์มากกว่า 6 ล้อ', label: 'รถยนต์ 6-10 ล้อ', price: 200, en: 'Truck (6-10 wheel)' },
  { match: 'อากาศยาน', label: 'อากาศยาน', price: 2500, en: 'Aircraft' },
];

// ประเภทผู้เดินทาง — featured = โชว์เป็นช่องหลักในหน้ากาก, ที่เหลืออยู่ใน "เพิ่มประเภทอื่น"
// nationality = สัญชาติที่จะเลือกให้อัตโนมัติ (Thai / ต่างชาติใช้ตัวแทนหนึ่งสัญชาติ)
// en = ชื่ออังกฤษไว้โชว์ใน console
const TRAVELER_TYPES = [
  { id: 'thai_adult',   match: 'ผู้ใหญ่ชาวไทย',          label: 'ผู้ใหญ่ไทย',       price: 60,  nationality: 'Thai',     featured: true,  en: 'Adult (Thai)' },
  { id: 'thai_child',   match: 'เด็กไทย',                label: 'เด็กไทย (3-14)',   price: 30,  nationality: 'Thai',     featured: true,  en: 'Child (Thai)' },
  { id: 'foreign_adult',match: 'ผู้ใหญ่ชาวต่างชาติ',     label: 'ผู้ใหญ่ต่างชาติ',  price: 300, nationality: 'American', featured: true,  en: 'Adult (Foreign)' },
  { id: 'foreign_child',match: 'เด็กชาวต่างชาติ',        label: 'เด็กต่างชาติ (3-14)', price: 150, nationality: 'American', featured: true, en: 'Child (Foreign)' },
  { id: 'thai_student', match: 'นักเรียน นิสิต',         label: 'นักเรียน/นักศึกษาไทย', price: 30, nationality: 'Thai',  featured: false, en: 'Student (Thai)' },
  { id: 'child_under3', match: 'เด็กอายุต่ำกว่า 3',      label: 'เด็กต่ำกว่า 3 ปี', price: 0,   nationality: 'Thai',     featured: false, en: 'Child under 3' },
  { id: 'monk',         match: 'พระภิกษุ',               label: 'พระ/นักบวช',       price: 0,   nationality: 'Thai',     featured: false, en: 'Monk' },
  { id: 'disabled',     match: 'คนพิการ',                label: 'คนพิการ',          price: 0,   nationality: 'Thai',     featured: false, en: 'Disabled' },
  { id: 'promo_card',   match: 'บัตรประชาสัมพันธ์',       label: 'บัตรประชาสัมพันธ์', price: 0,  nationality: 'Thai',     featured: false, en: 'Promo card' },
  { id: 'thai_group',   match: 'ทัศนศึกษาเป็นหมู่คณะ',    label: 'หมู่คณะไทย',       price: 30,  nationality: 'Thai',     featured: false, en: 'Group (Thai)' },
  { id: 'thai_elder',   match: 'ผู้สูงอายุ ชาวไทย',       label: 'ผู้สูงอายุไทย (60+)', price: 0, nationality: 'Thai',    featured: false, en: 'Elder (Thai)' },
];

module.exports = { PARK, POOL_SIZE, MAX_PENDING, TIME_SLOTS, SLOT_CLOSE_BUFFER_MIN, VEHICLE_TYPES, TRAVELER_TYPES };
