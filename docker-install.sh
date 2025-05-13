#!/bin/bash

# Script d'installation pour le déploiement de FHIRHub + HAPI FHIR via Docker
# Ce script est conçu pour être idempotent (peut être exécuté plusieurs fois sans effet négatif)

set -e  # Arrête l'exécution en cas d'erreur

# Variables
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
DATA_DIR="$SCRIPT_DIR/data"
FHIRHUB_DATA_DIR="$DATA_DIR/fhirhub"
HAPI_FHIR_DATA_DIR="$DATA_DIR/hapi-fhir"
LOG_FILE="$SCRIPT_DIR/docker-install.log"

# Fonction de journalisation
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Fonction pour vérifier si Docker est installé
check_docker() {
    if ! command -v docker &> /dev/null; then
        log "ERREUR: Docker n'est pas installé. Veuillez installer Docker avant de continuer."
        exit 1
    fi

    if ! command -v docker compose &> /dev/null; then
        log "ERREUR: Docker Compose n'est pas installé. Veuillez installer Docker Compose avant de continuer."
        exit 1
    fi

    log "Docker et Docker Compose sont installés."
}

# Fonction pour créer les répertoires nécessaires
create_directories() {
    log "Création des répertoires de données..."
    
    # Création des répertoires pour FHIRHub
    mkdir -p "$FHIRHUB_DATA_DIR/storage/db"
    mkdir -p "$FHIRHUB_DATA_DIR/storage/data/cache"
    mkdir -p "$FHIRHUB_DATA_DIR/french_terminology"
    mkdir -p "$FHIRHUB_DATA_DIR/logs"
    mkdir -p "$FHIRHUB_DATA_DIR/temp"

    # Création des répertoires pour HAPI FHIR
    mkdir -p "$HAPI_FHIR_DATA_DIR"
    
    # Définir les permissions appropriées
    chmod -R 755 "$DATA_DIR"
    chmod -R 777 "$FHIRHUB_DATA_DIR/storage" "$FHIRHUB_DATA_DIR/logs" "$FHIRHUB_DATA_DIR/temp"
    
    log "Répertoires créés avec succès."
}

# Fonction pour vérifier/créer le script de healthcheck
check_healthcheck_script() {
    HEALTHCHECK_SCRIPT="$SCRIPT_DIR/healthcheck.sh"
    
    if [ ! -f "$HEALTHCHECK_SCRIPT" ]; then
        log "Création du script de healthcheck..."
        
        cat > "$HEALTHCHECK_SCRIPT" << 'EOL'
#!/bin/bash

# Script de vérification de l'état de santé pour le conteneur FHIRHub
# Utilisé par Docker pour vérifier que le service est opérationnel

# Paramètres
APP_URL="http://localhost:5000"
ENDPOINT="/api/system/health"
TIMEOUT=5

# Effectue une requête HTTP avec timeout
response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT $APP_URL$ENDPOINT)

# Vérifie si le code HTTP est 200 (OK)
if [ "$response" = "200" ]; then
    exit 0  # Succès
else
    echo "Healthcheck a échoué. Code HTTP: $response"
    exit 1  # Échec
fi
EOL
        
        chmod +x "$HEALTHCHECK_SCRIPT"
        log "Script de healthcheck créé."
    else
        log "Script de healthcheck déjà existant."
    fi
}

# Fonction principale
main() {
    clear
    log "========== Démarrage de l'installation FHIRHub + HAPI FHIR =========="
    
    # Vérifier si Docker est installé
    check_docker
    
    # Créer les répertoires nécessaires
    create_directories
    
    # Vérifier/créer le script de healthcheck
    check_healthcheck_script
    
    # Construire et démarrer les conteneurs
    log "Construction et démarrage des conteneurs Docker..."
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d
    
    # Vérifier si les conteneurs sont en cours d'exécution
    if [ "$(docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps --status running | wc -l)" -gt 1 ]; then
        log "Les conteneurs sont en cours d'exécution."
        log "FHIRHub est accessible à l'adresse: http://localhost:5000"
        log "HAPI FHIR est accessible à l'adresse: http://localhost:8080/fhir"
        
        # Test simple de connectivité
        log "Test de connexion aux serveurs (patientez quelques secondes)..."
        sleep 5
        
        FHIRHUB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:5000)
        if [ "$FHIRHUB_STATUS" = "200" ]; then
            log "✅ FHIRHub est accessible."
        else
            log "⚠️ FHIRHub n'est pas encore accessible (code: $FHIRHUB_STATUS). Cela peut prendre quelques secondes pour démarrer."
        fi
        
        HAPI_FHIR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8080/fhir/metadata)
        if [ "$HAPI_FHIR_STATUS" = "200" ]; then
            log "✅ HAPI FHIR est accessible."
        else
            log "⚠️ HAPI FHIR n'est pas encore accessible (code: $HAPI_FHIR_STATUS). Cela peut prendre une minute pour démarrer."
        fi
        
        log "========== Installation terminée avec succès =========="
        log "Pour vérifier l'état des conteneurs, exécutez: docker compose ps"
        log "Pour voir les logs, exécutez: docker compose logs -f"
    else
        log "ERREUR: Les conteneurs n'ont pas démarré correctement."
        log "Vérifiez les logs pour plus de détails: docker compose logs -f"
        exit 1
    fi
}

# Exécuter la fonction principale
main