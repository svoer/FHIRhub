@echo off
setlocal enableextensions

echo ==========================================================
echo      Installation de FHIRHub - Convertisseur HL7 vers FHIR
echo ==========================================================

REM Définir les variables pour Node.js intégré
set NODE_VERSION=20.15.1
set NODE_DIR=node-v%NODE_VERSION%-win-x64
set NODE_ARCHIVE=%NODE_DIR%.zip
set NODE_URL=https://nodejs.org/download/release/v%NODE_VERSION%/%NODE_ARCHIVE%
set NODE_LOCAL_PATH=vendor\nodejs
set TEMP_PATH=vendor\temp

REM Créer le répertoire vendor s'il n'existe pas
if not exist "vendor" mkdir vendor
if not exist "vendor\temp" mkdir vendor\temp

REM Vérification de l'environnement
echo [1/8] Vérification de l'environnement...

REM Vérification de l'environnement Python
echo Vérification de Python...
set "PYTHON_CMD="
set "PYTHON_VERSION="

where python3 >nul 2>nul
if %errorlevel% equ 0 (
  set "PYTHON_CMD=python3"
  for /f "tokens=*" %%i in ('python3 --version 2^>^&1') do set PYTHON_VERSION=%%i
  echo ✅ Python 3 trouvé: %PYTHON_VERSION%
) else (
  where python >nul 2>nul
  if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
    for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
    
    echo %PYTHON_VERSION% | findstr "Python 3" >nul
    if %errorlevel% equ 0 (
      echo ✅ Python 3 trouvé: %PYTHON_VERSION%
    ) else (
      echo ⚠️ %PYTHON_VERSION% trouvé, mais Python 3 est recommandé
    )
  ) else (
    echo ⚠️ Python non trouvé. Tentative d'installation automatique...
    
    REM Tentative de téléchargement et d'installation de Python 3.10 via PowerShell
    echo Téléchargement de Python 3.10...
    mkdir vendor\temp 2>nul
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { (New-Object Net.WebClient).DownloadFile('https://www.python.org/ftp/python/3.10.11/python-3.10.11-amd64.exe', 'vendor\temp\python-3.10.11-amd64.exe'); Write-Host 'Téléchargement réussi'; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }}"
    
    if %errorlevel% equ 0 (
      echo Installation silencieuse de Python 3.10...
      vendor\temp\python-3.10.11-amd64.exe /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
      timeout /t 5 /nobreak > nul
      
      echo Vérification de l'installation de Python...
      REM Rafraîchir les variables d'environnement après l'installation
      call refreshenv 2>nul || (
        echo Exécution de command prompt refresh...
        call cmd /c exit /b 0
      )
      
      where python >nul 2>nul
      if %errorlevel% equ 0 (
        set "PYTHON_CMD=python"
        for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
        echo ✅ Python 3 installé avec succès: %PYTHON_VERSION%
      ) else (
        echo ⚠️ L'installation automatique de Python a échoué
        echo ⚠️ Veuillez installer Python 3.10+ manuellement
      )
    ) else (
      echo ⚠️ Échec du téléchargement de Python
      echo ⚠️ Veuillez installer Python 3.10+ manuellement
    )
  )
)

REM Vérifier pip et installer les modules requis
if not "%PYTHON_CMD%"=="" (
  REM Détecter pip
  set "PIP_CMD="
  
  where pip3 >nul 2>nul
  if %errorlevel% equ 0 (
    set "PIP_CMD=pip3"
    for /f "tokens=*" %%i in ('pip3 --version 2^>^&1') do echo ✅ Pip trouvé: %%i
  ) else (
    where pip >nul 2>nul
    if %errorlevel% equ 0 (
      set "PIP_CMD=pip"
      for /f "tokens=*" %%i in ('pip --version 2^>^&1') do echo ✅ Pip trouvé: %%i
    ) else (
      echo Vérification de pip via module Python...
      %PYTHON_CMD% -m pip --version >nul 2>nul
      if %errorlevel% equ 0 (
        set "PIP_CMD=%PYTHON_CMD% -m pip"
        for /f "tokens=*" %%i in ('%PYTHON_CMD% -m pip --version 2^>^&1') do echo ✅ Pip trouvé via Python module: %%i
      ) else (
        echo ⚠️ Module pip non trouvé. Tentative d'installation...
        
        REM Tentative d'installation via ensurepip
        %PYTHON_CMD% -m ensurepip --upgrade --default-pip >nul 2>nul
        
        REM Vérifier à nouveau si pip est disponible
        %PYTHON_CMD% -m pip --version >nul 2>nul
        if %errorlevel% equ 0 (
          set "PIP_CMD=%PYTHON_CMD% -m pip"
          echo ✅ Module pip installé avec succès
        ) else (
          echo ⚠️ Impossible d'installer pip automatiquement
        )
      )
    )
  )
  
  REM Installer les modules requis si pip est disponible
  if not "%PIP_CMD%"=="" (
    echo Installation/vérification des modules Python requis...
    
    %PYTHON_CMD% -c "import hl7" >nul 2>nul
    if %errorlevel% neq 0 (
      echo Installation du module hl7...
      %PIP_CMD% install hl7
      %PYTHON_CMD% -c "import hl7" >nul 2>nul
      if %errorlevel% equ 0 (
        echo ✅ Module hl7 installé avec succès
      )
    ) else (
      echo ✅ Module hl7 déjà installé
    )
    
    %PYTHON_CMD% -c "import requests" >nul 2>nul
    if %errorlevel% neq 0 (
      echo Installation du module requests...
      %PIP_CMD% install requests
      %PYTHON_CMD% -c "import requests" >nul 2>nul
      if %errorlevel% equ 0 (
        echo ✅ Module requests installé avec succès
      )
    ) else (
      echo ✅ Module requests déjà installé
    )
  )
)

echo ✅ Vérification de Python terminée
echo.

goto :check_system_nodejs

REM Fonction pour télécharger et installer Node.js localement
:install_local_nodejs
echo 📦 Installation locale de Node.js v%NODE_VERSION%...

REM Vérifier si l'archive existe déjà
if not exist "vendor\%NODE_ARCHIVE%" (
  echo    Téléchargement de Node.js v%NODE_VERSION%...
  
  REM Téléchargement avec PowerShell
  powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('%NODE_URL%', 'vendor\%NODE_ARCHIVE%')}"
  
  if %errorlevel% neq 0 (
    echo ❌ Échec du téléchargement de Node.js. Erreur PowerShell: %errorlevel%
    echo    Essai avec bitsadmin...
    
    REM Tentative avec bitsadmin si PowerShell échoue
    bitsadmin /transfer nodeDownload /download /priority normal %NODE_URL% "%cd%\vendor\%NODE_ARCHIVE%"
    
    if %errorlevel% neq 0 (
      echo ❌ Échec du téléchargement avec bitsadmin. Veuillez télécharger manuellement Node.js v%NODE_VERSION% depuis:
      echo    %NODE_URL%
      echo    et placez-le dans le dossier vendor.
      exit /b 1
    )
  )
) else (
  echo    Archive Node.js déjà téléchargée.
)

REM Extraire l'archive si le répertoire n'existe pas
if not exist "%NODE_LOCAL_PATH%" (
  echo    Extraction de Node.js...
  mkdir "%NODE_LOCAL_PATH%" 2>nul
  
  REM Extraction avec PowerShell
  powershell -Command "& {Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('vendor\%NODE_ARCHIVE%', 'vendor\temp')}"
  
  if %errorlevel% neq 0 (
    echo ❌ Échec de l'extraction de Node.js.
    exit /b 1
  )
  
  REM Déplacer les fichiers extraits
  xcopy "vendor\temp\%NODE_DIR%\*" "%NODE_LOCAL_PATH%\" /E /Y /Q
  rmdir /s /q "vendor\temp\%NODE_DIR%"
) else (
  echo    Node.js déjà extrait.
)

REM Vérifier l'installation
if not exist "%NODE_LOCAL_PATH%\node.exe" (
  echo ❌ L'installation de Node.js local a échoué.
  exit /b 1
)

set USE_LOCAL_NODEJS=1
echo ✅ Node.js v%NODE_VERSION% installé localement avec succès.
goto :nodejs_choice_done

REM Déterminer si Node.js est déjà installé sur le système
:check_system_nodejs
set use_system_nodejs=0
set use_local_nodejs=1

where node >nul 2>nul
if %errorlevel% equ 0 (
  REM Node.js est installé, vérifier la version
  for /f "tokens=1,2,3 delims=." %%a in ('node -v') do set SYSTEM_NODE_VERSION=%%a
  set SYSTEM_NODE_VERSION=%SYSTEM_NODE_VERSION:~1%
  
  if %SYSTEM_NODE_VERSION% GEQ 18 (
    if %SYSTEM_NODE_VERSION% LEQ 20 (
      echo ✅ Node.js v%SYSTEM_NODE_VERSION% trouvé et compatible.
      echo    Options disponibles:
      echo    1) Utiliser Node.js v%SYSTEM_NODE_VERSION% du système
      echo    2) Installer Node.js v%NODE_VERSION% localement (recommandé pour la compatibilité)
      echo.
      choice /c 12 /m "Votre choix (1 ou 2)"
      
      if errorlevel 2 (
        echo    ✓ Installation et utilisation de Node.js v%NODE_VERSION% localement...
        goto :install_local_nodejs
      ) else (
        echo    ✓ Utilisation de Node.js du système.
        set use_system_nodejs=1
        set use_local_nodejs=0
      )
    ) else (
      echo ⚠️ Node.js v%SYSTEM_NODE_VERSION% détecté, mais trop récent pour FHIRHub.
      echo    Installation de Node.js v%NODE_VERSION% localement pour assurer la compatibilité...
      goto :install_local_nodejs
    )
  ) else (
    echo ⚠️ Node.js v%SYSTEM_NODE_VERSION% détecté, mais trop ancien pour FHIRHub.
    echo    Installation de Node.js v%NODE_VERSION% localement pour assurer la compatibilité...
    goto :install_local_nodejs
  )
) else (
  echo ❓ Node.js non détecté sur le système.
  echo    Installation de Node.js v%NODE_VERSION% localement...
  goto :install_local_nodejs
)

:nodejs_choice_done

REM Modification du script de démarrage pour utiliser le Node.js local si nécessaire
if %use_local_nodejs% equ 1 (
  REM Sauvegarder une copie du script de démarrage original si nécessaire
  if not exist "start.bat.orig" (
    copy start.bat start.bat.orig >nul
  )
  
  REM Créer un nouveau script de démarrage qui utilise le Node.js local
  echo @echo off> start_temp.bat
  echo setlocal enableextensions>> start_temp.bat
  echo.>> start_temp.bat
  echo REM Script de démarrage généré par le programme d'installation>> start_temp.bat
  echo REM Utilise Node.js v%NODE_VERSION% local>> start_temp.bat
  echo.>> start_temp.bat
  echo echo Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4>> start_temp.bat
  echo echo Initialisation du système de conversion HL7 vers FHIR...>> start_temp.bat
  echo.>> start_temp.bat
  echo if exist ".nodejsrc" (>> start_temp.bat
  echo   echo Configuration Node.js locale détectée...>> start_temp.bat
  echo.>> start_temp.bat
  echo   if exist "%NODE_LOCAL_PATH%\node.exe" (>> start_temp.bat
  echo     echo ✓ Utilisation de Node.js local v%NODE_VERSION%>> start_temp.bat
  echo     "%cd%\%NODE_LOCAL_PATH%\node.exe" app.js>> start_temp.bat
  echo   ^) else (>> start_temp.bat
  echo     echo ⚠️ Node.js local non trouvé, utilisation de Node.js système...>> start_temp.bat
  echo     node app.js>> start_temp.bat
  echo   ^)>> start_temp.bat
  echo ^) else (>> start_temp.bat
  echo   echo Node.js système utilisé>> start_temp.bat
  echo   node app.js>> start_temp.bat
  echo ^)>> start_temp.bat
  echo.>> start_temp.bat
  echo pause>> start_temp.bat
  
  REM Remplacer l'ancien script par le nouveau
  move /y start_temp.bat start.bat >nul
  echo    ✓ Script de démarrage modifié pour utiliser Node.js local.
)

REM Configurer les variables pour l'installation
if %use_local_nodejs% equ 1 (
  set NODE_CMD=%cd%\%NODE_LOCAL_PATH%\node.exe
  set NPM_CMD=%cd%\%NODE_LOCAL_PATH%\npm.cmd
) else (
  set NODE_CMD=node
  set NPM_CMD=npm
)

echo ✅ Environnement compatible (Node.js v%NODE_VERSION%)

REM Création des répertoires nécessaires
echo [2/7] Création des répertoires...
if not exist "data\conversions" mkdir data\conversions
if not exist "data\history" mkdir data\history
if not exist "data\outputs" mkdir data\outputs
if not exist "data\test" mkdir data\test
if not exist "logs" mkdir logs
if not exist "backups" mkdir backups
echo ✓ Structure des dossiers de données créée

REM Installation des dépendances
echo [3/7] Installation des dépendances...

REM Vérification du fichier package.json
if not exist "package.json" (
  echo X Erreur: Fichier package.json introuvable.
  echo   Création d'un fichier package.json par défaut...
  
  echo {^
  "name": "fhirhub",^
  "version": "1.0.0",^
  "description": "Convertisseur HL7 vers FHIR avec terminologies françaises",^
  "main": "app.js",^
  "scripts": {^
    "start": "node app.js",^
    "dev": "nodemon app.js"^
  },^
  "dependencies": {^
    "better-sqlite3": "^8.5.0",^
    "body-parser": "^1.20.2",^
    "cors": "^2.8.5",^
    "dotenv": "^16.0.3",^
    "express": "^4.18.2",^
    "fhir": "^4.12.0",^
    "fhir.js": "^0.0.22",^
    "helmet": "^7.0.0",^
    "hl7-parser": "^1.0.1",^
    "hl7-standard": "^1.0.2",^
    "jsonwebtoken": "^9.0.0",^
    "morgan": "^1.10.0",^
    "simple-hl7": "^3.2.0",^
    "swagger-jsdoc": "^6.2.8",^
    "swagger-ui-express": "^4.6.3",^
    "uuid": "^9.0.0"^
  },^
  "devDependencies": {^
    "nodemon": "^2.0.22"^
  }^
}> package.json
)

REM Suppression complet du node_modules s'il existe pour une installation propre
if exist "node_modules" (
  echo Suppression des modules existants pour une installation propre...
  rmdir /s /q node_modules
)

echo Installation des dépendances Node.js...
call %NPM_CMD% cache clean --force
echo Nettoyage du cache npm terminé

REM Utiliser npm install avec l'option --no-optional pour éviter les problèmes de compilation sous Windows
echo Installation des packages avec --no-optional pour éviter les problèmes de compilation...
call %NPM_CMD% install --no-optional

REM Vérifier que les dépendances critiques sont bien installées
echo Vérification des dépendances critiques...
if not exist "node_modules\express" (
  echo Dépendance express manquante. Installation spécifique...
  call %NPM_CMD% install express --save
)
if not exist "node_modules\better-sqlite3" (
  echo Dépendance better-sqlite3 manquante. Installation spécifique...
  call %NPM_CMD% install better-sqlite3 --save
)

REM Configuration de l'environnement
echo [4/7] Configuration de l'environnement...
if not exist ".env" (
  echo PORT=5000> .env
  echo DB_PATH=./data/fhirhub.db>> .env
  echo LOG_LEVEL=info>> .env
  echo JWT_SECRET=>> .env
  echo ✓ Fichier .env créé avec succès
) else (
  echo ℹ️ Fichier .env existant conservé
)

REM Initialisation de la base de données
echo [5/7] Initialisation de la base de données...
echo [TERMINOLOGY] Préparation des terminologies françaises...

REM Vérifier que le dossier french_terminology existe et contient les fichiers nécessaires
if not exist "french_terminology" (
  echo ⚠️ Le dossier french_terminology n'existe pas. Création...
  mkdir french_terminology
  mkdir french_terminology\cache
)

REM Créer ou vérifier le fichier de configuration des OIDs
if not exist "french_terminology\ans_oids.json" (
  echo ⚠️ Création du fichier ans_oids.json par défaut...
  echo {^
  "version": "1.0.0",^
  "lastUpdated": "2025-04-28T10:15:30Z",^
  "systems": {^
    "ins": "urn:oid:1.2.250.1.213.1.4.8",^
    "rpps": "urn:oid:1.2.250.1.71.4.2.1",^
    "adeli": "urn:oid:1.2.250.1.71.4.2.2",^
    "finess": "urn:oid:1.2.250.1.71.4.2.2"^
  }^
}> french_terminology\ans_oids.json
)

REM Créer ou vérifier le fichier de codes communs
if not exist "french_terminology\ans_common_codes.json" (
  echo ⚠️ Création du fichier ans_common_codes.json par défaut...
  echo {^
  "version": "1.0.0",^
  "lastUpdated": "2025-04-28T10:15:30Z",^
  "codeSystemMap": {^
    "profession": "https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante",^
    "specialite": "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale"^
  }^
}> french_terminology\ans_common_codes.json
)

REM Créer ou vérifier le fichier des systèmes de terminologie
if not exist "french_terminology\ans_terminology_systems.json" (
  echo ⚠️ Création du fichier ans_terminology_systems.json par défaut...
  echo {^
  "version": "1.0.0",^
  "lastUpdated": "2025-04-28T10:15:30Z",^
  "systems": {^
    "LOINC": "http://loinc.org",^
    "UCUM": "http://unitsofmeasure.org",^
    "SNOMED-CT": "http://snomed.info/sct"^
  }^
}> french_terminology\ans_terminology_systems.json
)

REM Vérifier que la configuration est complète
if not exist "french_terminology\config.json" (
  echo ⚠️ Création du fichier config.json par défaut...
  echo {^
  "version": "1.0.0",^
  "lastUpdated": "2025-04-28T10:15:30Z",^
  "cacheEnabled": true,^
  "cacheDuration": 86400,^
  "defaultLanguage": "fr"^
}> french_terminology\config.json
)

REM Configuration de Node.js
echo [6/7] Configuration du système Node.js...

REM Créer un fichier de configuration pour Node.js
if %use_local_nodejs% equ 1 (
  echo Enregistrement de la configuration Node.js locale...
  
  echo {^
  "use_local_nodejs": true,^
  "node_version": "%NODE_VERSION%",^
  "node_path": "%NODE_LOCAL_PATH%",^
  "installation_date": "%date:~6,4%-%date:~3,2%-%date:~0,2%"^
}> .nodejsrc
  
  echo ✓ Configuration Node.js locale enregistrée
)

REM Finalisation
echo [7/7] Finalisation de l'installation...

echo ==========================================================
echo      ✓ Installation de FHIRHub terminée avec succès
echo ==========================================================
echo.
echo Pour démarrer l'application :
echo   start.bat
echo.
echo Site web accessible sur : http://localhost:5000
echo Identifiants par défaut :
echo   Utilisateur : admin
echo   Mot de passe : adminfhirhub
echo.
echo Clé API de test : dev-key
echo Documentation API : http://localhost:5000/api-docs
echo ==========================================================

pause