@echo off
setlocal enabledelayedexpansion
title Log Prism - SEO Log Analyzer
color 0B
cls

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        Log Prism  -  SEO Log Analyzer    ║
echo  ║        Local Development Server          ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Change to the project directory
cd /d "%~dp0"

:: Check if pre-built Electron app exists
if exist "release\win-unpacked\SEO Log Analyzer.exe" (
    echo Starting SEO Log Analyzer...
    start "" "release\win-unpacked\SEO Log Analyzer.exe"
    exit /b 0
)

echo [1/4] Checking environment...
where node >nul 2>&1 || (echo [ERROR] Node.js not found. & pause & exit /b 1)
where npm >nul 2>&1 || (echo [ERROR] npm not found. & pause & exit /b 1)

if not exist "node_modules\" (
    echo [2/4] node_modules not found. Installing...
    call npm install --prefer-offline
) else (
    echo [2/4] Environment ready.
)

echo [3/4] Checking port 5173...
:: Use PowerShell to kill the process on port 5173 - much more reliable than CMD FOR loops
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($conn) { $conn | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force; echo \"[*] Terminated existing process (ID: $($_.OwningProcess))\" } }"

:: Clear Vite cache
if exist "node_modules\.vite\" rmdir /s /q "node_modules\.vite" >nul 2>&1

echo [4/4] Starting server...
echo.
echo  ═══════════════════════════════════════════════
echo   App URL: http://localhost:5173/
echo   Status:  Waiting for server to be ready...
echo  ═══════════════════════════════════════════════

:: Launch browser in background when port becomes available (Disabled: Vite-Plugin-Electron automatically spawns Electron window)
:: start /b powershell -NoProfile -WindowStyle Hidden -Command "$p=5173; while(-not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)) { Start-Sleep -s 1 }; Start-Process http://localhost:5173"

:: Run Vite
call npm run dev

echo.
echo  [--] Server stopped.
pause >nul
