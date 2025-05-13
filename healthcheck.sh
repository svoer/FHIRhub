#!/bin/bash

# Script de vérification de l'état de santé pour le conteneur FHIRHub
# Utilisé par Docker pour vérifier que le service est opérationnel

# Paramètres
APP_URL="http://localhost:5000"
ENDPOINT="/api/system/health"
TIMEOUT=5

# Effectue une requête HTTP avec timeout
response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT $APP_URL$ENDPOINT)

# Vérifie si le code HTTP est 200 (OK)
if [ "$response" = "200" ]; then
    exit 0  # Succès
else
    echo "Healthcheck a échoué. Code HTTP: $response"
    exit 1  # Échec
fi