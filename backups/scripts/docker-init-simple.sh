#!/bin/bash

# Script d'initialisation simplifié pour FHIRHub
# Ce script crée la structure de répertoires pour le système

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Fonction pour afficher des messages
echo_step() {
  echo -e "${BLUE}=====================================================================${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}=====================================================================${NC}"
}

echo_step "Initialisation de l'environnement pour FHIRHub"

# Vérifier les privilèges d'administration
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}Note: Ce script n'est pas exécuté en tant qu'administrateur.${NC}"
  echo -e "${YELLOW}Certaines opérations pourraient nécessiter des droits d'administration.${NC}"
  if command -v sudo &> /dev/null; then
    echo -e "${YELLOW}Vous pouvez relancer le script avec sudo si nécessaire.${NC}"
  fi
fi

# Création des répertoires pour le système
echo_step "Création des répertoires pour le système"

# Création des répertoires standards avec une structure simplifiée
mkdir -p data/db
mkdir -p data/app_data
mkdir -p data/logs
mkdir -p data/backups
mkdir -p data/french_terminology

# Ajuster les permissions (plus permissif pour le développement)
echo -e "${BLUE}Configuration des permissions...${NC}"

# Permissions génériques pour les dossiers
chmod -R 777 data/

# Si nous sommes sur un système avec Docker installé, ajuster les permissions
if [ -e /var/run/docker.sock ]; then
  echo -e "${BLUE}Configuration des permissions pour le socket Docker...${NC}"
  chmod 666 /var/run/docker.sock 2>/dev/null || echo -e "${YELLOW}Vous devrez peut-être exécuter cette commande avec sudo: sudo chmod 666 /var/run/docker.sock${NC}"
fi

# Rendre le script exécutable
chmod +x docker-init-simple.sh

echo_step "Initialisation de l'environnement terminée"
echo -e "${GREEN}✓ Structure de répertoires créée${NC}"
echo -e "${GREEN}✓ Permissions configurées${NC}"

# Instructions finales
echo -e "${BLUE}=====================================================================${NC}"
echo -e "${YELLOW}Pour démarrer le service, exécutez:${NC}"
echo -e "${YELLOW}docker-compose up -d${NC}"
echo -e "${BLUE}=====================================================================${NC}"