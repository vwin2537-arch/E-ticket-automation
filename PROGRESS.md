# PROGRESS.md — DNP E-Ticket Auto-fill

## สถานะ: 🟢 ใช้งานได้ + ทน "เน็ตด่านวูบ" (goto retry + pool=1) — อัพเดทล่าสุด 20/7/69

### 🆕 (20/7/69) เครื่องด่านบางเครื่องเน็ตวูบ → บอทค้าง + แบนเนอร์ "ออกจากระบบ" หลอก
**โจทย์ (log จริง DESKTOP-8VP1TLN):** เครื่องนึงเชื่อม DNP ยากมาก (อีกเครื่องปกติ) — Chrome ธรรมดาเข้าได้ แต่บอทค้าง
- **root cause = เน็ตวูบ ไม่ใช่โค้ด/ไม่ใช่เครื่องพัง:** log ฟ้องสำเร็จ↔ล้ม **สลับกันในนาทีเดียว** (52 สำเร็จ + 47 ล้มวันนี้)
  error เป็น `Timeout`/`ERR_CONNECTION_TIMED_OUT`/`ERR_NAME_NOT_RESOLVED`/`ERR_NETWORK_CHANGED` = network layer วูบ
  → ถ้าเป็น config Playwright (proxy/AV) ต้องเจ๊งตลอด ไม่มีทางสำเร็จ 52 ครั้ง. Chrome รอด = เปิดตอนเน็ต "up"
- **แก้ (ทำให้ทนเน็ตแย่ ไม่ใช่แก้ config):** ดู CLAUDE.md note ⚡ "ทนเน็ตวูบ"
  - `gotoWithRetry()` เข้าหน้า DNP ลองใหม่ 3 รอบ backoff (warmTab + checkLogin) — วูบครั้งเดียวไม่กลายเป็นค้าง
  - **POOL_SIZE 3→1** ยิงเน็ตเบา กิน RAM น้อย (แลก: กรอกผิดต้องทิ้งใบ warm สด ~6วิ)
  - `checkLogin` แยก 3 สถานะ in/out/**neterror** → หน้ากากขึ้น "📡 เน็ตมีปัญหา" แทน "❌ ออกจากระบบ" (หลอก) + ไม่บล็อกปุ่มจอง
- ✅ เทส: retry ลอง 3 รอบจริงแล้วโยน / goto ผ่านรอบแรกไม่มี penalty (checkLogin สด→`out`). commit `4920951`
- ⏳ **รอเทสเครื่องด่านจริง:** อัปเดต **เครื่องมีปัญหาเครื่องเดียว** (`4-UPDATE-Windows.bat`) — เครื่องปกติ **ไม่ต้องกด = ไม่กระทบ**

### 🆕 (5/7/69) แก้จองกลุ่มใหญ่เด้งออก + popup โชว์สถานะจริง x/N + % จริง + เวลานับ
**โจทย์ (เจอจาก user จริงที่ด่าน):** จอง 30-40 คน → เกิน 2 นาที → ระบบ "เด้งออก/รีเซตเอง" จองไม่ได้ + popup ดูเหมือนค้าง
- **root cause:** `server.js` `BOOK_TIMEOUT_MS` fixed 2 นาทีครอบทั้งงาน — 1 คน ~3.5วิ → 35 คน ≈ เกิน 2 นาที = โดนตัดกลางคัน
- **แก้:** เปลี่ยนเป็น **watchdog จับ "ค้างจริง"** (`withStallGuard` นับจาก progress ล่าสุด) → จองกี่คนก็ไม่โดนตัดถ้ายังคืบหน้า
  → CLAUDE.md server.js note. `BOOK_STALL_MS` (env override ได้ให้เทสย่นเวลา)
- **progress จริง:** `fillBooking(onProgress)` รายงานทุกขั้น (time/vehicle/traveler i/N/summary) → `/api/book-progress`
  หน้ากาก poll ทุกวิ → **bar เป็น % จริง** (traveler = 12→95%, เลิก 90%-หลอก-ค้าง) + ข้อความทุกขั้นตั้งแต่วิแรก + **เวลานับ 0:0X**
- **fetch หลุด (Chrome ตัด ~5 นาทีงานใหญ่มาก) → กู้ผลผ่าน `/api/book-progress`** (เช็ก startedAt กันหยิบใบเก่า) ไม่ขึ้น error หลอก
- ✅ เทส: `scripts/test-progress.js` (mock) 9/9 — watchdog ไม่ตัดงานที่คืบหน้า, ตัดงานค้างจริง, progress ไหล + Playwright UI test เห็น bar/สถานะ/เวลาวิ่งจริง. เดิม test-pipeline 18/18 ยังผ่าน. commit `2484aa1`
- ⏳ **รอเทส Windows ด่านจริง:** จอง 30-40 คนผ่านตลอด + เลข x/N + เวลาวิ่งตามจริง

### 🆕 (17/6/69) วิเคราะห์ความเร็ว + timing instrumentation (วัดก่อน optimize)
**โจทย์:** อยากให้บอทกรอกไวขึ้น — วัด breakdown จริงก่อน ไม่เดา
- **เพิ่มเครื่องวัด:** `src/timing.js` (collector → `logs/timing.csv` long format 1แถว/step) ฝังใน `automation.js fillBooking`
  (helper `T()` no-op ถ้าไม่ส่ง timing ไม่กระทบ path อื่น) + `server.js` วัด acquire + `upload-logs` ส่ง timing.csv ด้วย.
  `scripts/diag-selectopt.js` debug selectOption แยก phase (รับ date argv รัน cutoff แล้วใช้พรุ่งนี้ได้)
- **ผลวิเคราะห์ (ข้อมูลจริง จาก play 21 ใบ + diag) → CLAUDE.md "ความเร็ว":**
  - **2วิ/คนเพิ่ม = DNP timer ในหน้าเขาเอง เร่งไม่ได้** (คงที่ 2009-2035ms, ไม่มี network, force-click พัง, รอ-แล้ว-คลิกแย่กว่า)
    — Playwright คลิกทันทีที่ element พร้อมแล้ว = เร็วสุดเท่าที่ทำได้
  - acquire 7วิที่เห็น = **artifact เทส** (จองพรุ่งนี้หลัง cutoff; pool warm แค่วันนี้); prod จองวันนี้ acquire≈0
- ✅ **(17/6/69) แก้แล้ว: `waitForTimeout(3000)` หลังกด "ต่อไป" → poll ปุ่ม "เช็คเอาท์" หน้าสรุป** (`automation.js` step 7).
  ไม่ต้องรันจองจริงหา selector — อ่านจาก `auth/shot-summary.png` (จองจริง 13/6) เห็นปุ่ม "เช็คเอาท์" ในกล่องสรุป →
  `waitFor({state:'visible',timeout:8000}).catch()`. ปกติ <1วิ ประหยัด ~2วิ/ใบ, fallback = ถ่ายภาพต่อถ้า DNP เปลี่ยน UI.
  `node -c` ผ่าน. ⏳ **verify รอบจองจริงรอบหน้า** (path นี้ dryRun ไม่แตะ — เทสไม่ได้จนกว่าจะจองจริง)
- ⏳ **next (optional):** pre-warm "พรุ่งนี้" (เผื่อจองเย็นหลัง cutoff — acquire cold ~7วิ เฉพาะวันที่ pool ไม่ได้ warm)

### 🆕 (15/6/69) เลิกเด้งจองพรุ่งนี้อัตโนมัติ — default "วันนี้" เสมอ + ปุ่มยืนยันพรุ่งนี้
**โจทย์ (เจอจาก user จริง):** หลัง ~15:00 DNP ปิดจองของวันนี้ → ระบบเด้ง default เป็น "พรุ่งนี้" เงียบๆ →
นทท. walk-in ที่มาเข้า **วันนี้** โดนกรอก+จ่ายเงินเป็นบัตร **พรุ่งนี้** โดยไม่มีใครทันสังเกต = คลาดเคลื่อน
(ขัด design เดิม AUDIT #3 ที่เคยขอให้เด้งพรุ่งนี้ — สมมติฐานเดิมผิดหน้างาน: ที่ด่านทุกคน=walk-in เข้าวันนี้ ด่านปิด 15:30)
- **แก้ (ลบ auto-advance 3 จุด):** `automation.js bookDate()` คืนวันนี้เสมอ / `pool.js` ลบบล็อกเด้ง warm พรุ่งนี้
  (`targetDate`=วันนี้เสมอ) / `index.html bookDateLocal()` วันนี้เสมอ — เก็บ orphan (`TIME_SLOTS/BUFFER`, `tomorrowISO/todayISO`, `slotEndMin`)
- **วันนี้ DNP ปิดทุกรอบ → ไม่เด้งพรุ่งนี้เอง** แต่ดับปุ่มจอง + แบนเนอร์แดง `#todayClosed` "วันนี้หมดเวลาจองแล้ว"
  + ปุ่ม "📅 จองล่วงหน้าพรุ่งนี้ →" (`bookTomorrow()` set วัน=พรุ่งนี้ `dateTouched=true` → cold path เดิม). **จนท.กดยืนยันเอง**
  → กันจ่ายผิดวัน 100% (ปุ่มวันนี้ดับสนิท) + ยังจองพรุ่งนี้ได้ถ้าจงใจ
- **บั๊กตอนเทส live:** `#go` มี 2 ตัวคุม (login + วันนี้ปิด) เขียนทับกันแบบ last-writer (checkLoginStatus async
  เสร็จทีหลัง→เปิดปุ่มทับ) → รวมเป็น gate เดียว `syncGoButton()` อ่าน `loginOK`+`todayClosed` พร้อมกัน
- ✅ **verify (live หน้ากากจริง 15/6/69 เย็น DNP ปิดวันนี้):** วันที่=วันนี้ / แบนเนอร์แดงโผล่ / **ปุ่มจองดับ** /
  dropdown "ปิดรับจองแล้ว" / กด "จองพรุ่งนี้"→วัน=16/6 แบนเนอร์ซ่อน ปุ่มจองเปิด (เทสด้วย playwright headless) + `node -c` ผ่าน
- ⏳ **รอ:** อัพเดทเครื่องด่าน (`4-UPDATE-Windows.bat` git pull) + เทสจองพรุ่งนี้จนถึงหน้าสรุปจริง

### 🆕 (13/6/69) เลิก zip → ปุ่มอัพเดท `4-UPDATE-Windows.bat` (git pull)
**โจทย์:** เดิมอัพเดท = แตก zip เป็นโฟลเดอร์ใหม่ → log/auth อยู่คนละโฟลเดอร์ ต้องคอยก๊อปมือ ไม่มาตรฐาน
- **แก้:** ปุ่มเดียวดับเบิลคลิก — ตรวจเองว่าครั้งแรก (git init + remote + `reset --hard origin/main`) หรืออัพเดทปกติ (`git pull`)
  + `npm install` เฉพาะตอน package เปลี่ยน. **logs/auth gitignore อยู่แล้ว → ไม่ถูกแตะ log ต่อเนื่อง ไม่ต้องก๊อป**
- เช็ค Git ในเครื่อง ไม่มี → บอกลิงก์ git-scm.com ลงครั้งเดียว (เหมือน Node.js). repo เป็น public → pull ไม่ต้อง login
- อัพเดท README-Windows ส่วนที่ 3 + CLAUDE.md ส่วน GitHub
- ⏳ **รอ:** ลง Git for Windows ที่ด่าน + วางไฟล์ปุ่มลงโฟลเดอร์เดิมครั้งเดียว + ดับเบิลคลิกทดสอบครั้งแรกจริง

### 🆕 (13/6/69) ปุ่มปิดการทำงาน + กู้ระบบ + ส่ง log ขึ้น Drive อัตโนมัติ
**โจทย์:** จนท. งงแล้วเผลอปิดหน้าต่างดำ (command line) → server ตาย Chrome บอทค้างเต็มจอ ระบบเออเรอ + พี่วินอยากดูบัคทางไกล
- **เคส A (หน้าต่างยังเปิด): ปุ่ม "ปิดการทำงาน" บนหน้ากาก** → confirm modal → `POST /api/shutdown` →
  ส่ง log ขึ้น Drive → เก็บ browser (`shutdown()` เดิม) → `process.exit(0)`. แก้ `2-START.bat` เป็น `if errorlevel 1 pause`
  (exit 0 = ปิดปกติ → หน้าต่างปิดเอง / crash = ค้างให้เห็น error) — แทน Ctrl+C. มีใบ pending ค้าง = บล็อก ไม่ปิด (กันเงินหาย)
- **เคส B (เผลอปิดหน้าต่าง Chrome ค้าง): `RESET-Windows.bat`** ดับเบิลคลิกเดียว → kill server เก่า(port) +
  กวาด Chrome **เฉพาะ playwright** (PowerShell filter `ms-playwright` ไม่แตะ Chrome ปกติ) + ส่ง log + เปิดระบบใหม่ (+ `กู้ระบบเอราวัณ.command` ไว้เทส Mac)
- **ส่ง log → Google Drive (Apps Script):** `src/filelog.js` ดักทุก console+crash เขียน `logs/server.log` อัตโนมัติ
  (เดิม console หายกับหน้าต่างดำ) → `scripts/upload-logs.js` POST `usage.csv`+`server.log` ไป Apps Script web app
  (best-effort 10วิ, แยกโฟลเดอร์ตามชื่อเครื่อง รองรับหลายด่าน). **ไม่ส่ง `server-live.log` เดิม** (ขยะ ไม่เคยถูกเขียนอัตโนมัติ)
- **🔐 url+secret แยกไป `src/log-upload.local.js` (gitignore)** — repo เป็น public ห้ามให้ secret หลุด; config.js `require` override ถ้ามี. ก๊อปไปเครื่องด่านด้วย (เหมือน auth/)
- ✅ **เทสครบ:** filelog เขียนไฟล์, `/api/shutdown` → ok → exit 0, deploy Apps Script + upload จริง `200` → **verify ผ่าน MCP เห็นไฟล์ขึ้น Drive จริง** (โฟลเดอร์ Erawan-Logs แยกตามชื่อเครื่อง)
- ⏳ **รอ:** เทส `.bat` บน Windows ด่านจริง (taskkill/PowerShell กวาด playwright + หน้าต่างปิดเองตอนกดปิด) + ก๊อป `log-upload.local.js` ไปเครื่องด่าน

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

### 🆕 (7/6/69 #2) หน้าสรุปเด้งหน้าจอ + มีปุ่มปริ้นในหน้า Playwright
2 ปัญหาที่เครื่องด่าน ต้นเหตุเดียวกัน (หน้าสรุป/QR อยู่ใน Chromium ของ Playwright = คนละตัวกับ Chrome ปกติ):
1) **หน้าสรุปหลบหลังหน้ากาก จนท.ไม่เห็น** → `revealWindow()` เพิ่ม CDP **minimize→normal** ก่อน `bringToFront`
   (bringToFront ดึงแค่แท็บในตัว Chromium ไม่ยกหน้าต่างมาทับ Chrome หน้ากาก)
2) **ไม่มีปุ่มปริ้น** (extension `dnp-eticket-receipt` อยู่แค่ Chrome ปกติ) → ก๊อป `receipt-core.js`+`content.js`
   มาไว้ `src/receipt-inject/` แล้วฉีดเข้าหน้า DNP (สคริปต์ไม่ใช้ chrome.* API ฉีดได้ตรงๆ) + `--kiosk-printing` (Windows) ปริ้นเงียบ
   ⚠️ **flow จริง (พี่วินยืนยัน):** สรุป→เลือก QR→หน้าจ่าย**เด้งหน้าต่างใหม่**→หน้าเดิม waiting→นทท.จ่าย→ขึ้นปุ่ม "ดูตั๋ว"→
   **QR เข้าอุทยานเด้งหน้าต่างใหม่ = จุดที่ต้องปริ้น**. ลองแรกใช้ `addInitScript` → เทสพบ**ครอบ window.open popup ไม่ถึง**
   (`window.DNPReceipt` undefined ในหน้าตั๋ว) → เปลี่ยนเป็น `injectReceiptButton()` ดักที่ `context.on('page')`+event `load`
   ✅ เทส offline ผ่าน: หน้าหลัก+popup ตั๋วมีปุ่ม / popup จ่ายเงินคนละ host ไม่มีปุ่ม (ไม่รั่ว)
   ⏳ **รอเทส live**: หน้าสรุปเด้งทับ + ปุ่ม 🖨️ ขึ้นในหน้าตั๋วท้ายสุด + ปริ้นออก

### 🆕 (7/6/69 #3) หน้าสรุปเต็มจอ (Mac) + เลือกขนาดกระดาษ 57/80mm + เทส live 4 ใบ
- **เทส live เอง 4 ใบ:** pipeline เป๊ะ (3 ใบเข้าคิว pending 1→2→3, ใบ4 reject ทันที) + ปุ่มปริ้นขึ้นหน้าสรุป (เห็นใน shot)
  ⚠️ เจอ **orphan chromium สะสม** จาก `npm run restart` (kill -9 ไม่ graceful) — แก้ด้วย `npm stop` (เลี่ยง restart ตอน dev)
- **หน้าสรุปเด้งเล็กมุมขวาบน Mac** (ไม่เต็มจอ): พบ `revealWindow` เดิม (minimize→normal+ขนาด) **Mac ไม่ apply ขนาด** ค้าง ~500×375
  (screenshot เต็มเพราะยึด viewport ไม่ใช่ขนาดหน้าต่างจริง — หลอกตา). แก้: **minimize→normal→maximized + retry** ได้ 1470×838
  (race: setWindowBounds(normal) ตอบก่อน OS ออกจาก minimized → maximized error → retry วนรอ). ✅ พิสูจน์ getWindowBounds ใน flow จริง แยก Mac/Windows
- **เลือกขนาดกระดาษ 57/80mm** (พี่วินมีเครื่องปริ้น 2 ขนาด): modal ถามครั้งเดียวตอนเปิดหน้ากาก → server เก็บ in-memory →
  ฉีด `window.__DNP_RECEIPT_WIDTH` เข้าหน้าตั๋ว → `receipt-core` parametrize (QR 38/42mm). ปริ้น silent ไป default printer (ตั้งเอง)
  ✅ เทส: API (null→ถาม/57/fallback80), render 57+80, modal เด้ง+กดเลือก+chip. ⏳ รอพี่จ่ายจริงดูใบเสร็จ 57mm + หน้าตั๋วเต็มจอ
  ⚠️ แก้ `receipt-core.js` 2 ที่ (ต้นฉบับ `~/dnp-eticket-receipt` + สำเนา `src/receipt-inject/`)
- 💡 **บทเรียนเสียเวลา:** แก้ revealWindow แล้วพี่วินบอก "ยังไม่เต็มจอ" — ที่จริง `npm start/stop` ของ AI **fail เงียบ**
  เพราะ cwd ค้างที่ `/Users/ovatina` (จาก `cd` ตอน zip) หา package.json ไม่เจอ → server เก่าโค้ดเดิมรันอยู่ พี่วินเลยเทสโค้ดเก่า
  → **start server ด้วย path เต็ม `node /abs/.../src/server.js`** (cwd-independent) + ยืนยันโค้ดใหม่รันจริงด้วย log ก่อนสรุป

## รอทำ / รอตัดสินใจ ⏳
- **deploy Apps Script ส่ง log → Drive**: ทำตาม `apps-script/README-deploy.md` (5 นาที) → URL ใส่ `config.js` LOG_UPLOAD
- **ทดสอบ end-to-end จริง**: กด "ต่อไป" ดูหน้าสรุปว่าหยุดถูกที่ + ยังไม่จ่าย (รอพี่วินโอเค เป็นระบบจริงหน่วยงาน)
- **เทส Windows จริงที่ด่าน**: #2 graceful shutdown, pipeline ดักหลายใบ, รอบเวลา data-driven, ซ่อนหน้าต่างสนิท + **ปุ่มปิด/RESET.bat ใหม่** (กวาด playwright ไม่โดน Chrome ปกติ, หน้าต่างปิดเองตอนกดปิด)
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
