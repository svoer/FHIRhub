#!/bin/bash

# Script de nettoyage des fichiers temporaires et assets
# Ce script supprime les fichiers temporaires, logs et ressources non nécessaires

# Définir les couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}     Nettoyage des fichiers temporaires et ressources inutilisées     ${NC}"
echo -e "${BLUE}=====================================================================${NC}"

# Supprimer les réponses IA stockées
echo -e "${YELLOW}Suppression des réponses IA stockées...${NC}"
rm -rf storage/data/ai_responses/* 2>/dev/null
mkdir -p storage/data/ai_responses
touch storage/data/ai_responses/.gitkeep

# Supprimer les fichiers temporaires dans attached_assets
echo -e "${YELLOW}Suppression des assets attachés...${NC}"
rm -rf attached_assets/* 2>/dev/null
mkdir -p attached_assets
touch attached_assets/.gitkeep

# Supprimer les fichiers de cache
echo -e "${YELLOW}Suppression des fichiers de cache...${NC}"
rm -rf storage/data/cache/* 2>/dev/null
mkdir -p storage/data/cache
touch storage/data/cache/.gitkeep

# Vider les fichiers temporaires de conversion
echo -e "${YELLOW}Nettoyage des logs de conversion...${NC}"
find ./logs/conversions -type f -not -name ".gitkeep" -delete 2>/dev/null

# Supprimer les scripts de nettoyage temporaires
echo -e "${YELLOW}Suppression des scripts de nettoyage temporaires...${NC}"
rm -f clean-*-backup.sh 2>/dev/null
rm -f clean-repo-manual.sh 2>/dev/null
rm -f _clean-* 2>/dev/null

# Supprimer les logs temporaires
echo -e "${YELLOW}Suppression des logs temporaires...${NC}"
find . -name "*.log" -type f -not -path "./hapi-fhir/hapi-fhir-server.log" -delete 2>/dev/null

# Supprimer les fichiers temporaires IN/OUT
echo -e "${YELLOW}Suppression des fichiers temporaires IN/OUT...${NC}"
find . -name "*_IN_*" -o -name "*_OUT_*" -type f -delete 2>/dev/null

# Récapitulatif
echo -e "${GREEN}✓ Nettoyage terminé!${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${YELLOW}Dossiers nettoyés:${NC}"
echo -e "${YELLOW}- storage/data/ai_responses/${NC}"
echo -e "${YELLOW}- attached_assets/${NC}"
echo -e "${YELLOW}- storage/data/cache/${NC}"
echo -e "${YELLOW}- logs/conversions/${NC}"
echo -e "${YELLOW}- Fichiers temporaires divers (IN/OUT, logs)${NC}"
echo -e "${CYAN}=====================================================================${NC}"

exit 0