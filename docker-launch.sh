#!/bin/bash

# Script de lancement en un clic pour l'architecture Docker
# Ce script initialise les données et lance les services

# Définir les couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}     Démarrage de l'architecture Docker FHIRHub (services séparés)   ${NC}"
echo -e "${BLUE}=====================================================================${NC}"

# Initialiser la structure de données
echo -e "${YELLOW}Étape 1/3: Initialisation de la structure de données...${NC}"
./docker-init-data.sh

# Arrêter les conteneurs existants
echo -e "${YELLOW}Étape 2/3: Arrêt des conteneurs existants...${NC}"
docker-compose down

# Démarrer les services
echo -e "${YELLOW}Étape 3/3: Démarrage des services...${NC}"
docker-compose up -d

echo -e "${GREEN}✓ Démarrage terminé !${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${GREEN}Services disponibles :${NC}"
echo -e "${GREEN}   ✓ FHIRHub : http://localhost:5000${NC}"
echo -e "${GREEN}   ✓ HAPI FHIR : http://localhost:8080/fhir${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${YELLOW}Pour suivre les logs :${NC}"
echo -e "${YELLOW}   - FHIRHub   : docker logs -f fhirhub${NC}"
echo -e "${YELLOW}   - HAPI FHIR : docker logs -f fhirhub-hapi${NC}"
echo -e "${CYAN}=====================================================================${NC}"