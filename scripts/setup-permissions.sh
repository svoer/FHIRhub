#!/bin/bash

# 🔒 Script de Configuration des Permissions FHIRHub
# Configure les permissions appropriées pour tous les environnements

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
FHIRHUB_USER="${FHIRHUB_USER:-fhirhub}"
FHIRHUB_GROUP="${FHIRHUB_GROUP:-$FHIRHUB_USER}"

# Détection de l'environnement
detect_environment() {
    if [ -f "docker-compose.yml" ] && command -v docker-compose &> /dev/null; then
        ENV_TYPE="docker"
        print_status "Environnement Docker détecté"
    elif systemctl list-units --type=service | grep -q fhirhub; then
        ENV_TYPE="systemd"
        print_status "Environnement systemd détecté"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        ENV_TYPE="macos"
        print_status "Environnement macOS détecté"
    else
        ENV_TYPE="standalone"
        print_status "Environnement standalone détecté"
    fi
}

# Vérification des privilèges
check_privileges() {
    if [[ $ENV_TYPE != "docker" ]] && [[ $EUID -ne 0 ]]; then
        print_warning "Ce script nécessite des privilèges root pour configurer les permissions système"
        print_status "Exécution avec sudo recommandée pour une configuration complète"
        SUDO_REQUIRED=true
    else
        SUDO_REQUIRED=false
    fi
}

# Création de l'utilisateur système
create_system_user() {
    if [[ $ENV_TYPE == "docker" ]]; then
        print_status "Environnement Docker - pas de création d'utilisateur système nécessaire"
        return 0
    fi
    
    if [[ $SUDO_REQUIRED == true ]]; then
        print_warning "Privilèges root requis pour créer l'utilisateur système"
        return 0
    fi
    
    print_status "Création de l'utilisateur système $FHIRHUB_USER..."
    
    case "$OSTYPE" in
        linux-gnu*)
            if ! id "$FHIRHUB_USER" &>/dev/null; then
                useradd -r -s /bin/bash -d /opt/fhirhub -m "$FHIRHUB_USER" || {
                    print_warning "Impossible de créer l'utilisateur système"
                    return 1
                }
                print_success "Utilisateur $FHIRHUB_USER créé"
            else
                print_status "Utilisateur $FHIRHUB_USER existe déjà"
            fi
            ;;
        darwin*)
            if ! id "$FHIRHUB_USER" &>/dev/null; then
                # macOS user creation
                NEXT_UID=$(dscl . -list /Users UniqueID | awk '{print $2}' | sort -n | tail -1)
                NEXT_UID=$((NEXT_UID + 1))
                
                dscl . -create "/Users/$FHIRHUB_USER"
                dscl . -create "/Users/$FHIRHUB_USER" UserShell /bin/bash
                dscl . -create "/Users/$FHIRHUB_USER" RealName "FHIRHub Service User"
                dscl . -create "/Users/$FHIRHUB_USER" UniqueID "$NEXT_UID"
                dscl . -create "/Users/$FHIRHUB_USER" PrimaryGroupID 20
                dscl . -create "/Users/$FHIRHUB_USER" NFSHomeDirectory "/opt/fhirhub"
                
                print_success "Utilisateur $FHIRHUB_USER créé (macOS)"
            else
                print_status "Utilisateur $FHIRHUB_USER existe déjà"
            fi
            ;;
    esac
}

# Configuration des permissions de base
setup_base_permissions() {
    print_status "Configuration des permissions de base..."
    
    # Vérifier que les dossiers existent
    if [[ ! -d "data" ]]; then
        print_status "Création de la structure de dossiers..."
        mkdir -p data/{fhirhub/{config,logs,cache,terminologies,uploads},hapi-fhir/{database,lucene}}
    fi
    
    # Permissions de base (lecture pour tous)
    chmod -R 755 data/ 2>/dev/null || {
        print_warning "Impossible de modifier les permissions avec chmod - privilèges insuffisants"
    }
    
    print_success "Permissions de base configurées"
}

# Configuration des permissions d'écriture
setup_write_permissions() {
    print_status "Configuration des permissions d'écriture..."
    
    # Dossiers nécessitant l'écriture
    WRITE_DIRS=(
        "data/fhirhub/logs"
        "data/fhirhub/cache" 
        "data/fhirhub/uploads"
        "data/hapi-fhir/database"
        "data/hapi-fhir/lucene"
    )
    
    for dir in "${WRITE_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            chmod -R 770 "$dir" 2>/dev/null || {
                print_warning "Impossible de modifier les permissions pour $dir"
            }
            print_status "Permissions d'écriture configurées pour $dir"
        fi
    done
    
    print_success "Permissions d'écriture configurées"
}

# Configuration des permissions de configuration
setup_config_permissions() {
    print_status "Configuration des permissions pour les fichiers de configuration..."
    
    # Fichiers de configuration sensibles
    CONFIG_FILES=(
        ".env"
        "config/default.json"
        "config/production.json"
        "config/development.json"
    )
    
    for file in "${CONFIG_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            chmod 600 "$file" 2>/dev/null || {
                print_warning "Impossible de sécuriser $file"
            }
            print_status "Fichier $file sécurisé (600)"
        fi
    done
    
    # Dossier de configuration
    if [[ -d "data/fhirhub/config" ]]; then
        chmod 750 "data/fhirhub/config" 2>/dev/null || {
            print_warning "Impossible de sécuriser le dossier de configuration"
        }
    fi
    
    print_success "Permissions de configuration sécurisées"
}

# Attribution de propriété
setup_ownership() {
    if [[ $ENV_TYPE == "docker" ]]; then
        print_status "Environnement Docker - propriété gérée par les conteneurs"
        return 0
    fi
    
    if [[ $SUDO_REQUIRED == true ]]; then
        print_warning "Privilèges root requis pour modifier la propriété des fichiers"
        return 0
    fi
    
    if id "$FHIRHUB_USER" &>/dev/null; then
        print_status "Attribution de la propriété à $FHIRHUB_USER:$FHIRHUB_GROUP..."
        
        chown -R "$FHIRHUB_USER:$FHIRHUB_GROUP" data/ 2>/dev/null || {
            print_warning "Impossible de modifier la propriété des fichiers"
        }
        
        chown -R "$FHIRHUB_USER:$FHIRHUB_GROUP" . 2>/dev/null || {
            print_warning "Impossible de modifier la propriété du projet"
        }
        
        print_success "Propriété attribuée à $FHIRHUB_USER:$FHIRHUB_GROUP"
    else
        print_warning "Utilisateur $FHIRHUB_USER introuvable - propriété non modifiée"
    fi
}

# Configuration SELinux (si applicable)
setup_selinux() {
    if command -v getenforce &> /dev/null && [[ $(getenforce) != "Disabled" ]]; then
        print_status "Configuration SELinux..."
        
        # Contextes SELinux pour les dossiers de données
        setsebool -P httpd_can_network_connect 1 2>/dev/null || true
        
        # Contexte pour les fichiers de données
        semanage fcontext -a -t admin_home_t "$(pwd)/data(/.*)?" 2>/dev/null || true
        restorecon -R data/ 2>/dev/null || true
        
        print_success "SELinux configuré"
    fi
}

# Configuration AppArmor (si applicable)
setup_apparmor() {
    if command -v aa-status &> /dev/null; then
        print_status "AppArmor détecté - configuration recommandée manuellement"
        print_warning "Consultez la documentation pour la configuration AppArmor"
    fi
}

# Vérification des permissions
verify_permissions() {
    print_status "Vérification des permissions..."
    
    local errors=0
    
    # Vérifier les permissions de lecture
    if [[ ! -r "data" ]]; then
        print_error "Dossier data non lisible"
        ((errors++))
    fi
    
    # Vérifier les permissions d'écriture
    WRITE_TEST_DIRS=(
        "data/fhirhub/logs"
        "data/fhirhub/cache"
        "data/hapi-fhir/database"
    )
    
    for dir in "${WRITE_TEST_DIRS[@]}"; do
        if [[ -d "$dir" ]] && [[ ! -w "$dir" ]]; then
            print_error "Dossier $dir non accessible en écriture"
            ((errors++))
        fi
    done
    
    # Test d'écriture
    TEST_FILE="data/fhirhub/logs/.permission-test"
    if touch "$TEST_FILE" 2>/dev/null; then
        rm -f "$TEST_FILE"
        print_success "Test d'écriture réussi"
    else
        print_error "Test d'écriture échoué"
        ((errors++))
    fi
    
    if [[ $errors -eq 0 ]]; then
        print_success "Toutes les permissions sont correctes"
        return 0
    else
        print_error "$errors erreur(s) de permissions détectée(s)"
        return 1
    fi
}

# Affichage d'un résumé
display_summary() {
    echo
    echo "📋 Résumé de la Configuration des Permissions"
    echo "=============================================="
    
    echo "Environment: $ENV_TYPE"
    
    if [[ $ENV_TYPE != "docker" ]]; then
        if id "$FHIRHUB_USER" &>/dev/null; then
            echo "Utilisateur système: $FHIRHUB_USER ✓"
        else
            echo "Utilisateur système: non configuré ⚠"
        fi
    fi
    
    echo "Structure de permissions:"
    echo "  data/                     755 (lecture générale)"
    echo "  data/fhirhub/config/      750 (configuration protégée)"
    echo "  data/fhirhub/logs/        770 (écriture logs)"
    echo "  data/fhirhub/cache/       770 (écriture cache)"
    echo "  data/fhirhub/uploads/     770 (écriture uploads)"
    echo "  data/hapi-fhir/           770 (base de données HAPI)"
    echo "  .env                      600 (configuration sensible)"
    
    if [[ $SUDO_REQUIRED == true ]]; then
        echo
        print_warning "Pour une sécurité optimale, exécutez ce script avec sudo:"
        echo "sudo $0"
    fi
    
    echo
    print_success "Configuration des permissions terminée"
}

# Fonction principale
main() {
    echo "🔒 Configuration des Permissions FHIRHub"
    echo "========================================"
    echo
    
    detect_environment
    check_privileges
    create_system_user
    setup_base_permissions
    setup_write_permissions
    setup_config_permissions
    setup_ownership
    setup_selinux
    setup_apparmor
    
    if verify_permissions; then
        display_summary
    else
        print_error "Des problèmes de permissions subsistent"
        echo "Consultez le guide de dépannage pour plus d'informations"
        exit 1
    fi
}

# Gestion des options
case "${1:-}" in
    --verify-only)
        verify_permissions
        exit $?
        ;;
    --help|-h)
        echo "Usage: $0 [--verify-only] [--help]"
        echo "Configure les permissions appropriées pour FHIRHub"
        echo
        echo "Options:"
        echo "  --verify-only  Vérifie seulement les permissions existantes"
        echo "  --help         Affiche cette aide"
        exit 0
        ;;
    *)
        main
        ;;
esac