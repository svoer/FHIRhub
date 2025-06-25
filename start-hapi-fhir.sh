#!/bin/bash

# Script de démarrage pour serveur HAPI FHIR
# Version simplifiée pour FHIRHub

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    case "$1" in
        "ERROR") echo -e "${RED}❌ $2${NC}" ;;
        "SUCCESS") echo -e "${GREEN}✅ $2${NC}" ;;
        "WARN") echo -e "${YELLOW}⚠️ $2${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️ $2${NC}" ;;
    esac
}

# Variables par défaut
HAPI_VERSION="7.4.0"
HAPI_JAR="hapi-fhir-jpaserver-starter-${HAPI_VERSION}.jar"
HAPI_DIR="./hapi-fhir"
HAPI_URL="https://github.com/hapifhir/hapi-fhir-jpaserver-starter/releases/download/v${HAPI_VERSION}/${HAPI_JAR}"
PORT=${1:-8080}
MEMORY=${2:-512m}

# Aide
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: $0 [PORT] [MEMORY]"
    echo "  PORT    Port d'écoute (défaut: 8080)"
    echo "  MEMORY  Mémoire allouée (défaut: 512m)"
    echo
    echo "Exemples:"
    echo "  $0                    # Port 8080, 512m RAM"
    echo "  $0 8080 1g           # Port 8080, 1GB RAM"
    exit 0
fi

# Créer le répertoire HAPI FHIR
mkdir -p "$HAPI_DIR"

# Vérifier si Java est installé
if ! command -v java &> /dev/null; then
    log "ERROR" "Java non installé. Installation de OpenJDK 17..."
    
    # Tentative d'installation de Java selon la distribution
    if command -v dnf &> /dev/null; then
        sudo dnf install -y java-17-openjdk 2>/dev/null || log "WARN" "Échec installation Java avec dnf"
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y openjdk-17-jre 2>/dev/null || log "WARN" "Échec installation Java avec apt"
    elif command -v yum &> /dev/null; then
        sudo yum install -y java-17-openjdk 2>/dev/null || log "WARN" "Échec installation Java avec yum"
    fi
    
    # Revérifier
    if ! command -v java &> /dev/null; then
        log "ERROR" "Impossible d'installer Java automatiquement"
        log "INFO" "Veuillez installer Java 17+ manuellement"
        exit 1
    fi
fi

JAVA_VERSION=$(java -version 2>&1 | head -n1)
log "SUCCESS" "Java détecté: $JAVA_VERSION"

# Télécharger HAPI FHIR si nécessaire
if [ ! -f "$HAPI_DIR/$HAPI_JAR" ]; then
    log "INFO" "Téléchargement de HAPI FHIR $HAPI_VERSION..."
    
    if command -v curl &> /dev/null; then
        curl -L -o "$HAPI_DIR/$HAPI_JAR" "$HAPI_URL" --progress-bar
    elif command -v wget &> /dev/null; then
        wget -O "$HAPI_DIR/$HAPI_JAR" "$HAPI_URL" --show-progress
    else
        log "ERROR" "curl ou wget requis pour télécharger HAPI FHIR"
        exit 1
    fi
    
    if [ ! -f "$HAPI_DIR/$HAPI_JAR" ]; then
        log "ERROR" "Échec du téléchargement de HAPI FHIR"
        exit 1
    fi
    
    log "SUCCESS" "HAPI FHIR téléchargé"
else
    log "SUCCESS" "HAPI FHIR déjà présent"
fi

# Vérifier si le port est libre
if command -v lsof &> /dev/null; then
    if lsof -ti:$PORT > /dev/null 2>&1; then
        log "WARN" "Port $PORT déjà occupé"
        exit 1
    fi
fi

# Démarrer HAPI FHIR
log "INFO" "Démarrage de HAPI FHIR sur le port $PORT..."

cd "$HAPI_DIR"

# Configurations HAPI FHIR
export SERVER_PORT=$PORT
export SPRING_DATASOURCE_URL="jdbc:h2:file:./target/database/h2"
export HAPI_FHIR_FHIR_VERSION=R4
export HAPI_FHIR_REUSE_CACHED_SEARCH_RESULTS_MILLIS=60000

# Démarrage en arrière-plan
nohup java -Xmx$MEMORY -jar "$HAPI_JAR" \
    --server.port=$PORT \
    --spring.datasource.url="jdbc:h2:file:./target/database/h2" \
    --hapi.fhir.fhir_version=R4 \
    > ../logs/hapi-fhir.log 2>&1 &

HAPI_PID=$!
echo $HAPI_PID > ../logs/hapi-fhir.pid

log "SUCCESS" "HAPI FHIR démarré (PID: $HAPI_PID)"
log "INFO" "URL: http://localhost:$PORT/fhir"
log "INFO" "Logs: ../logs/hapi-fhir.log"

# Attendre que le serveur soit prêt
log "INFO" "Attente du démarrage complet..."
for i in {1..30}; do
    if curl -s http://localhost:$PORT/fhir/metadata > /dev/null 2>&1; then
        log "SUCCESS" "HAPI FHIR opérationnel"
        exit 0
    fi
    sleep 1
done

log "WARN" "HAPI FHIR démarre en arrière-plan (peut prendre quelques minutes)"
exit 0