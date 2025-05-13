#!/bin/bash

# Script de téléchargement des dépendances volumineuses pour FHIRHub
# Version 1.0.0

# Définition des couleurs pour une meilleure lisibilité des logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Fonction pour télécharger un fichier avec retry et vérification
download_file() {
  local url=$1
  local destination=$2
  local description=$3
  local min_size=$4  # Taille minimale en octets pour être valide

  echo -e "${BLUE}Téléchargement de $description...${NC}"
  
  # Créer le répertoire de destination si nécessaire
  mkdir -p $(dirname "$destination")
  
  # Télécharger avec curl ou wget, selon ce qui est disponible
  if command -v curl > /dev/null; then
    curl -# -L -o "$destination.tmp" "$url"
  elif command -v wget > /dev/null; then
    wget --show-progress -O "$destination.tmp" "$url"
  else
    echo -e "${RED}Erreur: curl ou wget est requis pour télécharger les fichiers.${NC}"
    return 1
  fi
  
  # Vérifier si le téléchargement a réussi
  if [ ! -f "$destination.tmp" ]; then
    echo -e "${RED}Erreur: Échec du téléchargement de $description.${NC}"
    return 1
  fi
  
  # Vérifier la taille du fichier téléchargé
  FILE_SIZE=$(stat -c%s "$destination.tmp" 2>/dev/null || stat -f%z "$destination.tmp" 2>/dev/null)
  if [ -n "$min_size" ] && [ "$FILE_SIZE" -lt "$min_size" ]; then
    echo -e "${RED}Le fichier téléchargé est trop petit pour être valide ($(($FILE_SIZE / 1024 / 1024)) Mo).${NC}"
    rm "$destination.tmp"
    return 1
  else
    # Renommer le fichier temporaire
    mv "$destination.tmp" "$destination"
    echo -e "${GREEN}✓ Téléchargement terminé: $destination ($(($FILE_SIZE / 1024 / 1024)) Mo)${NC}"
    return 0
  fi
}

# Bannière
echo -e "${CYAN}=========================================================="
echo -e "   FHIRHub - Téléchargement des dépendances volumineuses"
echo -e "   $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "==========================================================${NC}"

# 1. Vérification et téléchargement du serveur HAPI FHIR
HAPI_JAR="./hapi-fhir/hapi-fhir-server-starter-5.4.0.jar"
HAPI_URL="https://github.com/hapifhir/hapi-fhir-jpaserver-starter/releases/download/v5.4.0/hapi-fhir-jpaserver-starter.war"
HAPI_ALT_URL="https://repo1.maven.org/maven2/ca/uhn/hapi/fhir/hapi-fhir-jpaserver-starter/5.4.0/hapi-fhir-jpaserver-starter-5.4.0.war"

if [ ! -f "$HAPI_JAR" ]; then
  echo -e "${YELLOW}Le serveur HAPI FHIR n'est pas installé.${NC}"
  
  # Essayer avec l'URL principale
  if ! download_file "$HAPI_URL" "$HAPI_JAR" "HAPI FHIR Server v5.4.0" 30000000; then
    echo -e "${YELLOW}Tentative avec une URL alternative...${NC}"
    # Si ça échoue, essayer avec l'URL alternative
    if ! download_file "$HAPI_ALT_URL" "$HAPI_JAR" "HAPI FHIR Server v5.4.0 (alt)" 30000000; then
      echo -e "${RED}Impossible de télécharger le serveur HAPI FHIR.${NC}"
      echo -e "${YELLOW}Vous pouvez exécuter ./start-hapi-fhir.sh pour un téléchargement automatique lors du démarrage.${NC}"
    fi
  fi
else
  echo -e "${GREEN}✓ Le serveur HAPI FHIR est déjà installé${NC}"
  # Afficher la taille du fichier
  HAPI_SIZE=$(stat -c%s "$HAPI_JAR" 2>/dev/null || stat -f%z "$HAPI_JAR" 2>/dev/null)
  echo -e "${BLUE}   Taille: $(($HAPI_SIZE / 1024 / 1024)) Mo${NC}"
fi

# 2. Vérification et téléchargement des terminologies françaises
FRENCH_TERM_DIR="./storage/terminologies/french"
if [ ! -d "$FRENCH_TERM_DIR" ] || [ -z "$(ls -A $FRENCH_TERM_DIR 2>/dev/null)" ]; then
  echo -e "${YELLOW}Terminologies françaises manquantes.${NC}"
  mkdir -p $FRENCH_TERM_DIR
  
  # Vérifier si le script Python est disponible
  if [ -f "./get_french_terminology.py" ]; then
    echo -e "${BLUE}Exécution du script de téléchargement des terminologies françaises...${NC}"
    if command -v python3 > /dev/null; then
      python3 ./get_french_terminology.py && echo -e "${GREEN}✓ Terminologies françaises téléchargées avec succès${NC}" || echo -e "${RED}Échec du téléchargement des terminologies françaises${NC}"
    else
      echo -e "${RED}Python3 est requis pour télécharger les terminologies françaises.${NC}"
    fi
  else
    echo -e "${RED}Script de téléchargement des terminologies non trouvé (get_french_terminology.py).${NC}"
  fi
else
  echo -e "${GREEN}✓ Terminologies françaises déjà installées${NC}"
  # Compter le nombre de fichiers
  TERM_COUNT=$(find "$FRENCH_TERM_DIR" -type f | wc -l)
  echo -e "${BLUE}   Nombre de fichiers: $TERM_COUNT${NC}"
fi

# 3. Autres dépendances volumineuses peuvent être ajoutées ici
# ...

# Résumé
echo -e "${CYAN}=========================================================="
echo -e "   Résumé des dépendances"
echo -e "==========================================================${NC}"

echo -ne "${BLUE}HAPI FHIR:${NC} "
if [ -f "$HAPI_JAR" ]; then
  echo -e "${GREEN}Installé✓${NC}"
else
  echo -e "${RED}Non installé✗${NC}"
fi

echo -ne "${BLUE}Terminologies françaises:${NC} "
if [ -d "$FRENCH_TERM_DIR" ] && [ ! -z "$(ls -A $FRENCH_TERM_DIR 2>/dev/null)" ]; then
  echo -e "${GREEN}Installées✓${NC}"
else
  echo -e "${RED}Non installées✗${NC}"
fi

echo -e "${CYAN}==========================================================${NC}"
echo -e "${GREEN}Téléchargement des dépendances terminé.${NC}"