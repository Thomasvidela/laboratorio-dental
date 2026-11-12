@echo off
chcp 65001 >nul
title DentalLab Pro - Servidor PWA
cd /d "%~dp0"

echo ========================================================
echo   DENTALLAB PRO - SISTEMA DE GESTION DE LABORATORIO
echo ========================================================
echo.

if not exist "node_modules" (
    echo [1/2] Instalando dependencias por primera vez...
    call npm.cmd install
)

if not exist "prisma\dev.db" (
    echo [+] Inicializando base de datos local...
    call npx.cmd prisma db push
) else (
    if not exist "backups" mkdir "backups"
    copy /Y "prisma\dev.db" "backups\dev-ultimo-inicio.db" >nul
)

echo Direcciones para abrir en tu telefono (misma red Wi-Fi):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo   - http://%%b:3000
    )
)
echo.
echo En esta computadora se abrira automaticamente:
echo   - http://localhost:3000
echo.
echo Presiona Ctrl + C o cierra esta ventana para detener el servidor.
echo ========================================================
echo.

start "" "http://localhost:3000"

if exist ".next\BUILD_ID" (
    call npx.cmd next start -H 0.0.0.0 -p 3000
) else (
    call npx.cmd next dev -H 0.0.0.0 -p 3000
)

pause
