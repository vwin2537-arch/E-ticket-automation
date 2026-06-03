@echo off
chcp 65001 >nul
title Setup - DNP Erawan Booking
cd /d "%~dp0"

echo.
echo  ========================================
echo    SETUP - Erawan Booking System
echo    (run this ONCE)
echo  ========================================
echo.

REM --- Check Node.js ---
where node >nul 2>&1
if errorlevel 1 (
  echo  [X] Node.js is NOT installed on this PC.
  echo.
  echo  Please install it first:
  echo     1. Open  https://nodejs.org
  echo     2. Download the LEFT button ^(LTS^), install with Next, Next...
  echo     3. Then double-click this file again.
  echo.
  pause
  exit /b
)

echo  [OK] Found Node.js version:
node -v
echo.

REM --- Check login session file (copied from boss's Mac) ---
if not exist "auth\storageState.json" (
  echo  [!] WARNING: login file  auth\storageState.json  not found.
  echo      Copy the whole "auth" folder from the boss's computer
  echo      into this folder first, or booking will not work.
  echo.
)

REM --- Remove old node_modules (Mac build cannot run on Windows) ---
if exist node_modules (
  echo  [..] Removing old node_modules to reinstall for Windows...
  rmdir /s /q node_modules
)

echo  [..] Installing components, please wait. Do NOT close this window...
echo.
call npm install
if errorlevel 1 (
  echo.
  echo  [X] npm install failed. Check internet, then run again.
  pause
  exit /b
)

echo.
echo  [..] Downloading browser for form-filling ^(~150MB^)...
echo.
call npx playwright install chromium
if errorlevel 1 (
  echo.
  echo  [X] Browser download failed. Check internet, then run again.
  pause
  exit /b
)

echo.
echo  ========================================
echo    [OK] Setup complete!
echo    From now on, double-click:
echo       2-START-Windows.bat
echo    See README-Windows.md for Thai details.
echo  ========================================
echo.
pause
