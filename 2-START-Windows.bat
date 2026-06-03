@echo off
chcp 65001 >nul
title Erawan Booking System - keep this window open
cd /d "%~dp0"

echo.
echo   Starting Erawan Booking System...
echo   [!] Do NOT close this window while using it.
echo       Close it only when you are finished.
echo.

REM --- Kill old server still holding port 5179 (avoid port clash) ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5179 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

REM --- Wait 3s for server, then open the browser to the form ---
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:5179"

REM --- Start the server (stays running until this window is closed) ---
node src\server.js

pause
