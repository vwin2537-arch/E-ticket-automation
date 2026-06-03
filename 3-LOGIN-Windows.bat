@echo off
chcp 65001 >nul
title Erawan Booking - LOGIN to DNP
cd /d "%~dp0"

echo.
echo   Logging in to DNP e-ticket system...
echo   [!] A browser window will open shortly.
echo       Please log in there (username / password) as usual.
echo       When you see the "Logout" menu, it will SAVE automatically and close.
echo.

node scripts\login.js

echo.
echo   Done. You can close this window now.
pause
