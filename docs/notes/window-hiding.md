# ซ่อน/เด้งหน้าต่างเบราว์เซอร์ตอนกรอก

> แยกออกจาก `CLAUDE.md` เมื่อ 28/10/69 (คุมขนาดไฟล์ที่โหลดทุก session) — เขียนบันทึกใหม่ของเรื่องนี้ต่อในไฟล์นี้

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
  - ⚠️ **restore bounds (Windows) ต้องยืนยันด้วย `getWindowBounds`** (7/6/69 #3): race เดียวกันทำให้ set `normal{60,40}`
    ไม่ apply → restore bounds ค้าง -32000 → จนท.กด **restore-down/ย่อ → หน้าต่างหายนอกจอ**. แก้: Windows วน set normal
    + อ่าน `getWindowBounds` ยืนยัน left/top≥0 ก่อนไป maximized
- **popup จ่ายเงิน/ตั๋ว QR (Windows) เกิดนอกจอด้วย** (7/6/69 #3): หน้าต่างใหม่เกิดที่ default -32000 ตาม launch flag →
  `context.on('page')` ต้องเรียก `revealWindow` กับ popup (`opener()≠null`) ดึงกลับเข้าจอ — หน้าหลัก (opener=null) ปล่อยซ่อนตอนกรอก
- screenshot **ต้องทำหลัง revealWindow เสมอ** (ถ้าหน้าต่างถูกย่อ/ซ่อน render จะหยุด → screenshot ค้าง)
- หน้ากากโชว์ popup overlay เต็มจอเขียวกรม + spinner + **progress bar simulated** (`#overlay`) ข้อความ**ทางการ** (เผื่อ นทท.เห็นจอ)
  — progress bar ไม่ใช่ % จริง (`/api/book` ไม่ stream) วิ่งเข้าใกล้ 90% แล้วเด้ง 100% เมื่อ server ตอบ
- `/api/login-status` **cache 5 นาที** (`?force=1` = ตรวจใหม่) — ไม่งั้นทุก refresh เปิด browser เช็ก = ช้า 6 วิ
- ⛔ **3 วิธีที่ลองแล้วใช้ไม่ได้** (อย่าทำซ้ำ — ดู PROGRESS lesson):
  (1) `page.route` บล็อกรูป → ช้า 4 เท่า + โลโก้หาย
  (2) `minimize` หน้าต่าง → ช้า 5 เท่า (Chrome throttle ตอนย่อ)
  (3) headless กรอกแล้ว handoff ไป headful → หน้าสรุป DNP อยู่ใน memory ไม่มี URL เฉพาะ ข้ามเบราว์เซอร์ไม่ได้
