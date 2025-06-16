#!/bin/bash

# Script pour sauvegarder les données FHIRHub avant un redémarrage Docker
# À exécuter AVANT docker-compose down

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Définir le dossier de sauvegarde
BACKUP_DIR="./volumes/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

echo -e "${BLUE}=== Sauvegarde des données FHIRHub avant redémarrage Docker ===${NC}"

# Vérification si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker n'est pas en cours d'exécution. Veuillez démarrer Docker.${NC}"
  exit 1
fi

# Vérification si le conteneur FHIRHub est en cours d'exécution
if ! docker ps | grep -q fhirhub; then
  echo -e "${RED}Erreur: Conteneur FHIRHub non trouvé. Veuillez démarrer les conteneurs.${NC}"
  exit 1
fi

echo -e "${YELLOW}Sauvegarde de la base de données SQLite...${NC}"
# Copier la base de données depuis le conteneur
docker exec fhirhub cp /app/storage/db/fhirhub.db /app/storage/db/fhirhub.db.bak
# Puis copier la sauvegarde localement
docker cp fhirhub:/app/storage/db/fhirhub.db.bak $BACKUP_DIR/fhirhub.db

# Vérifier si la sauvegarde a réussi
if [ -f "$BACKUP_DIR/fhirhub.db" ]; then
  echo -e "${GREEN}✓ Base de données sauvegardée avec succès${NC}"
else
  echo -e "${RED}× Échec de la sauvegarde de la base de données${NC}"
  exit 1
fi

echo -e "${YELLOW}Sauvegarde des données applicatives...${NC}"
# Sauvegarder les dossiers de données
docker exec fhirhub tar -czf /app/storage/backups/data_backup.tar.gz /app/storage/data
docker cp fhirhub:/app/storage/backups/data_backup.tar.gz $BACKUP_DIR/

# Vérifier si la sauvegarde a réussi
if [ -f "$BACKUP_DIR/data_backup.tar.gz" ]; then
  echo -e "${GREEN}✓ Données applicatives sauvegardées avec succès${NC}"
else
  echo -e "${RED}× Échec de la sauvegarde des données applicatives${NC}"
  exit 1
fi

echo -e "${GREEN}Sauvegarde terminée avec succès !${NC}"
echo -e "${BLUE}Emplacement de la sauvegarde : ${BACKUP_DIR}${NC}"
echo -e ""
echo -e "${YELLOW}Vous pouvez maintenant arrêter Docker en toute sécurité avec :${NC}"
echo -e "  docker-compose down"
echo -e ""
echo -e "${YELLOW}Pour restaurer cette sauvegarde après redémarrage, utilisez :${NC}"
echo -e "  ./restore-docker-data.sh ${BACKUP_DIR}"