@echo off
title Push to GitHub
cd /d "%~dp0"
echo ===================================================
echo  Staging changes...
echo ===================================================
"C:\Users\JGI\AppData\Local\GitHubDesktop\app-3.5.12\resources\app\git\cmd\git.exe" add .
echo.

echo ===================================================
echo  Committing changes...
echo ===================================================
"C:\Users\JGI\AppData\Local\GitHubDesktop\app-3.5.12\resources\app\git\cmd\git.exe" commit -m "Fix OOM on large files, add toggle on Data Intake, and add clear button to error pages"
echo.

echo ===================================================
echo  Pushing final-version-log-file-analyser to GitHub...
echo ===================================================
"C:\Users\JGI\AppData\Local\GitHubDesktop\app-3.5.12\resources\app\git\cmd\git.exe" push -u origin main
echo.

echo ===================================================
echo  Done! Press any key to close.
echo ===================================================
pause >nul
