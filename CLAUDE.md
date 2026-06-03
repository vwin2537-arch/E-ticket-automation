# CLAUDE.md — DNP E-Ticket Auto-fill (จองบัตรเอราวัณ)

## คืออะไร
หน้ากาก web app + browser automation ที่กรอกฟอร์มจองบัตรเข้าอุทยานเอราวัณ
(ระบบ e-ticket.dnp.go.th) แทนมือ — กรอกแค่จำนวนคน/รถ/วัน แล้วสคริปต์ไปกรอก
ในระบบจริงให้ **หยุดที่หน้าสรุปก่อนจ่ายเงิน** (พี่วินตรวจ+จ่ายเอง)

## Stack
- Node.js + Playwright (chromium) — คุมเบราว์เซอร์
- Express — เสิร์ฟหน้ากาก + API
- ไม่มี build step, ไม่มี framework frontend (HTML/CSS/JS ล้วน)

## วิธีใช้
```bash
npm run login   # ครั้งแรก/เมื่อ session หมด: เปิดเบราว์เซอร์ให้ login เอง แล้ว save
npm start       # เปิดหน้ากาก + อุ่น warm pool (เปิด POOL_SIZE แท็บกดการ์ด+เลือกวันนี้รอ — ใช้เวลา ~10วิ/แท็บ)
npm run restart # แก้โค้ดแล้วเปิดใหม่ — ฆ่าตัวเก่าที่ถือ port ก่อน (อย่าใช้ start ซ้ำ เดี๋ยว port ชนตายเงียบ)
```
⚠️ **server cache โค้ด:** automation.js ถูก `require` ตอน start — แก้โค้ดแล้วต้อง `npm run restart` เสมอ
ไม่งั้นยังรันโค้ดเก่า (เคยทำให้เจอบัค "ไม่มียานพาหนะ" — ดู PROGRESS)
กรอกในหน้ากาก → กดยืนยัน → หน้ากากขึ้น popup spinner, เบราว์เซอร์กรอกแบบ**ซ่อนนอกจอ** →
พอถึงหน้าสรุป เบราว์เซอร์**เด้งกลับเข้าจอ**ให้พี่วินตรวจ+จ่ายเอง

## โครงไฟล์
- `src/config.js` — ตัวเลือกฟอร์ม (เวลา/ยานพาหนะ/ประเภทผู้เดินทาง + ราคา) + `POOL_SIZE` ← แก้ตรงนี้ถ้าระบบเปลี่ยน
  มี field `en` ทุกประเภท (ยานพาหนะ/ผู้เดินทาง) ไว้โชว์ใน console เป็นอังกฤษ — เพิ่มประเภทใหม่อย่าลืมใส่ `en`
- `src/automation.js` — `warmTab()` (Phase A: เปิด→การ์ด→เลือกวัน) + `fillBooking()` (Phase B: เวลา/รถ/คน→สรุป)
  + `runBooking()` (warm+fill รวม สำหรับ cold path/สคริปต์เทส)
- `src/pool.js` — warm pool: `init()` อุ่น POOL_SIZE แท็บตอน start, `acquire(date)` หยิบ+เติมคืน, ทิ้งแท็บค้างข้ามวัน
- `src/datepicker.js` — เลือกวันใน Element UI date picker
- `src/names.js` — generate ชื่อมั่วๆ (ระบบไม่เช็กชื่อจริง)
- `src/server.js` — Express + API `/api/config`, `/api/book`, `/api/login-status`, `/api/pool-status` (สถานะ warm: ready/warming/size/today)
- `src/logger.js` — เขียน log การใช้งานลง `logs/usage.csv` (logUsage) — เรียกจาก server.js ทุกครั้งที่จอง
  คอลัมน์ท้าย: `คนไทย`/`ต่างชาติ`/`รายละเอียดผู้เดินทาง`. `ensureHeader()` อัพเดท header ไฟล์เดิมเมื่อเพิ่ม column (ไม่ลบแถวเก่า)
  ⚠️ ส่ง zip ไป Windows **ห้ามใส่ logs/usage.csv** (ทับ log จริงของเครื่องด่าน) — header เก่าจะอัพเกรดเองตอนจองครั้งหน้า
- `public/index.html` — หน้ากาก UI (รอบเวลาฉลาด + ไฟสถานะ login + แถบสถานะ warm `1/3→3/3` ตามวันที่ + progress bar ใน popup)
- `scripts/login.js` — login + save session
- `auth/storageState.json` — session (อย่า commit, อย่าแชร์)
- `*-Windows.bat` + `คู่มือ-Windows.md` — สำหรับรันบน Windows (ดูหมายเหตุล่าง)

## Login (สำคัญ)
session เก็บที่ `auth/storageState.json` — **ต้อง login ผ่านเบราว์เซอร์ที่ Playwright เปิด** (`npm run login`
หรือดับเบิลคลิก launcher ข้างล่าง) เท่านั้น. login ใน Chrome ปกติ **ไม่นับ** (Playwright อ่านแค่ session ตัวเอง).
session อยู่ได้นานเป็นปี (refresh_token) → **ก๊อป `auth/storageState.json` ไปเครื่องอื่นได้เลย ไม่ต้อง login ซ้ำ**.
ไฟล์ดับเบิลคลิก login (ไม่ต้องเปิด terminal): Windows = `3-LOGIN-Windows.bat`, Mac = `เข้าระบบ DNP.command`

## รันบน Windows (ให้ลูกน้องใช้)
โค้ดหลัก cross-platform แล้ว — Windows ใช้ `ติดตั้งครั้งแรก-Windows.bat` (ครั้งเดียว) +
`เปิดระบบจองเอราวัณ-Windows.bat` (แทน `npm start`; `npm run restart` ใช้บน Windows ไม่ได้ เพราะ lsof) +
`3-LOGIN-Windows.bat` (login ใหม่เมื่อ session หมด).
ก๊อปทั้งโฟลเดอร์ไป **รวม `auth/` ไม่เอา `node_modules/`**.
⚠️ **ข้อความ console (หน้าต่างดำ) ต้องเป็นอังกฤษล้วน + เลี่ยง emoji** — Windows cmd วาดไทยไม่ได้แม้ตั้ง chcp 65001
(ฟอนต์ console ไม่มี glyph ไทย). แก้ log ใน server/automation/pool/logger/login = อังกฤษ. **แต่ throw Error คงไทย** (เด้งไปหน้ากากเว็บ) ⚠️ แก้ .bat ต้องคง **อังกฤษล้วน+CRLF+ไม่มี BOM**
⚠️ **ชื่อไฟล์ที่ส่งขึ้น Windows ต้องเป็น ASCII** (`1-SETUP`/`2-START`/`README`) — `zip` ของ Mac ไม่ฝัง UTF-8 flag
ชื่อไฟล์ไทยจะ mojibake ตอนแตกบน Windows Explorer. zip ส่งลูกน้อง: `zip -r ... -x "*/node_modules/*" "*/auth/shot-*.png"`

## ข้อสำคัญของระบบ DNP (ที่ทำให้ออกแบบแบบนี้)
1. **ต้องเข้าผ่านหน้าแรกแล้วคลิกการ์ดอุทยาน** — เปิด URL `/ticketDetail/493` ตรงๆ
   จะได้โควต้า=0 ทุกวัน disabled
2. **ลำดับบังคับ:** เลือกวัน → ตัวเลือกอื่น (เวลา/รถ/ผู้เดินทาง) ถึงโหลด
3. ฟอร์มเป็น **Element UI (Vue)** — input ไม่มี name/id ต้องอ้างด้วย placeholder,
   dropdown ต้องคลิกเปิด+คลิก li (ไม่ใช่ `<select>`)
4. **ช่องชื่อต้องพิมพ์แบบ type** (`pressSequentially`) — `fill()` เฉยๆ Vue ไม่รับค่า (ขึ้น error แดง)
5. **กฎวันจอง:** cutoff 15:30 ทุกวัน, ล่วงหน้าได้ 7 วัน — ไม่ hardcode ใน code,
   ปล่อยให้ระบบตัดสิน (ถ้าวัน disabled → automation โยน error แจ้งพี่วิน)
6. ช่องไม่บังคับ (เลขบัตร/เบอร์/วันเกิด/โรค) — ข้ามหมด

## หยุดที่ไหน
หลังกรอกครบ กด "ต่อไป" → หน้าสรุป → **หยุด ไม่จ่ายเงินแทน** (ปล่อย browser เปิดค้างให้พี่วินตรวจ+จ่าย)
ใบใหม่ที่จองสำเร็จ **ปิดใบเก่าอัตโนมัติ** (`lastTab` ใน `server.js`) — จองทีละใบ ใบใหม่มาแทนใบเก่าที่จ่ายเสร็จ/ทิ้ง

## ⚠️ รอบเวลา: ปิดรอบในหน้ากากก่อนเวลาจริง 10 นาที (`SLOT_CLOSE_BUFFER_MIN` ใน index.html)
DNP เอา option รอบออกจาก dropdown **ก่อนเวลาสิ้นสุดเป๊ะ** (เช่นรอบเช้าหายก่อน 11:45) → ถ้า จนท.เลือกรอบที่ใกล้ปิด
บอท `selectOption('เลือกเวลา')` หาไม่เจอ → error "ไม่กรอก ค้างหน้าเลือกวัน". แก้: หน้ากากปิดรอบล่วงหน้า 10 นาที
(`rebuildTimeSlots` หัก buffer) + `automation.js` error เวลาบอกชัด "รอบนี้อาจปิดรับแล้ว ลองเลือกรอบอื่น".
ปรับ buffer ได้ที่ค่าเดียว `SLOT_CLOSE_BUFFER_MIN`. **เทส/เดโมเลี่ยงช่วงคาบเกี่ยวเวลาปิดรอบ** (กันสับสน)

## pipeline จองดักหลายใบ — เคยลอง revert ออก (3/6/69)
เคยลองค้างรอจ่าย 3 ใบ (`pendingTabs`/`MAX_PENDING`/`revealWindow(page,slot)`) แต่ revert กลับ `lastTab` เดิม
(เลื่อนทำ ไม่ใช่ของเสีย — ตอนแรกเข้าใจผิดว่าเป็นต้นเหตุบัค "ไม่กรอก" จริงๆ คือรอบเวลา ↑). ทำใหม่ค่อยเทสให้ครบ

## ซ่อนหน้าต่างตอนกรอก (`automation.js`) — นทท.ที่ด่านเห็นจอเดียวกับที่กดจอง ต้องซ่อนสนิท
- เปิด chromium headful + flags กัน throttle (`--disable-backgrounding-occluded-windows`,
  `--disable-renderer-backgrounding`, `--disable-background-timer-throttling`)
- **แยกตาม OS** (`process.platform`):
  - 🪟 **Windows (เครื่องด่านจริง)**: `--window-position=-32000,-32000` ดันออกนอกจอ = ซ่อนสนิท + เร็ว
    (Windows ยอมให้หน้าต่างหลุดนอกจอ ต่างจาก Mac)
  - 🍎 **Mac (เครื่องเทส)**: `tuckWindow()` ซุกเล็ก (380×260) มุมล่างขวา — Mac ดึงหน้าต่างนอกจอกลับเสมอ
    เลยซ่อนสนิทไม่ได้ แต่เป็นแค่เครื่อง dev
- `revealWindow()` (CDP `setWindowBounds` normal + bringToFront) — เด้งเต็มจอตอนถึงหน้าสรุป/dryRun/error
- screenshot **ต้องทำหลัง revealWindow เสมอ** (ถ้าหน้าต่างถูกย่อ/ซ่อน render จะหยุด → screenshot ค้าง)
- หน้ากากโชว์ popup overlay เต็มจอเขียวกรม + spinner + **progress bar simulated** (`#overlay`) ข้อความ**ทางการ** (เผื่อ นทท.เห็นจอ)
  — progress bar ไม่ใช่ % จริง (`/api/book` ไม่ stream) วิ่งเข้าใกล้ 90% แล้วเด้ง 100% เมื่อ server ตอบ
- `/api/login-status` **cache 5 นาที** (`?force=1` = ตรวจใหม่) — ไม่งั้นทุก refresh เปิด browser เช็ก = ช้า 6 วิ
- ⛔ **3 วิธีที่ลองแล้วใช้ไม่ได้** (อย่าทำซ้ำ — ดู PROGRESS lesson):
  (1) `page.route` บล็อกรูป → ช้า 4 เท่า + โลโก้หาย
  (2) `minimize` หน้าต่าง → ช้า 5 เท่า (Chrome throttle ตอนย่อ)
  (3) headless กรอกแล้ว handoff ไป headful → หน้าสรุป DNP อยู่ใน memory ไม่มี URL เฉพาะ ข้ามเบราว์เซอร์ไม่ได้

## Persona
มุก (ไข่มุก) เลขาฯ พี่วิน — ภาษาไทยเป็นกันเอง ลงท้าย "ค่ะ"
