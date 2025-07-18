@echo off
SET POWERSHELL_PATH=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
SET POWERSHELL_INSTALLED=0

:: Step 1: Check if PowerShell exists
IF EXIST "%POWERSHELL_PATH%" (
    SET POWERSHELL_INSTALLED=1
    echo [MSFW INSTALLER LOG]: PowerShell is already installed.
) ELSE (
    echo [MSFW INSTALLER LOG]: PowerShell not found.
)

:: Step 2: Install PowerShell if not installed
IF %POWERSHELL_INSTALLED%==0 (
    echo [MSFW INSTALLER LOG]: Checking for Chocolatey...

    where choco >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        echo [MSFW INSTALLER LOG]: Chocolatey is installed. Installing PowerShell...
        choco install powershell-core -y
    ) ELSE (
        echo [MSFW INSTALLER LOG]: Chocolatey not found. Checking for winget...

        where winget >nul 2>&1
        IF %ERRORLEVEL% EQU 0 (
            echo [MSFW INSTALLER LOG]: winget found. Installing PowerShell...
            winget install --id Microsoft.Powershell --exact --silent
        ) ELSE (
            echo [MSFW INSTALLER LOG]: Neither Chocolatey nor winget found. Installing Chocolatey manually...

            SET "POWERSHELL_INSTALL_SCRIPT=%TEMP%\install_choco.ps1"
            (
                echo Set-ExecutionPolicy Bypass -Scope Process -Force
                echo [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
                echo iex ^(^(New-Object System.Net.WebClient^).DownloadString^('https://community.chocolatey.org/install.ps1'^)^)
            ) > "%POWERSHELL_INSTALL_SCRIPT%"

            powershell -ExecutionPolicy Bypass -File "%POWERSHELL_INSTALL_SCRIPT%"

            echo [MSFW INSTALLER LOG]: Installing PowerShell via Chocolatey...
            choco install powershell-core -y
        )
    )
)

:: Step 4: Confirm PowerShell is installed
where powershell >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [MSFW INSTALLER LOG]: PowerShell is now installed.
    echo [MSFW INSTALLER LOG]: Launching install.ps1...
    powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"
) ELSE (
    echo [MSFW INSTALLER ERROR]: PowerShell install failed.
    echo Please install it manually from:
    echo https://github.com/PowerShell/PowerShell/releases/download/v7.5.2/PowerShell-7.5.2-win-x64.msi
    pause
    exit
)

exit
