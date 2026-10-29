# โครงไฟล์ — หน้าที่แต่ละไฟล์ + API + log

> แยกออกจาก `CLAUDE.md` เมื่อ 28/10/69 (คุมขนาดไฟล์ที่โหลดทุก session) — เขียนบันทึกใหม่ของเรื่องนี้ต่อในไฟล์นี้

## โครงไฟล์
- `src/config.js` — ตัวเลือกฟอร์ม (เวลา/ยานพาหนะ/ประเภทผู้เดินทาง + ราคา) + `POOL_SIZE` + `LOG_UPLOAD`(url/secret ส่ง log → Drive) ← แก้ตรงนี้ถ้าระบบเปลี่ยน
  มี field `en` ทุกประเภท (ยานพาหนะ/ผู้เดินทาง) ไว้โชว์ใน console เป็นอังกฤษ — เพิ่มประเภทใหม่อย่าลืมใส่ `en`
- `src/automation.js` — `warmTab()` (Phase A: เปิด→การ์ด→เลือกวัน + `readTimeSlots()` อ่านรอบจริง) + `fillBooking()`
  (Phase B: เวลา/รถ/คน→สรุป; `selectOption` ฟ้องถ้ารอบ `is-disabled`) + `runBooking()` (warm+fill รวม cold path/เทส)
  + `bookDate()` (วันเป้าหมาย = **วันนี้เสมอ** — ไม่เด้งพรุ่งนี้อัตโนมัติ)
- `src/pool.js` — warm pool: `init()` อุ่น POOL_SIZE แท็บตอน start, `acquire(date)` หยิบ+เติมคืน. `targetDate` = วันนี้เสมอ
  + `slots` รอบเวลาจริงจาก DNP — ทั้งคู่ส่งผ่าน `status()`. acquire ทิ้งแท็บไม่ตรง targetDate
- `src/datepicker.js` — เลือกวันใน Element UI date picker
- `src/names.js` — generate ชื่อมั่วๆ (ระบบไม่เช็กชื่อจริง)
- `src/server.js` — Express + API `/api/config`, `/api/book`, `/api/book-progress` (ความคืบหน้าจองที่วิ่งอยู่: stage/current/total/done/result — หน้ากาก poll โชว์ x/N + กู้ผลถ้า fetch หลุด), `/api/login-status`, `/api/pool-status` (สถานะ warm: ready/warming/size/today), `/api/shutdown` (ปุ่มปิด: ส่ง log→shutdown→exit 0; บล็อกถ้ามี pending)
  ⚠️ **จองกลุ่มใหญ่ห้ามใช้ timeout ตายตัวครอบทั้งงาน** (5/7/69): เดิม `BOOK_TIMEOUT_MS` fixed 2 นาที → 30-40 คน (~3.5วิ/คน) โดนตัดกลางคัน = "เด้งออก/รีเซตเอง" ที่ด่าน. แก้เป็น `withStallGuard` **watchdog นับจาก progress ล่าสุด** (`progress.at` อัปเดตทุกครั้งที่ `onProgress`) — จองกี่คนก็ไม่โดนตัดถ้ายังคืบหน้า ตัดเฉพาะค้างจริงเกิน `BOOK_STALL_MS`(2นาที). อย่า revert กลับ fixed timeout
  + `pendingTabs[]` คิวใบจริงดักรอจ่าย (#5) + `prunePending()` เอาใบที่ จนท.ปิดหน้าต่างแล้วออกจากคิว
  + `shutdown()` จับ SIGINT/SIGTERM ปิด browser ทั้งหมด (pool+pendingTabs+lastDryTab) ก่อนตาย กัน chromium orphan
- `src/filelog.js` — `install()` ดักทุก `console.log/error` + `uncaughtException/unhandledRejection` เขียนลง `logs/server.log`
  (เดิม console หายกับหน้าต่างดำ ติดตามบัคไม่ได้). เรียกบรรทัดแรกสุดของ server.js (ก่อน log แรก). crash → log แล้ว `exit(1)` (.bat เห็น+ค้างจอ)
- `src/logfiles.js` — ที่อยู่ไฟล์ log **รายเดือน** `logs/YYYY-MM_usage.csv|_timing.csv|_server.log` (single source ให้ logger/timing/filelog/upload-logs) · ⚠️ **ห้ามลบไฟล์เก่าในเครื่อง** (พี่วินเก็บทำผลงานวัดประสิทธิภาพ ~10MB/ปี)
- `scripts/upload-logs.js` — ส่งแบบเดียวกับแอปมือถือ (29/10/69): ไฟล์รายเดือน → ส่งเฉพาะ byte ใหม่ `mode=append` + `from/to` (Apps Script ข้ามก้อนซ้ำ) ก้อน ≤900KB ตัดที่ขึ้นบรรทัด · state `logs/upload-state.json` · timeout 60วิ
  Drive = `<ชื่อเครื่อง>/2026-10_usage.csv` 1 ไฟล์/ชนิด/เดือน · ไฟล์สะสมแบบเก่า (`logs/usage.csv` ฯลฯ) ส่งแบบเต็มครั้งสุดท้าย → ย้าย `logs/legacy/until-<วันที่>_*` (legacy พลาดไม่ขวางไฟล์รายเดือน)
  server ส่งเอง: เปิดระบบ 1 นาที + ทุก 30 นาที + ปุ่มปิด · RESET.bat เรียก CLI · ⚠️ ที่มา: เดิมส่งทั้งก้อนสะสมเฉพาะตอนกดปุ่มปิด → โต 15.6MB ส่งไม่ทัน 10วิ log หยุดขึ้น Drive 27/10/69
  เทส: `gas-mock` รัน Code.gs จริงบน Drive ปลอม (scratch) — ส่งซ้ำ/คำตอบหาย/เน็ตล่ม/ไฟล์ไทย 3.8MB หลายก้อน ผ่าน
- `src/log-upload.local.js` — **url+secret ส่ง log (gitignore, repo public ห้ามหลุด)** — config.js `require` override ถ้ามี. ก๊อปไปเครื่องด่านด้วย
- `apps-script/Code.gs` + `README-deploy.md` — Apps Script web app รับ log เขียนลง Drive (พี่วิน deploy เอง ตั้ง FOLDER_ID+SECRET → URL ใส่ `config.js`)
  + `mode=append` (27/10/69 มือถือ, 29/10/69 +PC) ต่อท้าย `mobile-<รหัส>/<วันที่>.csv` และ `<เครื่อง>/YYYY-MM_<ชนิด>` (ชื่อไฟล์ตาม `APPEND_FILE_RE`/≤1MB) · `from/to` + Script Properties `sent:<เครื่อง>/<ไฟล์>` กันต่อท้ายซ้ำ · ทาง PC เดิมไม่เปลี่ยน · redeploy = Manage deployments → ✏️ → **New version** (ห้าม New deployment = URL ใหม่)
- `src/timing.js` — จับเวลาแต่ละ step ของการกรอก → **1 แถว/ใบ** `รวม(วินาที)` + `แยกขั้น` (`acquire0.0 sel_type0.8 ...` รวมทุกคน) ลง `logs/YYYY-MM_timing.csv` (เดิม long format 1แถว/step โต ~100KB/วัน → เปลี่ยน 29/10/69)
  `createCollector()` → ส่งเข้า `fillBooking(opts.timing)` (helper `T()` no-op ถ้าไม่ส่ง) + server วัด `acquire`. gitignore + ส่ง Drive
- `scripts/diag-selectopt.js` — debug `selectOption` แยกเวลา phase + นับ attempt + ดู network (อ่านอย่างเดียว ไม่จอง) `node scripts/diag-selectopt.js [YYYY-MM-DD]`
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
- `public/index.html` — หน้ากาก UI (รอบเวลาฉลาด + ไฟสถานะ login + แถบสถานะ warm `1/3→3/3` ตามวันที่ + popup จอง: **progress bar % จริง** (poll `/api/book-progress`, traveler=12→95%) + ข้อความทุกขั้น (เตรียม/เวลา/รถ/รายการที่ x/N/สรุป) + เวลานับ 0:0X)
- `scripts/login.js` — login + save session
- `auth/storageState.json` — session (อย่า commit, อย่าแชร์)
- `*-Windows.bat` + `คู่มือ-Windows.md` — สำหรับรันบน Windows (ดูหมายเหตุล่าง)
