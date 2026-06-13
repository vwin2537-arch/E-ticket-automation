@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Update - DNP Erawan Booking
cd /d "%~dp0"

set "REPO=https://github.com/vwin2537-arch/E-ticket-automation.git"

echo.
echo  ========================================
echo    UPDATE - Erawan Booking System
echo  ========================================
echo.

REM --- Check Git (install ONCE, like Node.js) ---
where git >nul 2>&1
if errorlevel 1 (
  echo  [X] Git is NOT installed on this PC.
  echo.
  echo  Please install it ONCE:
  echo     1. Open  https://git-scm.com/download/win
  echo     2. Download "64-bit Git for Windows Setup"
  echo        install with Next, Next, Next...
  echo     3. Then double-click this file again.
  echo.
  pause
  exit /b
)

set "NEEDINSTALL=0"

if not exist ".git" (
  REM ===== FIRST TIME: turn this zip-folder into a git folder =====
  REM Your logs\ and auth\ are ignored, so they are NOT touched.
  echo  [..] First time setup: linking this folder to GitHub...
  echo       ^(your logs and login session will NOT be touched^)
  echo.
  git init
  git remote add origin "%REPO%"
  git fetch origin
  if errorlevel 1 (
    echo.
    echo  [X] Cannot reach GitHub. Check internet, then run again.
    pause
    exit /b
  )
  git reset --hard origin/main
  git branch -M main
  git branch --set-upstream-to=origin/main main >nul 2>&1
  set "NEEDINSTALL=1"
) else (
  REM ===== EVERY OTHER TIME: just pull =====
  echo  [..] Checking for updates from GitHub...
  echo.
  for /f %%i in ('git rev-parse HEAD') do set "OLD=%%i"
  git pull
  if errorlevel 1 (
    echo.
    echo  [X] Update failed. Check internet, then run again.
    pause
    exit /b
  )
  for /f %%i in ('git rev-parse HEAD') do set "NEW=%%i"
  if "!OLD!"=="!NEW!" (
    echo.
    echo  [OK] Already up to date.
  ) else (
    git diff --name-only !OLD! !NEW! | findstr /i "package" >nul && set "NEEDINSTALL=1"
  )
)

REM --- Reinstall components only if package files changed ---
if "!NEEDINSTALL!"=="1" (
  echo.
  echo  [..] Installing updated components, please wait...
  echo       Do NOT close this window.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [X] npm install failed. Check internet, then run again.
    pause
    exit /b
  )
)

echo.
echo  ========================================
echo    [OK] Update complete!
echo    Now double-click:  2-START-Windows.bat
echo  ========================================
echo.
pause
