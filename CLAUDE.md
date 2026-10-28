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
**ปิดปกติ (dev/Mac):** กด `Ctrl+C` ที่หน้าต่าง `npm start` / **ถ้าเผลอปิดหน้าต่าง/ค้าง:** `npm stop` กวาด orphan
**ปิดที่เครื่องด่าน (จนท.):** กดปุ่ม **"⏻ ปิดการทำงาน"** ในหน้ากาก → `POST /api/shutdown` ส่ง log+เก็บ browser+`exit 0` (หน้าต่างปิดเอง). มีใบ pending ค้าง = บล็อก ไม่ปิด
**เผลอปิดหน้าต่างดำ (Chrome บอทค้าง):** ดับเบิลคลิก **`RESET-Windows.bat`** → kill server+กวาด playwright chrome+ส่ง log+เปิดใหม่ (Mac เทส: `กู้ระบบเอราวัณ.command`)

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

## 📁 รายละเอียดรายเรื่อง — เปิดอ่านเฉพาะตอนแตะเรื่องนั้น

> **ที่นี่เก็บแค่กฎ + ดัชนี** รายละเอียดอยู่ใน `docs/notes/` (แยก 28/10/69 ตอนไฟล์นี้โต 20k ตัวอักษร)
> **บันทึกใหม่ → เขียนลงไฟล์ใน `docs/notes/` ที่ตรงเรื่อง ไม่ต่อท้ายไฟล์นี้** (ไฟล์นี้ควรอยู่ใต้ ~15k ตัวอักษร)

| แตะเรื่องนี้ | อ่านไฟล์ | มีอะไรอยู่ |
|---|---|---|
| แก้ไฟล์ไหน ทำอะไร / API / log / receipt / Apps Script | `docs/notes/files.md` | config/automation/pool/server/filelog/timing/logger, `withStallGuard`, receipt-inject (สำเนา), Apps Script `mode=append`, ขนาดกระดาษ 57/80 |
| push / อัปเดตเครื่องด่าน | `docs/notes/deploy-update.md` | `4-UPDATE-Windows.bat` (git pull), ไฟล์ gitignore ที่ต้องก๊อปไปเครื่องด่าน, server cache โค้ด |
| รอบเวลา / วันเป้าหมาย / ใบดักรอจ่าย | `docs/notes/booking-rules.md` | `readTimeSlots` (is-disabled), วันนี้เสมอ + ปุ่มพรุ่งนี้, `syncGoButton`, `pendingTabs`/`MAX_PENDING`/`prunePending` |
| ซ่อน/เด้งหน้าต่าง | `docs/notes/window-hiding.md` | Windows -32000 / Mac tuck, `revealWindow` ลำดับ+race, popup จ่ายเงินดึงกลับเข้าจอ, 3 วิธีที่ลองแล้วไม่ได้ |
| ความเร็วการกรอก | `docs/notes/speed.md` | `pickDirect` + `ROW_SETTLE_MS` + `fixRow` (28/10/69), timing.csv, สิ่งที่เร่งไม่ได้ |
| เน็ตวูบ / แบนเนอร์ login หลอก | `docs/notes/network.md` | `gotoWithRetry`, `POOL_SIZE=1`, `checkLogin` in/out/neterror |

## ⚠️ กับดักที่ทำพังบ่อย (รายละเอียดอยู่ไฟล์ที่ชี้)

- **แก้โค้ดแล้วต้อง `npm run restart`** — server `require` automation.js ตอน start = ยังรันโค้ดเก่า → `deploy-update.md`
- **ไฟล์ที่ gitignore แต่เครื่องด่านต้องมี:** `auth/storageState.json` + `src/log-upload.local.js` (repo public ห้าม push) → `deploy-update.md`
- **ปุ่มจอง `#go` คุมที่ `syncGoButton()` จุดเดียว** — ห้ามเซ็ต disabled ตรงจากที่อื่น → `booking-rules.md`
- **ห้ามใช้ `browser.isConnected()` วัด "ปิดหน้าต่าง"** + prune ใบที่หลุดต้อง `browser.close()` (ไม่งั้น orphan กิน RAM) → `booking-rules.md`
- **จองกลุ่มใหญ่ห้าม timeout ตายตัวครอบทั้งงาน** — ใช้ watchdog นับจาก progress ล่าสุด (`withStallGuard`) → `files.md`
- **`revealWindow` ลำดับ minimize→normal→maximized + retry** · screenshot ต้องหลัง reveal · อย่าลองบล็อกรูป/minimize/headless handoff ซ้ำ → `window-hiding.md`
- **DNP ล้างค่า row ใหม่ที่ ~1.53 วิหลังกด "เพิ่ม..."** — ใส่ก่อนนั้นหาย → `pickDirect` หลัง `ROW_SETTLE_MS` + `fixRow` → `speed.md`
- **`neterror` ≠ ออกจากระบบ** — อย่าบล็อกปุ่มจองตอนเน็ตวูบ → `network.md`
- **receipt-inject เป็นสำเนา** ของ `~/dnp-eticket-receipt` · Apps Script redeploy = New version ห้าม New deployment → `files.md`

## Persona
มุก (ไข่มุก) เลขาฯ พี่วิน — ภาษาไทยเป็นกันเอง ลงท้าย "ค่ะ"
