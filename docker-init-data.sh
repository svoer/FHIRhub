#!/bin/bash

# Script d'initialisation de la structure de données pour Docker
# Ce script crée la structure de dossiers nécessaire au bon fonctionnement
# de l'architecture Docker avec services séparés

# Définir les couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}     Initialisation de l'architecture de données pour Docker         ${NC}"
echo -e "${BLUE}=====================================================================${NC}"

# Créer le dossier racine data
echo -e "${YELLOW}Création du dossier racine data...${NC}"
mkdir -p data

# Créer la structure pour FHIRHub
echo -e "${YELLOW}Création de la structure pour FHIRHub...${NC}"
mkdir -p data/fhirhub/db
mkdir -p data/fhirhub/storage/conversions
mkdir -p data/fhirhub/storage/cache
mkdir -p data/fhirhub/storage/ai_responses
mkdir -p data/fhirhub/storage/history
mkdir -p data/fhirhub/storage/outputs
mkdir -p data/fhirhub/storage/test
mkdir -p data/fhirhub/logs
mkdir -p data/fhirhub/terminology
mkdir -p data/fhirhub/backups

# Créer la structure pour HAPI FHIR
echo -e "${YELLOW}Création de la structure pour HAPI FHIR...${NC}"
mkdir -p data/hapifhir

# Définir les bonnes permissions
echo -e "${YELLOW}Définition des permissions...${NC}"
chmod -R 777 data

# Créer les dossiers import/export
echo -e "${YELLOW}Création des dossiers d'import/export...${NC}"
mkdir -p import
mkdir -p export
chmod -R 777 import export

echo -e "${GREEN}✓ Structure de données initialisée avec succès !${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${YELLOW}Structure des dossiers :${NC}"
echo -e "${YELLOW}data/                       # Dossier racine${NC}"
echo -e "${YELLOW}├── fhirhub/                # Données FHIRHub${NC}"
echo -e "${YELLOW}│   ├── db/                 # Base de données SQLite${NC}"
echo -e "${YELLOW}│   ├── storage/            # Stockage des données${NC}"
echo -e "${YELLOW}│   ├── logs/               # Journaux${NC}"
echo -e "${YELLOW}│   ├── terminology/        # Terminologies${NC}"
echo -e "${YELLOW}│   └── backups/            # Sauvegardes${NC}"
echo -e "${YELLOW}├── hapifhir/               # Données HAPI FHIR${NC}"
echo -e "${YELLOW}import/                     # Dossier d'importation${NC}"
echo -e "${YELLOW}export/                     # Dossier d'exportation${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${GREEN}Prêt pour 'docker-compose up' !${NC}"