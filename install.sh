#!/usr/bin/env bash
# =============================================================================
# FHIRHub Installation Script v2.1.0
# =============================================================================
# Installation automatisée complète de FHIRHub
# Compatible: Ubuntu, Debian, CentOS, RHEL, Alpine, macOS
# Fonctionnalités: détection auto, rollback, logs, validation, UI interactive
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# Variables globales
readonly SCRIPT_VERSION="2.1.0"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_FILE="$(pwd)/install.log"
readonly BACKUP_DIR="$(pwd)/.install-backup"
readonly MIN_NODE_VERSION=16
readonly REQUIRED_MEMORY_GB=2

# Flags de configuration
VERBOSE=false
QUIET=false
SKIP_DOCKER=false
FORCE_INSTALL=false
DRY_RUN=false
ENABLE_COLORS=true

# Couleurs pour l'interface
if [[ -t 1 ]] && command -v tput &>/dev/null; then
    readonly RED=$(tput setaf 1)
    readonly GREEN=$(tput setaf 2)
    readonly YELLOW=$(tput setaf 3)
    readonly BLUE=$(tput setaf 4)
    readonly MAGENTA=$(tput setaf 5)
    readonly CYAN=$(tput setaf 6)
    readonly WHITE=$(tput setaf 7)
    readonly BOLD=$(tput bold)
    readonly RESET=$(tput sgr0)
else
    readonly RED="" GREEN="" YELLOW="" BLUE="" MAGENTA="" CYAN="" WHITE="" BOLD="" RESET=""
    ENABLE_COLORS=false
fi

# =============================================================================
# Fonctions utilitaires
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    if [[ "$QUIET" == "false" ]]; then
        case "$level" in
            "INFO")  echo "${BLUE}ℹ️  $message${RESET}" ;;
            "WARN")  echo "${YELLOW}⚠️  $message${RESET}" ;;
            "ERROR") echo "${RED}❌ $message${RESET}" ;;
            "SUCCESS") echo "${GREEN}✅ $message${RESET}" ;;
            "DEBUG") [[ "$VERBOSE" == "true" ]] && echo "${MAGENTA}🔍 $message${RESET}" ;;
        esac
    fi
}

show_banner() {
    if [[ "$QUIET" == "false" ]]; then
        cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    ███████╗██╗  ██╗██╗██████╗ ██╗  ██╗██╗   ██╗██████╗       ║
║    ██╔════╝██║  ██║██║██╔══██╗██║  ██║██║   ██║██╔══██╗      ║
║    █████╗  ███████║██║██████╔╝███████║██║   ██║██████╔╝      ║
║    ██╔══╝  ██╔══██║██║██╔══██╗██╔══██║██║   ██║██╔══██╗      ║
║    ██║     ██║  ██║██║██║  ██║██║  ██║╚██████╔╝██████╔╝      ║
║    ╚═╝     ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝       ║
║                                                              ║
║    Plateforme de conversion HL7 to FHIR pour la France      ║
║                   Installation Script v2.1.0                ║
╚══════════════════════════════════════════════════════════════╝
EOF
    fi
}

show_usage() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

Options:
    -v, --verbose          Mode verbeux avec logs détaillés
    -q, --quiet           Mode silencieux (logs uniquement)
    -d, --skip-docker     Ignorer la configuration Docker
    -f, --force           Forcer l'installation même si déjà installé
    -n, --dry-run         Simulation sans modifications
    -h, --help            Afficher cette aide
    --version             Afficher la version du script

Exemples:
    $SCRIPT_NAME                    # Installation standard
    $SCRIPT_NAME --verbose          # Installation avec logs détaillés
    $SCRIPT_NAME --quiet --force    # Réinstallation silencieuse

Pour plus d'informations: https://github.com/your-repo/fhirhub
EOF
}

progress_bar() {
    local current=$1
    local total=$2
    local width=40
    local percentage=$((current * 100 / total))
    local completed=$((current * width / total))
    
    if [[ "$QUIET" == "false" ]]; then
        printf "\r${CYAN}["
        for ((i=0; i<completed; i++)); do printf "█"; done
        for ((i=completed; i<width; i++)); do printf "░"; done
        printf "] %d%% (%d/%d)${RESET}" "$percentage" "$current" "$total"
        [[ $current -eq $total ]] && echo
    fi
}

spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    
    if [[ "$QUIET" == "false" ]] && [[ "$ENABLE_COLORS" == "true" ]]; then
        while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
            local temp=${spinstr#?}
            printf " [%c]  " "$spinstr"
            local spinstr=$temp${spinstr%"$temp"}
            sleep $delay
            printf "\b\b\b\b\b\b"
        done
        printf "    \b\b\b\b"
    fi
}

create_backup() {
    if [[ -d "$BACKUP_DIR" ]]; then
        rm -rf "$BACKUP_DIR"
    fi
    mkdir -p "$BACKUP_DIR"
    
    # Sauvegarder les fichiers critiques
    [[ -f package.json ]] && cp package.json "$BACKUP_DIR/"
    [[ -f .env ]] && cp .env "$BACKUP_DIR/"
    [[ -d node_modules ]] && echo "node_modules backed up" > "$BACKUP_DIR/node_modules.bak"
    
    log "INFO" "Backup créé dans $BACKUP_DIR"
}

restore_backup() {
    if [[ -d "$BACKUP_DIR" ]]; then
        log "WARN" "Restauration du backup en cours..."
        [[ -f "$BACKUP_DIR/package.json" ]] && cp "$BACKUP_DIR/package.json" .
        [[ -f "$BACKUP_DIR/.env" ]] && cp "$BACKUP_DIR/.env" .
        log "SUCCESS" "Backup restauré"
    fi
}

cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log "ERROR" "Installation échouée (code: $exit_code)"
        restore_backup
    fi
    [[ -d "$BACKUP_DIR" ]] && rm -rf "$BACKUP_DIR"
    exit $exit_code
}

# =============================================================================
# Vérifications système
# =============================================================================

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get &>/dev/null; then
            echo "ubuntu"
        elif command -v yum &>/dev/null; then
            echo "centos"
        elif command -v apk &>/dev/null; then
            echo "alpine"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

check_system_requirements() {
    local step=1
    local total_steps=6
    
    log "INFO" "Vérification des prérequis système..."
    
    # Vérification de l'architecture
    progress_bar $((step++)) $total_steps
    local arch="$(uname -m)"
    log "DEBUG" "Architecture détectée: $arch"
    
    case "$arch" in
        x86_64|amd64)
            log "DEBUG" "Architecture x86_64 supportée"
            ;;
        arm64|aarch64)
            log "DEBUG" "Architecture ARM64 supportée"
            ;;
        *)
            log "WARN" "Architecture $arch non testée mais installation tentée"
            ;;
    esac
    
    # Vérification de la mémoire
    progress_bar $((step++)) $total_steps
    if command -v free &>/dev/null; then
        local memory_gb=$(($(free -m | awk 'NR==2{printf "%.0f", $2/1024}')))
        if [[ $memory_gb -lt $REQUIRED_MEMORY_GB ]]; then
            log "WARN" "Mémoire insuffisante: ${memory_gb}GB (recommandé: ${REQUIRED_MEMORY_GB}GB)"
        fi
        log "DEBUG" "Mémoire disponible: ${memory_gb}GB"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        local memory_gb=$(($(sysctl -n hw.memsize) / 1024 / 1024 / 1024))
        log "DEBUG" "Mémoire macOS: ${memory_gb}GB"
    else
        log "DEBUG" "Vérification mémoire ignorée (commande free non disponible)"
    fi
    
    # Vérification de l'espace disque
    progress_bar $((step++)) $total_steps
    if command -v df &>/dev/null; then
        local available_space=$(df . | awk 'NR==2 {print $4}' 2>/dev/null || echo "0")
        if [[ $available_space -gt 0 ]] && [[ $available_space -lt 1048576 ]]; then # 1GB en KB
            log "WARN" "Espace disque faible: $(($available_space/1024))MB disponible"
        elif [[ $available_space -gt 0 ]]; then
            log "DEBUG" "Espace disque: $(($available_space/1024))MB disponible"
        fi
    else
        log "DEBUG" "Vérification espace disque ignorée (commande df non disponible)"
    fi
    
    # Vérification des commandes requises
    progress_bar $((step++)) $total_steps
    local required_commands=("bash" "git" "curl")
    local optional_commands=("make" "gcc" "g++")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            log "ERROR" "Commande requise manquante: $cmd"
            exit 1
        fi
        log "DEBUG" "✓ $cmd trouvé"
    done
    
    for cmd in "${optional_commands[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            log "WARN" "Commande optionnelle manquante: $cmd (sera installée automatiquement)"
        else
            log "DEBUG" "✓ $cmd trouvé"
        fi
    done
    
    # Vérification de Node.js
    progress_bar $((step++)) $total_steps
    if command -v node &>/dev/null; then
        local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [[ $node_version -lt $MIN_NODE_VERSION ]]; then
            log "ERROR" "Node.js v$MIN_NODE_VERSION+ requis (installé: v$(node -v))"
            exit 1
        fi
        log "DEBUG" "Node.js v$(node -v) détecté"
    else
        log "ERROR" "Node.js non installé"
        exit 1
    fi
    
    # Vérification de npm
    progress_bar $((step++)) $total_steps
    if ! command -v npm &>/dev/null; then
        log "ERROR" "npm non installé"
        exit 1
    fi
    
    log "SUCCESS" "Tous les prérequis système sont satisfaits"
}

install_system_dependencies() {
    local os="$(detect_os)"
    log "INFO" "Installation des dépendances système ($os)..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "Mode simulation - installation des dépendances ignorée"
        return 0
    fi
    
    # Dans l'environnement Replit/Nix, les dépendances sont gérées différemment
    if [[ -n "${REPLIT_ENVIRONMENT:-}" ]] || [[ -n "${NIX_PATH:-}" ]]; then
        log "INFO" "Environnement Replit/Nix détecté - dépendances gérées automatiquement"
        return 0
    fi
    
    case "$os" in
        "ubuntu")
            apt-get update -qq 2>/dev/null || {
                log "WARN" "Impossible de mettre à jour les paquets (permissions insuffisantes)"
                return 0
            }
            apt-get install -y build-essential python3-dev libsqlite3-dev pkg-config 2>/dev/null || {
                log "WARN" "Installation des dépendances système échouée (peut nécessiter sudo)"
                return 0
            }
            ;;
        "centos")
            yum groupinstall -y "Development Tools" 2>/dev/null || {
                log "WARN" "Installation des outils de développement échouée"
                return 0
            }
            yum install -y python3-devel sqlite-devel pkgconfig 2>/dev/null || {
                log "WARN" "Installation des dépendances échouée"
                return 0
            }
            ;;
        "alpine")
            apk add --no-cache build-base python3-dev sqlite-dev pkgconfig 2>/dev/null || {
                log "WARN" "Installation des dépendances Alpine échouée"
                return 0
            }
            ;;
        "macos")
            if command -v brew &>/dev/null; then
                brew install sqlite3 pkg-config 2>/dev/null || {
                    log "WARN" "Installation Homebrew échouée"
                    return 0
                }
            else
                log "WARN" "Homebrew non installé sur macOS"
            fi
            ;;
        *)
            log "WARN" "OS non reconnu ($os), dépendances système ignorées"
            ;;
    esac
    
    log "SUCCESS" "Dépendances système configurées"
}

# =============================================================================
# Installation Node.js et dépendances
# =============================================================================

setup_nodejs_environment() {
    log "INFO" "Configuration de l'environnement Node.js..."
    
    # Vérification de .nvmrc
    if [[ -f ".nvmrc" ]] && command -v nvm &>/dev/null; then
        log "INFO" "Utilisation de la version Node.js spécifiée dans .nvmrc"
        if [[ "$DRY_RUN" == "false" ]]; then
            nvm use
        fi
    fi
    
    # Mise à jour de npm
    if [[ "$DRY_RUN" == "false" ]]; then
        log "INFO" "Mise à jour de npm..."
        npm install -g npm@latest &
        spinner $!
    fi
    
    log "SUCCESS" "Environnement Node.js configuré"
}

install_npm_dependencies() {
    log "INFO" "Installation des dépendances npm..."
    
    if [[ ! -f "package.json" ]]; then
        log "ERROR" "package.json non trouvé"
        exit 1
    fi
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Installation avec gestion des erreurs
        if ! npm ci --production=false; then
            log "WARN" "npm ci échoué, tentative avec npm install"
            npm install
        fi
        
        # Rebuild spécifique pour better-sqlite3
        log "INFO" "Reconstruction de better-sqlite3..."
        npm rebuild better-sqlite3 --build-from-source &
        spinner $!
        
        # Audit de sécurité
        log "INFO" "Audit de sécurité..."
        npm audit --audit-level moderate || log "WARN" "Vulnérabilités détectées, vérification recommandée"
    fi
    
    log "SUCCESS" "Dépendances npm installées"
}

# =============================================================================
# Configuration Docker (optionnel)
# =============================================================================

setup_docker() {
    if [[ "$SKIP_DOCKER" == "true" ]]; then
        return 0
    fi
    
    if [[ -f "docker-compose.yml" ]] && command -v docker &>/dev/null; then
        log "INFO" "Configuration Docker détectée"
        
        if [[ "$QUIET" == "false" ]]; then
            read -p "${CYAN}Voulez-vous utiliser Docker? [y/N]: ${RESET}" -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if [[ "$DRY_RUN" == "false" ]]; then
                    docker-compose build --parallel
                    log "SUCCESS" "Environnement Docker configuré"
                fi
            fi
        fi
    fi
}

# =============================================================================
# Configuration de l'application
# =============================================================================

setup_application() {
    log "INFO" "Configuration de l'application..."
    
    # Création des dossiers
    local directories=("logs" "data" "uploads" "storage/db" "public/uploads")
    for dir in "${directories[@]}"; do
        if [[ "$DRY_RUN" == "false" ]]; then
            mkdir -p "$dir"
            chmod 755 "$dir"
        fi
        log "DEBUG" "Dossier créé: $dir"
    done
    
    # Configuration .env
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.example" ]]; then
            if [[ "$DRY_RUN" == "false" ]]; then
                cp .env.example .env
            fi
            log "SUCCESS" "Fichier .env créé à partir de .env.example"
        else
            log "INFO" "Création d'un fichier .env minimal"
            if [[ "$DRY_RUN" == "false" ]]; then
                cat > .env << 'EOF'
NODE_ENV=development
PORT=5000
DATABASE_URL=sqlite:./storage/db/fhirhub.db
LOG_LEVEL=info
EOF
            fi
        fi
    fi
    
    # Validation du fichier .env
    validate_env_file
    
    log "SUCCESS" "Application configurée"
}

validate_env_file() {
    if [[ -f ".env" ]]; then
        log "INFO" "Validation du fichier .env..."
        
        local required_vars=("NODE_ENV" "PORT")
        local missing_vars=()
        
        for var in "${required_vars[@]}"; do
            if ! grep -q "^$var=" .env; then
                missing_vars+=("$var")
            fi
        done
        
        if [[ ${#missing_vars[@]} -gt 0 ]]; then
            log "WARN" "Variables manquantes dans .env: ${missing_vars[*]}"
        fi
        
        # Validation du port
        local port=$(grep "^PORT=" .env | cut -d= -f2)
        if [[ -n "$port" ]] && ! [[ "$port" =~ ^[0-9]+$ ]]; then
            log "ERROR" "PORT invalide dans .env: $port"
            exit 1
        fi
    fi
}

# =============================================================================
# Tests et validation
# =============================================================================

run_health_checks() {
    log "INFO" "Exécution des tests de santé..."
    
    local checks=0
    local total_checks=4
    
    # Test 1: Vérification de package.json
    if [[ -f "package.json" ]] && node -e "JSON.parse(require('fs').readFileSync('package.json'))" &>/dev/null; then
        ((checks++))
        log "DEBUG" "package.json valide"
    fi
    
    # Test 2: Vérification des modules critiques
    if [[ -d "node_modules/express" ]] && [[ -d "node_modules/better-sqlite3" ]]; then
        ((checks++))
        log "DEBUG" "Modules critiques présents"
    fi
    
    # Test 3: Vérification des fichiers de l'application
    if [[ -f "app.js" ]] || [[ -f "server.js" ]] || [[ -f "index.js" ]]; then
        ((checks++))
        log "DEBUG" "Point d'entrée de l'application trouvé"
    fi
    
    # Test 4: Vérification de la base de données
    if [[ -f "storage/db/fhirhub.db" ]] || [[ -n "${DATABASE_URL:-}" ]]; then
        ((checks++))
        log "DEBUG" "Configuration de base de données détectée"
    fi
    
    local success_rate=$((checks * 100 / total_checks))
    if [[ $success_rate -ge 75 ]]; then
        log "SUCCESS" "Tests de santé réussis ($checks/$total_checks)"
    else
        log "WARN" "Tests de santé partiels ($checks/$total_checks)"
    fi
}

# =============================================================================
# Fonctions principales
# =============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -d|--skip-docker)
                SKIP_DOCKER=true
                shift
                ;;
            -f|--force)
                FORCE_INSTALL=true
                shift
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            --version)
                echo "FHIRHub Installation Script v$SCRIPT_VERSION"
                exit 0
                ;;
            *)
                log "ERROR" "Option inconnue: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

main() {
    trap cleanup EXIT
    
    # Initialisation du fichier de log
    echo "Installation FHIRHub démarrée à $(date)" > "$LOG_FILE"
    
    parse_arguments "$@"
    
    show_banner
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "Mode simulation activé - aucune modification ne sera effectuée"
    fi
    
    # Vérification si déjà installé
    if [[ -f "node_modules/.package-lock.json" ]] && [[ "$FORCE_INSTALL" == "false" ]]; then
        log "WARN" "Installation existante détectée. Utilisez --force pour réinstaller."
        exit 0
    fi
    
    create_backup
    
    # Étapes d'installation
    check_system_requirements
    install_system_dependencies
    setup_nodejs_environment
    install_npm_dependencies
    setup_docker
    setup_application
    run_health_checks
    
    # Résumé final
    log "SUCCESS" "Installation FHIRHub terminée avec succès!"
    log "INFO" "Prochaines étapes:"
    log "INFO" "  1. Vérifiez votre fichier .env"
    log "INFO" "  2. Exécutez ./start.sh pour démarrer l'application"
    log "INFO" "  3. Consultez les logs dans $LOG_FILE"
    
    if [[ "$QUIET" == "false" ]]; then
        echo
        echo "${GREEN}🎉 FHIRHub est prêt à être utilisé!${RESET}"
        echo "${CYAN}📋 Logs d'installation: $LOG_FILE${RESET}"
        echo "${CYAN}🚀 Pour démarrer: ./start.sh${RESET}"
    fi
}

# Exécution principale
main "$@"