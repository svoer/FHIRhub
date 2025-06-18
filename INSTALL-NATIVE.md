# 💻 Installation Native FHIRHub (Sans Docker)

## 📋 Aperçu

Cette méthode d'installation permet de déployer FHIRHub directement sur votre système sans utiliser Docker. Recommandée pour les environnements de développement ou les systèmes avec des contraintes spécifiques.

## 🔧 Prérequis Système

### Version Node.js Requise
```bash
Node.js >= 18.17.0 (LTS recommandée)
npm >= 9.0.0
```

### Version Java pour HAPI FHIR
```bash
OpenJDK ou Oracle JDK >= 11 (JDK 21 recommandé)
```

### Ressources Système
- **RAM**: 4 Go minimum (8 Go recommandé)
- **Espace disque**: 10 Go minimum
- **Ports**: 5000 et 8080 libres

## 🐧 Installation Ubuntu/Debian

### 1. Installation des Dépendances
```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installation Java 21
sudo apt install -y openjdk-21-jdk

# Outils supplémentaires
sudo apt install -y git curl wget build-essential python3 make g++

# Vérification des versions
node --version    # >= 18.17.0
npm --version     # >= 9.0.0
java --version    # >= 11
```

### 2. Configuration Utilisateur
```bash
# Créer un utilisateur dédié (recommandé)
sudo useradd -r -s /bin/bash -d /opt/fhirhub -m fhirhub
sudo usermod -aG sudo fhirhub  # Optionnel pour administration

# Basculer vers l'utilisateur fhirhub
sudo su - fhirhub
```

### 3. Installation FHIRHub
```bash
# Cloner le projet
cd /opt/fhirhub
git clone https://github.com/fhirhub/fhirhub.git app
cd app

# Créer la structure de données
mkdir -p data/{fhirhub/{config,logs,cache,terminologies,uploads},hapi-fhir/{database,lucene}}

# Configurer les permissions
chmod -R 755 data/
chmod -R 770 data/fhirhub/{logs,cache,uploads}
chmod -R 770 data/hapi-fhir/

# Installer les dépendances Node.js
npm ci --production

# Configuration environnement
cp .env.example .env
nano .env  # Modifier selon vos besoins
```

### 4. Configuration HAPI FHIR Standalone
```bash
# Créer le dossier HAPI FHIR
mkdir -p /opt/fhirhub/hapi-fhir
cd /opt/fhirhub/hapi-fhir

# Télécharger HAPI FHIR
wget https://github.com/hapifhir/hapi-fhir-jpaserver-starter/releases/download/v6.10.5/hapi-fhir-jpaserver-starter-6.10.5.jar

# Configuration HAPI FHIR
cat > application.yaml << 'EOF'
spring:
  datasource:
    url: 'jdbc:h2:file:/opt/fhirhub/data/hapi-fhir/database/h2;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE'
    username: sa
    password: sa
    driverClassName: org.h2.Driver
  jpa:
    properties:
      hibernate.dialect: org.hibernate.dialect.H2Dialect

hapi:
  fhir:
    fhir_version: R4
    server_address: http://localhost:8080/fhir
    default_encoding: json
    allow_external_references: true
    allow_multiple_delete: true
    validation:
      enabled: false
    expunge_enabled: true
    subscription:
      resthook_enabled: false
      websocket_enabled: false
      email_enabled: false
    narrative_enabled: false
    bulk_export_enabled: false
    binary_storage_enabled: false
EOF
```

### 5. Services Systemd
```bash
# Service FHIRHub
sudo tee /etc/systemd/system/fhirhub.service << 'EOF'
[Unit]
Description=FHIRHub HL7 to FHIR Converter
After=network.target
Wants=hapi-fhir.service

[Service]
Type=simple
User=fhirhub
Group=fhirhub
WorkingDirectory=/opt/fhirhub/app
Environment=NODE_ENV=production
Environment=PORT=5000
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=fhirhub

[Install]
WantedBy=multi-user.target
EOF

# Service HAPI FHIR
sudo tee /etc/systemd/system/hapi-fhir.service << 'EOF'
[Unit]
Description=HAPI FHIR Server
After=network.target

[Service]
Type=simple
User=fhirhub
Group=fhirhub
WorkingDirectory=/opt/fhirhub/hapi-fhir
Environment=JAVA_OPTS=-Xmx2g -Xms1g
ExecStart=/usr/bin/java $JAVA_OPTS -jar hapi-fhir-jpaserver-starter-6.10.5.jar --spring.config.location=application.yaml
Restart=always
RestartSec=30
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=hapi-fhir

[Install]
WantedBy=multi-user.target
EOF

# Recharger et démarrer les services
sudo systemctl daemon-reload
sudo systemctl enable fhirhub hapi-fhir
sudo systemctl start hapi-fhir
sleep 30  # Attendre que HAPI FHIR démarre
sudo systemctl start fhirhub
```

## 🍎 Installation macOS

### 1. Installation avec Homebrew
```bash
# Installer Homebrew si nécessaire
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installer les dépendances
brew install node@20 openjdk@21 git

# Configurer Java
echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Vérifier les installations
node --version
java --version
```

### 2. Installation FHIRHub
```bash
# Créer le dossier de travail
mkdir -p ~/Applications/fhirhub
cd ~/Applications/fhirhub

# Cloner et configurer
git clone https://github.com/fhirhub/fhirhub.git app
cd app
mkdir -p data/{fhirhub/{config,logs,cache,terminologies,uploads},hapi-fhir/{database,lucene}}
npm ci --production

# Configuration
cp .env.example .env
# Modifier .env selon vos besoins
```

### 3. Services LaunchDaemons (macOS)
```bash
# Service FHIRHub
sudo tee /Library/LaunchDaemons/com.fhirhub.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.fhirhub</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>app.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/$(whoami)/Applications/fhirhub/app</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/fhirhub.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/fhirhub.error.log</string>
</dict>
</plist>
EOF

# Charger et démarrer
sudo launchctl load /Library/LaunchDaemons/com.fhirhub.plist
sudo launchctl start com.fhirhub
```

## 🪟 Installation Windows

### 1. Installation des Prérequis
```powershell
# Installer Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Installer les dépendances
choco install nodejs-lts openjdk21 git -y

# Recharger l'environnement
refreshenv

# Vérifier
node --version
java --version
```

### 2. Installation FHIRHub
```powershell
# Créer le dossier
New-Item -ItemType Directory -Path "C:\FHIRHub" -Force
Set-Location "C:\FHIRHub"

# Cloner le projet
git clone https://github.com/fhirhub/fhirhub.git app
Set-Location app

# Créer la structure
New-Item -ItemType Directory -Path "data\fhirhub\config" -Force
New-Item -ItemType Directory -Path "data\fhirhub\logs" -Force
New-Item -ItemType Directory -Path "data\fhirhub\cache" -Force
New-Item -ItemType Directory -Path "data\fhirhub\terminologies" -Force
New-Item -ItemType Directory -Path "data\fhirhub\uploads" -Force
New-Item -ItemType Directory -Path "data\hapi-fhir\database" -Force
New-Item -ItemType Directory -Path "data\hapi-fhir\lucene" -Force

# Installer les dépendances
npm ci --production

# Configuration
Copy-Item ".env.example" ".env"
# Modifier .env avec notepad ou votre éditeur préféré
```

### 3. Services Windows
```powershell
# Installer NSSM pour gérer les services
choco install nssm -y

# Créer le service FHIRHub
nssm install FHIRHub "C:\Program Files\nodejs\node.exe"
nssm set FHIRHub Parameters "app.js"
nssm set FHIRHub AppDirectory "C:\FHIRHub\app"
nssm set FHIRHub AppStdout "C:\FHIRHub\logs\fhirhub.log"
nssm set FHIRHub AppStderr "C:\FHIRHub\logs\fhirhub.error.log"

# Démarrer le service
nssm start FHIRHub
```

## 🔍 Configuration Post-Installation

### 1. Variables d'Environnement
```bash
# Fichier .env
NODE_ENV=production
PORT=5000
HAPI_FHIR_URL=http://localhost:8080/fhir

# Base de données
DATABASE_PATH=./data/fhirhub/fhirhub.db

# Sécurité
JWT_SECRET=your_very_long_secret_key_here
API_RATE_LIMIT=1000
CONVERSION_RATE_LIMIT=30
AUTH_RATE_LIMIT=10

# Performance
CACHE_MAX_SIZE=1000
CACHE_TTL=3600
NODE_OPTIONS=--max-old-space-size=512
```

### 2. Configuration Firewall
```bash
# Ubuntu/Debian
sudo ufw allow 5000/tcp comment "FHIRHub"
sudo ufw allow 8080/tcp comment "HAPI FHIR"

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload

# macOS
# Aller dans Préférences Système > Sécurité et confidentialité > Pare-feu
# Autoriser les connexions entrantes pour Node.js et Java
```

## 🔍 Tests de Validation

### Script de Test Automatisé
```bash
#!/bin/bash
# test-installation.sh

echo "🧪 Tests de validation FHIRHub"

# Test 1: FHIRHub Health
echo "Test 1: FHIRHub Health Check"
if curl -sf http://localhost:5000/api/system/health >/dev/null; then
    echo "✅ FHIRHub fonctionne"
else
    echo "❌ FHIRHub ne répond pas"
fi

# Test 2: HAPI FHIR Metadata
echo "Test 2: HAPI FHIR Metadata"
if curl -sf http://localhost:8080/fhir/metadata >/dev/null; then
    echo "✅ HAPI FHIR fonctionne"
else
    echo "❌ HAPI FHIR ne répond pas"
fi

# Test 3: Conversion HL7
echo "Test 3: Conversion HL7→FHIR"
RESULT=$(curl -s -X POST http://localhost:5000/api/convert \
    -H "X-API-KEY: dev-key" \
    -H "Content-Type: application/json" \
    -d '{"hl7Message":"MSH|^~\\&|TEST|TEST|||20241216||ADT^A01|1|P|2.5"}')

if echo "$RESULT" | grep -q '"success":true'; then
    echo "✅ Conversion fonctionne"
else
    echo "❌ Conversion échoue"
fi

echo "Tests terminés"
```

## 🛠️ Maintenance et Mise à Jour

### Mise à Jour FHIRHub
```bash
# Arrêter les services
sudo systemctl stop fhirhub

# Sauvegarder
tar -czf fhirhub-backup-$(date +%Y%m%d).tar.gz data/

# Mettre à jour le code
cd /opt/fhirhub/app
git pull origin main
npm ci --production

# Redémarrer
sudo systemctl start fhirhub
```

### Sauvegarde Automatisée
```bash
# Script de sauvegarde quotidienne
sudo tee /etc/cron.daily/fhirhub-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/fhirhub"
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/fhirhub-$(date +%Y%m%d-%H%M%S).tar.gz" \
    -C /opt/fhirhub data/
# Garder seulement les 7 dernières sauvegardes
find "$BACKUP_DIR" -name "fhirhub-*.tar.gz" -mtime +7 -delete
EOF

sudo chmod +x /etc/cron.daily/fhirhub-backup
```

## 🚨 Dépannage

### Logs à Vérifier
```bash
# Logs FHIRHub
sudo journalctl -u fhirhub -f

# Logs HAPI FHIR
sudo journalctl -u hapi-fhir -f

# Logs système
tail -f /var/log/syslog | grep fhir
```

### Problèmes Courants

**1. Erreur "EACCES" permissions**
```bash
sudo chown -R fhirhub:fhirhub /opt/fhirhub/
sudo chmod -R 755 /opt/fhirhub/app/
sudo chmod -R 770 /opt/fhirhub/data/
```

**2. Port déjà utilisé**
```bash
# Trouver le processus utilisant le port
sudo lsof -i :5000
# Modifier le port dans .env
PORT=5001
```

**3. Erreur mémoire Node.js**
```bash
# Augmenter la limite mémoire
export NODE_OPTIONS="--max-old-space-size=2048"
# Ou modifier .env
NODE_OPTIONS=--max-old-space-size=2048
```

Pour plus d'aide, consultez le [Guide de Dépannage](TROUBLESHOOTING.md) complet.