@echo off
echo [MSFW Installer] Checking for PowerShell...

:: Try to run pwsh.exe
where pwsh >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo PowerShell 7 is not installed. Installing...
    msiexec /i "%~dp0PowerShell-7.5.2-win-x64.msi" /qn /norestart
    timeout /t 5
)

:: Call the PowerShell script now (guaranteed to exist)
"%ProgramFiles%\PowerShell\7\pwsh.exe" -ExecutionPolicy Bypass -File "%~dp0install.ps1"
