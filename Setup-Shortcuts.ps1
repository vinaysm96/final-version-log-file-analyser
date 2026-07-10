# Setup-Shortcuts.ps1
# Creates a Desktop shortcut and optionally a Windows Startup entry for Log Prism

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exeFile   = Join-Path $scriptDir "release\win-unpacked\SEO Log Analyzer.exe"
$batchFile = Join-Path $scriptDir "start-app.bat"

if (Test-Path $exeFile) {
    $targetFile = $exeFile
    $iconFile   = $exeFile
} else {
    $targetFile = $batchFile
    $iconFile   = Join-Path $scriptDir "public\favicon.ico"
    if (-not (Test-Path $iconFile)) {
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCmd) { $iconFile = $nodeCmd.Source } else { $iconFile = "" }
    }
}

# ── 1. Desktop Shortcut ──────────────────────────────────────────────────────
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Log Prism.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetFile
$shortcut.WorkingDirectory = $scriptDir
$shortcut.WindowStyle = 1
$shortcut.Description = "Log Prism - SEO Log Analyzer"
if ($iconFile -ne "" -and (Test-Path $iconFile)) {
    $shortcut.IconLocation = "$iconFile,0"
}
$shortcut.Save()

Write-Host "[OK] Desktop shortcut created: $shortcutPath" -ForegroundColor Green

# ── 2. Windows Startup Shortcut (auto-start on login) ────────────────────────
$startupPath = [Environment]::GetFolderPath("Startup")
$startupShortcut = Join-Path $startupPath "Log Prism.lnk"

$choice = Read-Host "`nDo you want Log Prism to launch automatically when Windows starts? (Y/N)"
if ($choice -match "^[Yy]") {
    $shell2 = New-Object -ComObject WScript.Shell
    $sc2 = $shell2.CreateShortcut($startupShortcut)
    $sc2.TargetPath = $targetFile
    $sc2.WorkingDirectory = $scriptDir
    $sc2.WindowStyle = 7  # minimized
    $sc2.Description = "Log Prism - SEO Log Analyzer"
    if ($iconFile -ne "" -and (Test-Path $iconFile)) {
        $sc2.IconLocation = "$iconFile,0"
    }
    $sc2.Save()
    Write-Host "[OK] Startup entry created. App will auto-launch on login." -ForegroundColor Green
} else {
    Write-Host "[--] Skipped auto-start. You can run this script again to add it later." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host " Setup complete! To launch the app:"            -ForegroundColor Cyan
Write-Host "  1. Double-click 'Log Prism' on your Desktop"  -ForegroundColor White
Write-Host "  2. Or navigate to: http://localhost:5173/"    -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Pause
