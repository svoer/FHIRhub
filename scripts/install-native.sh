#!/bin/bash

# 💻 Script d'Installation Native FHIRHub (Sans Docker)
# Installation complète sur système hôte avec services système

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
FHIRHUB_USER="fhirhub"
FHIRHUB_HOME="/opt/fhirhub"
FHIRHUB_REPO="https://github.com/fhirhub/fhirhub.git"
MIN_NODE_VERSION="18.17.0"
MIN_JAVA_VERSION="11"
HAPI_FHIR_VERSION="6.10.5"

# Fonctions utilitaires
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Détection du système d'exploitation
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [[ -f /etc/os-release ]]; then
            source /etc/os-release
            OS_ID="$ID"
            OS_VERSION="$VERSION_ID"
        else
            print_error "Impossible de détecter la distribution Linux"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS_ID="macos"
        OS_VERSION=$(sw_vers -productVersion)
    else
        print_error "Système d'exploitation non supporté: $OSTYPE"
        exit 1
    fi
    print_success "Système détecté: $OS_ID $OS_VERSION"
}

# Vérification des privilèges root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Ce script doit être exécuté en tant que root"
        echo "Usage: sudo $0"
        exit 1
    fi
}

# Vérification des versions
version_compare() {
    printf '%s\n%s\n' "$1" "$2" | sort -V | head -n1 | [ "$1" = "$(cat)" ]
}

# Installation des dépendances selon l'OS
install_dependencies() {
    print_status "Installation des dépendances système..."
    
    case "$OS_ID" in
        "ubuntu"|"debian")
            apt update
            apt install -y curl wget git build-essential python3 make g++ software-properties-common
            
            # Node.js 20.x LTS
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
            
            # OpenJDK 21
            apt install -y openjdk-21-jdk
            ;;
            
        "centos"|"rhel"|"fedora")
            if command -v dnf &> /dev/null; then
                PKG_MGR="dnf"
            else
                PKG_MGR="yum"
            fi
            
            $PKG_MGR update -y
            $PKG_MGR install -y curl wget git gcc gcc-c++ make python3 java-21-openjdk-devel
            
            # Node.js
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
            $PKG_MGR install -y nodejs
            ;;
            
        "macos")
            if ! command -v brew &> /dev/null; then
                print_status "Installation de Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            
            brew install node@20 openjdk@21 git
            
            # Configuration Java pour macOS
            echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> /etc/profile
            export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
            ;;
            
        *)
            print_error "Distribution non supportée: $OS_ID"
            exit 1
            ;;
    esac
    
    print_success "Dépendances système installées"
}

# Vérification des versions installées
verify_versions() {
    print_status "Vérification des versions..."
    
    # Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | sed 's/v//')
        if version_compare "$MIN_NODE_VERSION" "$NODE_VERSION"; then
            print_success "Node.js $NODE_VERSION installé"
        else
            print_error "Version Node.js insuffisante: $NODE_VERSION (requis: >= $MIN_NODE_VERSION)"
            exit 1
        fi
    else
        print_error "Node.js non trouvé"
        exit 1
    fi
    
    # Java
    if command -v java &> /dev/null; then
        JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
        if [ "$JAVA_VERSION" -ge "$MIN_JAVA_VERSION" ]; then
            print_success "Java $JAVA_VERSION installé"
        else
            print_error "Version Java insuffisante: $JAVA_VERSION (requis: >= $MIN_JAVA_VERSION)"
            exit 1
        fi
    else
        print_error "Java non trouvé"
        exit 1
    fi
}

# Création de l'utilisateur système
create_user() {
    print_status "Création de l'utilisateur système $FHIRHUB_USER..."
    
    if ! id "$FHIRHUB_USER" &>/dev/null; then
        case "$OS_ID" in
            "ubuntu"|"debian"|"centos"|"rhel"|"fedora")
                useradd -r -s /bin/bash -d "$FHIRHUB_HOME" -m "$FHIRHUB_USER"
                print_success "Utilisateur $FHIRHUB_USER créé"
                ;;
            "macos")
                # macOS utilise dscl pour créer des utilisateurs
                dscl . -create /Users/"$FHIRHUB_USER"
                dscl . -create /Users/"$FHIRHUB_USER" UserShell /bin/bash
                dscl . -create /Users/"$FHIRHUB_USER" RealName "FHIRHub Service User"
                dscl . -create /Users/"$FHIRHUB_USER" NFSHomeDirectory "$FHIRHUB_HOME"
                dscl . -create /Users/"$FHIRHUB_USER" PrimaryGroupID 20
                mkdir -p "$FHIRHUB_HOME"
                chown "$FHIRHUB_USER":staff "$FHIRHUB_HOME"
                print_success "Utilisateur $FHIRHUB_USER créé (macOS)"
                ;;
        esac
    else
        print_status "Utilisateur $FHIRHUB_USER existe déjà"
    fi
}

# Installation de FHIRHub
install_fhirhub() {
    print_status "Installation de FHIRHub..."
    
    # Créer la structure de base
    mkdir -p "$FHIRHUB_HOME"
    cd "$FHIRHUB_HOME"
    
    # Cloner ou mettre à jour le projet
    if [[ -d "app" ]]; then
        print_status "Mise à jour du projet existant..."
        cd app
        sudo -u "$FHIRHUB_USER" git pull origin main
        cd ..
    else
        print_status "Clonage du projet..."
        sudo -u "$FHIRHUB_USER" git clone "$FHIRHUB_REPO" app
    fi
    
    cd app
    
    # Créer la structure de données
    print_status "Création de la structure de données..."
    sudo -u "$FHIRHUB_USER" mkdir -p data/{fhirhub/{config,logs,cache,terminologies,uploads},hapi-fhir/{database,lucene}}
    sudo -u "$FHIRHUB_USER" mkdir -p config/examples
    
    # Installer les dépendances Node.js
    print_status "Installation des dépendances Node.js..."
    sudo -u "$FHIRHUB_USER" npm ci --production
    
    print_success "FHIRHub installé dans $FHIRHUB_HOME/app"
}

# Configuration des permissions
setup_permissions() {
    print_status "Configuration des permissions..."
    
    # Propriété des fichiers
    chown -R "$FHIRHUB_USER":"$FHIRHUB_USER" "$FHIRHUB_HOME"
    
    # Permissions de base
    chmod -R 755 "$FHIRHUB_HOME"
    chmod -R 750 "$FHIRHUB_HOME/app/data/fhirhub/config"
    chmod -R 770 "$FHIRHUB_HOME/app/data/fhirhub"/{logs,cache,uploads}
    chmod -R 770 "$FHIRHUB_HOME/app/data/hapi-fhir"
    
    print_success "Permissions configurées"
}

# Configuration de l'environnement
setup_environment() {
    print_status "Configuration de l'environnement..."
    
    cd "$FHIRHUB_HOME/app"
    
    # Créer le fichier .env
    if [[ ! -f .env ]]; then
        sudo -u "$FHIRHUB_USER" cat > .env << EOF
# Configuration FHIRHub Production
NODE_ENV=production
PORT=5000
HAPI_FHIR_URL=http://localhost:8080/fhir

# Base de données
DATABASE_PATH=./data/fhirhub/fhirhub.db

# Sécurité
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
API_RATE_LIMIT=1000
CONVERSION_RATE_LIMIT=30
AUTH_RATE_LIMIT=10
ENABLE_SECURITY_HEADERS=true

# Performance
CACHE_MAX_SIZE=1000
CACHE_TTL=3600
NODE_OPTIONS=--max-old-space-size=1024

# Logging
LOG_LEVEL=info
LOG_MAX_SIZE=100MB
LOG_MAX_FILES=5

# Timeouts
FHIR_REQUEST_TIMEOUT=30000
FHIR_MAX_RETRY_ATTEMPTS=3
FHIR_RETRY_DELAY=1000
EOF
        print_success "Fichier .env créé"
    else
        print_status "Fichier .env existant conservé"
    fi
}

# Installation et configuration HAPI FHIR
setup_hapi_fhir() {
    print_status "Configuration de HAPI FHIR..."
    
    HAPI_DIR="$FHIRHUB_HOME/hapi-fhir"
    mkdir -p "$HAPI_DIR"
    cd "$HAPI_DIR"
    
    # Télécharger HAPI FHIR JAR
    HAPI_JAR="hapi-fhir-jpaserver-starter-${HAPI_FHIR_VERSION}.jar"
    if [[ ! -f "$HAPI_JAR" ]]; then
        print_status "Téléchargement de HAPI FHIR $HAPI_FHIR_VERSION..."
        sudo -u "$FHIRHUB_USER" wget -O "$HAPI_JAR" \
            "https://github.com/hapifhir/hapi-fhir-jpaserver-starter/releases/download/v${HAPI_FHIR_VERSION}/hapi-fhir-jpaserver-starter-${HAPI_FHIR_VERSION}.jar"
        print_success "HAPI FHIR téléchargé"
    fi
    
    # Configuration HAPI FHIR
    sudo -u "$FHIRHUB_USER" cat > application.yaml << 'EOF'
spring:
  datasource:
    url: 'jdbc:h2:file:./data/hapi-fhir/database/h2;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE'
    username: sa
    password: sa
    driverClassName: org.h2.Driver
  jpa:
    properties:
      hibernate.dialect: org.hibernate.dialect.H2Dialect
      hibernate.show_sql: false
      hibernate.format_sql: false

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
    advanced_lucene_indexing: false

logging:
  level:
    ca.uhn.fhir: WARN
    org.springframework: WARN
    org.hibernate: WARN
    root: WARN
EOF
    
    chown "$FHIRHUB_USER":"$FHIRHUB_USER" application.yaml
    print_success "HAPI FHIR configuré"
}

# Configuration des services système
setup_services() {
    print_status "Configuration des services système..."
    
    case "$OS_ID" in
        "ubuntu"|"debian"|"centos"|"rhel"|"fedora")
            setup_systemd_services
            ;;
        "macos")
            setup_launchd_services
            ;;
    esac
}

# Services systemd (Linux)
setup_systemd_services() {
    print_status "Configuration des services systemd..."
    
    # Service HAPI FHIR
    cat > /etc/systemd/system/hapi-fhir.service << EOF
[Unit]
Description=HAPI FHIR Server
After=network.target
Documentation=https://hapifhir.io/

[Service]
Type=simple
User=$FHIRHUB_USER
Group=$FHIRHUB_USER
WorkingDirectory=$FHIRHUB_HOME/hapi-fhir
Environment=JAVA_OPTS=-Xmx2g -Xms1g -server -XX:+UseG1GC
ExecStart=/usr/bin/java \$JAVA_OPTS -jar hapi-fhir-jpaserver-starter-${HAPI_FHIR_VERSION}.jar --spring.config.location=application.yaml
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hapi-fhir

# Sécurité
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$FHIRHUB_HOME

[Install]
WantedBy=multi-user.target
EOF
    
    # Service FHIRHub
    cat > /etc/systemd/system/fhirhub.service << EOF
[Unit]
Description=FHIRHub HL7 to FHIR Converter
After=network.target hapi-fhir.service
Wants=hapi-fhir.service
Documentation=https://github.com/fhirhub/fhirhub

[Service]
Type=simple
User=$FHIRHUB_USER
Group=$FHIRHUB_USER
WorkingDirectory=$FHIRHUB_HOME/app
Environment=NODE_ENV=production
Environment=PORT=5000
EnvironmentFile=$FHIRHUB_HOME/app/.env
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fhirhub

# Sécurité
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$FHIRHUB_HOME

[Install]
WantedBy=multi-user.target
EOF
    
    # Recharger et activer les services
    systemctl daemon-reload
    systemctl enable hapi-fhir fhirhub
    
    print_success "Services systemd configurés"
}

# Services LaunchDaemons (macOS)
setup_launchd_services() {
    print_status "Configuration des services LaunchDaemons..."
    
    # Service HAPI FHIR
    cat > /Library/LaunchDaemons/com.fhirhub.hapi-fhir.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.fhirhub.hapi-fhir</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/java</string>
        <string>-Xmx2g</string>
        <string>-Xms1g</string>
        <string>-jar</string>
        <string>hapi-fhir-jpaserver-starter-${HAPI_FHIR_VERSION}.jar</string>
        <string>--spring.config.location=application.yaml</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$FHIRHUB_HOME/hapi-fhir</string>
    <key>UserName</key>
    <string>$FHIRHUB_USER</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/hapi-fhir.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/hapi-fhir.error.log</string>
</dict>
</plist>
EOF
    
    # Service FHIRHub
    cat > /Library/LaunchDaemons/com.fhirhub.plist << EOF
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
    <string>$FHIRHUB_HOME/app</string>
    <key>UserName</key>
    <string>$FHIRHUB_USER</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/fhirhub.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/fhirhub.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>5000</string>
    </dict>
</dict>
</plist>
EOF
    
    # Charger les services
    launchctl load /Library/LaunchDaemons/com.fhirhub.hapi-fhir.plist
    launchctl load /Library/LaunchDaemons/com.fhirhub.plist
    
    print_success "Services LaunchDaemons configurés"
}

# Configuration du firewall
setup_firewall() {
    print_status "Configuration du firewall..."
    
    case "$OS_ID" in
        "ubuntu"|"debian")
            if command -v ufw &> /dev/null; then
                ufw allow 5000/tcp comment "FHIRHub"
                ufw allow 8080/tcp comment "HAPI FHIR"
                print_success "Règles UFW ajoutées"
            fi
            ;;
        "centos"|"rhel"|"fedora")
            if command -v firewall-cmd &> /dev/null; then
                firewall-cmd --permanent --add-port=5000/tcp
                firewall-cmd --permanent --add-port=8080/tcp
                firewall-cmd --reload
                print_success "Règles firewalld ajoutées"
            fi
            ;;
        "macos")
            print_warning "Configuration firewall manuelle requise sur macOS"
            ;;
    esac
}

# Démarrage des services
start_services() {
    print_status "Démarrage des services..."
    
    case "$OS_ID" in
        "ubuntu"|"debian"|"centos"|"rhel"|"fedora")
            systemctl start hapi-fhir
            print_status "Attente du démarrage de HAPI FHIR..."
            sleep 30
            systemctl start fhirhub
            print_success "Services démarrés"
            ;;
        "macos")
            launchctl start com.fhirhub.hapi-fhir
            print_status "Attente du démarrage de HAPI FHIR..."
            sleep 30
            launchctl start com.fhirhub
            print_success "Services démarrés"
            ;;
    esac
}

# Tests de validation
run_tests() {
    print_status "Exécution des tests de validation..."
    
    # Attendre que les services soient complètement démarrés
    sleep 10
    
    # Test FHIRHub
    for i in {1..30}; do
        if curl -sf http://localhost:5000/api/system/health >/dev/null 2>&1; then
            print_success "✓ FHIRHub opérationnel"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "✗ FHIRHub ne répond pas"
            return 1
        fi
        sleep 2
    done
    
    # Test HAPI FHIR
    for i in {1..60}; do
        if curl -sf http://localhost:8080/fhir/metadata >/dev/null 2>&1; then
            print_success "✓ HAPI FHIR opérationnel"
            break
        fi
        if [ $i -eq 60 ]; then
            print_error "✗ HAPI FHIR ne répond pas"
            return 1
        fi
        sleep 3
    done
    
    # Test conversion
    RESULT=$(curl -s -X POST http://localhost:5000/api/convert \
        -H "X-API-KEY: dev-key" \
        -H "Content-Type: application/json" \
        -d '{"hl7Message":"MSH|^~\\&|TEST|TEST|||20241216||ADT^A01|1|P|2.5"}' \
        2>/dev/null | jq -r '.success' 2>/dev/null || echo "false")
    
    if [ "$RESULT" = "true" ]; then
        print_success "✓ Test de conversion réussi"
    else
        print_warning "⚠ Test de conversion échoué (configuration API key requise)"
    fi
    
    print_success "Tests de validation terminés"
}

# Affichage des informations finales
display_final_info() {
    echo
    echo "🎉 Installation FHIRHub native terminée avec succès!"
    echo
    echo "📍 Services installés:"
    echo "   • FHIRHub:              http://localhost:5000"
    echo "   • HAPI FHIR:            http://localhost:8080/fhir"
    echo "   • Documentation:        http://localhost:5000/api-reference.html"
    echo
    echo "📁 Répertoires importants:"
    echo "   • Application:          $FHIRHUB_HOME/app"
    echo "   • Données:              $FHIRHUB_HOME/app/data"
    echo "   • Configuration:        $FHIRHUB_HOME/app/.env"
    echo "   • HAPI FHIR:            $FHIRHUB_HOME/hapi-fhir"
    echo
    echo "🔧 Gestion des services:"
    case "$OS_ID" in
        "ubuntu"|"debian"|"centos"|"rhel"|"fedora")
            echo "   • État:                 systemctl status fhirhub hapi-fhir"
            echo "   • Redémarrage:          systemctl restart fhirhub"
            echo "   • Logs:                 journalctl -u fhirhub -f"
            echo "   • Arrêt:                systemctl stop fhirhub hapi-fhir"
            ;;
        "macos")
            echo "   • État:                 launchctl list | grep fhirhub"
            echo "   • Redémarrage:          launchctl kickstart -k system/com.fhirhub"
            echo "   • Logs:                 tail -f /var/log/fhirhub.log"
            echo "   • Arrêt:                launchctl stop com.fhirhub"
            ;;
    esac
    echo
    echo "📚 Prochaines étapes:"
    echo "   1. Accéder à http://localhost:5000"
    echo "   2. Créer un compte administrateur"
    echo "   3. Configurer une clé API"
    echo "   4. Tester une conversion HL7→FHIR"
    echo
    echo "📖 Documentation: https://github.com/fhirhub/fhirhub/wiki"
    echo
}

# Fonction principale
main() {
    echo "💻 Installation Native FHIRHub"
    echo "==============================="
    echo
    
    detect_os
    check_root
    install_dependencies
    verify_versions
    create_user
    install_fhirhub
    setup_permissions
    setup_environment
    setup_hapi_fhir
    setup_services
    setup_firewall
    start_services
    run_tests
    display_final_info
}

# Point d'entrée
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi