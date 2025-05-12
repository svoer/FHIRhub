#!/bin/bash

# Script de démarrage pour l'environnement Docker
# Ce script lance à la fois le serveur HAPI FHIR et l'application FHIRHub

# Définir les couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}              Démarrage de FHIRHub (Environnement Docker)            ${NC}"
echo -e "${BLUE}=====================================================================${NC}"

# Vérifier si le serveur HAPI FHIR est accessible (en cas de service externe)
HAPI_FHIR_SERVER=${HAPI_FHIR_SERVER:-"http://localhost:8080/fhir"}
DOCKER_ENV=${DOCKER_ENV:-"true"}

echo -e "${BLUE}[1/4] Vérification des dossiers et permissions nécessaires...${NC}"
# Créer ou vérifier les répertoires nécessaires
mkdir -p /app/storage/data/ai_responses
mkdir -p /app/storage/data/conversions
mkdir -p /app/storage/data/history
mkdir -p /app/storage/data/outputs
mkdir -p /app/storage/data/test 
mkdir -p /app/storage/data/cache
mkdir -p /app/storage/db
mkdir -p /app/storage/logs
mkdir -p /app/storage/backups
mkdir -p /app/hapi-fhir

# Si nous sommes dans le conteneur principal et pas dans un service externe
if [ "$DOCKER_ENV" = "true" ] && [[ "$HAPI_FHIR_SERVER" == *"localhost"* ]]; then
    echo -e "${BLUE}[2/4] Configuration du serveur HAPI FHIR intégré...${NC}"
    
    # Télécharger le JAR du serveur HAPI FHIR si nécessaire
    HAPI_JAR="/app/hapi-fhir/hapi-fhir-server-starter-5.4.0.jar"
    if [ ! -f "$HAPI_JAR" ]; then
        echo -e "${YELLOW}Serveur HAPI FHIR non trouvé. Téléchargement...${NC}"
        wget -q -O "$HAPI_JAR" "https://github.com/hapifhir/hapi-fhir-jpaserver-starter/releases/download/v5.4.0/hapi-fhir-jpaserver-starter.war" || {
            echo -e "${RED}Échec du téléchargement du serveur HAPI FHIR${NC}"
            echo -e "${YELLOW}Le serveur HAPI FHIR ne sera pas disponible. Continuez avec FHIRHub uniquement...${NC}"
        }
    fi
    
    # Vérifier si Java est disponible
    if command -v java &> /dev/null; then
        echo -e "${BLUE}[3/4] Démarrage du serveur HAPI FHIR en arrière-plan...${NC}"
        # Démarrer le serveur HAPI FHIR en arrière-plan avec un log
        java -jar "$HAPI_JAR" --port 8080 --memory 512 > /app/storage/logs/hapi-fhir.log 2>&1 &
        HAPI_PID=$!
        echo $HAPI_PID > /app/storage/logs/hapi-fhir.pid
        echo -e "${GREEN}✓ Serveur HAPI FHIR démarré en arrière-plan (PID: $HAPI_PID)${NC}"
        
        # Attendre que le serveur soit disponible
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
            echo -e "${YELLOW}⚠️ Délai d'attente dépassé, mais le serveur HAPI FHIR pourrait toujours démarrer...${NC}"
        fi
    else
        echo -e "${YELLOW}Java n'est pas disponible. Le serveur HAPI FHIR ne peut pas être démarré.${NC}"
        echo -e "${YELLOW}Continuez avec FHIRHub uniquement. Assurez-vous que HAPI_FHIR_SERVER est configuré correctement.${NC}"
    fi
else
    echo -e "${BLUE}[2/4] Utilisation d'un serveur HAPI FHIR externe: ${HAPI_FHIR_SERVER}${NC}"
fi

# Démarrer l'application principale
echo -e "${BLUE}[4/4] Démarrage de l'application FHIRHub...${NC}"
echo -e "${GREEN}✓ Application FHIRHub prête pour les connexions sur le port 5000${NC}"
echo -e "${BLUE}=====================================================================${NC}"

# Démarrer l'application Node.js
node app.js

# En cas d'arrêt de Node.js, arrêter également le serveur HAPI FHIR si nous l'avons démarré
if [ -f "/app/storage/logs/hapi-fhir.pid" ]; then
    HAPI_PID=$(cat /app/storage/logs/hapi-fhir.pid)
    if ps -p $HAPI_PID > /dev/null; then
        echo -e "${BLUE}Arrêt du serveur HAPI FHIR (PID: $HAPI_PID)...${NC}"
        kill $HAPI_PID
        echo -e "${GREEN}✓ Serveur HAPI FHIR arrêté${NC}"
    fi
fi