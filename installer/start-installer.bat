@echo off
REM Start Installer for MSFW Engine

REM Check for PowerShell installation
powershell -Command "if (-not (Get-Command pwsh -ErrorAction SilentlyContinue)) { echo 'PowerShell is not installed.'; exit 1 }"
if %ERRORLEVEL% NEQ 0 (
    echo PowerShell is not installed. Installing...
    msiexec /i "installer\PowerShell-7.5.2-win-x64.msi" /quiet /norestart
    REM Restart to ensure powershell is ready
    echo PowerShell installation complete.
)

REM Check for Node.js installation
node -v > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed. Installing...
    msiexec /i "installer\node-v22.17.1-x64.msi" /quiet /norestart
)

REM Run the install.ps1 script to finish the installation
powershell -ExecutionPolicy Bypass -File "installer\install.ps1"

REM Complete installation message
echo Installation complete. You may now use the MSFW Engine.
pause
