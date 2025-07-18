@echo off
SET POWERSHELL_PATH=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
SET POWERSHELL_INSTALLED=0

:: Step 1: Check if PowerShell exists
IF EXIST "%POWERSHELL_PATH%" (
    SET POWERSHELL_INSTALLED=1
    echo PowerShell is already installed.
) ELSE (
    echo PowerShell not found.
)

:: Step 2: Install PowerShell if not installed
IF %POWERSHELL_INSTALLED%==0 (
    echo Checking for Chocolatey...

    :: Step 2.1: Check if Chocolatey is installed
    where choco >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        echo Chocolatey is already installed. Installing PowerShell...
        choco install powershell-core -y
    ) ELSE (
        echo Chocolatey not found. Checking if winget is available...

        :: Step 2.2: If Chocolatey is not installed, use winget to install PowerShell
        where winget >nul 2>&1
        IF %ERRORLEVEL% EQU 0 (
            echo winget found. Installing PowerShell...
            winget install --id Microsoft.Powershell --exact --silent
        ) ELSE (
            echo Neither Chocolatey nor winget is available. Trying to install Chocolatey...

            :: Step 3: Install Chocolatey if neither PowerShell nor winget are found
            echo Installing Chocolatey...
            SET POWERSELL_INSTALL_SCRIPT=%TEMP%\install_choco.ps1
            echo Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')) > %POWERSELL_INSTALL_SCRIPT%
            powershell -ExecutionPolicy Bypass -File %POWERSELL_INSTALL_SCRIPT%

            :: Step 3.1: Install PowerShell after installing Chocolatey
            echo Installing PowerShell via Chocolatey...
            choco install powershell-core -y
        )
    )
)

:: Step 4: Check if PowerShell is installed successfully
where powershell >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo PowerShell is installed successfully.
    echo Running install.ps1...
    powershell -ExecutionPolicy Bypass -File install.ps1
) ELSE (
    echo PowerShell installation failed. Please install PowerShell manually by visiting:
    echo https://github.com/PowerShell/PowerShell/releases/download/v7.5.2/PowerShell-7.5.2-win-x64.msi

    :: Step 5: Inform user to rerun the installer
    echo Please install PowerShell, and then relaunch the installer to continue.
    pause
    exit
)

:: End of batch script
exit

