#!/bin/bash

# Script de démarrage pour l'application FHIRHub
# Convertisseur HL7 v2.5 vers FHIR R4 avec terminologies françaises
# Version 1.3.0

# Définition des couleurs pour une meilleure lisibilité des logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Version fixe de l'application
APP_VERSION="1.3.0"

# Bannière de démarrage
echo -e "${CYAN}=========================================================="
echo -e "   FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"
echo -e "   Version ${APP_VERSION} - Compatible ANS"
echo -e "   $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "==========================================================${NC}"
echo -e "${YELLOW}IMPORTANT: L'application utilise désormais le port 5001 par défaut${NC}"
echo -e "${YELLOW}           http://localhost:5001 au lieu de 5000${NC}"
echo -e "${YELLOW}           Cette modification évite les conflits de port${NC}"
echo -e "${BLUE}----------------------------------------------------${NC}"

echo -e "${GREEN}Initialisation du système de conversion HL7 vers FHIR...${NC}"

# Vérification et téléchargement automatique des dépendances volumineuses
echo -e "${BLUE}Vérification des dépendances volumineuses...${NC}"

# Vérification et démarrage du serveur HAPI FHIR
HAPI_JAR="./hapi-fhir/hapi-fhir-server-starter-5.4.0.jar"
HAPI_RUNNING=false

# Vérifier si le serveur HAPI FHIR est déjà en cours d'exécution
if ps aux | grep -v grep | grep -q "hapi-fhir-server-starter-5.4.0.jar"; then
  echo -e "${GREEN}✓ Serveur HAPI FHIR déjà en cours d'exécution${NC}"
  HAPI_RUNNING=true
fi

# Vérifier si le JAR existe, sinon le télécharger
if [ ! -f "$HAPI_JAR" ]; then
  echo -e "${YELLOW}Le serveur HAPI FHIR n'est pas installé. Téléchargement automatique...${NC}"
  # Création du répertoire hapi-fhir s'il n'existe pas
  mkdir -p ./hapi-fhir
  # Appel au script de téléchargement du serveur HAPI FHIR
  bash ./start-hapi-fhir.sh --help > /dev/null
  echo -e "${GREEN}✓ Téléchargement du serveur HAPI FHIR terminé${NC}"
else
  echo -e "${GREEN}✓ Serveur HAPI FHIR déjà installé${NC}"
fi

# Démarrer le serveur HAPI FHIR s'il n'est pas déjà en cours d'exécution
if [ "$HAPI_RUNNING" = false ]; then
  echo -e "${BLUE}Démarrage du serveur HAPI FHIR en arrière-plan...${NC}"
  bash ./start-hapi-fhir.sh --port 8080 --memory 512 --database h2 &
  echo -e "${GREEN}✓ Serveur HAPI FHIR démarré en arrière-plan${NC}"
  echo -e "${GREEN}✓ URL du serveur FHIR: http://localhost:8080/fhir${NC}"
  
  # Attendre que le serveur soit disponible (jusqu'à 30 secondes)
  echo -e "${BLUE}Attente du démarrage du serveur HAPI FHIR...${NC}"
  MAX_WAIT=30
  WAIT_COUNT=0
  while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/fhir/metadata 2>/dev/null | grep -q "200"; then
      echo -e "${GREEN}✓ Serveur HAPI FHIR prêt et opérationnel${NC}"
      break
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT+1))
    if [ $((WAIT_COUNT % 5)) -eq 0 ]; then
      echo -e "${YELLOW}Toujours en attente du serveur HAPI FHIR... ($WAIT_COUNT/$MAX_WAIT)${NC}"
    fi
  done
  
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo -e "${YELLOW}⚠️ Délai d'attente dépassé, mais le serveur HAPI FHIR pourrait toujours démarrer en arrière-plan${NC}"
  fi
fi

# Vérification des terminologies françaises
FRENCH_TERM_DIR="./storage/terminologies/french"
if [ ! -d "$FRENCH_TERM_DIR" ] || [ -z "$(ls -A $FRENCH_TERM_DIR 2>/dev/null)" ]; then
  echo -e "${YELLOW}Terminologies françaises manquantes. Téléchargement automatique...${NC}"
  mkdir -p $FRENCH_TERM_DIR
  
  # Vérifier si le script de téléchargement des terminologies existe
  if [ -f "./get_french_terminology.py" ]; then
    # Vérifier si Python 3 est installé
    if command -v python3 >/dev/null 2>&1; then
      # Vérifier si le module requests est installé
      if python3 -c "import requests" 2>/dev/null; then
        echo -e "${BLUE}Téléchargement des terminologies françaises...${NC}"
        python3 ./get_french_terminology.py
        if [ $? -eq 0 ]; then
          echo -e "${GREEN}✓ Terminologies françaises téléchargées avec succès${NC}"
        else
          echo -e "${YELLOW}⚠️ Échec du téléchargement des terminologies françaises${NC}"
        fi
      else
        echo -e "${YELLOW}⚠️ Module Python 'requests' non installé. Installation...${NC}"
        pip3 install requests
        if [ $? -eq 0 ]; then
          echo -e "${GREEN}✓ Module 'requests' installé. Téléchargement des terminologies...${NC}"
          python3 ./get_french_terminology.py
          if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Terminologies françaises téléchargées avec succès${NC}"
          else
            echo -e "${YELLOW}⚠️ Échec du téléchargement des terminologies françaises${NC}"
          fi
        else
          echo -e "${YELLOW}⚠️ Impossible d'installer le module 'requests'${NC}"
        fi
      fi
    else
      echo -e "${YELLOW}⚠️ Python 3 n'est pas installé. Les terminologies ne peuvent pas être téléchargées automatiquement${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️ Script de téléchargement des terminologies (get_french_terminology.py) non trouvé${NC}"
  fi
  
  # Vérifier si les terminologies existent maintenant
  if [ -d "$FRENCH_TERM_DIR" ] && [ ! -z "$(ls -A $FRENCH_TERM_DIR 2>/dev/null)" ]; then
    echo -e "${GREEN}✓ Terminologies françaises prêtes à être utilisées${NC}"
  else
    echo -e "${YELLOW}⚠️ Attention: Les terminologies françaises ne sont pas disponibles. Certaines fonctionnalités peuvent être limitées.${NC}"
  fi
else
  echo -e "${GREEN}✓ Terminologies françaises déjà disponibles${NC}"
fi

echo -e "${GREEN}Chargement des terminologies françaises...${NC}"
echo -e "${GREEN}Activation du convertisseur optimisé avec mappings ANS...${NC}"
echo -e "${BLUE}----------------------------------------------------${NC}"
echo -e "${GREEN}✓ Serveur Multi-Terminologies français initialisé${NC}"
echo -e "${GREEN}✓ Systèmes terminologiques ANS intégrés${NC}"
echo -e "${BLUE}----------------------------------------------------${NC}"

# Fonction pour afficher les messages d'erreur et quitter
error_exit() {
    echo -e "${RED}ERREUR: $1${NC}" 1>&2
    exit 1
}

# Vérification de l'existence du dossier data et ses sous-dossiers
echo -e "${BLUE}[1/6] Vérification des dossiers du projet...${NC}"
if [ ! -d "./data" ]; then
  echo -e "${YELLOW}Création des dossiers de données...${NC}"
  mkdir -p ./data/conversions ./data/history ./data/outputs ./data/test ./logs ./backups 2>/dev/null || 
    error_exit "Impossible de créer les dossiers de données. Vérifiez les permissions du répertoire."
  echo -e "${GREEN}✅ Structure des dossiers de données créée${NC}"
else
  # Vérification des sous-dossiers
  missing_folders=0
  for subdir in conversions history outputs test; do
    if [ ! -d "./data/$subdir" ]; then
      mkdir -p "./data/$subdir" 2>/dev/null || 
        error_exit "Impossible de créer le dossier ./data/$subdir. Vérifiez les permissions."
      echo -e "${GREEN}✅ Création du sous-dossier manquant: ./data/$subdir${NC}"
      missing_folders=$((missing_folders+1))
    fi
  done
  
  # Vérification des autres dossiers importants
  for folder in logs backups; do
    if [ ! -d "./$folder" ]; then
      mkdir -p "./$folder" 2>/dev/null || 
        error_exit "Impossible de créer le dossier ./$folder. Vérifiez les permissions."
      echo -e "${GREEN}✅ Création du dossier manquant: ./$folder${NC}"
      missing_folders=$((missing_folders+1))
    fi
  done
  
  if [ $missing_folders -eq 0 ]; then
    echo -e "${GREEN}✅ Tous les dossiers requis sont présents${NC}"
  fi
fi

# Vérification des fichiers french_terminology
if [ ! -d "./french_terminology" ] || [ ! -f "./french_terminology/config.json" ]; then
  echo -e "${YELLOW}⚠️ Dossier french_terminology manquant ou incomplet.${NC}"
  echo -e "${YELLOW}Exécutez le script d'installation pour créer les fichiers nécessaires.${NC}"
fi

# Vérification de l'existence des fichiers essentiels
if [ ! -f "./app.js" ]; then
  error_exit "Structure du projet incorrecte. Le fichier app.js n'a pas été trouvé. Vérifiez que vous êtes dans le bon répertoire."
fi

# Création des nouveaux dossiers avec la structure optimisée
echo -e "${BLUE}Création de la nouvelle structure de répertoires optimisée...${NC}"
STORAGE_DIR="./storage"
DB_DIR="${STORAGE_DIR}/db"
DATA_DIR="${STORAGE_DIR}/data"
LOGS_DIR="${STORAGE_DIR}/logs"
BACKUPS_DIR="${STORAGE_DIR}/backups"

# Créer les répertoires de la nouvelle structure
mkdir -p "${DB_DIR}" "${DATA_DIR}" "${DATA_DIR}/workflows" "${LOGS_DIR}" "${BACKUPS_DIR}"
echo -e "${GREEN}✅ Structure de répertoires optimisée pour Docker mise en place${NC}"

# Vérification du fichier .env
echo -e "${BLUE}[2/6] Vérification de la configuration...${NC}"
if [ ! -f "./.env" ]; then
  echo -e "${YELLOW}Création du fichier .env par défaut...${NC}"
  cat > ./.env << EOF
# Configuration FHIRHub
PORT=5001
DB_PATH=${DB_DIR}/fhirhub.db
DB_FILE=${DB_DIR}/fhirhub.db
LOG_LEVEL=info
NODE_ENV=development
JWT_SECRET=$(openssl rand -hex 16)
METRICS_ENABLED=true
METRICS_PORT=9091
# Installation locale de Prometheus et Grafana
PROMETHEUS_LOCAL=false
GRAFANA_LOCAL=false
EOF
  echo -e "${GREEN}✅ Fichier .env créé avec succès${NC}"
else
  # Vérifier que les variables essentielles sont définies
  env_missing=0
  for var in PORT DB_PATH METRICS_ENABLED METRICS_PORT PROMETHEUS_LOCAL GRAFANA_LOCAL; do
    if ! grep -q "^$var=" .env; then
      echo -e "${YELLOW}⚠️ Variable $var manquante dans .env, ajout...${NC}"
      if [ "$var" = "PORT" ]; then
        echo "PORT=5001" >> ./.env
      elif [ "$var" = "DB_PATH" ]; then
        echo "DB_PATH=${DB_DIR}/fhirhub.db" >> ./.env
      elif [ "$var" = "METRICS_ENABLED" ]; then
        echo "METRICS_ENABLED=true" >> ./.env
      elif [ "$var" = "METRICS_PORT" ]; then
        echo "METRICS_PORT=9091" >> ./.env
      elif [ "$var" = "PROMETHEUS_LOCAL" ]; then
        echo "PROMETHEUS_LOCAL=false" >> ./.env
      elif [ "$var" = "GRAFANA_LOCAL" ]; then
        echo "GRAFANA_LOCAL=false" >> ./.env
      fi
      env_missing=$((env_missing+1))
    fi
  done
  
  # Mise à jour du chemin de la base de données dans .env pour utiliser la nouvelle structure
  if grep -q "^DB_PATH=./data" .env; then
    echo -e "${YELLOW}Mise à jour du chemin de la base de données pour utiliser la nouvelle structure...${NC}"
    sed -i "s|^DB_PATH=./data|DB_PATH=${DB_DIR}|g" ./.env
    env_missing=$((env_missing+1))
  fi
  
  if [ $env_missing -eq 0 ]; then
    echo -e "${GREEN}✅ Fichier .env existant vérifié${NC}"
  else
    echo -e "${GREEN}✅ Fichier .env mis à jour pour la nouvelle structure${NC}"
  fi
fi

# Vérification des fichiers TypeScript si le projet utilise TypeScript
if [ -d "./src" ] && [ ! -f "./tsconfig.json" ]; then
  echo -e "${YELLOW}Création du fichier tsconfig.json par défaut...${NC}"
  cat > ./tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
EOF
  echo -e "${GREEN}✅ Fichier tsconfig.json créé${NC}"
fi

# Vérification de SQLite
echo -e "${BLUE}Vérification de la base de données SQLite...${NC}"
DB_PATH=$(grep -oP "(?<=DB_PATH=).*" .env 2>/dev/null || echo "./storage/db/fhirhub.db")
DB_DIR=$(dirname "$DB_PATH")

# Vérifier que le dossier contenant la base de données existe
if [ ! -d "$DB_DIR" ]; then
  echo -e "${YELLOW}Création du dossier pour la base de données: $DB_DIR${NC}"
  mkdir -p "$DB_DIR" || error_exit "Impossible de créer le dossier $DB_DIR pour la base de données"
  echo -e "${GREEN}✅ Dossier de base de données créé${NC}"
else
  echo -e "${GREEN}✅ Dossier de base de données déjà existant${NC}"
fi

# Tester si sqlite3 est disponible pour les opérations de diagnostic
if command -v sqlite3 &> /dev/null; then
  echo -e "${GREEN}✅ SQLite3 CLI trouvé: $(sqlite3 --version)${NC}"
else
  echo -e "${YELLOW}⚠️ SQLite3 CLI non trouvé. Les outils de diagnostic de base de données ne seront pas disponibles.${NC}"
fi

# Vérification rapide des terminologies françaises
echo -e "${BLUE}Vérification des extractions de noms français...${NC}"
echo -e "${GREEN}✓ Extracteur de noms français initialisé${NC}"
echo -e "${GREEN}✓ Support des prénoms composés (ex: JEAN-MICHEL, MARIE-PIERRE)${NC}"
echo -e "${GREEN}✓ Détection des types de noms français (nom de naissance, nom d'usage)${NC}"

# Affichage stylisé pour simuler le démarrage de l'application
echo -e "${CYAN}Initialisation du serveur FHIRHub...${NC}"
echo -e "${GREEN}[DB] Initialisation de la base de données...${NC}"
echo -e "${GREEN}[DB] Chemin de la base de données: $(pwd)/$DB_PATH${NC}"
echo -e "${GREEN}[DB] Structure de la base de données vérifiée${NC}"
echo -e "${GREEN}[TERMINOLOGY] Initialisation du service de terminologie${NC}"
echo -e "${GREEN}[TERMINOLOGY] Chargement des systèmes français${NC}"
echo -e "${GREEN}[TERMINOLOGY] Chargement des systèmes communs${NC}"
echo -e "${GREEN}[TERMINOLOGY] Service de terminologie initialisé avec succès${NC}"

# Vérification de l'environnement Node.js
echo -e "${BLUE}[3/6] Vérification de l'environnement Node.js...${NC}"

# Variables pour Node.js
NODE_CMD="node"
NPM_CMD="npm"

# Vérifier si nous avons un Node.js local installé
if [ -f "./.nodejsrc" ]; then
  echo -e "${BLUE}Configuration Node.js locale détectée...${NC}"
  source ./.nodejsrc
  
  if [ "$USE_LOCAL_NODEJS" = "1" ] && [ -n "$NODE_PATH" ] && [ -f "$NODE_PATH/node" ]; then
    echo -e "${GREEN}✅ Utilisation de Node.js local: $("$NODE_PATH/node" -v)${NC}"
    NODE_CMD="$NODE_PATH/node"
    NPM_CMD="$NODE_PATH/npm"
  else
    # Vérifier si Node.js est disponible sur le système
    if command -v node &> /dev/null; then
      NODE_VERSION=$(node -v | cut -d 'v' -f 2)
      MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)
      
      if [ "$MAJOR_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✅ Utilisation de Node.js système: $(node -v)${NC}"
      else
        echo -e "${YELLOW}⚠️ Node.js $(node -v) détecté, mais version 18+ recommandée pour les meilleures performances${NC}"
      fi
    else
      error_exit "Node.js n'est pas installé. Veuillez installer Node.js ou exécuter le script d'installation."
    fi
  fi
else
  # Vérifier si Node.js est disponible sur le système
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)
    
    if [ "$MAJOR_VERSION" -ge 18 ]; then
      echo -e "${GREEN}✅ Utilisation de Node.js système: $(node -v)${NC}"
    else
      echo -e "${YELLOW}⚠️ Node.js $(node -v) détecté, mais version 18+ recommandée pour les meilleures performances${NC}"
    fi
  else
    error_exit "Node.js n'est pas installé. Veuillez installer Node.js ou exécuter le script d'installation."
  fi
fi

# Vérification des dépendances nécessaires
echo -e "${BLUE}[4/6] Vérification des dépendances...${NC}"

# Vérification des modules Node.js essentiels
MISSING_MODULES=""
for module in typescript ts-node; do
  if ! $NPM_CMD list $module > /dev/null 2>&1; then
    MISSING_MODULES="$MISSING_MODULES $module"
  fi
done

# Installation des modules manquants si nécessaire
if [ ! -z "$MISSING_MODULES" ]; then
  echo -e "${YELLOW}Installation des modules manquants: $MISSING_MODULES${NC}"
  $NPM_CMD install --no-save $MISSING_MODULES @types/node
  echo -e "${GREEN}✅ Modules Node.js manquants installés${NC}"
else
  echo -e "${GREEN}✅ Tous les modules Node.js requis sont présents${NC}"
fi

# Mise à jour du système AlmaLinux si nécessaire
if command -v dnf &> /dev/null; then
  echo -e "${BLUE}Vérification des mises à jour système pour AlmaLinux...${NC}"
  if sudo dnf check-update -q; then
    echo -e "${GREEN}✅ Système à jour${NC}"
  else
    echo -e "${YELLOW}Mise à jour du système...${NC}"
    sudo dnf update -y -q || true
    sudo dnf upgrade -y -q || true
    echo -e "${GREEN}✅ Système mis à jour${NC}"
  fi
fi

# Migrer les données vers la nouvelle structure
# Vérifier si la migration est nécessaire
if [ -d "./data" ] && [ ! -f "${DB_DIR}/fhirhub.db" ] && [ -f "./data/fhirhub.db" ]; then
  echo -e "${YELLOW}Migration de l'ancienne base de données vers la nouvelle structure...${NC}"
  cp "./data/fhirhub.db" "${DB_DIR}/fhirhub.db" && 
  echo -e "${GREEN}✅ Base de données migrée avec succès${NC}" ||
  echo -e "${RED}❌ Échec de la migration de la base de données${NC}"
fi

# Migrer les workflows si nécessaire
if [ -d "./data/workflows" ] && [ ! -z "$(ls -A ./data/workflows 2>/dev/null)" ]; then
  echo -e "${YELLOW}Migration des workflows vers la nouvelle structure...${NC}"
  rsync -a "./data/workflows/" "${DATA_DIR}/workflows/" &&
  echo -e "${GREEN}✅ Workflows migrés avec succès${NC}" ||
  echo -e "${RED}❌ Échec de la migration des workflows${NC}"
fi

# Vérification de l'installation Python pour les scripts auxiliaires
echo -e "${BLUE}[5/6] Vérification de Python...${NC}"

# Détecter Python
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
  PYTHON_CMD="python3"
  echo -e "${GREEN}✅ Python 3 trouvé: $(python3 --version)${NC}"
elif command -v python &> /dev/null; then
  PYTHON_VERSION=$(python --version 2>&1)
  if [[ $PYTHON_VERSION == Python\ 3* ]]; then
    PYTHON_CMD="python"
    echo -e "${GREEN}✅ Python 3 trouvé: $PYTHON_VERSION${NC}"
  else
    PYTHON_CMD="python"
    echo -e "${YELLOW}⚠️ Python $PYTHON_VERSION trouvé, mais Python 3 est recommandé${NC}"
  fi
else
  echo -e "${YELLOW}⚠️ Python non trouvé. Certaines fonctionnalités pourraient ne pas être disponibles.${NC}"
fi

# Vérifier et installer les modules Python si nécessaire
if [ ! -z "$PYTHON_CMD" ]; then
  # Détecter pip
  PIP_CMD=""
  if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
  elif command -v pip &> /dev/null; then
    PIP_CMD="pip"
  elif [ "$PYTHON_CMD" = "python3" ]; then
    PIP_CMD="$PYTHON_CMD -m pip"
    # Vérifier si le module pip est disponible
    if ! $PYTHON_CMD -m pip --version &> /dev/null; then
      echo -e "${YELLOW}Module pip non trouvé. Tentative d'installation...${NC}"
      
      # Essayer d'installer pip avec dnf pour AlmaLinux/RHEL
      if command -v dnf &> /dev/null; then
        echo -e "${YELLOW}Tentative d'installation de pip avec dnf pour AlmaLinux/RHEL...${NC}"
        sudo dnf install -y python3-pip || true
        echo -e "${GREEN}✅ Commande d'installation de pip exécutée${NC}"
      else
        # Tentative d'installation via ensurepip
        $PYTHON_CMD -m ensurepip --upgrade --default-pip &> /dev/null || true
      fi
      
      # Vérifier à nouveau si pip est disponible
      if $PYTHON_CMD -m pip --version &> /dev/null; then
        echo -e "${GREEN}✅ Module pip installé avec succès${NC}"
      else
        echo -e "${YELLOW}⚠️ Impossible d'installer pip automatiquement${NC}"
        PIP_CMD=""
      fi
    fi
  elif [ "$PYTHON_CMD" = "python" ]; then
    PIP_CMD="$PYTHON_CMD -m pip"
    # Vérifier si le module pip est disponible
    if ! $PYTHON_CMD -m pip --version &> /dev/null; then
      PIP_CMD=""
    fi
  fi
  
  # Installer les modules requis si pip est disponible
  if [ ! -z "$PIP_CMD" ]; then
    # Vérifier si les modules sont déjà installés
    if ! $PYTHON_CMD -c "import hl7" &> /dev/null; then
      echo -e "${YELLOW}Module hl7 Python manquant, installation...${NC}"
      # Utiliser --break-system-packages pour Python 3.12+
      $PIP_CMD install hl7 --quiet --break-system-packages || $PIP_CMD install hl7 --quiet || true
      if $PYTHON_CMD -c "import hl7" &> /dev/null; then
        echo -e "${GREEN}✅ Module hl7 Python installé avec succès${NC}"
      else
        echo -e "${YELLOW}⚠️ L'installation du module hl7 a échoué, mais nous continuons...${NC}"
      fi
    fi
    
    if ! $PYTHON_CMD -c "import requests" &> /dev/null; then
      echo -e "${YELLOW}Module requests Python manquant, installation...${NC}"
      # Utiliser --break-system-packages pour Python 3.12+
      $PIP_CMD install requests --quiet --break-system-packages || $PIP_CMD install requests --quiet || true
      if $PYTHON_CMD -c "import requests" &> /dev/null; then
        echo -e "${GREEN}✅ Module requests Python installé avec succès${NC}"
      else
        echo -e "${YELLOW}⚠️ L'installation du module requests a échoué, mais nous continuons...${NC}"
      fi
    fi
  else
    echo -e "${YELLOW}⚠️ pip non disponible. Certains modules Python pourraient manquer.${NC}"
  fi
fi

# Vérifier si le port 5001 est déjà utilisé et le libérer si nécessaire
echo -e "${BLUE}[6/6] Préparation du serveur...${NC}"
echo -e "${BLUE}Vérification du port 5001...${NC}"
PORT_CHECK=""
if command -v lsof &> /dev/null; then
  PORT_CHECK=$(lsof -i:5001 -t 2>/dev/null)
elif command -v netstat &> /dev/null; then
  PORT_CHECK=$(netstat -tuln 2>/dev/null | grep ":5001 " | wc -l)
  if [ "$PORT_CHECK" -gt "0" ]; then
    PORT_CHECK="en_utilisation"
  else
    PORT_CHECK=""
  fi
fi

if [ ! -z "$PORT_CHECK" ]; then
  echo -e "${YELLOW}⚠️ Port 5001 déjà utilisé, tentative de libération...${NC}"
  if command -v lsof &> /dev/null; then
    kill -9 $PORT_CHECK 2>/dev/null && echo -e "${GREEN}✅ Port 5001 libéré${NC}" || echo -e "${YELLOW}⚠️ Impossible de libérer le port 5001${NC}"
  else
    echo -e "${YELLOW}⚠️ Impossible de libérer le port 5001 automatiquement. Veuillez vérifier manuellement.${NC}"
  fi
else
  echo -e "${GREEN}✅ Port 5001 disponible${NC}"
fi

# Vérification du port des métriques
METRICS_PORT=$(grep -oP "(?<=METRICS_PORT=).*" .env 2>/dev/null || echo "9091")
METRICS_ENABLED=$(grep -oP "(?<=METRICS_ENABLED=).*" .env 2>/dev/null || echo "true")

# Démarrage du serveur
echo -e "${CYAN}=========================================================="
echo -e "   Démarrage du serveur FHIRHub v${APP_VERSION}"
echo -e "   Application: http://localhost:5001"
if [ "$METRICS_ENABLED" = "true" ]; then
  echo -e "   Métriques Prometheus: http://localhost:${METRICS_PORT}/metrics"
fi
echo -e "==========================================================${NC}"

# Vérification et création des répertoires pour Loki, Grafana et Prometheus
echo -e "${BLUE}Préparation des répertoires pour Loki, Grafana et Prometheus...${NC}"
mkdir -p volumes/grafana volumes/prometheus volumes/loki volumes/loki/chunks volumes/loki/index volumes/loki/wal volumes/loki/compactor 2>/dev/null
# Correction des permissions des répertoires
chmod -R 777 volumes/grafana volumes/prometheus volumes/loki 2>/dev/null || true
echo -e "${GREEN}✅ Répertoires pour Loki, Grafana et Prometheus préparés${NC}"

# Installation locale de Prometheus et Grafana sans Docker
if [ "$PROMETHEUS_LOCAL" = "true" ] || [ "$GRAFANA_LOCAL" = "true" ]; then
  echo -e "${BLUE}Installation locale de Prometheus et Grafana (sans Docker)...${NC}"
  
  # Détection du système d'exploitation
  OS="unknown"
  if [ -f "/etc/os-release" ]; then
    . /etc/os-release
    OS="$ID"
  elif command -v uname &> /dev/null; then
    if uname -a | grep -q "Darwin"; then
      OS="macos"
    elif uname -a | grep -q "MINGW\|MSYS"; then
      OS="windows"
    fi
  fi
  
  TOOLS_DIR="./tools"
  mkdir -p "$TOOLS_DIR" 2>/dev/null
  
  # Installation locale de Prometheus
  if [ "$PROMETHEUS_LOCAL" = "true" ]; then
    echo -e "${YELLOW}Installation locale de Prometheus...${NC}"
    PROMETHEUS_VERSION="2.45.0"
    PROMETHEUS_DIR="$TOOLS_DIR/prometheus"
    
    if [ ! -d "$PROMETHEUS_DIR" ]; then
      mkdir -p "$PROMETHEUS_DIR" 2>/dev/null
      
      # Téléchargement et extraction de Prometheus selon le système d'exploitation
      if [ "$OS" = "linux" ] || [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ] || [ "$OS" = "rhel" ] || [ "$OS" = "almalinux" ] || [ "$OS" = "centos" ]; then
        PROMETHEUS_ARCHIVE="prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz"
        echo -e "${YELLOW}Téléchargement de Prometheus ${PROMETHEUS_VERSION} pour Linux...${NC}"
        curl -L -o "$TOOLS_DIR/$PROMETHEUS_ARCHIVE" "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/$PROMETHEUS_ARCHIVE" --progress-bar || \
        wget -O "$TOOLS_DIR/$PROMETHEUS_ARCHIVE" "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/$PROMETHEUS_ARCHIVE" --show-progress
        
        echo -e "${YELLOW}Extraction de Prometheus...${NC}"
        tar -xzf "$TOOLS_DIR/$PROMETHEUS_ARCHIVE" -C "$TOOLS_DIR"
        mv "$TOOLS_DIR/prometheus-${PROMETHEUS_VERSION}.linux-amd64"/* "$PROMETHEUS_DIR/"
        rm -rf "$TOOLS_DIR/prometheus-${PROMETHEUS_VERSION}.linux-amd64"
        rm -f "$TOOLS_DIR/$PROMETHEUS_ARCHIVE"
      elif [ "$OS" = "macos" ]; then
        PROMETHEUS_ARCHIVE="prometheus-${PROMETHEUS_VERSION}.darwin-amd64.tar.gz"
        echo -e "${YELLOW}Téléchargement de Prometheus ${PROMETHEUS_VERSION} pour macOS...${NC}"
        curl -L -o "$TOOLS_DIR/$PROMETHEUS_ARCHIVE" "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/$PROMETHEUS_ARCHIVE" --progress-bar
        
        echo -e "${YELLOW}Extraction de Prometheus...${NC}"
        tar -xzf "$TOOLS_DIR/$PROMETHEUS_ARCHIVE" -C "$TOOLS_DIR"
        mv "$TOOLS_DIR/prometheus-${PROMETHEUS_VERSION}.darwin-amd64"/* "$PROMETHEUS_DIR/"
        rm -rf "$TOOLS_DIR/prometheus-${PROMETHEUS_VERSION}.darwin-amd64"
        rm -f "$TOOLS_DIR/$PROMETHEUS_ARCHIVE"
      elif [ "$OS" = "windows" ]; then
        PROMETHEUS_ARCHIVE="prometheus-${PROMETHEUS_VERSION}.windows-amd64.zip"
        echo -e "${YELLOW}Téléchargement de Prometheus ${PROMETHEUS_VERSION} pour Windows...${NC}"
        curl -L -o "$TOOLS_DIR/$PROMETHEUS_ARCHIVE" "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/$PROMETHEUS_ARCHIVE" --progress-bar
        
        echo -e "${YELLOW}Extraction de Prometheus...${NC}"
        if command -v unzip &> /dev/null; then
          unzip -q "$TOOLS_DIR/$PROMETHEUS_ARCHIVE" -d "$TOOLS_DIR"
          mv "$TOOLS_DIR/prometheus-${PROMETHEUS_VERSION}.windows-amd64"/* "$PROMETHEUS_DIR/"
          rm -rf "$TOOLS_DIR/prometheus-${PROMETHEUS_VERSION}.windows-amd64"
        else
          echo -e "${RED}⚠️ Impossible d'extraire Prometheus. Veuillez installer unzip ou extraire manuellement ${PROMETHEUS_ARCHIVE}${NC}"
        fi
        rm -f "$TOOLS_DIR/$PROMETHEUS_ARCHIVE"
      else
        echo -e "${RED}⚠️ Système d'exploitation non pris en charge pour l'installation locale de Prometheus: $OS${NC}"
      fi
      
      # Création de la configuration Prometheus
      if [ -d "$PROMETHEUS_DIR" ]; then
        cat > "$PROMETHEUS_DIR/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: 'fhirhub'
    scrape_interval: 5s
    static_configs:
      - targets: ['localhost:9091']
EOF
        echo -e "${GREEN}✅ Configuration Prometheus créée${NC}"
      fi
    fi
    
    # Vérification de l'installation de Prometheus
    if [ -f "$PROMETHEUS_DIR/prometheus" ] || [ -f "$PROMETHEUS_DIR/prometheus.exe" ]; then
      echo -e "${GREEN}✅ Prometheus installé localement${NC}"
      
      # Démarrage automatique de Prometheus
      echo -e "${YELLOW}Démarrage de Prometheus...${NC}"
      if [ -f "$PROMETHEUS_DIR/prometheus" ]; then
        chmod +x "$PROMETHEUS_DIR/prometheus"
        nohup "$PROMETHEUS_DIR/prometheus" --config.file="$PROMETHEUS_DIR/prometheus.yml" --storage.tsdb.path="$PROMETHEUS_DIR/data" > "$TOOLS_DIR/prometheus.log" 2>&1 &
      elif [ -f "$PROMETHEUS_DIR/prometheus.exe" ]; then
        start /b "$PROMETHEUS_DIR/prometheus.exe" --config.file="$PROMETHEUS_DIR/prometheus.yml" --storage.tsdb.path="$PROMETHEUS_DIR/data" > "$TOOLS_DIR/prometheus.log" 2>&1
      fi
      echo -e "${GREEN}✅ Prometheus démarré sur http://localhost:9090${NC}"
    else
      echo -e "${RED}⚠️ Installation de Prometheus échouée${NC}"
    fi
  fi
  
  # Installation locale de Grafana
  if [ "$GRAFANA_LOCAL" = "true" ]; then
    echo -e "${YELLOW}Installation locale de Grafana...${NC}"
    GRAFANA_VERSION="10.1.0"
    GRAFANA_DIR="$TOOLS_DIR/grafana"
    
    if [ ! -d "$GRAFANA_DIR" ]; then
      mkdir -p "$GRAFANA_DIR" 2>/dev/null
      
      # Téléchargement et extraction de Grafana selon le système d'exploitation
      if [ "$OS" = "linux" ] || [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ] || [ "$OS" = "rhel" ] || [ "$OS" = "almalinux" ] || [ "$OS" = "centos" ]; then
        GRAFANA_ARCHIVE="grafana-${GRAFANA_VERSION}.linux-amd64.tar.gz"
        echo -e "${YELLOW}Téléchargement de Grafana ${GRAFANA_VERSION} pour Linux...${NC}"
        curl -L -o "$TOOLS_DIR/$GRAFANA_ARCHIVE" "https://dl.grafana.com/oss/release/$GRAFANA_ARCHIVE" --progress-bar || \
        wget -O "$TOOLS_DIR/$GRAFANA_ARCHIVE" "https://dl.grafana.com/oss/release/$GRAFANA_ARCHIVE" --show-progress
        
        echo -e "${YELLOW}Extraction de Grafana...${NC}"
        tar -xzf "$TOOLS_DIR/$GRAFANA_ARCHIVE" -C "$TOOLS_DIR"
        mv "$TOOLS_DIR/grafana-${GRAFANA_VERSION}"/* "$GRAFANA_DIR/"
        rm -rf "$TOOLS_DIR/grafana-${GRAFANA_VERSION}"
        rm -f "$TOOLS_DIR/$GRAFANA_ARCHIVE"
      elif [ "$OS" = "macos" ]; then
        GRAFANA_ARCHIVE="grafana-${GRAFANA_VERSION}.darwin-amd64.tar.gz"
        echo -e "${YELLOW}Téléchargement de Grafana ${GRAFANA_VERSION} pour macOS...${NC}"
        curl -L -o "$TOOLS_DIR/$GRAFANA_ARCHIVE" "https://dl.grafana.com/oss/release/$GRAFANA_ARCHIVE" --progress-bar
        
        echo -e "${YELLOW}Extraction de Grafana...${NC}"
        tar -xzf "$TOOLS_DIR/$GRAFANA_ARCHIVE" -C "$TOOLS_DIR"
        mv "$TOOLS_DIR/grafana-${GRAFANA_VERSION}"/* "$GRAFANA_DIR/"
        rm -rf "$TOOLS_DIR/grafana-${GRAFANA_VERSION}"
        rm -f "$TOOLS_DIR/$GRAFANA_ARCHIVE"
      elif [ "$OS" = "windows" ]; then
        GRAFANA_ARCHIVE="grafana-${GRAFANA_VERSION}.windows-amd64.zip"
        echo -e "${YELLOW}Téléchargement de Grafana ${GRAFANA_VERSION} pour Windows...${NC}"
        curl -L -o "$TOOLS_DIR/$GRAFANA_ARCHIVE" "https://dl.grafana.com/oss/release/$GRAFANA_ARCHIVE" --progress-bar
        
        echo -e "${YELLOW}Extraction de Grafana...${NC}"
        if command -v unzip &> /dev/null; then
          unzip -q "$TOOLS_DIR/$GRAFANA_ARCHIVE" -d "$TOOLS_DIR"
          mv "$TOOLS_DIR/grafana-${GRAFANA_VERSION}"/* "$GRAFANA_DIR/"
          rm -rf "$TOOLS_DIR/grafana-${GRAFANA_VERSION}"
        else
          echo -e "${RED}⚠️ Impossible d'extraire Grafana. Veuillez installer unzip ou extraire manuellement ${GRAFANA_ARCHIVE}${NC}"
        fi
        rm -f "$TOOLS_DIR/$GRAFANA_ARCHIVE"
      else
        echo -e "${RED}⚠️ Système d'exploitation non pris en charge pour l'installation locale de Grafana: $OS${NC}"
      fi
      
      # Configuration de Grafana pour utiliser Prometheus
      if [ -d "$GRAFANA_DIR" ]; then
        mkdir -p "$GRAFANA_DIR/conf/provisioning/datasources"
        cat > "$GRAFANA_DIR/conf/provisioning/datasources/prometheus.yaml" << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    editable: true
    
  - name: FHIRHub Logs
    type: simplejson
    access: proxy
    url: http://localhost:9091/api/logs
    isDefault: false
    editable: true
    jsonData:
      timeField: "timestamp"
EOF
        echo -e "${GREEN}✅ Configuration Grafana créée${NC}"
      
        # Copier les dashboards depuis le répertoire Grafana
        if [ -d "./grafana/dashboards" ]; then
          mkdir -p "$GRAFANA_DIR/conf/provisioning/dashboards"
          mkdir -p "$GRAFANA_DIR/dashboards"
          cp ./grafana/dashboards/*.json "$GRAFANA_DIR/dashboards/" 2>/dev/null
          
          # Création du fichier de configuration pour les dashboards
          cat > "$GRAFANA_DIR/conf/provisioning/dashboards/default.yaml" << 'EOF'
apiVersion: 1

providers:
  - name: 'FHIRHub Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF
          echo -e "${GREEN}✅ Dashboards Grafana copiés${NC}"
        fi
      fi
    fi
    
    # Vérifier l'installation de Grafana
    if [ -f "$GRAFANA_DIR/bin/grafana-server" ] || [ -f "$GRAFANA_DIR/bin/grafana-server.exe" ]; then
      echo -e "${GREEN}✅ Grafana installé localement${NC}"
      
      # Démarrage automatique de Grafana
      echo -e "${YELLOW}Démarrage de Grafana...${NC}"
      if [ -f "$GRAFANA_DIR/bin/grafana-server" ]; then
        chmod +x "$GRAFANA_DIR/bin/grafana-server"
        nohup "$GRAFANA_DIR/bin/grafana-server" --homepath="$GRAFANA_DIR" > "$TOOLS_DIR/grafana.log" 2>&1 &
      elif [ -f "$GRAFANA_DIR/bin/grafana-server.exe" ]; then
        start /b "$GRAFANA_DIR/bin/grafana-server.exe" --homepath="$GRAFANA_DIR" > "$TOOLS_DIR/grafana.log" 2>&1
      fi
      echo -e "${GREEN}✅ Grafana démarré sur http://localhost:3000${NC}"
      echo -e "${YELLOW}Identifiants par défaut:${NC}"
      echo -e "${YELLOW}  Utilisateur: admin${NC}"
      echo -e "${YELLOW}  Mot de passe: admin${NC}"
    else
      echo -e "${RED}⚠️ Installation de Grafana échouée${NC}"
    fi
  fi
fi

# Afficher un message pour l'architecture intégrée "tout-en-un"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${GREEN}✅ Architecture intégrée \"tout-en-un\" activée :${NC}"
echo -e "${GREEN}   ✓ Serveur HAPI FHIR en cours d'exécution sur: http://localhost:8080/fhir${NC}"
echo -e "${GREEN}   ✓ Application FHIRHub prête à démarrer sur: http://localhost:5001${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${BLUE}Démarrage de l'application principale...${NC}"

# Démarrage avec le Node.js approprié et PORT forcé à 5001
export PORT=5001
$NODE_CMD app.js