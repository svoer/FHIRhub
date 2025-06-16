#!/bin/bash

# Script de réinitialisation des statistiques et des données de conversion
# Ce script vide les dossiers de résultats de conversion et réinitialise les statistiques dans la base de données

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variable pour auto-confirmer toutes les actions
AUTO_CONFIRM=false

# Vérifier si l'option -y est utilisée
if [[ "$1" == "-y" ]]; then
    AUTO_CONFIRM=true
fi

# Fonction pour afficher un message de confirmation et demander à l'utilisateur de confirmer
confirm() {
    if [ "$AUTO_CONFIRM" = true ]; then
        return 0
    fi
    
    read -p "$(echo -e "${YELLOW}$1 [y/N] ${NC}")" response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Vérifier si le script est exécuté avec les droits d'administrateur
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${YELLOW}Note: Ce script peut nécessiter des droits d'administrateur pour accéder à certains fichiers.${NC}"
    echo -e "${YELLOW}Si vous rencontrez des erreurs de permission, relancez-le avec sudo.${NC}"
    echo ""
fi

echo -e "${BLUE}=== Script de réinitialisation des données FHIRHub ===${NC}"
echo -e "${YELLOW}ATTENTION: Ce script va supprimer toutes les données de conversion et réinitialiser les statistiques.${NC}"
echo -e "${YELLOW}Cette action est irréversible. Assurez-vous d'avoir sauvegardé toutes les données importantes.${NC}"
echo ""

# Demander confirmation avant de poursuivre
if ! confirm "Êtes-vous sûr de vouloir réinitialiser toutes les données de conversion et les statistiques?"; then
    echo -e "${BLUE}Opération annulée.${NC}"
    exit 0
fi

echo -e "\n${BLUE}=== Réinitialisation des dossiers de données de conversion ===${NC}"

# Vérifier si les dossiers existent avant de les vider
echo "Nettoyage des dossiers de données..."

# Fonction pour vider un dossier tout en préservant sa structure
clean_directory() {
    local dir=$1
    if [ -d "$dir" ]; then
        echo -e "${GREEN}Nettoyage du dossier $dir${NC}"
        find "$dir" -type f -not -path "*/\.*" -delete
        echo -e "${GREEN}✓ Dossier $dir vidé avec succès${NC}"
    else
        echo -e "${YELLOW}Le dossier $dir n'existe pas, ignoré${NC}"
    fi
}

# Nettoyer les dossiers de données
clean_directory "./data/conversions"
clean_directory "./data/history"
clean_directory "./data/outputs"

echo -e "\n${BLUE}=== Réinitialisation de la base de données ===${NC}"

DB_PATH="./storage/db/fhirhub.db"

# Vérifier si la base de données existe
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}Erreur: La base de données $DB_PATH n'existe pas.${NC}"
    exit 1
fi

# Vérifier si sqlite3 est installé
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}Erreur: sqlite3 n'est pas installé. Installez-le pour réinitialiser la base de données.${NC}"
    exit 1
fi

echo "Réinitialisation des statistiques dans la base de données..."

# Sauvegarder la base de données avant modification
BACKUP_PATH="./storage/db/fhirhub_backup_$(date +%Y%m%d_%H%M%S).db"
cp "$DB_PATH" "$BACKUP_PATH"
echo -e "${GREEN}✓ Sauvegarde de la base de données créée: $BACKUP_PATH${NC}"

# Réinitialiser les tables de la base de données
sqlite3 "$DB_PATH" <<EOF
DELETE FROM conversion_logs;
DELETE FROM api_activity_logs;
DELETE FROM system_logs WHERE event_type = 'conversion';
UPDATE api_usage_limits SET current_daily_usage = 0, current_monthly_usage = 0;
VACUUM;
EOF

echo -e "${GREEN}✓ Tables de la base de données réinitialisées avec succès${NC}"

echo -e "\n${BLUE}=== Réinitialisation terminée ===${NC}"
echo -e "${GREEN}Toutes les données de conversion et statistiques ont été réinitialisées avec succès.${NC}"
echo -e "${GREEN}Le système est prêt pour de nouvelles conversions.${NC}"

# Vérifier si l'application est en cours d'exécution
if pgrep -f "node.*app.js" > /dev/null || pgrep -f "node.*server.js" > /dev/null; then
    echo -e "\n${YELLOW}Note: L'application FHIRHub semble être en cours d'exécution.${NC}"
    echo -e "${YELLOW}Il est recommandé de la redémarrer pour que les changements soient pris en compte.${NC}"
    
    if confirm "Voulez-vous redémarrer l'application maintenant?"; then
        # Redémarrer le service si systemd est utilisé
        if systemctl is-active --quiet fhirhub.service; then
            echo "Redémarrage du service systemd fhirhub..."
            sudo systemctl restart fhirhub.service
            echo -e "${GREEN}✓ Service FHIRHub redémarré${NC}"
        # Sinon, suggérer un redémarrage manuel
        else
            echo -e "${YELLOW}Veuillez redémarrer l'application manuellement pour appliquer les changements.${NC}"
        fi
    fi
fi

exit 0