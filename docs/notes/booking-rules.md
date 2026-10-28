# รอบเวลา data-driven + pipeline ดักหลายใบ

> แยกออกจาก `CLAUDE.md` เมื่อ 28/10/69 (คุมขนาดไฟล์ที่โหลดทุก session) — เขียนบันทึกใหม่ของเรื่องนี้ต่อในไฟล์นี้

## ⚠️ รอบเวลา: data-driven จาก DNP จริง — ไม่เดา buffer (แก้ 7/6/69)
**กลไก DNP:** ไม่เอารอบออกจาก dropdown แต่ทำเป็น `is-disabled` (สีเทาคลิกไม่ติด) ก่อนเวลาปิดจริง — และปิด
**เร็วกว่า buffer ที่เดา** (รอบบ่ายโดน disable ตั้งแต่ ~15:12 ทั้งที่จบ 15:30). คลิก disabled = Vue ไม่ commit →
บอทค้าง "เลือกเวลาไม่ได้". **เลิกเดา → อ่านจริง:** `warmTab` เรียก `readTimeSlots()` อ่าน `{text,disabled}` จาก DNP
ติดมากับ tab → `pool` ส่งผ่าน `status().slots` → `/api/pool-status` → หน้ากากโชว์เฉพาะรอบที่ DNP เปิดจริง
(`rebuildTimeSlots` ใช้ `warmCache.slots` ไม่ใช่ buffer). `selectOption` เจอ `is-disabled` ฟ้องทันที (ตาข่ายชั้นสุดท้าย).
**วันเป้าหมาย = "วันนี้" เสมอ (`pool.targetDate`):** `bookDate()`=วันนี้ — **ไม่เด้งพรุ่งนี้อัตโนมัติ** (15/6/69 แก้:
นทท.ที่ด่าน=walk-in เข้าวันนี้ การเด้งพรุ่งนี้เงียบๆ ทำให้จ่ายเงินผิดวัน). ถ้า DNP ปิด **ทุกรอบ** ของวันนี้ →
หน้ากากดับปุ่มจอง + ขึ้นแบนเนอร์แดง `#todayClosed` "วันนี้หมดเวลาจองแล้ว" + ปุ่ม "จองล่วงหน้าพรุ่งนี้ →"
(`bookTomorrow()` set วัน=พรุ่งนี้ `dateTouched=true` → cold path warm สด). **จนท.ต้องกดยืนยันเอง ไม่เด้งให้**.
`SLOT_CLOSE_BUFFER_MIN` ใช้แค่ปิดรอบฝั่ง DNP — `bookDate()` ไม่ใช้แล้ว.
⚠️ **ปุ่มจอง `#go` มี 2 เงื่อนไขคุม (login + วันนี้ปิด) → รวมที่ `syncGoButton()` จุดเดียว** อ่าน `loginOK`+`todayClosed`
พร้อมกัน. **ห้ามเซ็ต `$('go').disabled` ตรงๆ จากที่อื่น** (เคยเป็นบั๊ก: checkLoginStatus async เสร็จทีหลังเปิดปุ่มทับแบนเนอร์).
**diag:** `node scripts/diag-timeslot.js <YYYY-MM-DD>` อ่านรอบเวลา+disabled แบบอ่านอย่างเดียว (ไม่จอง) ไว้ debug

## pipeline จองดักหลายใบ (#5) — ✅ ทำแล้ว (3/6/69)
`pendingTabs[]` คิวใบจริงสูงสุด `MAX_PENDING`=3 (config.js). จองใบใหม่ **push เข้าคิว ไม่ปิดใบเก่า**.
หลุดคิวเอง: `prunePending()` กรอง `!page.isClosed()` → จนท.ปิดหน้าต่างใบที่จ่ายเสร็จ = หลุดคิวอัตโนมัติ
⚠️ **ห้ามใช้ `browser.isConnected()` วัด "ปิดหน้าต่าง"** — Playwright `launch()` ถือ connection ไว้ ปิดหน้าต่างแล้ว browser ยังไม่ตาย isConnected ค้าง true คิวไม่มีวันว่าง (เคยเป็นบั๊ก 4/6/69 — พิสูจน์ใน `scripts/test-window-close.js`)
⚠️ **prune ใบที่หลุดต้อง `browser.close()` ด้วย** — ไม่งั้น process orphan ค้างใน Dock สะสมกิน RAM (ปิดหน้าต่าง = ปิดแค่ "หน้าต่าง" ไม่ฆ่า process). orphan ที่หลุดจาก list แล้ว shutdown ก็เก็บไม่ได้ ต้อง `pkill -f ms-playwright` ลบมือ (ไม่แตะ Google Chrome ปกติ)
(ไม่ต้องกดปิดในระบบ). ครบเพดาน → error เตือน ไม่ acquire ไม่ปิดอะไร (กันใบยังไม่จ่ายโดนปิด เงินหาย).
หน้ากากโชว์ "🎫 ดักอยู่ N/3 ใบ" (poll /api/pool-status → `pending`/`maxPending`). เทส `scripts/test-pipeline.js`
(mock pool+fillBooking ไม่ยิง DNP) 18/18 ผ่าน + เทส live จริงผ่าน (3 ใบ→ใบ4 error→ปิดหน้าต่าง pending 3→2→0). ⏳ รอเทส Windows จริง. ปรับเพดานที่ค่าเดียว `MAX_PENDING`
