// names.js — generate ชื่อมั่วๆ ที่ดูเป็นธรรมชาติ (ระบบ DNP ไม่เช็กชื่อจริง)

const thaiFirst = ['สมชาย', 'สมหญิง', 'วิชัย', 'ประเสริฐ', 'มานะ', 'ปรีชา', 'สุนิสา',
  'อรทัย', 'กิตติ', 'ธนากร', 'นภา', 'พรชัย', 'วันเพ็ญ', 'สมศักดิ์', 'จิราพร',
  'ณัฐพล', 'ศิริพร', 'อนุชา', 'รัตนา', 'พิมพ์ใจ'];
const thaiLast = ['ใจดี', 'รักษาศักดิ์', 'แสงทอง', 'มั่นคง', 'ศรีสุข', 'พงษ์พันธ์',
  'บุญมา', 'ทองดี', 'สุขเกษม', 'วงศ์ไทย', 'จันทร์เพ็ญ', 'ภักดี', 'เจริญสุข',
  'ประเสริฐศรี', 'อยู่สบาย'];

const interFirst = ['John', 'Michael', 'David', 'James', 'Robert', 'Emma', 'Olivia',
  'Sophia', 'William', 'Daniel', 'Anna', 'Maria', 'Thomas', 'Laura', 'Peter'];
const interLast = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia',
  'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Lee', 'Walker', 'Hall', 'Young'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function thaiName() {
  return `${pick(thaiFirst)} ${pick(thaiLast)}`;
}

function interName() {
  return `${pick(interFirst)} ${pick(interLast)}`;
}

// คืน array ชื่อตามจำนวน — ไม่ซ้ำกันในชุดเดียว
function generateNames(generator, count) {
  const set = new Set();
  let guard = 0;
  while (set.size < count && guard < count * 50) {
    set.add(generator());
    guard++;
  }
  // เผื่อสุ่มชนกันจนครบไม่ได้ ก็เติมต่อท้ายด้วยเลข
  const out = Array.from(set);
  while (out.length < count) out.push(`${generator()} ${out.length + 1}`);
  return out;
}

module.exports = {
  thaiNames: (n) => generateNames(thaiName, n),
  interNames: (n) => generateNames(interName, n),
};
