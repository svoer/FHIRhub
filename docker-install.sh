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
HAPI_CONFIG_FILE="$SCRIPT_DIR/hapi-application.properties"

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

    # Vérifier si 'docker compose' (nouvelle syntaxe) ou 'docker-compose' (ancienne syntaxe) est disponible
    if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
        log "ERREUR: Docker Compose n'est pas installé. Veuillez installer Docker Compose avant de continuer."
        exit 1
    fi
    
    # Déterminer quelle commande utiliser pour Docker Compose
    if command -v docker compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
        log "Utilisation de la nouvelle syntaxe 'docker compose'"
    else
        DOCKER_COMPOSE_CMD="docker-compose"
        log "Utilisation de l'ancienne syntaxe 'docker-compose'"
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

    # Création des répertoires pour HAPI FHIR avec leur structure complète
    mkdir -p "$HAPI_FHIR_DATA_DIR/database"
    mkdir -p "$HAPI_FHIR_DATA_DIR/config"
    mkdir -p "$HAPI_FHIR_DATA_DIR/logs"
    
    # Créer un fichier vide dans le répertoire database pour s'assurer qu'il existe
    touch "$HAPI_FHIR_DATA_DIR/database/.keep"
    
    # Définir les permissions appropriées
    chmod -R 777 "$DATA_DIR"
    
    # S'assurer que les répertoires spécifiques sont accessibles en écriture
    find "$DATA_DIR" -type d -exec chmod 777 {} \;
    
    log "Répertoires créés avec succès avec les permissions 777."
}

# Fonction pour créer un fichier de configuration pour HAPI FHIR
create_hapi_config() {
    log "Création du fichier de configuration HAPI FHIR..."
    
    cat > "$HAPI_CONFIG_FILE" << 'EOL'
# Configuration de la base de données
spring.datasource.url=jdbc:h2:file:/data/hapi/database/h2;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
spring.datasource.username=sa
spring.datasource.password=sa
spring.datasource.driverClassName=org.h2.Driver
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=update

# Configuration du serveur
server.port=8080
server.servlet.context-path=/

# Configuration FHIR
hapi.fhir.fhir_version=R4
hapi.fhir.default_encoding=json
hapi.fhir.allow_external_references=true
hapi.fhir.allow_multiple_delete=true
hapi.fhir.allow_placeholder_references=true
hapi.fhir.expunge_enabled=true
hapi.fhir.server_address=http://localhost:8080/fhir

# Désactiver les subscriptions pour éviter les erreurs
hapi.fhir.subscription.resthook_enabled=false
hapi.fhir.subscription.websocket_enabled=false
hapi.fhir.subscription.email_enabled=false

# Configuration de validation
hapi.fhir.validation.enabled=false
hapi.fhir.validation.request_only=true

# Configuration de journalisation
logging.level.root=WARN
logging.level.ca.uhn.fhir=WARN
logging.level.org.springframework=WARN
logging.level.org.hibernate=WARN

# Configuration JPA
spring.jpa.properties.hibernate.format_sql=false
spring.jpa.properties.hibernate.show_sql=false
EOL

    # Copier le fichier de configuration dans le répertoire data
    cp "$HAPI_CONFIG_FILE" "$HAPI_FHIR_DATA_DIR/config/application.properties"
    chmod 644 "$HAPI_FHIR_DATA_DIR/config/application.properties"
    
    log "Fichier de configuration HAPI FHIR créé avec succès."
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

# Fonction pour vérifier et mettre à jour le docker-compose.yml
check_docker_compose() {
    log "Vérification du fichier docker-compose.yml..."
    
    # Vérifier si le volume est correctement configuré
    if grep -q "./data/hapi-fhir:/data/hapi" "$SCRIPT_DIR/docker-compose.yml"; then
        log "Configuration du volume HAPI FHIR correcte."
    else
        log "⚠️ Attention: La configuration du volume HAPI FHIR pourrait être incorrecte."
        log "Assurez-vous que la ligne suivante est présente dans docker-compose.yml:"
        log "      - ./data/hapi-fhir:/data/hapi"
    fi
    
    # Vérifier si les variables d'environnement nécessaires sont présentes
    if ! grep -q "spring.config.location" "$SCRIPT_DIR/docker-compose.yml"; then
        log "⚠️ Attention: La variable spring.config.location n'est pas définie."
        log "Il est recommandé d'ajouter la ligne suivante aux variables d'environnement:"
        log "      - SPRING_CONFIG_LOCATION=file:/data/hapi/config/application.properties"
    fi
}

# Fonction pour nettoyer les conteneurs existants
clean_containers() {
    log "Nettoyage des conteneurs existants..."
    
    # Arrêter les conteneurs s'ils sont en cours d'exécution
    $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" down 2>/dev/null || true
    
    # Supprimer les conteneurs HAPI FHIR existants pour éviter les conflits
    docker rm -f hapi-fhir 2>/dev/null || true
    
    log "Nettoyage terminé."
}

# Fonction pour mettre à jour le fichier docker-compose.yml si nécessaire
update_docker_compose() {
    log "Vérification des paramètres dans docker-compose.yml..."
    
    # Ajouter la variable SPRING_CONFIG_LOCATION si elle n'existe pas
    if ! grep -q "SPRING_CONFIG_LOCATION" "$SCRIPT_DIR/docker-compose.yml"; then
        log "Ajout de la variable SPRING_CONFIG_LOCATION au conteneur HAPI FHIR..."
        
        # Utiliser sed pour ajouter la variable après les autres variables d'environnement
        sed -i '/environment:/,/deploy:/ s/^      # Configuration Spring/      - SPRING_CONFIG_LOCATION=file:\/\/\/data\/hapi\/config\/application.properties\n      # Configuration Spring/' "$SCRIPT_DIR/docker-compose.yml"
    fi
}

# Fonction principale
main() {
    clear
    log "========== Démarrage de l'installation FHIRHub + HAPI FHIR =========="
    
    # Vérifier si Docker est installé
    check_docker
    
    # Nettoyer les conteneurs existants
    clean_containers
    
    # Créer les répertoires nécessaires
    create_directories
    
    # Créer le fichier de configuration HAPI FHIR
    create_hapi_config
    
    # Vérifier/créer le script de healthcheck
    check_healthcheck_script
    
    # Vérifier et éventuellement mettre à jour docker-compose.yml
    check_docker_compose
    update_docker_compose
    
    # Construire et démarrer les conteneurs
    log "Construction et démarrage des conteneurs Docker..."
    $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" up -d
    
    # Attendre que les conteneurs démarrent
    log "Attente du démarrage des conteneurs (cela peut prendre une minute)..."
    sleep 10
    
    # Vérifier si les conteneurs sont en cours d'exécution
    if [ "$($DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" ps --status running | wc -l)" -gt 1 ]; then
        log "Les conteneurs sont en cours d'exécution."
        log "FHIRHub est accessible à l'adresse: http://localhost:5000"
        log "HAPI FHIR est accessible à l'adresse: http://localhost:8080/fhir"
        
        # Test simple de connectivité
        log "Test de connexion aux serveurs (patientez quelques secondes)..."
        sleep 5
        
        FHIRHUB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:5000 || echo "Error")
        if [ "$FHIRHUB_STATUS" = "200" ]; then
            log "✅ FHIRHub est accessible."
        else
            log "⚠️ FHIRHub n'est pas encore accessible (code: $FHIRHUB_STATUS). Cela peut prendre quelques secondes pour démarrer."
        fi
        
        HAPI_FHIR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8080/fhir/metadata || echo "Error")
        if [ "$HAPI_FHIR_STATUS" = "200" ]; then
            log "✅ HAPI FHIR est accessible."
        else
            log "⚠️ HAPI FHIR n'est pas encore accessible (code: $HAPI_FHIR_STATUS). Cela peut prendre une minute pour démarrer complètement."
            
            # Afficher les logs de HAPI FHIR pour le débogage
            log "Dernières lignes des logs HAPI FHIR:"
            $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" logs --tail=20 hapi-fhir
        fi
        
        log "========== Installation terminée avec succès =========="
        log "Pour vérifier l'état des conteneurs, exécutez: $DOCKER_COMPOSE_CMD ps"
        log "Pour voir les logs, exécutez:"
        log "- FHIRHub: $DOCKER_COMPOSE_CMD logs -f fhirhub"
        log "- HAPI FHIR: $DOCKER_COMPOSE_CMD logs -f hapi-fhir"
        log "- Tous les services: $DOCKER_COMPOSE_CMD logs -f"
    else
        log "ERREUR: Les conteneurs n'ont pas démarré correctement."
        log "Affichage des logs Docker pour diagnostic:"
        $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" logs
        exit 1
    fi
}

# Exécuter la fonction principale
main