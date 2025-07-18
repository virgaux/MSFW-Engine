# install.ps1 – Silent dependency bootstrap for MSFW Engine

Write-Host "[MSFW INSTALLER] Installing dependencies..." -ForegroundColor Cyan

# Ensure Node.js is installed
$nodeVersion = (node -v 2>$null).Replace("v", "")
if (-not $nodeVersion -or [version]$nodeVersion -lt [version]"22.17.1") {
    Write-Host "[MSFW] Installing Node.js..." -ForegroundColor Yellow
    Start-Process msiexec.exe -ArgumentList "/i `"$env:USERPROFILE\Documents\MSFW_Engine\installer\node-v22.17.1-x64.msi`" /quiet /norestart" -Wait -Verb RunAs
}

# Ensure npm dependencies are installed
Write-Host "[MSFW] Running npm install..." -ForegroundColor Cyan
npm install

Write-Host "[MSFW INSTALLER] All dependencies installed successfully." -ForegroundColor Green
