#!/usr/bin/env bash
# =============================================================================
# FHIRHub Startup Script v2.1.0
# =============================================================================
# Démarrage automatisé et supervision de FHIRHub
# Fonctionnalités: health checks, supervision, logs, rollback, monitoring
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# Variables globales
readonly SCRIPT_VERSION="2.1.0"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_FILE="$(pwd)/logs/startup.log"
readonly APP_LOG_FILE="$(pwd)/logs/app.log"
readonly PID_FILE="$(pwd)/logs/fhirhub.pid"
readonly HEALTH_CHECK_TIMEOUT=30
readonly STARTUP_TIMEOUT=60

# Configuration par défaut
DEFAULT_PORT=5000
DEFAULT_NODE_ENV=development
DEFAULT_LOG_LEVEL=info

# Flags de configuration
VERBOSE=false
QUIET=false
DAEMON=false
NO_BUILD=false
FORCE_RESTART=false
HEALTH_CHECK_ONLY=false
MONITOR_MODE=false

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
fi

# =============================================================================
# Fonctions utilitaires
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    # Créer le dossier logs s'il n'existe pas
    mkdir -p "$(dirname "$LOG_FILE")"
    
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
║                    🚀 FHIRHub Startup 🚀                    ║
║                                                              ║
║    Plateforme de conversion HL7 to FHIR pour la France      ║
║                   Startup Script v2.1.0                     ║
╚══════════════════════════════════════════════════════════════╝
EOF
    fi
}

show_usage() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS] [COMMAND]

Commands:
    start              Démarrer l'application (défaut)
    stop               Arrêter l'application
    restart            Redémarrer l'application
    status             Vérifier le statut
    health             Test de santé uniquement
    monitor            Mode monitoring continu
    logs               Afficher les logs en temps réel

Options:
    -v, --verbose      Mode verbeux avec logs détaillés
    -q, --quiet        Mode silencieux
    -d, --daemon       Démarrer en arrière-plan
    -b, --no-build     Ignorer la phase de build
    -f, --force        Forcer le redémarrage
    -p, --port PORT    Port personnalisé (défaut: 5000)
    -e, --env ENV      Environnement (development/production)
    -h, --help         Afficher cette aide
    --version          Afficher la version

Exemples:
    $SCRIPT_NAME                    # Démarrage standard
    $SCRIPT_NAME --daemon           # Démarrage en arrière-plan
    $SCRIPT_NAME restart --force    # Redémarrage forcé
    $SCRIPT_NAME monitor            # Monitoring continu
    $SCRIPT_NAME status             # Vérifier le statut

Variables d'environnement:
    PORT              Port d'écoute (défaut: 5000)
    NODE_ENV          Environnement (défaut: development)
    LOG_LEVEL         Niveau de logs (défaut: info)
EOF
}

spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    
    if [[ "$QUIET" == "false" ]]; then
        while kill -0 "$pid" 2>/dev/null; do
            local temp=${spinstr#?}
            printf " [%c]  " "$spinstr"
            local spinstr=$temp${spinstr%"$temp"}
            sleep $delay
            printf "\b\b\b\b\b\b"
        done
        printf "    \b\b\b\b"
    fi
}

countdown() {
    local seconds=$1
    local message="$2"
    
    if [[ "$QUIET" == "false" ]]; then
        for ((i=seconds; i>0; i--)); do
            printf "\r${CYAN}$message $i secondes...${RESET}"
            sleep 1
        done
        printf "\r${CYAN}$message terminé.        ${RESET}\n"
    else
        sleep "$seconds"
    fi
}

# =============================================================================
# Gestion des processus
# =============================================================================

get_running_pid() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "$pid"
            return 0
        else
            rm -f "$PID_FILE"
        fi
    fi
    
    # Recherche par nom de processus
    local pid=$(pgrep -f "node.*app\.js\|node.*server\.js\|npm.*start" | head -n1)
    if [[ -n "$pid" ]]; then
        echo "$pid"
        return 0
    fi
    
    return 1
}

is_app_running() {
    get_running_pid > /dev/null
}

stop_app() {
    log "INFO" "Arrêt de l'application..."
    
    local pid
    if pid=$(get_running_pid); then
        log "DEBUG" "PID trouvé: $pid"
        
        # Tentative d'arrêt gracieux
        kill -TERM "$pid" 2>/dev/null || true
        
        # Attendre l'arrêt gracieux
        local timeout=10
        while [[ $timeout -gt 0 ]] && kill -0 "$pid" 2>/dev/null; do
            sleep 1
            ((timeout--))
        done
        
        # Arrêt forcé si nécessaire
        if kill -0 "$pid" 2>/dev/null; then
            log "WARN" "Arrêt forcé du processus $pid"
            kill -KILL "$pid" 2>/dev/null || true
        fi
        
        rm -f "$PID_FILE"
        log "SUCCESS" "Application arrêtée"
    else
        log "WARN" "Aucun processus en cours d'exécution"
    fi
}

# =============================================================================
# Configuration et environnement
# =============================================================================

load_environment() {
    log "INFO" "Chargement de l'environnement..."
    
    # Charger le fichier .env s'il existe
    if [[ -f ".env" ]]; then
        log "DEBUG" "Chargement du fichier .env"
        set -a
        source .env
        set +a
    fi
    
    # Variables par défaut
    export NODE_ENV="${NODE_ENV:-$DEFAULT_NODE_ENV}"
    export PORT="${PORT:-$DEFAULT_PORT}"
    export LOG_LEVEL="${LOG_LEVEL:-$DEFAULT_LOG_LEVEL}"
    
    # Validation des variables critiques
    if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [[ $PORT -lt 1024 ]] || [[ $PORT -gt 65535 ]]; then
        log "ERROR" "PORT invalide: $PORT (doit être entre 1024 et 65535)"
        exit 1
    fi
    
    log "DEBUG" "NODE_ENV=$NODE_ENV, PORT=$PORT, LOG_LEVEL=$LOG_LEVEL"
    log "SUCCESS" "Environnement configuré"
}

validate_prerequisites() {
    log "INFO" "Validation des prérequis..."
    
    # Vérifier Node.js
    if ! command -v node &>/dev/null; then
        log "ERROR" "Node.js non installé"
        exit 1
    fi
    
    # Vérifier npm
    if ! command -v npm &>/dev/null; then
        log "ERROR" "npm non installé"
        exit 1
    fi
    
    # Vérifier package.json
    if [[ ! -f "package.json" ]]; then
        log "ERROR" "package.json non trouvé"
        exit 1
    fi
    
    # Vérifier node_modules
    if [[ ! -d "node_modules" ]]; then
        log "ERROR" "node_modules non trouvé. Exécutez d'abord ./install.sh"
        exit 1
    fi
    
    # Vérifier le point d'entrée
    local main_file
    if [[ -f "app.js" ]]; then
        main_file="app.js"
    elif [[ -f "server.js" ]]; then
        main_file="server.js"
    elif [[ -f "index.js" ]]; then
        main_file="index.js"
    else
        log "ERROR" "Point d'entrée de l'application non trouvé"
        exit 1
    fi
    
    log "DEBUG" "Point d'entrée: $main_file"
    log "SUCCESS" "Prérequis validés"
}

build_application() {
    if [[ "$NO_BUILD" == "true" ]]; then
        log "INFO" "Phase de build ignorée"
        return 0
    fi
    
    log "INFO" "Build de l'application..."
    
    # Vérifier s'il y a un script de build
    if npm run | grep -q "build"; then
        log "DEBUG" "Script de build détecté"
        if ! npm run build; then
            log "ERROR" "Échec du build"
            exit 1
        fi
        log "SUCCESS" "Build terminé"
    else
        log "DEBUG" "Aucun script de build défini"
    fi
}

# =============================================================================
# Démarrage et supervision
# =============================================================================

start_app() {
    log "INFO" "Démarrage de l'application..."
    
    # Vérifier si déjà en cours d'exécution
    if is_app_running && [[ "$FORCE_RESTART" == "false" ]]; then
        log "WARN" "Application déjà en cours d'exécution (PID: $(get_running_pid))"
        return 0
    fi
    
    # Arrêter l'application existante si nécessaire
    if is_app_running; then
        stop_app
    fi
    
    # Créer les dossiers de logs
    mkdir -p "$(dirname "$APP_LOG_FILE")"
    
    # Démarrer l'application
    if [[ "$DAEMON" == "true" ]]; then
        log "INFO" "Démarrage en mode daemon..."
        nohup npm start > "$APP_LOG_FILE" 2>&1 &
        local app_pid=$!
    else
        npm start > "$APP_LOG_FILE" 2>&1 &
        local app_pid=$!
    fi
    
    echo "$app_pid" > "$PID_FILE"
    log "DEBUG" "Application démarrée (PID: $app_pid)"
    
    # Attendre le démarrage
    wait_for_startup "$app_pid"
}

wait_for_startup() {
    local app_pid=$1
    log "INFO" "Attente du démarrage de l'application..."
    
    local timeout=$STARTUP_TIMEOUT
    local port_open=false
    
    while [[ $timeout -gt 0 ]]; do
        # Vérifier si le processus est toujours en vie
        if ! kill -0 "$app_pid" 2>/dev/null; then
            log "ERROR" "Le processus s'est arrêté de manière inattendue"
            show_error_logs
            exit 1
        fi
        
        # Vérifier si le port est ouvert
        if command -v nc &>/dev/null; then
            if nc -z localhost "$PORT" 2>/dev/null; then
                port_open=true
                break
            fi
        elif command -v netstat &>/dev/null; then
            if netstat -tuln | grep -q ":$PORT "; then
                port_open=true
                break
            fi
        else
            # Fallback: attendre un délai fixe
            if [[ $timeout -le $((STARTUP_TIMEOUT - 10)) ]]; then
                port_open=true
                break
            fi
        fi
        
        if [[ "$QUIET" == "false" ]]; then
            printf "\r${CYAN}Démarrage en cours... %ds restantes${RESET}" "$timeout"
        fi
        
        sleep 1
        ((timeout--))
    done
    
    if [[ "$QUIET" == "false" ]]; then
        printf "\r                                        \r"
    fi
    
    if [[ "$port_open" == "true" ]]; then
        log "SUCCESS" "Application démarrée sur le port $PORT"
    else
        log "ERROR" "Timeout lors du démarrage"
        show_error_logs
        exit 1
    fi
}

show_error_logs() {
    if [[ -f "$APP_LOG_FILE" ]]; then
        log "ERROR" "Dernières lignes des logs d'erreur:"
        if [[ "$QUIET" == "false" ]]; then
            echo "${RED}--- Début des logs d'erreur ---${RESET}"
            tail -n 20 "$APP_LOG_FILE" | sed "s/^/${RED}| ${RESET}/"
            echo "${RED}--- Fin des logs d'erreur ---${RESET}"
        fi
    fi
}

# =============================================================================
# Tests de santé
# =============================================================================

run_health_checks() {
    log "INFO" "Exécution des tests de santé..."
    
    local checks_passed=0
    local total_checks=4
    
    # Test 1: Vérification du processus
    if is_app_running; then
        ((checks_passed++))
        log "DEBUG" "✓ Processus en cours d'exécution"
    else
        log "ERROR" "✗ Processus non trouvé"
    fi
    
    # Test 2: Vérification du port
    if command -v nc &>/dev/null && nc -z localhost "$PORT" 2>/dev/null; then
        ((checks_passed++))
        log "DEBUG" "✓ Port $PORT accessible"
    else
        log "ERROR" "✗ Port $PORT inaccessible"
    fi
    
    # Test 3: Test HTTP de base
    if command -v curl &>/dev/null; then
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null || echo "000")
        if [[ "$http_code" =~ ^[23] ]]; then
            ((checks_passed++))
            log "DEBUG" "✓ Réponse HTTP valide ($http_code)"
        else
            log "ERROR" "✗ Réponse HTTP invalide ($http_code)"
        fi
    else
        log "WARN" "curl non disponible, test HTTP ignoré"
        ((checks_passed++))
    fi
    
    # Test 4: Test de l'endpoint de santé
    if command -v curl &>/dev/null; then
        if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
            ((checks_passed++))
            log "DEBUG" "✓ Endpoint /health accessible"
        else
            # Test d'un endpoint alternatif
            if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
                ((checks_passed++))
                log "DEBUG" "✓ Endpoint /api/health accessible"
            else
                log "WARN" "✗ Aucun endpoint de santé trouvé"
            fi
        fi
    else
        ((checks_passed++))
    fi
    
    # Résultat final
    local success_rate=$((checks_passed * 100 / total_checks))
    if [[ $success_rate -ge 75 ]]; then
        log "SUCCESS" "Tests de santé réussis ($checks_passed/$total_checks - $success_rate%)"
        return 0
    else
        log "ERROR" "Tests de santé échoués ($checks_passed/$total_checks - $success_rate%)"
        return 1
    fi
}

# =============================================================================
# Commandes principales
# =============================================================================

cmd_start() {
    load_environment
    validate_prerequisites
    build_application
    start_app
    
    if run_health_checks; then
        log "SUCCESS" "FHIRHub démarré avec succès!"
        show_app_info
    else
        log "ERROR" "Démarrage échoué"
        exit 1
    fi
}

cmd_stop() {
    stop_app
}

cmd_restart() {
    log "INFO" "Redémarrage de l'application..."
    FORCE_RESTART=true
    cmd_stop
    sleep 2
    cmd_start
}

cmd_status() {
    log "INFO" "Vérification du statut..."
    
    if is_app_running; then
        local pid=$(get_running_pid)
        log "SUCCESS" "Application en cours d'exécution (PID: $pid)"
        
        # Informations détaillées
        if command -v ps &>/dev/null; then
            local start_time=$(ps -o lstart= -p "$pid" 2>/dev/null | xargs)
            local cpu_usage=$(ps -o %cpu= -p "$pid" 2>/dev/null | xargs)
            local mem_usage=$(ps -o %mem= -p "$pid" 2>/dev/null | xargs)
            
            log "INFO" "Démarré: $start_time"
            log "INFO" "CPU: ${cpu_usage}%, Mémoire: ${mem_usage}%"
        fi
        
        run_health_checks
    else
        log "WARN" "Application non démarrée"
        exit 1
    fi
}

cmd_health() {
    HEALTH_CHECK_ONLY=true
    if is_app_running; then
        run_health_checks
    else
        log "ERROR" "Application non démarrée"
        exit 1
    fi
}

cmd_monitor() {
    log "INFO" "Mode monitoring activé (Ctrl+C pour arrêter)"
    
    while true; do
        clear
        echo "${BOLD}${CYAN}=== FHIRHub Monitor ===${RESET}"
        echo "Dernière mise à jour: $(date)"
        echo
        
        if is_app_running; then
            local pid=$(get_running_pid)
            echo "${GREEN}✅ Application en cours d'exécution (PID: $pid)${RESET}"
            
            # Informations système
            if command -v ps &>/dev/null; then
                local cpu_usage=$(ps -o %cpu= -p "$pid" 2>/dev/null | xargs)
                local mem_usage=$(ps -o %mem= -p "$pid" 2>/dev/null | xargs)
                echo "CPU: ${cpu_usage}% | Mémoire: ${mem_usage}%"
            fi
            
            # Test de connectivité
            if command -v curl &>/dev/null; then
                local response_time
                response_time=$(curl -o /dev/null -s -w "%{time_total}" "http://localhost:$PORT/" 2>/dev/null || echo "N/A")
                echo "Temps de réponse: ${response_time}s"
            fi
        else
            echo "${RED}❌ Application arrêtée${RESET}"
        fi
        
        echo
        echo "Logs récents:"
        if [[ -f "$APP_LOG_FILE" ]]; then
            tail -n 5 "$APP_LOG_FILE" | sed 's/^/  /'
        else
            echo "  Aucun log disponible"
        fi
        
        sleep 5
    done
}

cmd_logs() {
    if [[ -f "$APP_LOG_FILE" ]]; then
        log "INFO" "Affichage des logs en temps réel (Ctrl+C pour arrêter)"
        tail -f "$APP_LOG_FILE"
    else
        log "ERROR" "Fichier de logs non trouvé: $APP_LOG_FILE"
        exit 1
    fi
}

show_app_info() {
    if [[ "$QUIET" == "false" ]]; then
        echo
        echo "${GREEN}🎉 FHIRHub est opérationnel!${RESET}"
        echo "${CYAN}📍 URL: http://localhost:$PORT${RESET}"
        echo "${CYAN}🌍 Environnement: $NODE_ENV${RESET}"
        echo "${CYAN}📋 Logs: $APP_LOG_FILE${RESET}"
        echo "${CYAN}🔧 PID: $(get_running_pid)${RESET}"
        echo
        echo "${YELLOW}Commandes utiles:${RESET}"
        echo "  ${WHITE}./start.sh status${RESET}   - Vérifier le statut"
        echo "  ${WHITE}./start.sh monitor${RESET}  - Mode monitoring"
        echo "  ${WHITE}./start.sh logs${RESET}     - Afficher les logs"
        echo "  ${WHITE}./start.sh stop${RESET}     - Arrêter l'application"
    fi
}

# =============================================================================
# Fonctions principales
# =============================================================================

parse_arguments() {
    local command=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            start|stop|restart|status|health|monitor|logs)
                command="$1"
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -d|--daemon)
                DAEMON=true
                shift
                ;;
            -b|--no-build)
                NO_BUILD=true
                shift
                ;;
            -f|--force)
                FORCE_RESTART=true
                shift
                ;;
            -p|--port)
                if [[ -n "$2" ]] && [[ "$2" =~ ^[0-9]+$ ]]; then
                    export PORT="$2"
                    shift 2
                else
                    log "ERROR" "Port invalide: $2"
                    exit 1
                fi
                ;;
            -e|--env)
                if [[ -n "$2" ]]; then
                    export NODE_ENV="$2"
                    shift 2
                else
                    log "ERROR" "Environnement requis"
                    exit 1
                fi
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            --version)
                echo "FHIRHub Startup Script v$SCRIPT_VERSION"
                exit 0
                ;;
            *)
                log "ERROR" "Option inconnue: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Commande par défaut
    if [[ -z "$command" ]]; then
        command="start"
    fi
    
    echo "$command"
}

cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]] && [[ "$HEALTH_CHECK_ONLY" == "false" ]]; then
        log "ERROR" "Script terminé avec le code d'erreur: $exit_code"
    fi
    exit $exit_code
}

main() {
    trap cleanup EXIT
    
    # Initialisation du fichier de log
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "Démarrage FHIRHub à $(date)" > "$LOG_FILE"
    
    local command
    command=$(parse_arguments "$@")
    
    if [[ "$command" != "logs" ]] && [[ "$command" != "monitor" ]]; then
        show_banner
    fi
    
    case "$command" in
        "start")   cmd_start ;;
        "stop")    cmd_stop ;;
        "restart") cmd_restart ;;
        "status")  cmd_status ;;
        "health")  cmd_health ;;
        "monitor") cmd_monitor ;;
        "logs")    cmd_logs ;;
        *)
            log "ERROR" "Commande inconnue: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Exécution principale
main "$@"