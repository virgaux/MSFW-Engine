Write-Host "[MSFW Installer] Running setup via install.ps1..."

# 📌 Define installer paths
$nodeInstaller = "$PSScriptRoot\node-v22.17.1-x64.msi"

# -------------------------------
# ✅ Function: Check PowerShell version
# -------------------------------
function Ensure-PowerShell-UpToDate {
    $minVersion = [Version]"7.3.0"
    if ($PSVersionTable.PSVersion -lt $minVersion) {
        Write-Host "PowerShell version is outdated. Updating..."
        Start-Process msiexec.exe -ArgumentList "/i `"$PSScriptRoot\PowerShell-7.5.2-win-x64.msi`" /qn /norestart" -Wait -Verb RunAs
    } else {
        Write-Host "PowerShell version is up-to-date."
    }
}

# -------------------------------
# ✅ Function: Check Node.js version
# -------------------------------
function Ensure-NodeJS-LTS {
    Write-Host "[MSFW Installer] Checking Node.js..."
    $nodePath = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodePath) {
        Write-Host "Node.js not found. Installing..."
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn /norestart" -Wait -Verb RunAs
    } else {
        $nodeVersion = & node -v
        if ($nodeVersion -lt "v20.0.0") {
            Write-Host "Node.js version ($nodeVersion) is outdated. Updating..."
            Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn /norestart" -Wait -Verb RunAs
        } else {
            Write-Host "Node.js is already up-to-date: $nodeVersion"
        }
    }
}

# -------------------------------
# ✅ Function: Run npm install
# -------------------------------
function Run-NpmInstall {
    $projectRoot = Split-Path $PSScriptRoot -Parent
    Set-Location $projectRoot
    Write-Host "[MSFW Installer] Installing Node packages via npm..."
    & npm install
    Write-Host "[MSFW Installer] npm packages installed successfully."
}

# Run the full setup steps
Ensure-PowerShell-UpToDate
Ensure-NodeJS-LTS
Run-NpmInstall

Write-Host "[MSFW Installer] ✅ Setup complete."
