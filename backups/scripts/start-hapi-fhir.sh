#!/bin/bash
#
# Script de démarrage du serveur HAPI FHIR
# Ce script télécharge et démarre un serveur HAPI FHIR v5.4.0
#

# Définition des couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paramètres par défaut
PORT=8080
MEMORY=512
DATABASE="h2"
VERSION="5.4.0"
JAVA_PATH="java"

# Fonction d'affichage d'aide
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --port PORT       Port pour le serveur HAPI FHIR (défaut: 8080)"
  echo "  --memory MEMORY   Mémoire allouée en Mo (défaut: 512)"
  echo "  --java PATH       Chemin vers l'exécutable Java (défaut: java du système)"
  echo "  --database TYPE   Type de base de données: h2 ou sqlite (défaut: h2)"
  echo "  --help            Afficher cette aide"
  exit 1
}

# Traitement des arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --port)
      PORT="$2"
      shift 2
      ;;
    --memory)
      MEMORY="$2"
      shift 2
      ;;
    --java)
      JAVA_PATH="$2"
      shift 2
      ;;
    --database)
      DATABASE="$2"
      shift 2
      ;;
    --help)
      usage
      ;;
    *)
      echo -e "${RED}Option inconnue: $1${NC}"
      usage
      ;;
  esac
done

# Vérifier que le répertoire hapi-fhir existe
HAPI_DIR="./hapi-fhir"
if [ ! -d "$HAPI_DIR" ]; then
  echo -e "${BLUE}Création du répertoire hapi-fhir...${NC}"
  mkdir -p "$HAPI_DIR"
fi

# Définir le chemin du JAR
JAR_FILE="$HAPI_DIR/hapi-fhir-server-starter-$VERSION.jar"

# Vérifier si le serveur est déjà en cours d'exécution
EXISTING_PID=$(ps -ef | grep "hapi-fhir-server-starter-$VERSION.jar" | grep -v grep | awk '{print $2}')
if [ ! -z "$EXISTING_PID" ]; then
  echo -e "${YELLOW}Un serveur HAPI FHIR est déjà en cours d'exécution (PID: $EXISTING_PID).${NC}"
  read -p "Voulez-vous l'arrêter et en démarrer un nouveau? (o/n): " choice
  if [ "$choice" == "o" ] || [ "$choice" == "O" ]; then
    echo -e "${BLUE}Arrêt du serveur HAPI FHIR en cours...${NC}"
    kill -15 $EXISTING_PID
    sleep 5
  else
    echo -e "${GREEN}Utilisation du serveur HAPI FHIR existant.${NC}"
    exit 0
  fi
fi

# Vérifier si le JAR existe, sinon le télécharger
if [ ! -f "$JAR_FILE" ]; then
  echo -e "${BLUE}Téléchargement de HAPI FHIR v$VERSION...${NC}"
  
  # URL de téléchargement
  DOWNLOAD_URL="https://github.com/hapifhir/hapi-fhir-jpaserver-starter/releases/download/v$VERSION/hapi-fhir-jpaserver-starter.war"
  
  # Télécharger avec curl ou wget, selon ce qui est disponible
  if command -v curl > /dev/null; then
    curl -# -L -o "$JAR_FILE.tmp" "$DOWNLOAD_URL"
  elif command -v wget > /dev/null; then
    wget --show-progress -O "$JAR_FILE.tmp" "$DOWNLOAD_URL"
  else
    echo -e "${RED}Erreur: curl ou wget est requis pour télécharger le serveur HAPI FHIR.${NC}"
    exit 1
  fi
  
  # Vérifier si le téléchargement a réussi
  if [ ! -f "$JAR_FILE.tmp" ]; then
    echo -e "${RED}Erreur: Échec du téléchargement du serveur HAPI FHIR.${NC}"
    exit 1
  fi
  
  # Vérifier la taille du fichier téléchargé (au moins 30 Mo)
  FILE_SIZE=$(stat -c%s "$JAR_FILE.tmp" 2>/dev/null || stat -f%z "$JAR_FILE.tmp" 2>/dev/null)
  if [ "$FILE_SIZE" -lt 30000000 ]; then
    echo -e "${RED}Le fichier téléchargé est trop petit pour être valide ($(($FILE_SIZE / 1024 / 1024)) Mo).${NC}"
    rm "$JAR_FILE.tmp"
    
    # Essayer une URL alternative
    echo -e "${YELLOW}Tentative avec une URL alternative...${NC}"
    ALT_URL="https://repo1.maven.org/maven2/ca/uhn/hapi/fhir/hapi-fhir-jpaserver-starter/$VERSION/hapi-fhir-jpaserver-starter-$VERSION.war"
    
    if command -v curl > /dev/null; then
      curl -# -L -o "$JAR_FILE.tmp" "$ALT_URL"
    elif command -v wget > /dev/null; then
      wget --show-progress -O "$JAR_FILE.tmp" "$ALT_URL"
    fi
    
    # Vérifier à nouveau la taille
    FILE_SIZE=$(stat -c%s "$JAR_FILE.tmp" 2>/dev/null || stat -f%z "$JAR_FILE.tmp" 2>/dev/null)
    if [ "$FILE_SIZE" -lt 30000000 ]; then
      echo -e "${RED}Le fichier téléchargé est toujours trop petit pour être valide ($(($FILE_SIZE / 1024 / 1024)) Mo).${NC}"
      echo -e "${RED}Impossible de télécharger le serveur HAPI FHIR.${NC}"
      rm "$JAR_FILE.tmp"
      exit 1
    fi
  fi
  
  # Renommer le fichier temporaire
  mv "$JAR_FILE.tmp" "$JAR_FILE"
  
  echo -e "${GREEN}Téléchargement terminé: $JAR_FILE${NC}"
else
  echo -e "${GREEN}Le fichier $JAR_FILE existe déjà.${NC}"
fi

# Vérifier la version de Java
JAVA_VERSION=$("$JAVA_PATH" -version 2>&1 | awk -F '"' '/version/ {print $2}')
if [ -z "$JAVA_VERSION" ]; then
  echo -e "${RED}Erreur: Java n'est pas installé ou n'est pas accessible via le chemin spécifié.${NC}"
  exit 1
fi

echo -e "${BLUE}Version de Java: $JAVA_VERSION${NC}"

# Configurer les options de base de données
DB_OPTS=""
if [ "$DATABASE" == "sqlite" ]; then
  DB_DIR="$HAPI_DIR/sqlite"
  mkdir -p "$DB_DIR"
  DB_OPTS="-Dspring.datasource.url=jdbc:sqlite:$DB_DIR/hapi-fhir.db -Dspring.datasource.username=sa -Dspring.datasource.password=sa -Dspring.datasource.driver-class-name=org.sqlite.JDBC -Dspring.jpa.database-platform=ca.uhn.fhir.jpa.starter.util.SQLiteDialect"
fi

# Démarrer le serveur HAPI FHIR
echo -e "${BLUE}Démarrage du serveur HAPI FHIR sur le port $PORT avec $MEMORY Mo de mémoire...${NC}"
echo -e "${BLUE}Base de données: $DATABASE${NC}"

# Options JVM
JAVA_OPTS="-Xmx${MEMORY}m -Dserver.port=$PORT -DHAPI_FHIR_SERVER_VERSION=$VERSION -Dhapi.fhir.allow_external_references=true -Dhapi.fhir.expunge_enabled=true -Dhapi.fhir.advanced_lucene_indexing=true $DB_OPTS"

# Démarrer le serveur en arrière-plan
"$JAVA_PATH" $JAVA_OPTS -jar "$JAR_FILE" --fhir.validation.enabled=false --fhir.validation.request-only=true > "$HAPI_DIR/hapi-fhir-server.log" 2>&1 &

# Récupérer le PID du processus
SERVER_PID=$!

# Vérifier si le processus a démarré correctement
if ps -p $SERVER_PID > /dev/null; then
  echo -e "${GREEN}Serveur HAPI FHIR démarré avec succès (PID: $SERVER_PID)${NC}"
  echo -e "${GREEN}URL du serveur: http://localhost:$PORT/fhir${NC}"
  echo -e "${YELLOW}Les logs sont disponibles dans $HAPI_DIR/hapi-fhir-server.log${NC}"
  
  # Enregistrer le PID dans un fichier
  echo $SERVER_PID > "$HAPI_DIR/hapi-fhir-server.pid"
else
  echo -e "${RED}Erreur: Le serveur HAPI FHIR n'a pas pu démarrer.${NC}"
  echo -e "${YELLOW}Vérifiez les logs dans $HAPI_DIR/hapi-fhir-server.log${NC}"
  exit 1
fi

exit 0