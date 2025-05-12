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

# Création du dossier principal data
echo -e "${YELLOW}Création du dossier principal data...${NC}"
mkdir -p data

# Structure de données pour FHIRHub
echo -e "${YELLOW}Création de la structure pour FHIRHub...${NC}"
mkdir -p data/fhirhub/db          # Base de données SQLite
mkdir -p data/fhirhub/storage/conversions    # Conversions HL7 vers FHIR
mkdir -p data/fhirhub/storage/cache          # Cache des requêtes
mkdir -p data/fhirhub/storage/ai_responses   # Réponses des modèles d'IA
mkdir -p data/fhirhub/storage/history        # Historique des conversions
mkdir -p data/fhirhub/storage/outputs        # Sorties des conversions
mkdir -p data/fhirhub/storage/test           # Données de test
mkdir -p data/fhirhub/logs                   # Journaux d'application
mkdir -p data/fhirhub/terminology            # Terminologies (française, etc.)
mkdir -p data/fhirhub/backups                # Sauvegardes

# Structure de données pour HAPI FHIR
echo -e "${YELLOW}Création de la structure pour HAPI FHIR...${NC}"
mkdir -p data/hapifhir

# Dossiers partagés pour l'import et l'export de données
echo -e "${YELLOW}Création des dossiers d'échange de données...${NC}"
mkdir -p import
mkdir -p export

# Définition des bonnes permissions pour éviter les problèmes d'accès
echo -e "${YELLOW}Configuration des permissions...${NC}"
chmod -R 777 data import export

# Vérification de la structure des données créée
echo -e "${GREEN}✓ Structure de données initialisée avec succès !${NC}"

# Préparation pour les volumes Docker
echo -e "${YELLOW}Préparation des volumes Docker...${NC}"

# Création du fichier .env pour Docker si nécessaire
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}Création du fichier .env pour Docker...${NC}"
  cat > .env << EOF
# Variables d'environnement pour Docker
# Généré automatiquement par docker-init-data.sh

# Chemins pour les volumes Docker
VOLUME_FHIRHUB_DB=$(pwd)/data/fhirhub/db
VOLUME_FHIRHUB_STORAGE=$(pwd)/data/fhirhub/storage
VOLUME_FHIRHUB_LOGS=$(pwd)/data/fhirhub/logs
VOLUME_FHIRHUB_TERMINOLOGY=$(pwd)/data/fhirhub/terminology
VOLUME_HAPIFHIR=$(pwd)/data/hapifhir

# Ports à exposer
PORT_FHIRHUB=5000
PORT_HAPIFHIR=8080

# Autres paramètres
SESSION_SECRET=fhirhub_production_secure_session_key
EOF
  echo -e "${GREEN}✓ Fichier .env créé avec succès${NC}"
fi

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${YELLOW}Structure des données :${NC}"
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
echo -e "${GREEN}✓ Structure de données prête pour le déploiement Docker${NC}"
echo -e "${GREEN}✓ Exécutez './docker-launch.sh' pour démarrer les services${NC}"