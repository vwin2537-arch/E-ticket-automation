#!/bin/bash
# 🔧 กู้ระบบจองเอราวัณ (เคส B — เผลอปิดหน้าต่าง/Chrome ค้าง) — เวอร์ชัน Mac ไว้เทส
# คู่กับ RESET-Windows.bat ที่ใช้บนเครื่องด่านจริง
cd ~/dnp-eticket-autofill || { echo "หาโฟลเดอร์โปรเจคไม่เจอ"; exit 1; }

echo "🔧 กำลังกู้ระบบเอราวัณ..."
echo "   [1/4] ปิด server เก่าที่ค้าง port 5179..."
lsof -ti:5179 | xargs kill -9 2>/dev/null

echo "   [2/4] กวาด Chrome ของบอทที่ค้าง (เฉพาะ playwright ไม่แตะ Chrome ปกติ)..."
pkill -f ms-playwright 2>/dev/null

echo "   [3/4] ส่ง log ขึ้น Google Drive..."
node scripts/upload-logs.js

echo "   [4/4] เปิดระบบใหม่..."
(sleep 2 && open "http://localhost:5179") &
node src/server.js
