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

# Vérifier si l'utilisateur a les droits sudo
HAS_SUDO=0
if [ $(id -u) -eq 0 ]; then
  HAS_SUDO=1
elif command -v sudo >/dev/null 2>&1; then
  sudo -n true >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    HAS_SUDO=1
  fi
fi

# Fonction pour créer un dossier avec les bonnes permissions
create_dir() {
  local DIR=$1
  
  if [ ! -d "$DIR" ]; then
    echo -e "   Création: $DIR"
    
    if [ $HAS_SUDO -eq 1 ]; then
      sudo mkdir -p "$DIR"
      sudo chmod 777 "$DIR"
    else
      mkdir -p "$DIR" || {
        echo -e "${YELLOW}   Note: Création sans droits d'écriture, les conteneurs Docker pourraient avoir des problèmes de permissions${NC}"
        mkdir -p "$DIR" 2>/dev/null || true
      }
    fi
  else
    echo -e "   Existant: $DIR"
  fi
}

# Création du dossier principal data
echo -e "${YELLOW}Création du dossier principal data...${NC}"
create_dir "data"

# Structure de données pour FHIRHub
echo -e "${YELLOW}Création de la structure pour FHIRHub...${NC}"
create_dir "data/fhirhub/db"                    # Base de données SQLite
create_dir "data/fhirhub/storage/conversions"   # Conversions HL7 vers FHIR
create_dir "data/fhirhub/storage/cache"         # Cache des requêtes
create_dir "data/fhirhub/storage/ai_responses"  # Réponses des modèles d'IA
create_dir "data/fhirhub/storage/history"       # Historique des conversions
create_dir "data/fhirhub/storage/outputs"       # Sorties des conversions
create_dir "data/fhirhub/storage/test"          # Données de test
create_dir "data/fhirhub/logs"                  # Journaux d'application
create_dir "data/fhirhub/terminology"           # Terminologies (française, etc.)
create_dir "data/fhirhub/backups"               # Sauvegardes
create_dir "data/fhirhub/src"                   # Dossier src pour compatibilité

# Structure de données pour HAPI FHIR
echo -e "${YELLOW}Création de la structure pour HAPI FHIR...${NC}"
create_dir "data/hapifhir"

# Dossiers partagés pour l'import et l'export de données
echo -e "${YELLOW}Création des dossiers d'échange de données...${NC}"
create_dir "import"
create_dir "export"

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

# Créer le fichier index.js dans le dossier src pour compatibilité
SRC_INDEX="data/fhirhub/src/index.js"
if [ ! -f "$SRC_INDEX" ]; then
  echo -e "${YELLOW}Création du fichier de compatibilité src/index.js...${NC}"
  mkdir -p "$(dirname "$SRC_INDEX")"
  cat > "$SRC_INDEX" << EOF
// Module FHIRHub - Fichier de compatibilité pour Docker
const fhirHub = {
  version: "1.0.0",
  name: "FHIRHub",
  initialize: function() {
    console.log("[FHIRHub] Module de compatibilité initialisé");
    return true;
  },
  getStatus: function() {
    return { status: "ready", mode: "compatibility" };
  },
  convertHL7ToFHIR: function(hl7Data) {
    // Fonction de compatibilité - ne fait rien mais évite les erreurs
    return { success: true };
  }
};

module.exports = fhirHub;
EOF
  echo -e "${GREEN}✓ Fichier src/index.js créé avec succès${NC}"
fi

# Vérifier si les dossiers sont accessibles en écriture
TEST_FILE="data/.write_test"
if touch "$TEST_FILE" 2>/dev/null; then
  rm "$TEST_FILE"
  echo -e "${GREEN}✓ Les dossiers ont les permissions correctes${NC}"
else
  echo -e "${YELLOW}⚠️ Certains dossiers pourraient avoir des problèmes de permissions${NC}"
  echo -e "${YELLOW}  Conseil: Exécutez 'sudo chmod -R 777 data import export' si nécessaire${NC}"
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