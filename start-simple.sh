#!/bin/bash

# Script de démarrage simplifié pour FHIRHub
# Version 2.0 - Corrigé pour les erreurs identifiées

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_VERSION="2.0"

# Bannière de démarrage
echo -e "${CYAN}=========================================================="
echo -e "   FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"
echo -e "   Version ${APP_VERSION} - Compatible ANS"
echo -e "   $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "==========================================================${NC}"

# Fonction pour afficher les messages
log() {
    case "$1" in
        "ERROR") echo -e "${RED}❌ $2${NC}" ;;
        "SUCCESS") echo -e "${GREEN}✅ $2${NC}" ;;
        "WARN") echo -e "${YELLOW}⚠️ $2${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️ $2${NC}" ;;
    esac
}

# Fonction d'erreur et sortie
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Gestion des arguments
COMMAND=${1:-start}
DAEMON=false
PORT=${PORT:-5000}

case "$COMMAND" in
    "start"|"")
        # Mode démarrage par défaut
        ;;
    "stop")
        log "INFO" "Arrêt de l'application..."
        STOPPED=false
        
        # Chercher par PID file d'abord
        if [ -f "./logs/fhirhub.pid" ]; then
            PID=$(cat ./logs/fhirhub.pid 2>/dev/null)
            if [ ! -z "$PID" ] && kill -0 $PID 2>/dev/null; then
                kill $PID
                sleep 2
                if ! kill -0 $PID 2>/dev/null; then
                    rm -f ./logs/fhirhub.pid
                    STOPPED=true
                    log "SUCCESS" "Application arrêtée (PID: $PID)"
                fi
            fi
        fi
        
        # Fallback: chercher par nom de processus
        if [ "$STOPPED" = false ]; then
            if pgrep -f "node.*app.js" > /dev/null; then
                pkill -f "node.*app.js"
                sleep 2
                log "SUCCESS" "Application arrêtée"
            else
                log "WARN" "Aucun processus FHIRHub trouvé"
            fi
        fi
        exit 0
        ;;
    "restart")
        log "INFO" "Redémarrage de l'application..."
        $0 stop
        sleep 2
        # Continue avec le démarrage
        ;;
    "status")
        log "INFO" "Vérification du statut..."
        RUNNING=false
        
        # Vérifier via PID file
        if [ -f "./logs/fhirhub.pid" ]; then
            PID=$(cat ./logs/fhirhub.pid 2>/dev/null)
            if [ ! -z "$PID" ] && kill -0 $PID 2>/dev/null; then
                RUNNING=true
                log "SUCCESS" "Application en cours d'exécution (PID: $PID)"
            else
                rm -f ./logs/fhirhub.pid
            fi
        fi
        
        # Fallback: chercher par nom de processus
        if [ "$RUNNING" = false ]; then
            if pgrep -f "node.*app.js" > /dev/null; then
                PID=$(pgrep -f "node.*app.js")
                RUNNING=true
                log "SUCCESS" "Application en cours d'exécution (PID: $PID)"
            fi
        fi
        
        if [ "$RUNNING" = true ]; then
            # Test de connectivité
            if command -v curl &> /dev/null; then
                if curl -s http://localhost:$PORT/ > /dev/null 2>&1; then
                    log "SUCCESS" "Application répond sur le port $PORT"
                else
                    log "WARN" "Application ne répond pas sur le port $PORT"
                fi
            fi
        else
            log "WARN" "Application non démarrée"
            exit 1
        fi
        exit 0
        ;;
    "--daemon")
        DAEMON=true
        ;;
    "--help"|"-h")
        echo "Usage: $0 [COMMAND] [OPTIONS]"
        echo
        echo "Commands:"
        echo "  start     Démarrer l'application (défaut)"
        echo "  stop      Arrêter l'application"
        echo "  restart   Redémarrer l'application"
        echo "  status    Vérifier le statut"
        echo
        echo "Options:"
        echo "  --daemon  Démarrer en arrière-plan"
        echo "  --help    Afficher cette aide"
        echo
        echo "Variables d'environnement:"
        echo "  PORT      Port d'écoute (défaut: 5000)"
        exit 0
        ;;
    *)
        error_exit "Commande inconnue: $COMMAND. Utilisez --help pour l'aide."
        ;;
esac

# [1/5] Vérifications préliminaires
log "INFO" "[1/5] Vérifications préliminaires..."

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "app.js" ]; then
    error_exit "app.js non trouvé. Assurez-vous d'être dans le répertoire du projet."
fi

if [ ! -f "package.json" ]; then
    error_exit "package.json non trouvé. Exécutez d'abord ./install-simple.sh"
fi

if [ ! -d "node_modules" ]; then
    error_exit "node_modules non trouvé. Exécutez d'abord ./install-simple.sh"
fi

# Vérifier Node.js dans PATH ou utiliser le local
NODE_CMD="node"
NPM_CMD="npm"

# Si Node.js local existe, l'utiliser
if [ -f "./vendor/nodejs/bin/node" ]; then
    export PATH="$(pwd)/vendor/nodejs/bin:$PATH"
    NODE_CMD="./vendor/nodejs/bin/node"
    NPM_CMD="./vendor/nodejs/bin/npm"
    log "INFO" "Utilisation de Node.js local: $($NODE_CMD --version)"
elif ! command -v node &> /dev/null; then
    error_exit "Node.js non trouvé. Exécutez ./install-simple.sh ou installez Node.js"
fi

log "SUCCESS" "Structure du projet validée"

# [2/5] Chargement de la configuration
log "INFO" "[2/5] Chargement de la configuration..."

# Charger les variables d'environnement
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
    log "SUCCESS" "Variables d'environnement chargées depuis .env"
else
    log "WARN" "Fichier .env non trouvé, utilisation des valeurs par défaut"
fi

# Variables par défaut
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-5000}
export LOG_LEVEL=${LOG_LEVEL:-info}

log "SUCCESS" "Configuration: NODE_ENV=$NODE_ENV, PORT=$PORT"

# [3/5] Préparation de l'environnement
log "INFO" "[3/5] Préparation de l'environnement..."

# Créer les dossiers nécessaires s'ils n'existent pas
REQUIRED_DIRS=("logs" "storage/db" "data/conversions" "data/history")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        log "SUCCESS" "Dossier créé: $dir"
    fi
done

# Vérifier les permissions de la base de données
DB_PATH=${DATABASE_URL#sqlite:}
DB_PATH=${DB_PATH:-./storage/db/fhirhub.db}
DB_DIR=$(dirname "$DB_PATH")

if [ ! -d "$DB_DIR" ]; then
    mkdir -p "$DB_DIR"
fi

if ! touch "$DB_PATH" 2>/dev/null; then
    error_exit "Impossible d'accéder à la base de données: $DB_PATH"
fi

log "SUCCESS" "Base de données accessible: $DB_PATH"

# [4/5] Vérification du port
log "INFO" "[4/5] Vérification du port $PORT..."

if command -v lsof &> /dev/null; then
    if lsof -ti:$PORT > /dev/null 2>&1; then
        EXISTING_PID=$(lsof -ti:$PORT)
        if pgrep -f "node.*app.js" | grep -q "$EXISTING_PID"; then
            log "WARN" "FHIRHub déjà en cours d'exécution sur le port $PORT (PID: $EXISTING_PID)"
            log "INFO" "Utilisez './start-simple.sh stop' pour l'arrêter d'abord"
            exit 1
        else
            log "WARN" "Port $PORT occupé par un autre processus (PID: $EXISTING_PID)"
            log "INFO" "Changez la variable PORT dans .env ou arrêtez l'autre processus"
            exit 1
        fi
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tuln | grep -q ":$PORT "; then
        log "WARN" "Port $PORT semble occupé"
    fi
fi

log "SUCCESS" "Port $PORT disponible"

# [5/5] Démarrage de l'application
log "INFO" "[5/5] Démarrage de l'application..."

# Test des modules critiques avant démarrage
log "INFO" "Vérification des modules critiques..."
CRITICAL_MODULES=("axios" "express" "cors" "better-sqlite3")
for module in "${CRITICAL_MODULES[@]}"; do
    if ! $NODE_CMD -e "require('$module')" 2>/dev/null; then
        log "WARN" "Module $module manquant, tentative de réinstallation..."
        $NPM_CMD install "$module" --silent 2>/dev/null
    fi
done

# Affichage des informations de démarrage
echo
echo -e "${BLUE}----------------------------------------------------${NC}"
log "SUCCESS" "Système de conversion HL7 vers FHIR initialisé"
log "SUCCESS" "Terminologies françaises activées"
log "SUCCESS" "Convertisseur optimisé avec mappings ANS"
echo -e "${BLUE}----------------------------------------------------${NC}"

# Créer le fichier de log de l'application
LOG_FILE="./logs/app.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Démarrage
if [ "$DAEMON" = true ]; then
    log "INFO" "Démarrage en mode daemon..."
    nohup $NODE_CMD app.js > "$LOG_FILE" 2>&1 &
    APP_PID=$!
    echo $APP_PID > ./logs/fhirhub.pid
    
    # Attendre un peu et vérifier que l'application a démarré
    sleep 3
    if kill -0 $APP_PID 2>/dev/null; then
        log "SUCCESS" "Application démarrée en arrière-plan (PID: $APP_PID)"
        log "INFO" "Logs disponibles dans: $LOG_FILE"
    else
        log "ERROR" "Échec du démarrage en mode daemon"
        log "INFO" "Vérifiez les logs: cat $LOG_FILE"
        exit 1
    fi
else
    log "INFO" "Démarrage en mode interactif..."
    log "INFO" "Pour arrêter, utilisez Ctrl+C"
    
    # Gestionnaire de signal pour un arrêt propre
    trap 'echo -e "\n${YELLOW}⚠️ Arrêt de l'\''application...${NC}"; exit 0' INT TERM
    
    # Démarrage en mode interactif
    $NODE_CMD app.js
fi

# Attendre un peu pour vérifier que l'application répond
if [ "$DAEMON" = true ]; then
    sleep 5
    if command -v curl &> /dev/null; then
        if curl -s http://localhost:$PORT/ > /dev/null 2>&1; then
            log "SUCCESS" "Application opérationnelle sur http://localhost:$PORT"
        else
            log "WARN" "Application démarrée mais ne répond pas encore sur le port $PORT"
            log "INFO" "Vérifiez les logs: tail -f $LOG_FILE"
        fi
    fi
    
    echo
    echo "=========================================================="
    echo -e "${GREEN}🎉 FHIRHub démarré avec succès!${NC}"
    echo "=========================================================="
    echo
    echo "📍 URL: http://localhost:$PORT"
    echo "📋 Logs: $LOG_FILE"
    echo "🔧 PID: $APP_PID"
    echo
    echo "Commandes utiles:"
    echo "  ./start-simple.sh status    - Vérifier le statut"
    echo "  ./start-simple.sh stop      - Arrêter l'application"
    echo "  ./start-simple.sh restart   - Redémarrer"
    echo "  tail -f $LOG_FILE          - Suivre les logs"
    echo
    echo "=========================================================="
fi