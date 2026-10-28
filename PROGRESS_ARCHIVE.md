# PROGRESS_ARCHIVE.md — DNP E-Ticket Auto-fill (ประวัติเก่า)

> ย้ายมาจาก `PROGRESS.md` เมื่อ 7/6/69 เพื่อคุมเพดาน ~100 บรรทัด — เนื้อหา **setup → 3/6/69**
> สถานะปัจจุบัน + งานล่าสุด + บทเรียนที่ยังใช้ อยู่ใน [PROGRESS.md](PROGRESS.md) / technical detail อยู่ [CLAUDE.md](CLAUDE.md)

### (12/6/69) ใบเสร็จเพิ่มตารางสรุปค่าบริการ (กันไกด์โกงหัว) — sync จาก dnp-eticket-receipt
`receipt-core.js` (สำเนาใน `src/receipt-inject/`) เพิ่ม `getOrder()` scrape กล่อง "สรุปค่าบริการ" บนหน้าตั๋ว →
ใบเสร็จโชว์ตารางแยกประเภท+จำนวน+ราคา+ยอดรวม แบบใบเสร็จห้างฯ. **แก้ที่ต้นทาง `~/dnp-eticket-receipt` แล้วก๊อปทับ**
(รายละเอียด+selector อยู่ PROGRESS/CLAUDE ของโปรเจคนั้น). ✅ เทส jsdom ผ่าน.

### (7/6/69 #3) แก้บั๊ก Windows: หน้าต่างหายนอกจอ ตอนกดย่อ/เลือกจ่ายเงิน
อาการ (เครื่องด่าน Windows): หน้าสรุปเด้งเต็มจอ (maximized) ปกติ **แต่** (1) กด restore-down/ย่อ → หน้าต่างหายนอกจอ
เปิด/ปิดไม่ได้ (2) เลือกวิธีจ่ายเงิน+ยืนยัน → หน้าต่าง QR จ่ายเงินที่ควรเด้งใหม่กลับหายหลังจอ. **root cause เดียวกัน =
launch flag `--window-position=-32000,-32000`:** (1) `revealWindow` ตั้ง `normal{60,40}` มี race → ไม่ apply →
"restore bounds" ค้างที่ -32000 → กดย่อเด้งกลับนอกจอ. (2) popup จ่าย/ตั๋วเกิดที่ default -32000 ตาม flag.
**แก้ (`automation.js`):** (1) Windows วน set `normal` + ยืนยัน `getWindowBounds` left/top≥0 ก่อน maximized. (2)
`context.on('page')` ดึง popup (`opener()≠null`) กลับเข้าจอ. ⏳ รอเทส Windows จริง (Mac reproduce ไม่ได้)

## ทำแล้ว ✅ (setup → 3/6/69)
- Setup Node + Playwright + Express
- Login DNP + save session (`auth/storageState.json`)
- ส่องฟอร์มจริง เก็บ selector + ตัวเลือกครบ (เวลา 2 / ยานพาหนะ 7 / ผู้เดินทาง 11)
- `automation.js` — กรอกครบ flow ทดสอบผ่าน (dryRun): วัน→เวลา→รถ→ทะเบียน→ผู้เดินทางหลายคน
  generate ชื่อตามสัญชาติ ไม่มี error แดง ✅
- หน้ากาก web app — โชว์ราคา + ยอดรวม real-time, เพิ่มประเภทอื่นได้, โหมดทดสอบ
- **ยานพาหนะหลายคันได้** — แต่ละคัน {ประเภท, ทะเบียน} ปุ่ม "เพิ่มคัน"/ลบ,
  automation วน "เพิ่มประเภทยานพาหนะ" (params ใช้ `vehicles:[{match,plate}]` แล้ว)
  ทดสอบผ่าน 2 คัน + 3 คน ยอดรวม 1,130฿
- **รอบเวลาฉลาด** — ถ้าเลือก "วันนี้" และเลยเวลาสิ้นสุดของรอบ → ปิดรอบนั้นอัตโนมัติ +
  default ไปรอบที่ยังเปิด (เลย 11:45 ตัดรอบเช้า, เลย 15:30 ปิดหมด → เตือนเลือกวันอื่น)
  คิดวันด้วยเวลาท้องถิ่น (`localISO`) กันเพี้ยนช่วงเช้ามืด — ทดสอบ 8 เคสผ่าน
  ⚠️ **หมายเหตุ:** วิธี "เดา buffer" นี้ถูกแทนด้วย data-driven (7/6/69) แล้ว — ดู PROGRESS.md
- **บอทเร็วขึ้น** — แทน fixed wait ด้วย waitFor: เปิดปฏิทินรอ header โผล่,
  dropdown รอ `.el-select-dropdown:visible`, ลดเวลารอหลังคลิกวัน/เปลี่ยนเดือน
- **ไฟสถานะ login บนหน้ากาก** — เปิดหน้าแล้วเช็กอัตโนมัติ (`/api/login-status` →
  `checkLogin()` เปิด headless มองหา "ออกจากระบบ") โชว์เขียว/แดง + ปุ่ม "เช็กซ้ำ",
  ถ้าหลุดจะปิดปุ่มยืนยัน + บอกให้ `npm run login`
- **usage log CSV** (`src/logger.js` → `logs/usage.csv`) — เก็บทุกครั้งที่กดยืนยัน:
  วันเวลาที่ใช้/วันที่จอง/รอบ/จำนวนคน/รถ/ประเภทรถ/ยอดเงิน/เวลาที่ใช้/โหมด(ทดสอบ-จริง)/ผล/หมายเหตุ
  ใส่ BOM ให้ Excel เปิดภาษาไทยไม่เพี้ยน, server.js วัด duration + เรียก logUsage ทั้งสำเร็จ/ล้มเหลว
  ทดสอบ 3 เคสยอดเงินถูกต้อง — พี่วินเปิด CSV ทำ pivot รายงานเองได้
- **(3/6/69) log แยกไทย/ต่างชาติ** — เพิ่ม 3 column ท้ายตาราง: `คนไทย`/`ต่างชาติ`/`รายละเอียดผู้เดินทาง`
  (เช่น "ผู้ใหญ่ไทย×2, เด็กต่างชาติ×1") ยึดสัญชาติจาก config. `ensureHeader()` อัพเดท header ไฟล์เดิมอัตโนมัติ
  (เพิ่ม column ใหม่โดยไม่ลบแถวเก่า) — เครื่องด่านที่มี usage.csv อยู่แล้วจะอัพเกรด header เองตอนจองครั้งหน้า
- **(3/6/69) console เป็นอังกฤษล้วน** — Windows cmd วาดไทยไม่ได้ (ขึ้นกล่อง □) แม้ตั้ง chcp 65001 เพราะฟอนต์ไม่มีไทย
  แก้: แปลงข้อความ log ทุกจุดใน server/automation/pool/logger/login.js เป็นอังกฤษ + เลี่ยง emoji,
  เพิ่ม field `en` ใน VEHICLE_TYPES/TRAVELER_TYPES (config) map ค่าไทย→อังกฤษตอน log.
  **error ที่เด้งไปหน้ากากเว็บคงไทยไว้** (throw Error) — scripts/debug-* ไม่แตะ (รันบน Mac dev เท่านั้น)
- **รองรับ Windows** (ให้ลูกน้องใช้ 1 เครื่อง, ก๊อป session พี่วินไป) — `ติดตั้งครั้งแรก-Windows.bat`
  (เช็ก node→npm install→playwright install) + `เปิดระบบจองเอราวัณ-Windows.bat` (ฆ่า port ด้วย netstat/taskkill)
  + `คู่มือ-Windows.md`. โค้ดหลัก+login.js cross-platform แล้ว (path.join, ไม่มี hardcode).
  .bat แก้เป็น **อังกฤษล้วน + CRLF + ไม่มี BOM** แล้ว (verified) กัน console ไทยเพี้ยน/batch พัง
  ⚠️ ยังไม่ได้รันจริงบน Windows — รอพี่วินลองที่ออฟฟิศ
- **แก้ default วันที่** — เดิม default = พรุ่งนี้ (`setDate(+1)`) ทำให้รีเฟรชแล้ววันเลื่อนไป 1 วัน
  → เปลี่ยนเป็น default = **วันนี้** (`localISO(new Date())`) ตรงกับวันจริงแล้ว (index.html บรรทัด ~112)
- **ซ่อนหน้าต่างตอนกรอก (แยกตาม OS) + popup ทางการ + login cache** (2/6/69) — นทท.ที่ด่านเห็นจอเดียวกับที่กดจอง
  จึงต้องซ่อนสนิท: 🪟 Windows = `--window-position=-32000,-32000` ดันนอกจอ (ซ่อนสนิท+เร็ว) /
  🍎 Mac = `tuckWindow()` ซุกเล็กมุมจอ (Mac ดึงกลับ ซ่อนสนิทไม่ได้ แต่แค่เครื่องเทส). เด้งเต็มจอตอนหน้าสรุป.
  popup overlay เต็มจอเขียวกรม ข้อความทางการ (เผื่อ นทท.เห็น). `/api/login-status` cache 5 นาที (6วิ→0.01วิ).
  Mac เทส 19 วิ ✅ — ⏳ รอพี่วินทดสอบ Windows ที่ด่านว่าซ่อนสนิทจริง
- **Login launcher ดับเบิลคลิก** (2/6/69) — `3-LOGIN-Windows.bat` (ASCII+CRLF) + `เข้าระบบ DNP.command` (Mac)
  รัน `node scripts/login.js` ให้ ไม่ต้องเปิด terminal. อุด gap: หน่วยงานไม่มีวิธี login ใหม่เอง.
  ย้ำ: login ต้องผ่านเบราว์เซอร์ Playwright เท่านั้น (Chrome ปกติไม่นับ) / หรือก๊อป storageState.json ไปเลย
- **⚡ Warm pool เร่งความเร็ว** (2/6/69) — เลียนแบบ จนท.เปิดหลายแท็บกดการ์ดรอ. แยก `runBooking` เป็น
  `warmTab()` (เปิด→คลิกการ์ด→เลือก**วันนี้**) + `fillBooking()` (เวลา/รถ/คน→สรุป). `src/pool.js` เปิด warm
  `POOL_SIZE=3` แท็บ standby นอกจอตอน server start, `acquire()` หยิบแท็บพร้อมมากรอกทันที + เติมคืนพื้นหลัง.
  server ปิดแท็บใบเก่าอัตโนมัติเมื่อใบใหม่สำเร็จ (แก้เคสกรอกผิดแล้วทิ้ง). pool เฉพาะ "วันนี้" (นทท.เข้าวันนี้
  ~100%), จองวันอื่น = warm สด (cold). ของแถม pool หมุนเร็ว=แท็บสดเสมอ ลดโควต้า stale
- **⚡ เร่ง Phase B (กรอกจริง) 8.3→6.8 วิ** (2/6/69) — วัด breakdown แล้วพบ verify กันพลาดกินแค่ 22ms (เก็บไว้ฟรี),
  network DNP 63%. บีบเฉพาะหน่วงที่เราคุม: `selectOption` poll ค่าแทน `waitForTimeout(200/600)` (1208→12ms),
  เพิ่มคน/คันรอช่องโผล่แทน `(350)` (430→69ms), delay พิมพ์ 15→5ms (1096→852ms). หน่วงเรา 2.7→0.9วิ.
  เทส 3 รอบนิ่ง (6.8/6.6/6.9) ชื่อไม่ตกอักษร. **network ครอง 83% แล้ว → เร่งต่อไม่คุ้ม** (รวม warm: 18→~6.8วิ)
  เทสด้วย `scripts/test-warmfill.js` (เก็บไว้ regression)
- **Progress bar ใน popup + แถบสถานะ warm pool บนหน้ากาก** (2/6/69) — (1) popup ตอนกรอกเพิ่ม progress bar
  *simulated* (วิ่งเข้าใกล้ 90% นุ่มๆ + shimmer, server ตอบ→เด้ง 100% หน่วง 0.45วิ ค่อยปิด) — `/api/book`
  ไม่ stream % จริง เลยใช้ simulated พอ ไม่แตะ backend. (2) เพิ่ม `/api/pool-status` (`pool.status()`+size+today)
  หน้ากาก poll ทุก 2.5วิ โชว์ `1/3→3/3 ●●●` **ฉลาดตามวันที่**: เลือกวันนี้=โชว์ความพร้อม / เลือกวันอื่น=
  "เปิดสด ~6วิ (warm เฉพาะวันนี้)" → พี่วินเห็นเลยว่าทำไมจองวันอื่นช้า. แก้แค่ `index.html`+`server.js`
- **ปุ่มล้างฟอร์ม + คีย์ลัด Esc** (2/6/69) — ปุ่ม "🧹 ล้างฟอร์ม — เริ่มใบใหม่" + กด **Esc** ก็ได้ →
  reset เป็นค่าเริ่มต้น (วันนี้/รถ1คัน/คน0/โหมดทดสอบปิด) **ไม่โหลดหน้าใหม่** (เร็วกว่า refresh ที่ด่าน
  ไม่เช็ก login/อุ่น warm ใหม่). แยก `resetForm()` ให้ init+ปุ่มใช้ร่วม. Esc guard ไม่ล้างตอน popup กรอกเปิด.
- **(3/6/69) แก้บัค "ไม่กรอก ค้างหน้าเลือกวัน" — ต้นเหตุจริง = เลือกรอบเวลาที่ DNP ปิดไปแล้ว**
  อาการ: กดยืนยัน→เด้งมาหน้าเลือกวันแต่ไม่กรอก. ไล่เทส 3 ชั้น (warmTab ตรง / pool path / HTTP) **ผ่านหมด** ยกเว้น
  รอบเช้าที่ปิด → `{ok:false,"เลือก 08:00-11:45 ไม่สำเร็จ"}`. **root cause: เลือกรอบเช้าตอน ~11:43 → DNP เอา option
  ออกก่อน 11:45 เป๊ะ → selectOption หาไม่เจอ → error**. ไม่ใช่โค้ดพัง/ไม่ใช่ pipeline. แก้ 2 จุด: (1) `index.html`
  `SLOT_CLOSE_BUFFER_MIN=10` ปิดรอบในหน้ากากก่อนเวลาจริง 10 นาที (กัน race ขอบเวลา) (2) `automation.js` error เวลา
  ชัดขึ้น "รอบนี้อาจปิดรับแล้ว ลองเลือกรอบอื่น" (เดิม "ระบบช้า ลองใหม่" = กำกวม).
  ⚠️ **อัพเดท 7/6/69:** buffer แบบเดานี้ถูกแทนด้วย data-driven (อ่าน is-disabled จริง) — ดู PROGRESS.md
- **(3/6/69) ลอง pipeline จองดักหลายใบ → REVERT ออก** (คนละเรื่องกับบัคบน — pipeline ไม่ใช่ต้นเหตุ) — ลองให้ค้าง
  รอจ่าย 3 ใบ (`pendingTabs`/`MAX_PENDING`/`revealWindow(page,slot)`) แล้ว revert กลับ `lastTab` เดิม. เก็บไว้ทำใหม่ทีหลัง
- **(3/6/69) AUDIT.md + แก้บัค #1 dryRun ปิดใบจริง** — ตรวจโค้ดทั้งโปรเจค ทำ `AUDIT.md` (เช็กลิสต์ 14 ข้อ P0-P2).
  แก้ข้อ 1: เดิม dryRun ก็ `prevTab.browser.close()` → กดทดสอบคั่นระหว่างใบจริงรอจ่าย ใบจริงโดนปิด เงินหาย.
  แก้: แยก `lastDryTab` ออกจาก `lastTab`, `prevTab = dryRun ? lastDryTab : lastTab` ปิดเฉพาะใบโหมดเดียวกัน.
- **(3/6/69) แก้บัค #2 graceful shutdown** — เพิ่ม `shutdown()` จับ SIGINT/SIGTERM ปิด browser ทั้งหมด
  (`lastTab`+`lastDryTab`+`pool.drain()`) ก่อนตาย กัน chromium orphan ค้างกิน RAM. guard กันกดซ้ำ + safety timer 5 วิ.
- **(3/6/69) แก้ #3 แบบฉลาด — เลย 15:20 เด้งไปจอง "พรุ่งนี้" อัตโนมัติ** — เดิม warm "วันนี้" ตายตัว เลย cutoff
  แล้วขึ้น error แดงค้าง. อัพเกรด: เพิ่ม `bookDate()` (automation.js) = วันนี้ก่อน 15:20 / พรุ่งนี้หลัง / ข้ามเที่ยงคืนกลับวันนี้.
  pool warm ตาม bookDate, ย้าย `SLOT_CLOSE_BUFFER_MIN` ไป config.js (single source) ส่ง frontend ผ่าน /api/config,
  หน้ากาก default วัน + แถบ warm ตาม bookDate. ทดสอบ 8 เคสเวลาผ่าน + syntax ครบ.
- **(3/6/69) แก้ #4 running lock timeout** — เดิม `running` ค้าง true ถ้า fillBooking ค้าง (DNP ไม่ตอบ) → ปุ่มจอง
  ทั้งระบบล็อกจน Playwright timeout เองสะสม. แก้: เพิ่ม `withTimeout()` ครอบ fillBooking ด้วย `Promise.race`
  (`BOOK_TIMEOUT_MS` = 2 นาที) เกิน → โยน error ไทย ลง catch/finally ปกติ (ปลด running + ปิด tab ค้าง 60 วิ).
  เลือกครอบ fillBooking แทน reset running เฉยๆ (กันคนกดซ้อน 2 งานชนกัน). ตั้ง 2 นาที — หน้างานกลุ่มใหญ่สุด
  ~รถตู้ 20 คน (กรุ๊ปใหญ่จองจากบ้าน) + เผื่อ buffer กัน false timeout ตัดใบที่ใกล้สำเร็จ.
  หมายเหตุ: ตัด AUDIT #5 เดิม (สัญชาติ default American) ออกตามพี่วินสั่ง — renumber ใหม่ทั้งลิสต์
- **(3/6/69) เทส server จริงผ่าน #1–4** (Mac dryRun + ใบจริงไม่จ่าย) — วิธีพิสูจน์: นับ browser หลัก playwright
  (1 browser = 3 process บน Mac) เทียบก่อน/หลังตอน warm pool นิ่ง (`warming:0`).
  #1 ใบจริงค้าง + dryRun คั่น → browser 15 คงที่ (ใบจริงรอด ตรงบั๊ก P0). #2 SIGTERM → browser 0 + `Cleanup done. Bye.`
  (graceful แท้). #3 หลัง cutoff `bookDate:2026-06-04` + `lastError:null` + frontend default 4 มิ.ย.
  #4 (timeout) ลด `BOOK_TIMEOUT_MS`=3วิชั่วคราว ยิง dryRun 10 คน → ตัว1 timeout เด้งกลางคัน / ตัว2 ซ้อนติด lock /
  ตัว3 หลัง timeout ผ่าน lock (release-on-timeout). คืนค่า 2 นาที + restart แล้ว.
- **(3/6/69) ✅ AUDIT #5 — pipeline จองดักหลายใบ** (ถามล้อมพี่วิน 5 ข้อก่อนทำ: ดัก 2-3 ใบ / เน้น จนท.สะดวก
  ไม่ห่วง นทท. / ไม่ต้องกดปิดเอง / RAM 8GB+ / ชนเพดานเตือนไม่ปิดอัตโนมัติ). เปลี่ยน `lastTab` (ใบเดียว) →
  `pendingTabs[]` คิวใบจริงสูงสุด `MAX_PENDING`=3 — **จองใบใหม่ไม่ปิดใบเก่า** จนท.กรอกใบถัดไปได้เลยระหว่างคนแรกจ่าย.
  หลุดคิวเอง: `prunePending()` กรอง `!page.isClosed()` → ปิดหน้าต่างใบที่จ่ายเสร็จ = หลุดคิวอัตโนมัติ
  (ไม่ต้องกดปิดในระบบ). ครบเพดาน → error เตือน ไม่ acquire ไม่ปิดอะไร (กันเงินหาย). dryRun แยก ไม่เข้าคิว.
  หน้ากากเพิ่มแถบ "🎫 ดักอยู่ N/3 ใบ" (poll /api/pool-status). เทส `scripts/test-pipeline.js` 17/17 ผ่าน (mock)

## Lesson learned 💡 (เก่า)
- **เร่งความเร็วต้องวัด breakdown ก่อน อย่าเดา** — วัดแล้วพบ Phase B 63-83% เป็น network DNP (เร่งไม่ได้),
  ตัวกันพลาด (verify inputValue) กินแค่ 22ms = แทบฟรี (เร่งไม่ต้องแลกความแม่น). แทน `waitForTimeout` ตายตัว
  ด้วย **poll ค่า / รอ element โผล่ (auto-wait)** = ผ่านทันทีเมื่อระบบพร้อม เน็ตช้าก็รอพอดี (200/600→12ms).
  เมื่อ network ครองสัดส่วน >80% = บีบฝั่งเราจนสุดแล้ว เร่งต่อ (แตะ network/ลด delay พิมพ์เป็น 0) ไม่คุ้ม+เสี่ยง
- **อย่าใช้ `page.route` บล็อก image/font หวังเร่งความเร็ว** — กลับช้าลง 4 เท่า (22→77 วิ): การ `route.abort()`
  ทำให้ `waitForLoadState('networkidle')` รอ request ที่ถูก abort นานมาก (เปิดหน้า→เลือกวัน พุ่งจาก 6→35 วิ).
  ซ้ำ: รูปที่ abort แล้วไม่กลับมาโหลด → **โลโก้/ไอคอนหาย** (พี่วินสังเกตเห็นเอง). ถอดออก = หายทั้งสองปัญหา
- **ซ่อนหน้าต่างตอนกรอก ทำได้ยากบน Mac** — ลอง 3 วิธีไม่ผ่าน:
  (1) `--window-position` ติดลบ → Mac ดึงหน้าต่างกลับเข้าจอ (ยังเห็น)
  (2) CDP `minimize` → ซ่อนได้แต่ Chrome throttle render/timer ตอนย่อ → **ช้า 5 เท่า** (22→112 วิ) แม้ใส่ flags
  (3) headless กรอกแล้ว handoff state ไป headful → **หน้าสรุป DNP เป็น in-memory SPA, URL=หน้าฟอร์มเดิม
  (`ticketDetail/493`), เปิดเบราว์เซอร์ใหม่ได้ฟอร์มเปล่า+โควต้า=0** → ส่งต่อข้ามเบราว์เซอร์ไม่ได้.
  สรุป: ต้องกรอกในเบราว์เซอร์ตัวเดียวกับที่จ่าย + headful visible → ได้แค่ "ลดรบกวน" (หน้าต่างเล็กมุมจอ) ไม่ใช่ซ่อน 100%
- เปิด URL หน้าจอง DNP ตรงๆ ไม่ได้ — ต้องคลิกการ์ดจากหน้าแรก ไม่งั้นโควต้า=0
- session DNP: `access_token` อายุสั้น (~2 ชม.) แต่ `refresh_token` ~399 วัน +
  เว็บต่ออายุ access ให้อัตโนมัติ → จริงๆ login ทีนึงอยู่ได้นานเป็นปี ไม่ต้อง re-login บ่อย
- Element UI: input อ้างด้วย placeholder, dropdown คลิกเปิด+คลิก li
- ช่องชื่อใน Vue ต้อง `pressSequentially` (พิมพ์จริง) ไม่ใช่ `fill()` ไม่งั้น model ว่าง
- ผู้เดินทางหลายคน: กรอกคนปัจจุบันครบก่อน ค่อยกด "เพิ่มผู้เดินทาง" (เพิ่มก่อนกรอก = ระบบ block)
- เร่งความเร็ว 28s→18s: เปลี่ยน goto เป็น domcontentloaded + แทน fixed wait ด้วย
  waitFor element / waitForLoadState networkidle (พึ่ง auto-wait ของ locator) — ข้ามหน้าการ์ดไม่ได้ (โควต้า=0)
- **บัค "ไม่มียานพาหนะ" (root cause จริง):** server `require()` automation.js ไว้ใน memory ตั้งแต่ start —
  ตัวเก่า (โค้ดก่อนมี `vehicles` array) ค้างถือ port 5179 → `node` ตัวใหม่ bind ไม่ได้ ตายเงียบ ตัวเก่าตอบแทน →
  ผู้ใช้ได้โค้ดเก่าที่อ่าน `vehicleMatch=undefined` เลย selectOption คว้า option แรก ("ไม่มียานพาหนะ")
  **แก้:** ฆ่า port occupant ก่อน start เสมอ (`npm run restart` = `lsof -ti:5179|xargs kill -9` ก่อน) ✅
- เสริม verify inputValue + retry 3 ครั้ง ใน selectOption (กัน race ตอน options โหลดช้า — defensive)
- **(4/6/69) 🐛 prunePending — อย่าใช้ `browser.isConnected()` วัด "ปิดหน้าต่าง"** Playwright `launch()` ถือ
  connection ไว้ → ปิดหน้าต่างแล้ว process ยังไม่ตาย isConnected ค้าง true คิวไม่มีวันว่าง. ใช้ `!page.isClosed()`
  เป็นหลัก (isConnected เป็น backup เผื่อ crash) + prune ต้อง `browser.close()` ใบที่หลุดด้วย กัน orphan สะสม Dock.
  พิสูจน์ `scripts/test-window-close.js` (เปิด browser เปล่า ไม่แตะ DNP). เทส live: 3 ใบเต็มคิว→ใบ4 error→ปิดหน้าต่าง pending 3→2→0

---
## ย้ายจาก PROGRESS.md เมื่อ 28/10/69 (เนื้อหา 7/6–13/6/69)

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
