# คู่มือ deploy Apps Script — ส่ง log ขึ้น Google Drive (ทำครั้งเดียว ~5 นาที)

ระบบจะส่ง `usage.csv` + `server.log` ขึ้น Drive อัตโนมัติทุกครั้งที่ **กดปุ่มปิดในหน้ากาก**
หรือ **ดับเบิลคลิก RESET-Windows.bat** — พี่วินเปิด Drive ดูบัค/เออเรอจากที่ไหนก็ได้

## ✅ ขั้นที่ 1 — โฟลเดอร์ Drive (มุกทำให้แล้ว)
โฟลเดอร์ **Erawan-Logs** สร้างไว้ใน Drive พี่วินแล้ว + ใส่ `FOLDER_ID` ใน `Code.gs` ให้เรียบร้อย
→ https://drive.google.com/drive/folders/179_pmAkn1ZWrUr2jiEDwRXBqRxOuaCm4
(ถ้าอยากเปลี่ยนโฟลเดอร์เอง แก้ `FOLDER_ID` บนสุดของ `Code.gs`)

## ขั้นที่ 2 — สร้าง Apps Script
1. ไปที่ https://script.google.com → **New project**
2. ลบโค้ดเดิมทิ้ง แล้วก๊อปทั้งหมดจากไฟล์ `apps-script/Code.gs` มาวาง (FOLDER_ID ใส่ให้แล้ว)
3. `SECRET` = ค่า default `erawan-log-2569` ใช้ได้เลย (ถ้าเปลี่ยน ต้องแก้ใน `src/config.js` ให้ตรงกันด้วย)
4. กด 💾 Save

## ขั้นที่ 3 — Deploy เป็น Web app
1. กดปุ่ม **Deploy** (มุมขวาบน) → **New deployment**
2. กดเฟือง ⚙️ ข้าง "Select type" → เลือก **Web app**
3. ตั้งค่า:
   - **Execute as:** `Me` (อีเมลพี่วิน)
   - **Who has access:** `Anyone`  ← สำคัญ! ต้องเป็น Anyone ไม่งั้นเครื่องด่านยิงไม่เข้า
4. กด **Deploy** → ครั้งแรกจะให้ **Authorize access** → เลือกบัญชีพี่วิน
   → ถ้าขึ้น "Google hasn't verified" ให้กด **Advanced → Go to (project name) → Allow**
5. ก๊อป **Web app URL** ที่ได้ (ขึ้นต้น `https://script.google.com/macros/s/..../exec`)

## ✅ ขั้นที่ 4 — ใส่ URL กลับเข้าระบบ (มุกใส่ให้แล้ว)
URL ใส่ไว้ใน **`src/log-upload.local.js`** ให้แล้ว (ไฟล์นี้ gitignore — ไม่หลุดขึ้น GitHub public):
```js
module.exports = {
  url: 'https://script.google.com/macros/s/..../exec',  // ← URL จากขั้น 3
  secret: 'erawan-log-2569',                             // ← ตรงกับ SECRET ใน Apps Script
};
```
⚠️ ถ้า deploy ใหม่ได้ URL ใหม่ ให้แก้ที่ไฟล์นี้ (ไม่ใช่ config.js)
เสร็จแล้ว `npm run restart` (Mac) หรือเปิดระบบใหม่ (Windows) — ครั้งหน้ากดปุ่มปิด log จะขึ้น Drive เอง
⚠️ **ก๊อปไฟล์ `src/log-upload.local.js` ไปเครื่องด่านด้วย** (เหมือน `auth/`) ไม่งั้นเครื่องด่านจะไม่ส่ง log

## ทดสอบว่าใช้ได้
```bash
node scripts/upload-logs.js
```
ถ้าขึ้น `[log-upload] sent (...) -> 200 {"ok":true,...}` = สำเร็จ → ไปดูใน Drive จะเห็นโฟลเดอร์ชื่อเครื่อง + ไฟล์ log ข้างใน

## หมายเหตุ
- **แก้โค้ด Apps Script แล้วต้อง deploy ใหม่:** Deploy → Manage deployments → ✏️ แก้ → Version: New version → Deploy
  (URL เดิมใช้ได้ต่อ ไม่ต้องเปลี่ยน config)
- ไฟล์บน Drive ตั้งชื่อ `<วันเวลา>_usage.csv` แยกโฟลเดอร์ตามชื่อเครื่อง → หลายด่านไม่ปนกัน
- ถ้ายังไม่ตั้ง `url` ระบบรันได้ปกติ แค่ข้ามการส่ง log (ไม่ error)
