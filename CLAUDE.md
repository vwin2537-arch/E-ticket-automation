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
npm stop        # ปิดระบบ — ปิด server + เก็บ Chrome (ms-playwright) ที่หลุด orphan ทั้งหมด (Mac เท่านั้น ใช้ lsof)
```
**ปิดปกติ:** กลับไปหน้าต่างที่รัน `npm start` แล้วกด `Ctrl+C` (server ปิด browser ให้เองผ่าน graceful shutdown)
**ถ้าเผลอปิดหน้าต่าง/ค้าง:** `npm stop` กวาดเก็บ orphan ที่ Ctrl+C เก็บไม่ทัน

## GitHub
**Repo:** https://github.com/vwin2537-arch/E-ticket-automation

```bash
# push ครั้งแรก (ทำแล้ว)
git remote add origin https://github.com/vwin2537-arch/E-ticket-automation.git
git branch -M main
git push -u origin main

# push ทั่วไป (หลัง commit แล้ว)
git push

# clone ไปเครื่องใหม่
git clone https://github.com/vwin2537-arch/E-ticket-automation.git
```
⚠️ `.gitignore` exclude: `auth/storageState.json`, `node_modules/`, `logs/usage.csv`, `dnp-eticket-windows.zip`
— ก๊อป session ไปเครื่องอื่นด้วย `auth/storageState.json` เท่านั้น (อย่า push ขึ้น GitHub)
⚠️ **server cache โค้ด:** automation.js ถูก `require` ตอน start — แก้โค้ดแล้วต้อง `npm run restart` เสมอ
ไม่งั้นยังรันโค้ดเก่า (เคยทำให้เจอบัค "ไม่มียานพาหนะ" — ดู PROGRESS)
กรอกในหน้ากาก → กดยืนยัน → หน้ากากขึ้น popup spinner, เบราว์เซอร์กรอกแบบ**ซ่อนนอกจอ** →
พอถึงหน้าสรุป เบราว์เซอร์**เด้งกลับเข้าจอ**ให้พี่วินตรวจ+จ่ายเอง

## โครงไฟล์
- `src/config.js` — ตัวเลือกฟอร์ม (เวลา/ยานพาหนะ/ประเภทผู้เดินทาง + ราคา) + `POOL_SIZE` ← แก้ตรงนี้ถ้าระบบเปลี่ยน
  มี field `en` ทุกประเภท (ยานพาหนะ/ผู้เดินทาง) ไว้โชว์ใน console เป็นอังกฤษ — เพิ่มประเภทใหม่อย่าลืมใส่ `en`
- `src/automation.js` — `warmTab()` (Phase A: เปิด→การ์ด→เลือกวัน + `readTimeSlots()` อ่านรอบจริง) + `fillBooking()`
  (Phase B: เวลา/รถ/คน→สรุป; `selectOption` ฟ้องถ้ารอบ `is-disabled`) + `runBooking()` (warm+fill รวม cold path/เทส)
  + `bookDate()` (seed วันเป้าหมาย: วันนี้ก่อน 15:20 / พรุ่งนี้หลัง)
- `src/pool.js` — warm pool: `init()` อุ่น POOL_SIZE แท็บตอน start, `acquire(date)` หยิบ+เติมคืน. `targetDate` data-driven
  (วันนี้ปิดทุกรอบ → เด้งพรุ่งนี้เอง) + `slots` รอบเวลาจริงจาก DNP — ทั้งคู่ส่งผ่าน `status()`. acquire ทิ้งแท็บไม่ตรง targetDate
- `src/datepicker.js` — เลือกวันใน Element UI date picker
- `src/names.js` — generate ชื่อมั่วๆ (ระบบไม่เช็กชื่อจริง)
- `src/server.js` — Express + API `/api/config`, `/api/book`, `/api/login-status`, `/api/pool-status` (สถานะ warm: ready/warming/size/today)
  + `pendingTabs[]` คิวใบจริงดักรอจ่าย (#5) + `prunePending()` เอาใบที่ จนท.ปิดหน้าต่างแล้วออกจากคิว
  + `shutdown()` จับ SIGINT/SIGTERM ปิด browser ทั้งหมด (pool+pendingTabs+lastDryTab) ก่อนตาย กัน chromium orphan
- `src/logger.js` — เขียน log การใช้งานลง `logs/usage.csv` (logUsage) — เรียกจาก server.js ทุกครั้งที่จอง
  คอลัมน์ท้าย: `คนไทย`/`ต่างชาติ`/`รายละเอียดผู้เดินทาง`. `ensureHeader()` อัพเดท header ไฟล์เดิมเมื่อเพิ่ม column (ไม่ลบแถวเก่า)
  ⚠️ ส่ง zip ไป Windows **ห้ามใส่ logs/usage.csv** (ทับ log จริงของเครื่องด่าน) — header เก่าจะอัพเกรดเองตอนจองครั้งหน้า
- `src/receipt-inject/` — ก๊อป `receipt-core.js`+`content.js` จากโปรเจค `~/dnp-eticket-receipt` (ปุ่มปริ้นใบเสร็จ)
  automation ฉีดเข้าทุกหน้า DNP เพราะ Chromium ของ Playwright ไม่มี Chrome extension — `injectReceiptButton()`
  เรียกผ่าน `context.on('page')` + event `load` ครอบ **ทุกหน้าต่างที่ DNP เปิดใหม่** (⚠️ หน้าตั๋ว QR เข้าอุทยาน
  ที่ต้องปริ้นจริง เด้งเป็น `window.open` ใหม่ — `addInitScript` ครอบ popup ไม่ถึง ต้องดักที่ `context.on('page')`)
  เช็ค host=e-ticket.dnp.go.th กันปุ่มโผล่หน้าจ่ายเงินคนละ domain + เช็ค `window.DNPReceipt` กันฉีดซ้ำ
  **ขนาดกระดาษ 57/80mm:** จนท.เลือกตอนเปิดหน้ากาก (modal ถามครั้งเดียว/start) → POST `/api/paper-size` → server เก็บ
  in-memory + `setReceiptWidth()` → `injectReceiptButton` ฉีด `window.__DNP_RECEIPT_WIDTH` → `receipt-core` render ตามขนาด
  (parametrize `@page`/width/QR/ฟอนต์; 57mm: QR 38mm / 80mm: QR 42mm). ปริ้นไป **default printer** (silent) — จนท.ตั้ง default ให้ตรงขนาดเอง
  ⚠️ **เป็นสำเนา** — แก้ logic ปริ้นที่ `~/dnp-eticket-receipt` แล้วก๊อปทับโฟลเดอร์นี้ (ไม่งั้น 2 ที่ไม่ตรงกัน)
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
**ดักได้หลายใบ (pipeline #5):** ใบจริงที่จองสำเร็จเข้าคิว `pendingTabs[]` (สูงสุด `MAX_PENDING`=3) —
**ไม่ปิดใบเก่า** จนท.กรอกใบถัดไปได้เลยระหว่างคนแรกจ่าย. ใบทดสอบใช้ `lastDryTab` (ใบเดียว ปิดอันเก่า ไม่เข้าคิว).
แยกทดสอบ/จริงกันบัค: กด "โหมดทดสอบ" คั่นระหว่างใบจริงรอจ่าย ใบจริงไม่หาย (เงินไม่หาย)

## ⚠️ รอบเวลา: data-driven จาก DNP จริง — ไม่เดา buffer (แก้ 7/6/69)
**กลไก DNP:** ไม่เอารอบออกจาก dropdown แต่ทำเป็น `is-disabled` (สีเทาคลิกไม่ติด) ก่อนเวลาปิดจริง — และปิด
**เร็วกว่า buffer ที่เดา** (รอบบ่ายโดน disable ตั้งแต่ ~15:12 ทั้งที่จบ 15:30). คลิก disabled = Vue ไม่ commit →
บอทค้าง "เลือกเวลาไม่ได้". **เลิกเดา → อ่านจริง:** `warmTab` เรียก `readTimeSlots()` อ่าน `{text,disabled}` จาก DNP
ติดมากับ tab → `pool` ส่งผ่าน `status().slots` → `/api/pool-status` → หน้ากากโชว์เฉพาะรอบที่ DNP เปิดจริง
(`rebuildTimeSlots` ใช้ `warmCache.slots` ไม่ใช่ buffer). `selectOption` เจอ `is-disabled` ฟ้องทันที (ตาข่ายชั้นสุดท้าย).
**วันเป้าหมาย data-driven (`pool.targetDate`):** seed = `bookDate()` (วันนี้ก่อน 15:20 / พรุ่งนี้หลัง) แต่ถ้าอุ่น "วันนี้"
แล้ว DNP ปิด **ทุกรอบ** → pool เด้งอุ่น "พรุ่งนี้" เอง; หน้ากาก snap วันตาม `bookDate` จาก pool (เว้นพี่วินแก้วันเอง).
`SLOT_CLOSE_BUFFER_MIN` เหลือเป็นแค่ seed ของ `bookDate()` (ไม่ใช้ปิดรอบในหน้ากากแล้ว).
**diag:** `node scripts/diag-timeslot.js <YYYY-MM-DD>` อ่านรอบเวลา+disabled แบบอ่านอย่างเดียว (ไม่จอง) ไว้ debug

## pipeline จองดักหลายใบ (#5) — ✅ ทำแล้ว (3/6/69)
`pendingTabs[]` คิวใบจริงสูงสุด `MAX_PENDING`=3 (config.js). จองใบใหม่ **push เข้าคิว ไม่ปิดใบเก่า**.
หลุดคิวเอง: `prunePending()` กรอง `!page.isClosed()` → จนท.ปิดหน้าต่างใบที่จ่ายเสร็จ = หลุดคิวอัตโนมัติ
⚠️ **ห้ามใช้ `browser.isConnected()` วัด "ปิดหน้าต่าง"** — Playwright `launch()` ถือ connection ไว้ ปิดหน้าต่างแล้ว browser ยังไม่ตาย isConnected ค้าง true คิวไม่มีวันว่าง (เคยเป็นบั๊ก 4/6/69 — พิสูจน์ใน `scripts/test-window-close.js`)
⚠️ **prune ใบที่หลุดต้อง `browser.close()` ด้วย** — ไม่งั้น process orphan ค้างใน Dock สะสมกิน RAM (ปิดหน้าต่าง = ปิดแค่ "หน้าต่าง" ไม่ฆ่า process). orphan ที่หลุดจาก list แล้ว shutdown ก็เก็บไม่ได้ ต้อง `pkill -f ms-playwright` ลบมือ (ไม่แตะ Google Chrome ปกติ)
(ไม่ต้องกดปิดในระบบ). ครบเพดาน → error เตือน ไม่ acquire ไม่ปิดอะไร (กันใบยังไม่จ่ายโดนปิด เงินหาย).
หน้ากากโชว์ "🎫 ดักอยู่ N/3 ใบ" (poll /api/pool-status → `pending`/`maxPending`). เทส `scripts/test-pipeline.js`
(mock pool+fillBooking ไม่ยิง DNP) 18/18 ผ่าน + เทส live จริงผ่าน (3 ใบ→ใบ4 error→ปิดหน้าต่าง pending 3→2→0). ⏳ รอเทส Windows จริง. ปรับเพดานที่ค่าเดียว `MAX_PENDING`

## ซ่อนหน้าต่างตอนกรอก (`automation.js`) — นทท.ที่ด่านเห็นจอเดียวกับที่กดจอง ต้องซ่อนสนิท
- เปิด chromium headful + flags กัน throttle (`--disable-backgrounding-occluded-windows`,
  `--disable-renderer-backgrounding`, `--disable-background-timer-throttling`)
- **แยกตาม OS** (`process.platform`):
  - 🪟 **Windows (เครื่องด่านจริง)**: `--window-position=-32000,-32000` ดันออกนอกจอ = ซ่อนสนิท + เร็ว
    (Windows ยอมให้หน้าต่างหลุดนอกจอ ต่างจาก Mac) + `--kiosk-printing` ปริ้นใบเสร็จเงียบไม่เด้ง dialog
    (เดิมตั้งที่ Chrome ปกติ แต่หน้าสรุป/QR อยู่ใน Chromium ตัวนี้ → ต้องใส่ flag ที่ launch นี้ + ตั้ง thermal เป็น default printer)
  - 🍎 **Mac (เครื่องเทส)**: `tuckWindow()` ซุกเล็ก (380×260) มุมล่างขวา — Mac ดึงหน้าต่างนอกจอกลับเสมอ
    เลยซ่อนสนิทไม่ได้ แต่เป็นแค่เครื่อง dev
- `revealWindow()` — เด้ง**เต็มจอ (maximized)** + foreground ตอนถึงหน้าสรุป/dryRun/error
  ⚠️ ลำดับสำคัญ (พิสูจน์ด้วยการอ่าน `getWindowBounds` บน Mac): **minimize → normal → maximized → bringToFront**
  - minimize→restore = บังคับ OS ยกหน้าต่างมา foreground (bringToFront ดึงแค่ "แท็บ" ในตัว Chromium ไม่ยกหน้าต่างทับ Chrome หน้ากาก)
  - **Mac: setWindowBounds normal+ขนาด ไม่ apply ขนาด** (ค้างที่ขนาด tuck ~500×375) → ต้อง `maximized` ถึงเต็มจอ (1470×847). restore ต้องเป็น `normal` ล้วนๆ (ใส่ bounds คู่จะ error "maximize a minimized window")
  - Windows: หน้าต่างอยู่นอกจอ (-32000) → restore เป็น normal+bounds(60,40,1400×1000) ดึงกลับเข้าจอก่อน แล้ว maximized (แยก `process.platform`)
  - ⚠️ **race จริง:** `setWindowBounds(normal)` ตอบกลับ **ก่อน** OS ออกจาก minimized เสร็จ → ยิง maximized ทันทีจะ error
    "restore to normal first" (เจอเฉพาะหน้าหนักจริง ไม่เจอตอนเทสหน้าว่าง) → ต้อง **retry maximized วนรอ ~120ms ×8** จนสำเร็จ
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
