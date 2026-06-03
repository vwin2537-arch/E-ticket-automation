#!/bin/bash
# 🎟️ เปิดระบบจองบัตรเอราวัณ (มุกช่วยกรอก)
cd ~/dnp-eticket-autofill || { echo "หาโฟลเดอร์โปรเจคไม่เจอ"; exit 1; }

echo "🎟️  กำลังเปิดระบบจองเอราวัณ..."
echo "    ⚠️  อย่าปิดหน้าต่างนี้ขณะใช้งาน — ปิดเมื่อเลิกใช้เท่านั้น"
echo ""

# ฆ่า server ตัวเก่า (ถ้ามีค้าง) กัน port ชน
lsof -ti:5179 | xargs kill -9 2>/dev/null
sleep 1

# เปิดเบราว์เซอร์ไปหน้ากากอัตโนมัติ (รอ server ขึ้น 2 วิ)
(sleep 2 && open "http://localhost:5179") &

# สตาร์ท server (ค้างไว้จนปิดหน้าต่าง)
node src/server.js
