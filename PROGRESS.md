# PROGRESS.md — DNP E-Ticket Auto-fill

## สถานะ: 🟢 ใช้งานได้ + รอบเวลา data-driven (เลิกเดา buffer) — อัพเดทล่าสุด 7/6/69

> 📦 ประวัติงาน + บทเรียนเก่า (setup → 3/6/69) ย้ายไป [PROGRESS_ARCHIVE.md](PROGRESS_ARCHIVE.md)
> 🔧 technical detail/กฎทั้งหมดอยู่ [CLAUDE.md](CLAUDE.md) — ไฟล์นี้เก็บแค่ timeline + สถานะ

## ทำแล้ว ✅ (สรุป — รายละเอียดดู ARCHIVE/CLAUDE.md)
- **ระบบหลักครบ:** warm pool + กรอกอัตโนมัติ (วัน/เวลา/รถหลายคัน/คนหลายคน) หยุดก่อนจ่าย
- **หน้ากาก:** ราคา real-time, ไฟสถานะ login, progress bar, แถบ warm/ดักใบ, ล้างฟอร์ม+Esc
- **log/ops:** usage CSV (แยกไทย/ต่างชาติ) + console อังกฤษ (Windows cmd) + รองรับ Windows (.bat) + ซ่อนหน้าต่างตอนกรอก
- **AUDIT.md #1-5:** กันเงินหาย, graceful shutdown, เด้งจองพรุ่งนี้, lock timeout, pipeline ดักหลายใบ
- **(4/6/69) แก้บั๊ก pipeline** — prunePending ใช้ `page.isClosed()` (ไม่ใช่ isConnected) + `browser.close()` กัน orphan
  → เทส live ผ่าน (3 ใบเต็มคิว→ใบ4 error→ปิดหน้าต่าง 3→2→0). commit `b2e2a01` → lesson (ARCHIVE)

### 🆕 (7/6/69) แก้บั๊ก "บอทไม่กรอก หยุดแค่เลือกวัน+เวลา" — รอบเวลา data-driven (เลิกเดา buffer)
อาการ (อาการเดิมกลับมา): กดยืนยัน 15:12 → บอทเลือกวันได้ เลือกเวลาไม่ได้ ไม่ไปต่อ. **หลักฐาน:** shot-error เห็น
dropdown เวลาเปิดค้าง มีรอบ "11:45-15:30" โชว์อยู่ แต่ usage.csv ว่า "เลือกรอบไม่ได้". **root cause (ยืนยันด้วย
`scripts/diag-timeslot.js` อ่านสด):** DNP **ไม่เอารอบออกจาก dropdown** แต่ทำเป็น `is-disabled` (สีเทาคลิกไม่ติด)
ก่อนเวลาปิดจริง — รอบบ่ายโดน disable ตั้งแต่ ~15:12 (ก่อน 15:30 ตั้ง 18 นาที > buffer 10) → หน้ากากยังเสนอ →
บอทคลิก disabled → Vue ไม่ commit → verify ไม่ผ่าน → retry 3 ครั้ง → ยอมแพ้ (dash/format **ไม่ใช่ปัญหา**).
**แก้แบบไม่เดาเวลา (single source = DNP เอง):** (1) `automation.js` `readTimeSlots()` อ่าน disabled/enabled จริง
ตอน warm → ติดมากับ tab; `selectOption` เจอ `is-disabled` ฟ้องทันที (0.11วิ แทน ~3วิ retry). (2) `pool.js` เก็บ
`slots`+`targetDate` ส่งผ่าน status; วันนี้ปิดทุกรอบ → เด้งอุ่น "พรุ่งนี้" เอง. (3) `server.js` /api/pool-status ส่ง
`slots`+`bookDate` จาก pool. (4) `index.html` โชว์รอบตาม slots จริง (เลิกใช้ buffer) + snap วันตาม pool อัตโนมัติ.
✅ เทส: readTimeSlots (วันนี้ปิดคู่/พรุ่งนี้เปิดคู่) + pool เด้งพรุ่งนี้ + selectOption ฟ้อง 0.11วิ + server path จริง.
commit `d0270d8` push แล้ว + อัพ zip Windows. ⏳ รอเทส Windows จริง. → lesson

## รอทำ / รอตัดสินใจ ⏳
- **ทดสอบ end-to-end จริง**: กด "ต่อไป" ดูหน้าสรุปว่าหยุดถูกที่ + ยังไม่จ่าย (รอพี่วินโอเค เป็นระบบจริงหน่วยงาน)
- **เทส Windows จริงที่ด่าน**: #2 graceful shutdown, pipeline ดักหลายใบ, รอบเวลา data-driven, ซ่อนหน้าต่างสนิท
- สัญชาติต่างชาติ default = "American" — แก้ที่ `config.js` ถ้าพี่วินอยากได้สัญชาติอื่น

## Lesson learned 💡 (เก่ากว่านี้ดู [PROGRESS_ARCHIVE.md](PROGRESS_ARCHIVE.md))
- **เทสผ่าน server path จริง ไม่ใช่แค่ `node script`** — โค้ดถูกแต่ผู้ใช้เจอบัคได้ถ้า server ค้างเก่า (require cache).
  ยืนยัน restart สำเร็จด้วย `lsof -i:5179` + เวลา start (อย่าเชื่อแค่ข้อความ "restart แล้ว")
- **(3/6/69) บัค "ไม่กรอก ค้างหน้าเลือกวัน" = เลือกรอบเวลาที่ DNP ปิดแล้ว — ไม่ใช่โค้ด/pipeline:**
  อาการหลอกมาก. **วิธีดีบักที่ได้ผล: ไล่เทสเป็นชั้นจากในออกนอก** — (1) `warmTab+fillBooking` ตรง (2) `pool→acquire→fill`
  (server path) (3) HTTP `curl /api/book`. + ลองหลาย input (รอบเปิด vs ปิด) จะแยก "โค้ดพัง" ออกจาก "input/เวลา" ได้เร็ว
- **(7/6/69) ต่อยอด — DNP ไม่ "ลบ" รอบออกจาก dropdown แต่ทำเป็น `is-disabled` (คลิกไม่ติด) ก่อนปิดจริง
  เร็วกว่า buffer ที่เดา** (รอบบ่าย disabled ตั้งแต่ ~15:12 ทั้งที่จบ 15:30). คลิก disabled → Vue ไม่ commit → ค้าง.
  **การ "เดาเวลา" (buffer) ไม่มีวันแม่น — DNP เปลี่ยน timing ได้.** ทางแก้ที่จบจริง = **อ่านสถานะจริงจาก DNP**
  (`readTimeSlots` ตอน warm) เป็น single source แทนการเดา + ตาข่ายชั้นสุดท้าย (`selectOption` เช็ก is-disabled).
  วิธีพิสูจน์ root cause: เขียน diag อ่านอย่างเดียว (`scripts/diag-timeslot.js`) เทียบวันนี้ vs พรุ่งนี้ เห็น disabled ต่างชัด
