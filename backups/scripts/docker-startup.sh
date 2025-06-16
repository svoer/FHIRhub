#!/bin/bash

# Script de démarrage pour l'environnement Docker
# Ce script prépare l'environnement pour le conteneur FHIRHub uniquement

# Définir les couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}         Démarrage de FHIRHub (Architecture à services séparés)      ${NC}"
echo -e "${BLUE}=====================================================================${NC}"

# Vérifier le serveur HAPI FHIR externe (défini dans docker-compose.yml)
HAPI_FHIR_SERVER=${HAPI_FHIR_SERVER:-"http://hapifhir:8080/fhir"}
DOCKER_ENV=${DOCKER_ENV:-"true"}

echo -e "${BLUE}[1/3] Vérification des dossiers et permissions nécessaires...${NC}"
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
mkdir -p /app/french_terminology
echo -e "${GREEN}✓ Structure de dossiers vérifiée${NC}"

echo -e "${BLUE}[2/3] Attente de disponibilité du serveur HAPI FHIR externe...${NC}"
echo -e "${YELLOW}Connexion au serveur HAPI FHIR: ${HAPI_FHIR_SERVER}${NC}"

# Attendre que le serveur HAPI FHIR soit disponible 
MAX_WAIT=60
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s -o /dev/null -w "%{http_code}" $HAPI_FHIR_SERVER/metadata 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✓ Serveur HAPI FHIR externe prêt et opérationnel${NC}"
        break
    fi
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT+2))
    if [ $((WAIT_COUNT % 10)) -eq 0 ]; then
        echo -e "${YELLOW}Attente du serveur HAPI FHIR... ($WAIT_COUNT/$MAX_WAIT secondes)${NC}"
    fi
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo -e "${RED}⚠️ Impossible de contacter le serveur HAPI FHIR. L'application continuera mais certaines fonctionnalités pourraient ne pas fonctionner.${NC}"
fi

# Démarrer l'application principale
echo -e "${BLUE}[3/3] Démarrage de l'application FHIRHub...${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${GREEN}✓ Architecture à services séparés activée :${NC}"
echo -e "${GREEN}   ✓ Serveur HAPI FHIR accessible via: ${HAPI_FHIR_SERVER}${NC}"
echo -e "${GREEN}   ✓ Application FHIRHub prête à démarrer sur: http://localhost:5000${NC}"
echo -e "${CYAN}=====================================================================${NC}"

# Démarrer l'application Node.js
node app.js