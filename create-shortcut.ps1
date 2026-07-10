# =============================================================================
#  create-shortcut.ps1  -  Log Prism Desktop Shortcut Setup
#
#  What this script does:
#    1. Checks Node.js is installed
#    2. Creates Desktop shortcut -> start-app.bat
#    3. Creates Start Menu shortcut
#    4. Optionally adds Windows Startup entry (auto-launch on login)
#    5. Optionally runs npm install if node_modules is missing
#
#  How to run:
#    Right-click -> "Run with PowerShell"
#    OR: powershell -ExecutionPolicy Bypass -File create-shortcut.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# Resolve paths relative to this script's location
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exeFile    = Join-Path $projectDir "release\win-unpacked\SEO Log Analyzer.exe"
$batchFile  = Join-Path $projectDir "start-app.bat"

if (Test-Path $exeFile) {
    $targetFile = $exeFile
    $iconFile   = $exeFile
} else {
    $targetFile = $batchFile
    $iconFile   = Join-Path $projectDir "public\favicon.ico"
    # If no favicon, fall back to node.exe icon (safe fallback)
    if (-not (Test-Path $iconFile)) {
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCmd) {
            $iconFile = $nodeCmd.Source
        } else {
            $iconFile = ""
        }
    }
}

# -------------------------------------------------------------------
Write-Host ""
Write-Host "  Log Prism -- Shortcut Setup" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor DarkGray
Write-Host ""

# -- Check Node.js ----------------------------------------------------------
$nodeCmd2 = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd2) {
    $nodeVer = (node --version 2>&1)
    Write-Host "  [OK] Node.js $nodeVer detected." -ForegroundColor Green
} else {
    Write-Host "  [WARN] Node.js NOT found in PATH!" -ForegroundColor Yellow
    Write-Host "         Download from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "         Install Node.js first, then re-run this script." -ForegroundColor Yellow
    Write-Host "         (The shortcut will be created anyway.)" -ForegroundColor Yellow
}

# -- Verify target executable or batch file exists --------------------------
if (-not (Test-Path $targetFile)) {
    Write-Host ""
    Write-Host "  [ERROR] Target file not found!" -ForegroundColor Red
    Write-Host "          Expected: $targetFile" -ForegroundColor Red
    Write-Host "          Make sure you run this script from inside the" -ForegroundColor Red
    Write-Host "          seo-log-analyzer project folder." -ForegroundColor Red
    Write-Host ""
    Pause
    exit 1
}
Write-Host "  [OK] Target file found: $(Split-Path -Leaf $targetFile)" -ForegroundColor Green
Write-Host "  [OK] Icon: $iconFile" -ForegroundColor DarkGray

# -------------------------------------------------------------------
# Helper: create a Windows .lnk shortcut
# -------------------------------------------------------------------
function New-Lnk {
    param(
        [string]$LnkPath,
        [string]$Target,
        [string]$WorkDir,
        [string]$Desc,
        [string]$IconPath = "",
        [int]$Style = 1
    )
    $wsh = New-Object -ComObject WScript.Shell
    $sc  = $wsh.CreateShortcut($LnkPath)
    $sc.TargetPath       = $Target
    $sc.WorkingDirectory = $WorkDir
    $sc.Description      = $Desc
    $sc.WindowStyle      = $Style
    if ($IconPath -ne "" -and (Test-Path $IconPath)) {
        $sc.IconLocation = "$IconPath,0"
    }
    $sc.Save()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wsh)
}

# -------------------------------------------------------------------
# 1. Desktop Shortcut
# -------------------------------------------------------------------
$desktopPath  = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Log Prism.lnk"

New-Lnk `
    -LnkPath  $shortcutPath `
    -Target   $targetFile `
    -WorkDir  $projectDir `
    -Desc     "Log Prism - SEO Log Analyzer (http://localhost:5173/)" `
    -IconPath $iconFile `
    -Style    1

Write-Host "  [OK] Desktop shortcut created." -ForegroundColor Green
Write-Host "       Path: $shortcutPath" -ForegroundColor DarkGray

# -------------------------------------------------------------------
# 2. Start Menu Shortcut
# -------------------------------------------------------------------
$startMenuDir  = Join-Path ([Environment]::GetFolderPath("Programs")) "Log Prism"
$startMenuLink = Join-Path $startMenuDir "Log Prism.lnk"

if (-not (Test-Path $startMenuDir)) {
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
}

New-Lnk `
    -LnkPath  $startMenuLink `
    -Target   $targetFile `
    -WorkDir  $projectDir `
    -Desc     "Log Prism - SEO Log Analyzer" `
    -IconPath $iconFile `
    -Style    1

Write-Host "  [OK] Start Menu shortcut created." -ForegroundColor Green

# -------------------------------------------------------------------
# 3. Optional: Windows Startup (auto-launch on login)
# -------------------------------------------------------------------
Write-Host ""
$autoStart = Read-Host "  Auto-launch Log Prism when Windows starts? (Y/N)"

if ($autoStart -match "^[Yy]") {
    $startupFolder = [Environment]::GetFolderPath("Startup")
    $startupLink   = Join-Path $startupFolder "Log Prism.lnk"

    New-Lnk `
        -LnkPath  $startupLink `
        -Target   $targetFile `
        -WorkDir  $projectDir `
        -Desc     "Log Prism - SEO Log Analyzer (auto-start)" `
        -IconPath $iconFile `
        -Style    7    # 7 = minimised window so it does not interrupt login

    Write-Host "  [OK] Auto-start entry created (launches minimised)." -ForegroundColor Green
    Write-Host "       To remove: Delete '$startupLink'" -ForegroundColor DarkGray
} else {
    Write-Host "  [--] Auto-start skipped." -ForegroundColor Yellow
}

# -------------------------------------------------------------------
# 4. Optional: npm install if node_modules missing
# -------------------------------------------------------------------
if ($nodeCmd2) {
    $nodeModulesPath = Join-Path $projectDir "node_modules"
    if (-not (Test-Path $nodeModulesPath)) {
        Write-Host ""
        $doInstall = Read-Host "  node_modules not found. Run 'npm install' now? (Y/N)"
        if ($doInstall -match "^[Yy]") {
            Write-Host "  Installing dependencies (may take 2-3 minutes)..." -ForegroundColor Cyan
            Push-Location $projectDir
            npm install
            Pop-Location
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Dependencies installed successfully." -ForegroundColor Green
            } else {
                Write-Host "  [WARN] npm install returned errors. Check your internet connection." -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  [OK] node_modules already present - no install needed." -ForegroundColor Green
    }
}

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   Setup complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "   To launch Log Prism:" -ForegroundColor White
Write-Host "     - Double-click 'Log Prism' on your Desktop" -ForegroundColor White
Write-Host "     - Or search 'Log Prism' in the Start Menu" -ForegroundColor White
Write-Host ""
Write-Host "   Browser opens automatically to:" -ForegroundColor White
Write-Host "     http://localhost:5173/" -ForegroundColor Yellow
Write-Host ""
Write-Host "   The launcher handles automatically:" -ForegroundColor DarkGray
Write-Host "     [+] Checks Node.js is installed" -ForegroundColor DarkGray
Write-Host "     [+] Runs npm install if node_modules is missing" -ForegroundColor DarkGray
Write-Host "     [+] Kills any stuck process on port 5173" -ForegroundColor DarkGray
Write-Host "     [+] Clears stale Vite cache" -ForegroundColor DarkGray
Write-Host "     [+] Opens your default browser automatically" -ForegroundColor DarkGray
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""
Pause
