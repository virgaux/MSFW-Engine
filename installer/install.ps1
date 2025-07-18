# install.ps1 – Silent dependency bootstrap for MSFW Engine
# Must be run by Electron afterPack stage

Write-Host "[MSFW INSTALLER] Starting silent dependency installation..." -ForegroundColor Cyan

# Set paths
$nodeInstaller = "installer\node-v22.17.1-x64.msi"
$pwshInstaller = "installer\PowerShell-7.5.2-win-x64.msi"

# Function: Compare versions
function IsVersionLessThan($v1, $v2) {
    $v1 = [System.Version]::Parse($v1)
    $v2 = [System.Version]::Parse($v2)
    return $v1.CompareTo($v2) -lt 0
}

# Step 1: Ensure PowerShell 7.2+ is installed
try {
    $pwshVersion = (pwsh -Command '$PSVersionTable.PSVersion.ToString()' 2>$null)
    if (-not $pwshVersion -or (IsVersionLessThan $pwshVersion "7.2")) {
        Write-Host "[MSFW] Installing or upgrading PowerShell..." -ForegroundColor Yellow
        Start-Process msiexec.exe -ArgumentList "/i `"$pwshInstaller`" /qn /norestart" -Wait -Verb RunAs
    } else {
        Write-Host "[MSFW] PowerShell version $pwshVersion is already installed." -ForegroundColor Green
    }
} catch {
    Write-Host "[MSFW] PowerShell not detected. Installing..." -ForegroundColor Red
    Start-Process msiexec.exe -ArgumentList "/i `"$pwshInstaller`" /qn /norestart" -Wait -Verb RunAs
}

# Step 2: Ensure Node.js is installed and up-to-date
try {
    $nodeVersion = (node -v 2>$null).Replace("v", "")
    if (-not $nodeVersion -or (IsVersionLessThan $nodeVersion "22.17.1")) {
        Write-Host "[MSFW] Installing or upgrading Node.js..." -ForegroundColor Yellow
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn /norestart" -Wait -Verb RunAs
    } else {
        Write-Host "[MSFW] Node.js version $nodeVersion is already installed." -ForegroundColor Green
    }
} catch {
    Write-Host "[MSFW] Node.js not found. Installing..." -ForegroundColor Red
    Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn /norestart" -Wait -Verb RunAs
}

# Step 3: Run npm install if node_modules is missing
if (!(Test-Path "node_modules")) {
    Write-Host "[MSFW] Running npm install to fetch project dependencies..." -ForegroundColor Cyan
    npm install
}

Write-Host "[MSFW INSTALLER] All dependencies installed successfully." -ForegroundColor Green
