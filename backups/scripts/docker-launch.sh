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

# Vérifier les droits d'exécution sur les scripts
if [ ! -x "$(command -v docker)" ]; then
  echo -e "${RED}Erreur: Docker n'est pas installé ou n'est pas accessible.${NC}"
  echo -e "${YELLOW}Installez Docker pour continuer: https://docs.docker.com/get-docker/${NC}"
  exit 1
fi

# Détecter la version de Docker Compose
DOCKER_COMPOSE_CMD="docker-compose"
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE_CMD="docker compose"
  echo -e "${YELLOW}Détection: Docker Compose V2 détecté, utilisation de 'docker compose'${NC}"
else
  echo -e "${YELLOW}Détection: Docker Compose V1 détecté, utilisation de 'docker-compose'${NC}"
fi

# Donner les droits d'exécution à tous les scripts nécessaires
for script in "./docker-init-data.sh" "./docker-startup.sh" "./start-hapi-fhir.sh"; do
  if [ -f "$script" ] && [ ! -x "$script" ]; then
    echo -e "${YELLOW}Mise à jour des permissions du script $script...${NC}"
    chmod +x "$script"
  fi
done

# Initialiser la structure de données
echo -e "${YELLOW}Étape 1/3: Initialisation de la structure de données...${NC}"
bash ./docker-init-data.sh

# Arrêter les conteneurs existants
echo -e "${YELLOW}Étape 2/3: Arrêt des conteneurs existants...${NC}"
$DOCKER_COMPOSE_CMD down 2>/dev/null || echo -e "${YELLOW}Aucun conteneur à arrêter.${NC}"

# Démarrer les services
echo -e "${YELLOW}Étape 3/3: Démarrage des services...${NC}"
$DOCKER_COMPOSE_CMD up -d

if [ $? -ne 0 ]; then
  echo -e "${RED}Erreur lors du démarrage des services Docker.${NC}"
  echo -e "${YELLOW}Vérifiez que Docker est correctement installé et que vous avez les permissions suffisantes.${NC}"
  echo -e "${YELLOW}Vous pouvez lancer l'application sans Docker avec './start.sh'${NC}"
  exit 1
fi

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