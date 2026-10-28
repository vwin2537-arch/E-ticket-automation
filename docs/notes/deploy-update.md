# GitHub + อัปเดตเครื่องด่าน

> แยกออกจาก `CLAUDE.md` เมื่อ 28/10/69 (คุมขนาดไฟล์ที่โหลดทุก session) — เขียนบันทึกใหม่ของเรื่องนี้ต่อในไฟล์นี้

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
**อัพเดทเครื่องด่าน = `4-UPDATE-Windows.bat`** (เลิกใช้ zip): ปุ่มเดียว ตรวจเองว่าครั้งแรก (git init+remote+`reset --hard origin/main`)
หรืออัพเดทปกติ (`git pull`) + `npm install` เฉพาะตอน package เปลี่ยน. logs/auth ถูก gitignore → ไม่ถูกแตะ log ต่อเนื่อง
ครั้งแรกสุดต้องลง Git for Windows + วางไฟล์ปุ่มนี้ลงโฟลเดอร์ด่านครั้งเดียว (ปุ่มเช็ค git ให้ + บอกลิงก์ลงถ้าไม่มี)
⚠️ `.gitignore` exclude: `auth/storageState.json`, `src/log-upload.local.js`, `node_modules/`, `logs/usage.csv`, `dnp-eticket-windows.zip`
— **ก๊อปไปเครื่องด่านด้วย 2 ไฟล์: `auth/storageState.json` (session) + `src/log-upload.local.js` (url/secret ส่ง log→Drive)** — ทั้งคู่ gitignore (อย่า push ขึ้น GitHub public)
⚠️ **server cache โค้ด:** automation.js ถูก `require` ตอน start — แก้โค้ดแล้วต้อง `npm run restart` เสมอ
ไม่งั้นยังรันโค้ดเก่า (เคยทำให้เจอบัค "ไม่มียานพาหนะ" — ดู PROGRESS)
กรอกในหน้ากาก → กดยืนยัน → หน้ากากขึ้น popup spinner, เบราว์เซอร์กรอกแบบ**ซ่อนนอกจอ** →
พอถึงหน้าสรุป เบราว์เซอร์**เด้งกลับเข้าจอ**ให้พี่วินตรวจ+จ่ายเอง
