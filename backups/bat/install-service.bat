@echo off
setlocal enableextensions

echo ==========================================================
echo    Installation de FHIRHub comme service Windows
echo ==========================================================

REM Vérifier si on est en mode administrateur
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR : Ce script doit être exécuté en tant qu'administrateur.
    echo Veuillez redémarrer le script avec des droits d'administrateur.
    pause
    exit /b 1
)

REM Vérifier si NSSM est présent
set NSSM_PATH=nssm.exe
where /q %NSSM_PATH%
if %errorlevel% neq 0 (
    if exist ".\tools\nssm.exe" (
        set NSSM_PATH=.\tools\nssm.exe
    ) else (
        echo NSSM n'est pas installé ou n'est pas dans le PATH.
        echo.
        echo Deux options :
        echo 1. Téléchargez NSSM depuis https://nssm.cc/download
        echo 2. Installez-le manuellement puis réexécutez ce script
        echo 3. Ou appuyez sur une touche pour télécharger et installer automatiquement NSSM
        pause
        
        echo Téléchargement de NSSM...
        mkdir tools 2>nul
        powershell -Command "(New-Object Net.WebClient).DownloadFile('https://nssm.cc/release/nssm-2.24.zip', 'tools\nssm.zip')"
        powershell -Command "Expand-Archive -Path 'tools\nssm.zip' -DestinationPath 'tools' -Force"
        copy "tools\nssm-2.24\win64\nssm.exe" "tools\nssm.exe" >nul
        set NSSM_PATH=.\tools\nssm.exe
    )
)

REM Obtenir le chemin complet de Node.js
for /f "tokens=*" %%g in ('where node') do (set NODE_PATH=%%g)

if "%NODE_PATH%"=="" (
    echo Node.js n'est pas installé ou n'est pas dans le PATH.
    echo Veuillez installer Node.js avant d'installer le service.
    pause
    exit /b 1
)

REM Obtenir le chemin absolu du dossier courant
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

echo.
echo Configuration du service FHIRHub...
echo.
echo Chemin Node.js: %NODE_PATH%
echo Répertoire de travail: %SCRIPT_DIR%
echo Fichier principal: app.js
echo.

REM Vérifier si le service existe déjà
%NSSM_PATH% status FHIRHub > nul 2>&1
if %errorlevel% equ 0 (
    echo Le service FHIRHub existe déjà. Voulez-vous le réinstaller? (O/N)
    choice /c ON /n
    if %errorlevel% equ 1 (
        echo Arrêt et suppression du service existant...
        %NSSM_PATH% stop FHIRHub confirm
        %NSSM_PATH% remove FHIRHub confirm
    ) else (
        echo Installation annulée.
        exit /b 0
    )
)

echo Installation du service FHIRHub...
%NSSM_PATH% install FHIRHub "%NODE_PATH%" "app.js"
%NSSM_PATH% set FHIRHub AppDirectory "%SCRIPT_DIR%"
%NSSM_PATH% set FHIRHub Description "FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"
%NSSM_PATH% set FHIRHub DisplayName "FHIRHub"
%NSSM_PATH% set FHIRHub Start SERVICE_AUTO_START
%NSSM_PATH% set FHIRHub ObjectName LocalSystem
%NSSM_PATH% set FHIRHub AppEnvironmentExtra "NODE_ENV=production" "PORT=5000"
%NSSM_PATH% set FHIRHub AppStdout "%SCRIPT_DIR%\logs\service-stdout.log"
%NSSM_PATH% set FHIRHub AppStderr "%SCRIPT_DIR%\logs\service-stderr.log"
%NSSM_PATH% set FHIRHub AppRotateFiles 1
%NSSM_PATH% set FHIRHub AppRotateOnline 1
%NSSM_PATH% set FHIRHub AppRotateSeconds 86400
%NSSM_PATH% set FHIRHub AppRotateBytes 10485760

if not exist "%SCRIPT_DIR%\logs" mkdir "%SCRIPT_DIR%\logs"

echo.
echo Service FHIRHub installé avec succès!
echo.
echo Voulez-vous démarrer le service maintenant? (O/N)
choice /c ON /n
if %errorlevel% equ 1 (
    echo Démarrage du service FHIRHub...
    %NSSM_PATH% start FHIRHub
    echo.
    echo Service FHIRHub démarré!
    echo Vérifiez l'état du service dans le Gestionnaire de services Windows
    echo ou exécutez: %NSSM_PATH% status FHIRHub
) else (
    echo.
    echo Le service est installé mais n'a pas été démarré.
    echo Vous pouvez le démarrer manuellement via le Gestionnaire de services Windows
    echo ou exécuter: %NSSM_PATH% start FHIRHub
)

echo.
echo ==========================================================
echo L'application sera accessible à l'adresse: http://localhost:5000
echo ==========================================================

pause