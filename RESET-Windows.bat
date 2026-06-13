@echo off
chcp 65001 >nul
title Reset Erawan Booking System
cd /d "%~dp0"

echo.
echo   Resetting Erawan Booking System...
echo   (Use this if the black window was closed by accident and Chrome is stuck)
echo.

REM --- 1) Kill old server still holding port 5179 ---
echo   [1/4] Stopping old server on port 5179...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5179 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

REM --- 2) Kill ONLY the bot's Chrome (Playwright). Personal Chrome stays open ---
REM     Match command line containing "ms-playwright" so normal Chrome is never touched.
echo   [2/4] Closing stuck bot browsers (Playwright only)...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*ms-playwright*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

REM --- 3) Send logs to Google Drive (best-effort, 10s timeout) ---
echo   [3/4] Sending logs to Google Drive...
node scripts\upload-logs.js

REM --- 4) Open browser + start the server fresh ---
echo   [4/4] Starting the system again...
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:5179"
echo.
echo   [OK] System is starting. Use it as usual.
echo   [!] Do NOT close this window. To stop, use the on-screen Shut down button.
echo.
node src\server.js

REM exit 0 = closed normally via the web button -> window closes itself
if errorlevel 1 pause
