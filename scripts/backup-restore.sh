#!/bin/bash

# 💾 Script de Sauvegarde et Restauration FHIRHub
# Gestion complète des sauvegardes avec rotation automatique

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATA_DIR="${DATA_DIR:-./data}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"
EXCLUDE_CACHE="${EXCLUDE_CACHE:-true}"

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

# Détection de l'environnement
detect_environment() {
    if [ -f "docker-compose.yml" ] && command -v docker-compose &> /dev/null; then
        ENV_TYPE="docker"
        DOCKER_COMPOSE_CMD="docker-compose"
    elif [ -f "docker-compose.yml" ] && docker compose version &> /dev/null; then
        ENV_TYPE="docker"
        DOCKER_COMPOSE_CMD="docker compose"
    elif systemctl list-units --type=service 2>/dev/null | grep -q fhirhub; then
        ENV_TYPE="systemd"
    else
        ENV_TYPE="standalone"
    fi
}

# Arrêt des services
stop_services() {
    local graceful="${1:-true}"
    
    print_status "Arrêt des services FHIRHub..."
    
    case "$ENV_TYPE" in
        "docker")
            if [ "$graceful" = "true" ]; then
                $DOCKER_COMPOSE_CMD stop
            else
                $DOCKER_COMPOSE_CMD down
            fi
            ;;
        "systemd")
            sudo systemctl stop fhirhub hapi-fhir
            ;;
        *)
            # Arrêt manuel des processus
            pkill -TERM -f "node.*app.js" || true
            pkill -TERM -f "java.*hapi-fhir" || true
            sleep 5
            ;;
    esac
    
    print_success "Services arrêtés"
}

# Démarrage des services
start_services() {
    print_status "Démarrage des services FHIRHub..."
    
    case "$ENV_TYPE" in
        "docker")
            $DOCKER_COMPOSE_CMD up -d
            ;;
        "systemd")
            sudo systemctl start hapi-fhir
            sleep 10
            sudo systemctl start fhirhub
            ;;
        *)
            print_warning "Démarrage manuel requis pour l'environnement $ENV_TYPE"
            ;;
    esac
    
    print_success "Services démarrés"
}

# Création d'une sauvegarde
create_backup() {
    local backup_type="${1:-full}"
    local backup_name="${2:-}"
    
    # Générer un nom de sauvegarde si non fourni
    if [ -z "$backup_name" ]; then
        backup_name="fhirhub-${backup_type}-$(date +%Y%m%d-%H%M%S)"
    fi
    
    local backup_file="$BACKUP_DIR/${backup_name}.tar.gz"
    
    print_status "Création de la sauvegarde $backup_type: $backup_name"
    
    # Créer le dossier de sauvegarde
    mkdir -p "$BACKUP_DIR"
    
    # Construire les options de tar
    local tar_options="--create --gzip --file=$backup_file"
    
    # Compression
    if command -v pigz &> /dev/null; then
        print_status "Utilisation de pigz pour la compression parallèle"
        tar_options="--create --use-compress-program=pigz --file=$backup_file"
    fi
    
    # Exclusions
    local exclude_options=""
    if [ "$EXCLUDE_CACHE" = "true" ]; then
        exclude_options="--exclude=data/fhirhub/cache"
    fi
    
    case "$backup_type" in
        "full")
            print_status "Sauvegarde complète en cours..."
            tar $tar_options $exclude_options \
                --exclude=data/fhirhub/logs/access.log \
                --exclude='*.tmp' \
                --exclude='*.pid' \
                data/ .env docker-compose.yml 2>/dev/null || {
                print_warning "Certains fichiers n'ont pas pu être sauvegardés"
            }
            ;;
        "data")
            print_status "Sauvegarde des données uniquement..."
            tar $tar_options $exclude_options \
                --exclude='*.tmp' \
                --exclude='*.pid' \
                data/
            ;;
        "config")
            print_status "Sauvegarde de la configuration uniquement..."
            tar $tar_options \
                .env config/ data/fhirhub/config/ docker-compose.yml 2>/dev/null || {
                print_warning "Certains fichiers de configuration n'ont pas pu être sauvegardés"
            }
            ;;
        "database")
            print_status "Sauvegarde des bases de données uniquement..."
            tar $tar_options \
                data/fhirhub/fhirhub.db* \
                data/hapi-fhir/database/ 2>/dev/null
            ;;
    esac
    
    # Vérifier la sauvegarde
    if [ -f "$backup_file" ]; then
        local backup_size=$(du -h "$backup_file" | cut -f1)
        print_success "Sauvegarde créée: $backup_file (taille: $backup_size)"
        
        # Créer un fichier de métadonnées
        cat > "${backup_file}.info" << EOF
Sauvegarde FHIRHub
==================
Type: $backup_type
Date: $(date)
Taille: $backup_size
Environnement: $ENV_TYPE
Version: $(grep '"version"' package.json 2>/dev/null | cut -d'"' -f4 || echo "inconnue")
Contenu: $(tar -tzf "$backup_file" | wc -l) fichiers

Commande de restauration:
$0 restore "$backup_file"
EOF
        
        return 0
    else
        print_error "Échec de la création de la sauvegarde"
        return 1
    fi
}

# Restauration d'une sauvegarde
restore_backup() {
    local backup_file="$1"
    local force="${2:-false}"
    
    if [ ! -f "$backup_file" ]; then
        print_error "Fichier de sauvegarde non trouvé: $backup_file"
        return 1
    fi
    
    print_status "Restauration de la sauvegarde: $backup_file"
    
    # Vérifier l'intégrité de la sauvegarde
    if ! tar -tzf "$backup_file" >/dev/null 2>&1; then
        print_error "Fichier de sauvegarde corrompu"
        return 1
    fi
    
    # Afficher le contenu de la sauvegarde
    print_status "Contenu de la sauvegarde:"
    tar -tzf "$backup_file" | head -10
    local total_files=$(tar -tzf "$backup_file" | wc -l)
    echo "... et $((total_files - 10)) autres fichiers"
    
    # Confirmation si mode non forcé
    if [ "$force" != "true" ]; then
        echo
        read -p "Continuer avec la restauration ? [y/N]: " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Restauration annulée"
            return 0
        fi
    fi
    
    # Sauvegarder l'état actuel
    local current_backup="$BACKUP_DIR/pre-restore-$(date +%Y%m%d-%H%M%S).tar.gz"
    print_status "Sauvegarde de l'état actuel vers: $current_backup"
    
    mkdir -p "$BACKUP_DIR"
    tar -czf "$current_backup" data/ .env 2>/dev/null || {
        print_warning "Impossible de sauvegarder l'état actuel"
    }
    
    # Arrêter les services
    stop_services false
    
    # Restauration
    print_status "Extraction de la sauvegarde..."
    
    if tar -xzf "$backup_file" 2>/dev/null; then
        print_success "Sauvegarde restaurée avec succès"
    else
        print_error "Erreur lors de la restauration"
        
        # Tentative de restauration de l'état précédent
        if [ -f "$current_backup" ]; then
            print_status "Tentative de restauration de l'état précédent..."
            tar -xzf "$current_backup" 2>/dev/null || {
                print_error "Impossible de restaurer l'état précédent"
            }
        fi
        return 1
    fi
    
    # Redémarrer les services
    sleep 2
    start_services
    
    # Vérifier que tout fonctionne
    print_status "Vérification de la restauration..."
    sleep 10
    
    if curl -sf http://localhost:5000/api/system/health >/dev/null 2>&1; then
        print_success "Restauration réussie - FHIRHub opérationnel"
    else
        print_warning "Restauration terminée - vérification manuelle recommandée"
    fi
}

# Rotation des sauvegardes
rotate_backups() {
    print_status "Rotation des sauvegardes (conservation: $RETENTION_DAYS jours)"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_status "Aucun dossier de sauvegarde trouvé"
        return 0
    fi
    
    local deleted_count=0
    
    # Supprimer les sauvegardes anciennes
    find "$BACKUP_DIR" -name "fhirhub-*.tar.gz" -mtime +$RETENTION_DAYS -type f | while read -r old_backup; do
        print_status "Suppression de la sauvegarde ancienne: $(basename "$old_backup")"
        rm -f "$old_backup" "${old_backup}.info"
        ((deleted_count++))
    done
    
    # Afficher les statistiques
    local current_backups=$(find "$BACKUP_DIR" -name "fhirhub-*.tar.gz" -type f | wc -l)
    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    
    print_success "Rotation terminée: $current_backups sauvegarde(s) conservée(s) (taille totale: $total_size)"
}

# Listage des sauvegardes
list_backups() {
    print_status "Sauvegardes disponibles dans $BACKUP_DIR:"
    echo
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_warning "Aucun dossier de sauvegarde trouvé"
        return 0
    fi
    
    find "$BACKUP_DIR" -name "fhirhub-*.tar.gz" -type f | sort -r | while read -r backup_file; do
        if [ -f "$backup_file" ]; then
            local backup_name=$(basename "$backup_file" .tar.gz)
            local backup_size=$(du -h "$backup_file" | cut -f1)
            local backup_date=$(stat -c %y "$backup_file" 2>/dev/null | cut -d. -f1)
            
            echo "📦 $backup_name"
            echo "   Taille: $backup_size"
            echo "   Date: $backup_date"
            
            # Afficher les infos si disponibles
            if [ -f "${backup_file}.info" ]; then
                local backup_type=$(grep "Type:" "${backup_file}.info" | cut -d: -f2 | xargs)
                echo "   Type: $backup_type"
            fi
            echo
        fi
    done
    
    local total_backups=$(find "$BACKUP_DIR" -name "fhirhub-*.tar.gz" -type f | wc -l)
    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    
    echo "Total: $total_backups sauvegarde(s), taille: $total_size"
}

# Sauvegarde automatique avec rotation
auto_backup() {
    local backup_type="${1:-full}"
    
    print_status "Sauvegarde automatique $backup_type en cours..."
    
    if create_backup "$backup_type"; then
        rotate_backups
        print_success "Sauvegarde automatique terminée"
    else
        print_error "Échec de la sauvegarde automatique"
        return 1
    fi
}

# Vérification d'intégrité
verify_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        print_error "Fichier de sauvegarde non trouvé: $backup_file"
        return 1
    fi
    
    print_status "Vérification de l'intégrité: $backup_file"
    
    # Test d'intégrité tar
    if tar -tzf "$backup_file" >/dev/null 2>&1; then
        print_success "Archive tar valide"
    else
        print_error "Archive tar corrompue"
        return 1
    fi
    
    # Vérifier la présence de fichiers critiques
    local critical_files=("data/fhirhub" "data/hapi-fhir")
    local missing_files=0
    
    for file in "${critical_files[@]}"; do
        if tar -tzf "$backup_file" | grep -q "^$file"; then
            print_success "Fichier critique présent: $file"
        else
            print_warning "Fichier critique manquant: $file"
            ((missing_files++))
        fi
    done
    
    if [ $missing_files -eq 0 ]; then
        print_success "Vérification d'intégrité réussie"
        return 0
    else
        print_warning "Vérification d'intégrité partielle ($missing_files fichier(s) manquant(s))"
        return 1
    fi
}

# Affichage de l'aide
show_help() {
    cat << EOF
💾 Script de Sauvegarde et Restauration FHIRHub

Usage: $0 <commande> [options]

Commandes:
  backup [type] [nom]     Créer une sauvegarde
                          Types: full, data, config, database
                          
  restore <fichier>       Restaurer une sauvegarde
  
  list                    Lister les sauvegardes disponibles
  
  rotate                  Effectuer la rotation des sauvegardes
  
  auto [type]             Sauvegarde automatique avec rotation
  
  verify <fichier>        Vérifier l'intégrité d'une sauvegarde
  
  help                    Afficher cette aide

Options:
  --force                 Forcer l'opération sans confirmation
  --backup-dir <dir>      Dossier de sauvegarde (défaut: ./backups)
  --retention <jours>     Durée de conservation (défaut: 30 jours)
  --exclude-cache         Exclure le cache des sauvegardes (défaut: true)

Variables d'environnement:
  BACKUP_DIR             Dossier de sauvegarde
  RETENTION_DAYS         Durée de conservation des sauvegardes
  COMPRESSION_LEVEL      Niveau de compression (1-9)
  EXCLUDE_CACHE          Exclure le cache (true/false)

Exemples:
  $0 backup full                    # Sauvegarde complète
  $0 backup data backup-migration   # Sauvegarde des données avec nom personnalisé
  $0 restore backups/fhirhub-full-20241216-120000.tar.gz
  $0 auto full                      # Sauvegarde automatique avec rotation
  $0 list                           # Lister les sauvegardes
EOF
}

# Fonction principale
main() {
    local command="${1:-help}"
    local force=false
    
    # Parse des options globales
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                force=true
                shift
                ;;
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --retention)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            --exclude-cache)
                EXCLUDE_CACHE="$2"
                shift 2
                ;;
            *)
                break
                ;;
        esac
    done
    
    detect_environment
    
    case "$command" in
        backup)
            local backup_type="${2:-full}"
            local backup_name="${3:-}"
            create_backup "$backup_type" "$backup_name"
            ;;
        restore)
            local backup_file="${2:-}"
            if [ -z "$backup_file" ]; then
                print_error "Fichier de sauvegarde requis"
                echo "Usage: $0 restore <fichier>"
                exit 1
            fi
            restore_backup "$backup_file" "$force"
            ;;
        list)
            list_backups
            ;;
        rotate)
            rotate_backups
            ;;
        auto)
            local backup_type="${2:-full}"
            auto_backup "$backup_type"
            ;;
        verify)
            local backup_file="${2:-}"
            if [ -z "$backup_file" ]; then
                print_error "Fichier de sauvegarde requis"
                echo "Usage: $0 verify <fichier>"
                exit 1
            fi
            verify_backup "$backup_file"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Commande inconnue: $command"
            echo "Utilisez '$0 help' pour voir les commandes disponibles"
            exit 1
            ;;
    esac
}

# Point d'entrée
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi