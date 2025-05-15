#!/bin/bash

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${BLUE}   Test de redémarrage des serveurs FHIRHub et HAPI FHIR${NC}"
echo -e "${CYAN}=====================================================================${NC}"

# Tester si HAPI FHIR est en cours d'exécution
echo -e "${YELLOW}Vérification du serveur HAPI FHIR...${NC}"
if ps aux | grep -v grep | grep -q "hapi-fhir-server-starter-5.4.0.jar"; then
  echo -e "${GREEN}✓ Le serveur HAPI FHIR est en cours d'exécution${NC}"
  HAPI_PID=$(ps aux | grep -v grep | grep "hapi-fhir-server-starter-5.4.0.jar" | awk '{print $2}')
  echo -e "${YELLOW}PID du serveur HAPI FHIR: ${HAPI_PID}${NC}"
else
  echo -e "${RED}✗ Le serveur HAPI FHIR n'est pas en cours d'exécution${NC}"
  HAPI_PID=""
fi

# Arrêter HAPI FHIR s'il est en cours d'exécution
if [ -n "$HAPI_PID" ]; then
  echo -e "${YELLOW}Arrêt du serveur HAPI FHIR (PID: ${HAPI_PID})...${NC}"
  kill -15 $HAPI_PID
  sleep 2
  if ps -p $HAPI_PID > /dev/null 2>&1; then
    echo -e "${YELLOW}Force de l'arrêt du serveur HAPI FHIR (PID: ${HAPI_PID})...${NC}"
    kill -9 $HAPI_PID
    sleep 1
  fi
  
  if ps -p $HAPI_PID > /dev/null 2>&1; then
    echo -e "${RED}✗ Impossible d'arrêter le serveur HAPI FHIR${NC}"
  else
    echo -e "${GREEN}✓ Serveur HAPI FHIR arrêté avec succès${NC}"
  fi
fi

# Démarrer HAPI FHIR
echo -e "${YELLOW}Démarrage du serveur HAPI FHIR...${NC}"
nohup ./start-hapi-fhir.sh --port 8080 --memory 512 --database h2 > ./logs/hapi-fhir.log 2>&1 &

# Récupérer le PID
HAPI_PID=$!
echo -e "${YELLOW}Nouveau PID du serveur HAPI FHIR: ${HAPI_PID}${NC}"

# Assurer que le processus reste en arrière-plan
disown $HAPI_PID

# Attendre que le serveur soit disponible
echo -e "${YELLOW}Attente de la disponibilité du serveur HAPI FHIR...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0
SERVER_READY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT+1))
  
  # Utiliser curl pour vérifier la disponibilité
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/fhir/metadata 2>/dev/null | grep -q "200\|401"; then
    SERVER_READY=true
    break
  fi
  
  echo -n "."
  sleep 1
done

echo ""
if [ "$SERVER_READY" = true ]; then
  echo -e "${GREEN}✓ Serveur HAPI FHIR opérationnel et accessible${NC}"
else
  echo -e "${YELLOW}⚠️ Le serveur HAPI FHIR a démarré mais ne répond pas encore complètement aux requêtes.${NC}"
  echo -e "${YELLOW}   Vérifiez les logs dans ./logs/hapi-fhir.log${NC}"
fi

# Vérifier si le serveur FHIRHub est en cours d'exécution
echo -e "${YELLOW}Vérification du serveur FHIRHub...${NC}"
if ps aux | grep -v grep | grep -q "node app.js"; then
  echo -e "${GREEN}✓ Le serveur FHIRHub est en cours d'exécution${NC}"
  NODE_PID=$(ps aux | grep -v grep | grep "node app.js" | awk '{print $2}')
  echo -e "${YELLOW}PID du serveur FHIRHub: ${NODE_PID}${NC}"
else
  echo -e "${RED}✗ Le serveur FHIRHub n'est pas en cours d'exécution${NC}"
  NODE_PID=""
fi

# Vérifier si le serveur FHIRHub est accessible
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/ 2>/dev/null | grep -q "200"; then
  echo -e "${GREEN}✓ Serveur FHIRHub accessible à l'URL http://localhost:5001/${NC}"
else
  echo -e "${RED}✗ Le serveur FHIRHub n'est pas accessible${NC}"
  if [ -n "$NODE_PID" ]; then
    echo -e "${YELLOW}Le serveur est en cours d'exécution mais ne répond pas${NC}"
  else
    echo -e "${YELLOW}Démarrage du serveur FHIRHub...${NC}"
    export PORT=5001
    nohup node app.js > ./logs/fhirhub.log 2>&1 &
    NODE_PID=$!
    echo -e "${YELLOW}Nouveau PID du serveur FHIRHub: ${NODE_PID}${NC}"
    
    # Attendre que le serveur soit disponible
    echo -e "${YELLOW}Attente de la disponibilité du serveur FHIRHub...${NC}"
    MAX_ATTEMPTS=10
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
      ATTEMPT=$((ATTEMPT+1))
      
      if curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/ 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✓ Serveur FHIRHub démarré et accessible${NC}"
        break
      fi
      
      echo -n "."
      sleep 1
    done
    
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
      echo -e "${RED}✗ Impossible de démarrer le serveur FHIRHub ou de le rendre accessible${NC}"
    fi
  fi
fi

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${BLUE}   Statut des serveurs${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${BLUE}HAPI FHIR Server:${NC} ${GREEN}http://localhost:8080/fhir${NC}"
echo -e "${BLUE}FHIRHub Server:${NC}  ${GREEN}http://localhost:5001${NC}"
echo -e "${CYAN}=====================================================================${NC}"