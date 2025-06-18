#!/bin/bash

# 🐳 Script d'Installation Automatique FHIRHub avec Docker
# Ce script installe et configure FHIRHub avec toutes ses dépendances

set -euo pipefail  # Arrêt en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FHIRHUB_DIR="fhirhub"
FHIRHUB_URL="https://github.com/fhirhub/fhirhub.git"
MIN_DOCKER_VERSION="20.10.0"
MIN_COMPOSE_VERSION="2.0.0"

# Fonction d'affichage
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction de comparaison de version
version_compare() {
    printf '%s\n%s\n' "$1" "$2" | sort -V | head -n1 | [ "$1" = "$(cat)" ]
}

# Vérification des prérequis système
check_prerequisites() {
    print_status "Vérification des prérequis système..."
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker n'est pas installé. Veuillez installer Docker Engine >= $MIN_DOCKER_VERSION"
        echo "Installation Docker : https://docs.docker.com/engine/install/"
        exit 1
    fi
    
    # Vérifier la version Docker
    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    if ! version_compare "$MIN_DOCKER_VERSION" "$DOCKER_VERSION"; then
        print_error "Version Docker trop ancienne. Requis: >= $MIN_DOCKER_VERSION, Trouvé: $DOCKER_VERSION"
        exit 1
    fi
    print_success "Docker $DOCKER_VERSION détecté"
    
    # Vérifier Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose n'est pas installé. Veuillez installer Docker Compose >= $MIN_COMPOSE_VERSION"
        exit 1
    fi
    
    # Déterminer la commande Docker Compose
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
        COMPOSE_VERSION=$(docker compose version --short)
    else
        DOCKER_COMPOSE_CMD="docker-compose"
        COMPOSE_VERSION=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    fi
    
    if ! version_compare "$MIN_COMPOSE_VERSION" "$COMPOSE_VERSION"; then
        print_error "Version Docker Compose trop ancienne. Requis: >= $MIN_COMPOSE_VERSION, Trouvé: $COMPOSE_VERSION"
        exit 1
    fi
    print_success "Docker Compose $COMPOSE_VERSION détecté"
    
    # Vérifier les ressources système
    if [[ -f /proc/meminfo ]]; then
        MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        MEM_GB=$((MEM_KB / 1024 / 1024))
        if [ $MEM_GB -lt 4 ]; then
            print_warning "RAM disponible: ${MEM_GB}GB. Recommandé: >= 4GB"
        else
            print_success "RAM disponible: ${MEM_GB}GB"
        fi
    fi
    
    # Vérifier l'espace disque
    DISK_AVAILABLE=$(df . | tail -1 | awk '{print $4}')
    DISK_GB=$((DISK_AVAILABLE / 1024 / 1024))
    if [ $DISK_GB -lt 10 ]; then
        print_warning "Espace disque disponible: ${DISK_GB}GB. Recommandé: >= 10GB"
    else
        print_success "Espace disque disponible: ${DISK_GB}GB"
    fi
}

# Vérification des ports
check_ports() {
    print_status "Vérification de la disponibilité des ports..."
    
    for port in 5000 8080; do
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            print_error "Port $port déjà utilisé. Veuillez libérer ce port ou modifier la configuration."
            netstat -tuln | grep ":$port "
            exit 1
        fi
    done
    print_success "Ports 5000 et 8080 disponibles"
}

# Clonage ou mise à jour du projet
setup_project() {
    print_status "Configuration du projet FHIRHub..."
    
    if [ -d "$FHIRHUB_DIR" ]; then
        print_warning "Le dossier $FHIRHUB_DIR existe déjà"
        read -p "Voulez-vous le mettre à jour ? (y/N): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cd "$FHIRHUB_DIR"
            git pull origin main
            cd ..
            print_success "Projet mis à jour"
        fi
    else
        print_status "Clonage du projet depuis $FHIRHUB_URL"
        git clone "$FHIRHUB_URL" "$FHIRHUB_DIR"
        print_success "Projet cloné"
    fi
    
    cd "$FHIRHUB_DIR"
}

# Création de la structure de dossiers
create_directory_structure() {
    print_status "Création de la structure de dossiers..."
    
    # Créer la structure de données
    mkdir -p data/{fhirhub/{config,logs,cache,terminologies,uploads},hapi-fhir/{database,lucene}}
    mkdir -p docker/{fhirhub,hapi-fhir}
    mkdir -p scripts
    mkdir -p config/examples
    
    print_success "Structure de dossiers créée"
}

# Configuration des permissions
setup_permissions() {
    print_status "Configuration des permissions..."
    
    # Permissions de base
    chmod -R 755 data/
    
    # Permissions spécifiques pour les dossiers d'écriture
    chmod -R 770 data/fhirhub/{logs,cache,uploads} 2>/dev/null || true
    chmod -R 770 data/hapi-fhir/ 2>/dev/null || true
    
    # Créer un utilisateur système si nécessaire (Linux uniquement)
    if [[ "$OSTYPE" == "linux-gnu"* ]] && [ "$EUID" -eq 0 ]; then
        if ! id "fhirhub" &>/dev/null; then
            useradd -r -s /bin/false fhirhub
            print_success "Utilisateur système 'fhirhub' créé"
        fi
        chown -R fhirhub:fhirhub data/
        print_success "Permissions utilisateur configurées"
    else
        print_success "Permissions de base configurées"
    fi
}

# Configuration de l'environnement
setup_environment() {
    print_status "Configuration de l'environnement..."
    
    # Créer le fichier .env s'il n'existe pas
    if [ ! -f .env ]; then
        cat > .env << EOF
# Configuration FHIRHub
NODE_ENV=production
PORT=5000
HAPI_FHIR_URL=http://hapi-fhir:8080/fhir

# Sécurité
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
API_RATE_LIMIT=1000
CONVERSION_RATE_LIMIT=30
AUTH_RATE_LIMIT=10
ENABLE_SECURITY_HEADERS=true

# Performance
CACHE_MAX_SIZE=1000
CACHE_TTL=3600
NODE_OPTIONS=--max-old-space-size=512

# Timeouts
FHIR_REQUEST_TIMEOUT=30000
FHIR_MAX_RETRY_ATTEMPTS=3
FHIR_RETRY_DELAY=1000
EOF
        print_success "Fichier .env créé avec configuration par défaut"
    else
        print_status "Fichier .env existant conservé"
    fi
}

# Construction et démarrage des conteneurs
start_services() {
    print_status "Construction et démarrage des services..."
    
    # Construire les images
    print_status "Construction de l'image FHIRHub..."
    $DOCKER_COMPOSE_CMD build --no-cache fhirhub
    
    # Démarrer tous les services
    print_status "Démarrage des services..."
    $DOCKER_COMPOSE_CMD up -d
    
    print_success "Services démarrés"
}

# Attendre que les services soient prêts
wait_for_services() {
    print_status "Attente du démarrage complet des services..."
    
    # Attendre FHIRHub
    print_status "Attente de FHIRHub (port 5000)..."
    for i in {1..60}; do
        if curl -sf http://localhost:5000/api/system/health >/dev/null 2>&1; then
            print_success "FHIRHub est prêt"
            break
        fi
        if [ $i -eq 60 ]; then
            print_error "Timeout: FHIRHub n'a pas démarré dans les temps"
            $DOCKER_COMPOSE_CMD logs fhirhub
            exit 1
        fi
        sleep 2
    done
    
    # Attendre HAPI FHIR
    print_status "Attente de HAPI FHIR (port 8080)..."
    for i in {1..120}; do
        if curl -sf http://localhost:8080/fhir/metadata >/dev/null 2>&1; then
            print_success "HAPI FHIR est prêt"
            break
        fi
        if [ $i -eq 120 ]; then
            print_error "Timeout: HAPI FHIR n'a pas démarré dans les temps"
            $DOCKER_COMPOSE_CMD logs hapi-fhir
            exit 1
        fi
        sleep 3
    done
}

# Tests de validation
run_validation_tests() {
    print_status "Exécution des tests de validation..."
    
    # Test FHIRHub health
    if curl -sf http://localhost:5000/api/system/health >/dev/null; then
        print_success "✓ FHIRHub health check réussi"
    else
        print_error "✗ FHIRHub health check échoué"
        return 1
    fi
    
    # Test HAPI FHIR metadata
    if curl -sf http://localhost:8080/fhir/metadata >/dev/null; then
        print_success "✓ HAPI FHIR metadata réussi"
    else
        print_error "✗ HAPI FHIR metadata échoué"
        return 1
    fi
    
    # Test conversion simple
    print_status "Test de conversion HL7→FHIR..."
    CONVERSION_RESULT=$(curl -s -X POST http://localhost:5000/api/convert \
        -H "X-API-KEY: dev-key" \
        -H "Content-Type: application/json" \
        -d '{"hl7Message":"MSH|^~\\&|TEST|TEST|||20241216||ADT^A01|1|P|2.5"}' | jq -r '.success' 2>/dev/null || echo "false")
    
    if [ "$CONVERSION_RESULT" = "true" ]; then
        print_success "✓ Test de conversion réussi"
    else
        print_warning "⚠ Test de conversion échoué (configuration API key requise)"
    fi
    
    print_success "Tests de validation terminés"
}

# Affichage des informations finales
display_final_info() {
    echo
    echo "🎉 Installation FHIRHub terminée avec succès!"
    echo
    echo "📍 Services disponibles:"
    echo "   • Interface FHIRHub:    http://localhost:5000"
    echo "   • API de conversion:    http://localhost:5000/api"
    echo "   • Documentation API:    http://localhost:5000/api-reference.html"
    echo "   • Serveur HAPI FHIR:    http://localhost:8080/fhir"
    echo
    echo "🔧 Commandes utiles:"
    echo "   • État des services:    $DOCKER_COMPOSE_CMD ps"
    echo "   • Logs en temps réel:   $DOCKER_COMPOSE_CMD logs -f"
    echo "   • Redémarrage:          $DOCKER_COMPOSE_CMD restart"
    echo "   • Arrêt:                $DOCKER_COMPOSE_CMD down"
    echo
    echo "📚 Prochaines étapes:"
    echo "   1. Accéder à http://localhost:5000"
    echo "   2. Créer un compte administrateur"
    echo "   3. Configurer une clé API"
    echo "   4. Tester une conversion HL7→FHIR"
    echo
    echo "📖 Documentation complète: https://github.com/fhirhub/fhirhub/wiki"
    echo
}

# Fonction de nettoyage en cas d'erreur
cleanup_on_error() {
    print_error "Erreur détectée. Nettoyage en cours..."
    if [ -d "$FHIRHUB_DIR" ]; then
        cd "$FHIRHUB_DIR"
        $DOCKER_COMPOSE_CMD down 2>/dev/null || true
    fi
    exit 1
}

# Gestionnaire de signaux
trap cleanup_on_error ERR

# Point d'entrée principal
main() {
    echo "🚀 Installation FHIRHub avec Docker"
    echo "===================================="
    echo
    
    check_prerequisites
    check_ports
    setup_project
    create_directory_structure
    setup_permissions
    setup_environment
    start_services
    wait_for_services
    run_validation_tests
    display_final_info
}

# Vérifier si le script est exécuté directement
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi