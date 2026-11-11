# ทนเน็ตด่านวูบ

> แยกออกจาก `CLAUDE.md` เมื่อ 28/10/69 (คุมขนาดไฟล์ที่โหลดทุก session) — เขียนบันทึกใหม่ของเรื่องนี้ต่อในไฟล์นี้

## 🌐 ทนเน็ตวูบ (แก้ 20/7/69 — เครื่องด่านบางเครื่องเน็ตแย่)
**อาการ:** เครื่องด่านบางเครื่องเชื่อม DNP ยากมาก (อีกเครื่องปกติ) — บอทค้าง + หน้ากากขึ้น "ออกจากระบบ" ทั้งที่ session ดี.
**ต้นตอ = เน็ตวูบที่เครื่องนั้น ไม่ใช่โค้ด/ไม่ใช่ config Playwright:** log ฟ้อง สำเร็จ↔ล้ม **สลับกันในนาทีเดียว**
(52 สำเร็จ + 47 ล้ม/วัน) error network layer (`Timeout`/`ERR_CONNECTION_TIMED_OUT`/`ERR_NAME_NOT_RESOLVED`/`ERR_NETWORK_CHANGED`).
ถ้าเป็น proxy/AV บล็อกต้องเจ๊งตลอด (ไม่มีทางสำเร็จ 52). Chrome ธรรมดารอด = เปิดตอนเน็ต "up" + แท็บเดียว reuse connection.
บอทหนักกว่า: warm หลายแท็บ = `chromium.launch()` แยก ยิง DNS/TCP/TLS รัวพร้อมกัน เน็ตอ่อนรับไม่ไหว.
- **`gotoWithRetry()` (`automation.js`):** เข้าหน้า DNP ลองใหม่ 3 รอบ backoff (1.5s,3s) — ใช้ทั้ง `warmTab` + `checkLogin`.
  goto ผ่านรอบแรก = ไม่มี penalty (ไม่หน่วงตอนเน็ตดี). ล้มครบ 3 รอบค่อยโยน error เดิม
- **`POOL_SIZE=1` (`config.js`):** ยิงเน็ตเบาสุด + กิน RAM น้อย (เดิม 3 → warm 3 แท็บพร้อมกันยิงเน็ตหนัก).
  แลก: กรอกผิดต้องทิ้งใบแล้วกรอกใหม่ = รอ warm สด ~6วิ. ปรับกลับได้ถ้าเครื่องเน็ตดี
- **`checkLogin()` คืน 3 สถานะ `in`/`out`/`neterror`** (เดิม boolean): `neterror` = goto ล้ม (เน็ต) ≠ logout.
  `/api/login-status` ส่ง `status` (**ไม่ cache neterror** — เน็ตกลับมาเช็กซ้ำได้ทันที). หน้ากากขึ้น "📡 เน็ตมีปัญหา"
  (`.lstat.warn`) แทน "❌ ออกจากระบบ" + `loginOK=null` **ไม่บล็อกปุ่มจอง** (session น่าจะยังดี). warm-banner ก็แปล error เน็ตเป็นข้อความชาวบ้าน
- ⚠️ **แต่ละเครื่องอัปเดตโค้ดเองผ่าน `4-UPDATE-Windows.bat` (git pull) — ไม่ sync อัตโนมัติ.** ทดลองเครื่องมีปัญหาก่อนได้
  โดยเครื่องปกติไม่กระทบ (ไม่กด Update = โค้ดเดิม). auth/logs gitignore → pull ไม่แตะ

## 🔒 ใบรับรอง SSL ของ DNP หมดอายุ (11/11/69) — ทางยกเว้นชั่วคราว
- ใบ `*.dnp.go.th` หมดอายุ 10/11 23:59 GMT (= 11/11 07:00 ไทย) → `page.goto` ล้ม `net::ERR_CERT_DATE_INVALID` (warm failed + checkLogin=neterror + 3-LOGIN พัง) · กรมฯ แจ้งให้ใช้ต่อระหว่างต่ออายุ
- แก้: Chromium flag `--ignore-certificate-errors-spki-list=<SPKI sha256 base64>` = ยอม**เฉพาะกุญแจใบนี้** (ไม่ใช้ `ignoreHTTPSErrors` ที่ปลดทุกเว็บ — มีหน้าจ่ายเงิน) · `TEMP_CERT_ARGS` ใน `src/automation.js` (launchBrowser ทั้ง headless/headful + checkLogin) + `scripts/login.js`
- เทส DNP จริง: ไม่มี flag=ล้ม / SPKI ถูก=200 / SPKI ผิด=ล้ม / เว็บอื่นหมดอายุ (expired.badssl.com)=ยังโดนบล็อก · headful+headless ผ่านทั้งคู่ · checkLogin เดิม `neterror` → ใหม่โหลดได้
- ⚠️ พลาดรอบแรก: ใส่แค่ `src/` ลืม `scripts/login.js` → เครื่องที่หลุด login ใช้ 3-LOGIN ไม่ได้ (เห็นจากวิดีโอหน้าจอ) · **แก้เรื่องเชื่อมต่อ ให้ `grep -rn "chromium.launch"` ทั้ง repo ไม่ใช่แค่ src**
- ถอดเมื่อกรมต่อใบแล้ว (Mac mini `36_autoclick-monitor/cert.py` เตือนใน Telegram 19:00) → ลบ `TEMP_CERT_ARGS` + flag ใน login.js → push → ด่านกด 4-UPDATE
