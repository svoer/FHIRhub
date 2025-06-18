#!/bin/bash

# 🔍 Script de Diagnostic et Health Check FHIRHub
# Vérifie l'état complet du système et génère un rapport détaillé

set -euo pipefail

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Variables globales
HEALTH_SCORE=0
TOTAL_CHECKS=0
WARNINGS=0
ERRORS=0
START_TIME=$(date +%s)

# Fonctions d'affichage
print_header() { echo -e "${CYAN}$1${NC}"; }
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; ((HEALTH_SCORE++)); }
print_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; ((WARNINGS++)); }
print_error() { echo -e "${RED}[✗]${NC} $1"; ((ERRORS++)); }

# Fonction de test
run_check() {
    local description="$1"
    local command="$2"
    local critical="${3:-false}"
    
    ((TOTAL_CHECKS++))
    
    if eval "$command" >/dev/null 2>&1; then
        print_success "$description"
        return 0
    else
        if [[ "$critical" == "true" ]]; then
            print_error "$description"
        else
            print_warning "$description"
        fi
        return 1
    fi
}

# Détection de l'environnement
detect_environment() {
    print_header "🏗️ DÉTECTION DE L'ENVIRONNEMENT"
    
    if [ -f "docker-compose.yml" ] && command -v docker-compose &> /dev/null; then
        ENV_TYPE="docker"
        DOCKER_COMPOSE_CMD="docker-compose"
        print_status "Environnement Docker détecté"
    elif [ -f "docker-compose.yml" ] && docker compose version &> /dev/null; then
        ENV_TYPE="docker"
        DOCKER_COMPOSE_CMD="docker compose"
        print_status "Environnement Docker Compose v2 détecté"
    elif systemctl list-units --type=service 2>/dev/null | grep -q fhirhub; then
        ENV_TYPE="systemd"
        print_status "Environnement systemd détecté"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        ENV_TYPE="macos"
        print_status "Environnement macOS détecté"
    else
        ENV_TYPE="standalone"
        print_status "Environnement standalone détecté"
    fi
    
    echo "Système d'exploitation: $(uname -s) $(uname -r)"
    echo "Architecture: $(uname -m)"
    echo
}

# Vérification des prérequis système
check_system_prerequisites() {
    print_header "🔧 PRÉREQUIS SYSTÈME"
    
    # Vérifications communes
    run_check "Commande curl disponible" "command -v curl"
    run_check "Commande git disponible" "command -v git"
    
    case "$ENV_TYPE" in
        "docker")
            run_check "Docker installé" "command -v docker" true
            run_check "Docker Compose disponible" "command -v $DOCKER_COMPOSE_CMD" true
            
            if command -v docker &> /dev/null; then
                DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
                echo "Version Docker: $DOCKER_VERSION"
                
                # Vérifier que Docker fonctionne
                if docker info >/dev/null 2>&1; then
                    print_success "Docker daemon opérationnel"
                else
                    print_error "Docker daemon non accessible"
                fi
            fi
            ;;
        *)
            run_check "Node.js installé" "command -v node" true
            run_check "NPM installé" "command -v npm" true
            run_check "Java installé" "command -v java" true
            
            if command -v node &> /dev/null; then
                NODE_VERSION=$(node --version)
                echo "Version Node.js: $NODE_VERSION"
            fi
            
            if command -v java &> /dev/null; then
                JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -oE '[0-9]+' | head -1)
                echo "Version Java: $JAVA_VERSION"
            fi
            ;;
    esac
    echo
}

# Vérification des ressources système
check_system_resources() {
    print_header "💾 RESSOURCES SYSTÈME"
    
    # Mémoire
    if [[ -f /proc/meminfo ]]; then
        MEM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        MEM_AVAILABLE_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        MEM_TOTAL_GB=$((MEM_TOTAL_KB / 1024 / 1024))
        MEM_AVAILABLE_GB=$((MEM_AVAILABLE_KB / 1024 / 1024))
        
        echo "Mémoire totale: ${MEM_TOTAL_GB}GB"
        echo "Mémoire disponible: ${MEM_AVAILABLE_GB}GB"
        
        if [ $MEM_TOTAL_GB -ge 4 ]; then
            print_success "Mémoire suffisante (${MEM_TOTAL_GB}GB)"
        else
            print_warning "Mémoire limitée (${MEM_TOTAL_GB}GB, recommandé: 4GB+)"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        MEM_TOTAL_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
        echo "Mémoire totale: ${MEM_TOTAL_GB}GB"
        
        if [ $MEM_TOTAL_GB -ge 4 ]; then
            print_success "Mémoire suffisante (${MEM_TOTAL_GB}GB)"
        else
            print_warning "Mémoire limitée (${MEM_TOTAL_GB}GB, recommandé: 4GB+)"
        fi
    fi
    
    # Espace disque
    DISK_AVAILABLE=$(df . | tail -1 | awk '{print $4}')
    DISK_GB=$((DISK_AVAILABLE / 1024 / 1024))
    echo "Espace disque disponible: ${DISK_GB}GB"
    
    if [ $DISK_GB -ge 10 ]; then
        print_success "Espace disque suffisant (${DISK_GB}GB)"
    else
        print_warning "Espace disque limité (${DISK_GB}GB, recommandé: 10GB+)"
    fi
    
    # CPU
    if [[ -f /proc/cpuinfo ]]; then
        CPU_CORES=$(grep -c ^processor /proc/cpuinfo)
        echo "Cœurs CPU: $CPU_CORES"
        
        if [ $CPU_CORES -ge 2 ]; then
            print_success "CPU suffisant ($CPU_CORES cœurs)"
        else
            print_warning "CPU limité ($CPU_CORES cœur, recommandé: 2+)"
        fi
    fi
    echo
}

# Vérification de la structure de fichiers
check_file_structure() {
    print_header "📁 STRUCTURE DE FICHIERS"
    
    # Fichiers essentiels
    run_check "app.js présent" "[ -f app.js ]" true
    run_check "package.json présent" "[ -f package.json ]" true
    run_check "Dossier data/ présent" "[ -d data ]" true
    
    # Structure de données
    run_check "Dossier data/fhirhub présent" "[ -d data/fhirhub ]"
    run_check "Dossier data/hapi-fhir présent" "[ -d data/hapi-fhir ]"
    
    # Sous-dossiers FHIRHub
    run_check "Dossier logs présent" "[ -d data/fhirhub/logs ]"
    run_check "Dossier cache présent" "[ -d data/fhirhub/cache ]"
    run_check "Dossier uploads présent" "[ -d data/fhirhub/uploads ]"
    
    # Configuration
    run_check "Fichier .env présent" "[ -f .env ]"
    
    if [[ "$ENV_TYPE" == "docker" ]]; then
        run_check "docker-compose.yml présent" "[ -f docker-compose.yml ]" true
    fi
    echo
}

# Vérification des permissions
check_permissions() {
    print_header "🔒 PERMISSIONS"
    
    # Permissions de lecture
    run_check "Lecture du dossier data/" "[ -r data ]" true
    run_check "Lecture du fichier app.js" "[ -r app.js ]" true
    
    # Permissions d'écriture
    run_check "Écriture dans data/fhirhub/logs" "[ -w data/fhirhub/logs ]"
    run_check "Écriture dans data/fhirhub/cache" "[ -w data/fhirhub/cache ]"
    run_check "Écriture dans data/hapi-fhir" "[ -w data/hapi-fhir ]"
    
    # Test d'écriture réel
    TEST_FILE="data/fhirhub/logs/.health-check-test"
    if touch "$TEST_FILE" 2>/dev/null; then
        rm -f "$TEST_FILE"
        print_success "Test d'écriture réussi"
    else
        print_error "Test d'écriture échoué"
    fi
    echo
}

# Vérification des ports
check_ports() {
    print_header "🔌 PORTS RÉSEAU"
    
    # Vérifier si les ports sont en écoute
    if netstat -tuln 2>/dev/null | grep -q ":5000 "; then
        print_success "Port 5000 en écoute (FHIRHub)"
    else
        print_warning "Port 5000 non en écoute"
    fi
    
    if netstat -tuln 2>/dev/null | grep -q ":8080 "; then
        print_success "Port 8080 en écoute (HAPI FHIR)"
    else
        print_warning "Port 8080 non en écoute"
    fi
    
    # Vérifier la disponibilité des ports
    for port in 5000 8080; do
        if ! netstat -tuln 2>/dev/null | grep -q ":$port "; then
            if nc -z localhost $port 2>/dev/null; then
                print_warning "Port $port accessible mais pas dans netstat"
            else
                print_status "Port $port libre"
            fi
        fi
    done
    echo
}

# Vérification des services
check_services() {
    print_header "🚀 ÉTAT DES SERVICES"
    
    case "$ENV_TYPE" in
        "docker")
            if $DOCKER_COMPOSE_CMD ps 2>/dev/null | grep -q "Up"; then
                print_success "Services Docker actifs"
                echo "État des conteneurs:"
                $DOCKER_COMPOSE_CMD ps
            else
                print_warning "Services Docker non actifs"
            fi
            ;;
        "systemd")
            if systemctl is-active --quiet fhirhub; then
                print_success "Service FHIRHub actif"
            else
                print_warning "Service FHIRHub inactif"
            fi
            
            if systemctl is-active --quiet hapi-fhir; then
                print_success "Service HAPI FHIR actif"
            else
                print_warning "Service HAPI FHIR inactif"
            fi
            ;;
        "macos")
            if launchctl list | grep -q com.fhirhub; then
                print_success "Service FHIRHub actif (launchd)"
            else
                print_warning "Service FHIRHub inactif"
            fi
            ;;
        *)
            # Vérifier les processus
            if pgrep -f "node.*app.js" >/dev/null; then
                print_success "Processus FHIRHub détecté"
            else
                print_warning "Processus FHIRHub non détecté"
            fi
            
            if pgrep -f "java.*hapi-fhir" >/dev/null; then
                print_success "Processus HAPI FHIR détecté"
            else
                print_warning "Processus HAPI FHIR non détecté"
            fi
            ;;
    esac
    echo
}

# Tests de connectivité
check_connectivity() {
    print_header "🌐 CONNECTIVITÉ"
    
    # Test FHIRHub
    if curl -sf http://localhost:5000/api/system/health >/dev/null 2>&1; then
        print_success "FHIRHub accessible (http://localhost:5000)"
        
        # Tester l'API de stats
        if curl -sf http://localhost:5000/api/stats >/dev/null 2>&1; then
            print_success "API Stats accessible"
        else
            print_warning "API Stats non accessible"
        fi
    else
        print_error "FHIRHub non accessible"
    fi
    
    # Test HAPI FHIR
    if curl -sf http://localhost:8080/fhir/metadata >/dev/null 2>&1; then
        print_success "HAPI FHIR accessible (http://localhost:8080/fhir)"
    else
        print_error "HAPI FHIR non accessible"
    fi
    
    # Test conversion
    CONVERSION_TEST=$(curl -s -X POST http://localhost:5000/api/convert \
        -H "X-API-KEY: dev-key" \
        -H "Content-Type: application/json" \
        -d '{"hl7Message":"MSH|^~\\&|TEST|TEST|||20241216||ADT^A01|1|P|2.5"}' \
        2>/dev/null | jq -r '.success' 2>/dev/null || echo "false")
    
    if [ "$CONVERSION_TEST" = "true" ]; then
        print_success "API de conversion fonctionnelle"
    else
        print_warning "API de conversion non testable (clé API requise)"
    fi
    echo
}

# Vérification des logs
check_logs() {
    print_header "📄 LOGS ET ERREURS"
    
    LOG_DIR="data/fhirhub/logs"
    
    if [ -d "$LOG_DIR" ]; then
        # Vérifier les fichiers de logs
        for log_file in error.log access.log conversion.log; do
            if [ -f "$LOG_DIR/$log_file" ]; then
                print_success "Fichier $log_file présent"
                
                # Vérifier les erreurs récentes (dernière heure)
                RECENT_ERRORS=$(find "$LOG_DIR/$log_file" -newermt "1 hour ago" -exec grep -c "ERROR" {} \; 2>/dev/null || echo "0")
                if [ "$RECENT_ERRORS" -gt 0 ]; then
                    print_warning "$RECENT_ERRORS erreurs récentes dans $log_file"
                fi
            else
                print_warning "Fichier $log_file manquant"
            fi
        done
        
        # Taille totale des logs
        LOG_SIZE=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)
        echo "Taille totale des logs: $LOG_SIZE"
        
    else
        print_warning "Dossier de logs manquant"
    fi
    
    # Logs système selon l'environnement
    case "$ENV_TYPE" in
        "docker")
            echo "Logs Docker disponibles avec: $DOCKER_COMPOSE_CMD logs"
            ;;
        "systemd")
            echo "Logs systemd disponibles avec: journalctl -u fhirhub"
            ;;
    esac
    echo
}

# Vérification de la configuration
check_configuration() {
    print_header "⚙️ CONFIGURATION"
    
    if [ -f ".env" ]; then
        print_success "Fichier .env présent"
        
        # Vérifier les variables critiques
        if grep -q "^JWT_SECRET=" .env && [ "$(grep "^JWT_SECRET=" .env | cut -d= -f2 | wc -c)" -gt 20 ]; then
            print_success "JWT_SECRET configuré"
        else
            print_warning "JWT_SECRET manquant ou trop court"
        fi
        
        if grep -q "^NODE_ENV=" .env; then
            NODE_ENV=$(grep "^NODE_ENV=" .env | cut -d= -f2)
            print_success "NODE_ENV configuré ($NODE_ENV)"
        else
            print_warning "NODE_ENV non configuré"
        fi
        
        if grep -q "^HAPI_FHIR_URL=" .env; then
            print_success "HAPI_FHIR_URL configuré"
        else
            print_warning "HAPI_FHIR_URL non configuré"
        fi
        
    else
        print_error "Fichier .env manquant"
    fi
    
    # Vérifier les clés API IA
    if [ -f ".env" ]; then
        AI_PROVIDERS=0
        
        if grep -q "^MISTRAL_API_KEY=" .env && [ -n "$(grep "^MISTRAL_API_KEY=" .env | cut -d= -f2)" ]; then
            print_success "Clé API Mistral configurée"
            ((AI_PROVIDERS++))
        fi
        
        if grep -q "^OPENAI_API_KEY=" .env && [ -n "$(grep "^OPENAI_API_KEY=" .env | cut -d= -f2)" ]; then
            print_success "Clé API OpenAI configurée"
            ((AI_PROVIDERS++))
        fi
        
        if grep -q "^ANTHROPIC_API_KEY=" .env && [ -n "$(grep "^ANTHROPIC_API_KEY=" .env | cut -d= -f2)" ]; then
            print_success "Clé API Anthropic configurée"
            ((AI_PROVIDERS++))
        fi
        
        if [ $AI_PROVIDERS -eq 0 ]; then
            print_warning "Aucun fournisseur IA configuré"
        else
            print_success "$AI_PROVIDERS fournisseur(s) IA configuré(s)"
        fi
    fi
    echo
}

# Vérification de la base de données
check_database() {
    print_header "🗄️ BASE DE DONNÉES"
    
    DB_FILE="data/fhirhub/fhirhub.db"
    
    if [ -f "$DB_FILE" ]; then
        print_success "Base de données SQLite présente"
        
        DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
        echo "Taille de la base: $DB_SIZE"
        
        # Test d'intégrité si sqlite3 est disponible
        if command -v sqlite3 >/dev/null; then
            if sqlite3 "$DB_FILE" "PRAGMA integrity_check;" | grep -q "ok"; then
                print_success "Intégrité de la base de données OK"
            else
                print_error "Problème d'intégrité de la base de données"
            fi
        fi
    else
        print_warning "Base de données SQLite non trouvée (sera créée au premier démarrage)"
    fi
    
    # HAPI FHIR Database
    HAPI_DB_DIR="data/hapi-fhir/database"
    if [ -d "$HAPI_DB_DIR" ]; then
        HAPI_DB_SIZE=$(du -sh "$HAPI_DB_DIR" 2>/dev/null | cut -f1)
        echo "Taille base HAPI FHIR: $HAPI_DB_SIZE"
        print_success "Dossier base HAPI FHIR présent"
    else
        print_warning "Dossier base HAPI FHIR manquant"
    fi
    echo
}

# Génération du rapport final
generate_report() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    print_header "📊 RAPPORT FINAL"
    
    echo "Durée du diagnostic: ${duration}s"
    echo "Checks effectués: $TOTAL_CHECKS"
    echo "Succès: $HEALTH_SCORE"
    echo "Avertissements: $WARNINGS"
    echo "Erreurs: $ERRORS"
    echo
    
    # Calcul du score de santé
    if [ $TOTAL_CHECKS -gt 0 ]; then
        HEALTH_PERCENTAGE=$((HEALTH_SCORE * 100 / TOTAL_CHECKS))
        
        if [ $HEALTH_PERCENTAGE -ge 90 ]; then
            print_success "État système: EXCELLENT ($HEALTH_PERCENTAGE%)"
        elif [ $HEALTH_PERCENTAGE -ge 75 ]; then
            print_success "État système: BON ($HEALTH_PERCENTAGE%)"
        elif [ $HEALTH_PERCENTAGE -ge 60 ]; then
            print_warning "État système: ACCEPTABLE ($HEALTH_PERCENTAGE%)"
        else
            print_error "État système: PROBLÉMATIQUE ($HEALTH_PERCENTAGE%)"
        fi
    fi
    
    echo
    
    # Recommandations
    if [ $ERRORS -gt 0 ]; then
        print_error "Actions requises:"
        echo "  • Résoudre les erreurs critiques avant utilisation"
        echo "  • Consulter le guide de dépannage: TROUBLESHOOTING.md"
    fi
    
    if [ $WARNINGS -gt 0 ]; then
        print_warning "Améliorations recommandées:"
        echo "  • Vérifier les avertissements pour optimiser les performances"
        echo "  • Configurer les éléments manquants pour une utilisation complète"
    fi
    
    if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        print_success "Système prêt pour utilisation en production!"
    fi
    
    echo
    echo "Pour plus d'informations:"
    echo "  • Documentation: INSTALLATION_GUIDE.md"
    echo "  • Configuration: CONFIGURATION.md"
    echo "  • Dépannage: TROUBLESHOOTING.md"
}

# Fonction principale
main() {
    echo "🔍 Diagnostic Complet FHIRHub"
    echo "============================="
    echo "Début: $(date)"
    echo
    
    detect_environment
    check_system_prerequisites
    check_system_resources
    check_file_structure
    check_permissions
    check_ports
    check_services
    check_connectivity
    check_logs
    check_configuration
    check_database
    generate_report
}

# Gestion des options
case "${1:-}" in
    --quick)
        echo "🚀 Diagnostic Rapide FHIRHub"
        echo "=========================="
        detect_environment
        check_services
        check_connectivity
        ;;
    --connectivity-only)
        echo "🌐 Test de Connectivité FHIRHub"
        echo "============================"
        check_connectivity
        ;;
    --help|-h)
        echo "Usage: $0 [--quick] [--connectivity-only] [--help]"
        echo "Effectue un diagnostic complet de FHIRHub"
        echo
        echo "Options:"
        echo "  --quick              Diagnostic rapide (services et connectivité)"
        echo "  --connectivity-only  Test de connectivité uniquement"
        echo "  --help              Affiche cette aide"
        exit 0
        ;;
    *)
        main
        ;;
esac