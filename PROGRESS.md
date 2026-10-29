# PROGRESS.md — DNP E-Ticket Auto-fill

## สถานะ: 🟡 log รายเดือน + ส่งเฉพาะส่วนใหม่ทุก 30 นาที (แบบมือถือ) + timing 1 แถว/ใบ — เทส mock+Mac ผ่าน 29/10/69 · Apps Script New version ✅ (verify Google จริง) · push ✅ e3456c2 · รอด่านปิดระบบ+4-UPDATE · ใช้งานได้ + ทน "เน็ตด่านวูบ" + กรอกเร็วขึ้นเท่าตัว (28/10/69)

### 🆕 (28/10/69) กรอกเร็วขึ้นเกือบเท่าตัว (ยกวิธีจากแอปมือถือ v1.4)
- วัด DNP จริง (Mac, ถึงหน้าสรุป ไม่จ่าย): 5 คน กรอก 16.4→8.3 วิ · 17 คน+มอไซค์ 2 คัน 60.0→34.3 วิ · ยอดสรุปตรงทั้งก่อน/หลัง (810 / 2,110 บาท) · ไม่มี row ต้องกรอกซ้ำ
- `pickDirect` (Vue ตรง ไม่เปิด dropdown) + `ROW_SETTLE_MS` รอพ้น timer ล้าง row 1.53 วิ + `fixRow` · test-pipeline 18/18 ผ่าน
- 🟡 รอเครื่องด่านกด `4-UPDATE-Windows.bat` แล้วดู `timing.csv` ใน Drive (step `add_traveler` ควร ~1.7 วิ/คน, `verify` ควร ~0 — ถ้า verify สูง = เครื่องช้ากว่าที่รอ ปรับ ROW_SETTLE_MS)

### 🆕 (20/7/69) เครื่องด่านบางเครื่องเน็ตวูบ → บอทค้าง + แบนเนอร์ "ออกจากระบบ" หลอก
**โจทย์ (log จริง DESKTOP-8VP1TLN):** เครื่องนึงเชื่อม DNP ยากมาก (อีกเครื่องปกติ) — Chrome ธรรมดาเข้าได้ แต่บอทค้าง
- **root cause = เน็ตวูบ ไม่ใช่โค้ด/ไม่ใช่เครื่องพัง:** log ฟ้องสำเร็จ↔ล้ม **สลับกันในนาทีเดียว** (52 สำเร็จ + 47 ล้มวันนี้)
  error เป็น `Timeout`/`ERR_CONNECTION_TIMED_OUT`/`ERR_NAME_NOT_RESOLVED`/`ERR_NETWORK_CHANGED` = network layer วูบ
  → ถ้าเป็น config Playwright (proxy/AV) ต้องเจ๊งตลอด ไม่มีทางสำเร็จ 52 ครั้ง. Chrome รอด = เปิดตอนเน็ต "up"
- **แก้ (ทำให้ทนเน็ตแย่ ไม่ใช่แก้ config):** ดู `docs/notes/network.md`
  - `gotoWithRetry()` เข้าหน้า DNP ลองใหม่ 3 รอบ backoff (warmTab + checkLogin) — วูบครั้งเดียวไม่กลายเป็นค้าง
  - **POOL_SIZE 3→1** ยิงเน็ตเบา กิน RAM น้อย (แลก: กรอกผิดต้องทิ้งใบ warm สด ~6วิ)
  - `checkLogin` แยก 3 สถานะ in/out/**neterror** → หน้ากากขึ้น "📡 เน็ตมีปัญหา" แทน "❌ ออกจากระบบ" (หลอก) + ไม่บล็อกปุ่มจอง
- ✅ เทส: retry ลอง 3 รอบจริงแล้วโยน / goto ผ่านรอบแรกไม่มี penalty (checkLogin สด→`out`). commit `4920951`
- ⏳ **รอเทสเครื่องด่านจริง:** อัปเดต **เครื่องมีปัญหาเครื่องเดียว** (`4-UPDATE-Windows.bat`) — เครื่องปกติ **ไม่ต้องกด = ไม่กระทบ**

### 🆕 (5/7/69) แก้จองกลุ่มใหญ่เด้งออก + popup โชว์สถานะจริง x/N + % จริง + เวลานับ
**โจทย์ (เจอจาก user จริงที่ด่าน):** จอง 30-40 คน → เกิน 2 นาที → ระบบ "เด้งออก/รีเซตเอง" จองไม่ได้ + popup ดูเหมือนค้าง
- **root cause:** `server.js` `BOOK_TIMEOUT_MS` fixed 2 นาทีครอบทั้งงาน — 1 คน ~3.5วิ → 35 คน ≈ เกิน 2 นาที = โดนตัดกลางคัน
- **แก้:** เปลี่ยนเป็น **watchdog จับ "ค้างจริง"** (`withStallGuard` นับจาก progress ล่าสุด) → จองกี่คนก็ไม่โดนตัดถ้ายังคืบหน้า
  → `docs/notes/files.md` (server.js). `BOOK_STALL_MS` (env override ได้ให้เทสย่นเวลา)
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
- **ผลวิเคราะห์ (ข้อมูลจริง จาก play 21 ใบ + diag) → `docs/notes/speed.md`:**
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

## ทำแล้ว ✅ (สรุป — รายละเอียดดู ARCHIVE / `docs/notes/`)
- **ระบบหลักครบ:** warm pool + กรอกอัตโนมัติ (วัน/เวลา/รถหลายคัน/คนหลายคน) หยุดก่อนจ่าย
- **หน้ากาก:** ราคา real-time, ไฟสถานะ login, progress bar, แถบ warm/ดักใบ, ล้างฟอร์ม+Esc
- **log/ops:** usage CSV (แยกไทย/ต่างชาติ) + console อังกฤษ (Windows cmd) + รองรับ Windows (.bat) + ซ่อนหน้าต่างตอนกรอก
- **AUDIT.md #1-5:** กันเงินหาย, graceful shutdown, เด้งจองพรุ่งนี้, lock timeout, pipeline ดักหลายใบ
- **(4/6/69) แก้บั๊ก pipeline** — prunePending ใช้ `page.isClosed()` (ไม่ใช่ isConnected) + `browser.close()` กัน orphan
  → เทส live ผ่าน (3 ใบเต็มคิว→ใบ4 error→ปิดหน้าต่าง 3→2→0). commit `b2e2a01` → lesson (ARCHIVE)

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
