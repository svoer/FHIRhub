#!/bin/bash

# Script de vérification de l'état de santé pour le conteneur FHIRHub
# Utilisé par Docker pour vérifier que le service est opérationnel

# Paramètres
APP_URL="http://localhost:5000"
HEALTH_ENDPOINT="/api/system/health"
VERSION_ENDPOINT="/api/system/version"
TIMEOUT=5

# Étape 1 : Vérifier l'endpoint de santé
echo "Vérification de l'endpoint de santé..."
health_response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT $APP_URL$HEALTH_ENDPOINT)

if [ "$health_response" != "200" ]; then
    echo "Healthcheck a échoué. Code HTTP: $health_response"
    exit 1  # Échec
fi

# Étape 2 : Vérifier l'endpoint de version (vérification secondaire)
echo "Vérification de l'endpoint de version..."
version_response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT $APP_URL$VERSION_ENDPOINT)

if [ "$version_response" != "200" ]; then
    echo "Vérification de version a échoué. Code HTTP: $version_response"
    exit 1  # Échec
fi

# Étape 3 : Vérifier l'utilisation de la mémoire
# Uniquement si nous sommes dans un conteneur (vérifier la présence de cgroups)
if [ -f /sys/fs/cgroup/memory/memory.usage_in_bytes ]; then
    echo "Vérification de l'utilisation de la mémoire..."
    mem_total=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
    mem_used=$(cat /sys/fs/cgroup/memory/memory.usage_in_bytes)
    
    # Convertir en Mo pour une meilleure lisibilité
    mem_total_mb=$((mem_total / 1024 / 1024))
    mem_used_mb=$((mem_used / 1024 / 1024))
    
    # Calculer le pourcentage d'utilisation
    mem_used_percent=$((mem_used * 100 / mem_total))
    
    echo "Utilisation de la mémoire: $mem_used_mb MB / $mem_total_mb MB ($mem_used_percent%)"
    
    # Si l'utilisation de la mémoire dépasse 90%, émettre un avertissement mais ne pas échouer
    if [ $mem_used_percent -gt 90 ]; then
        echo "AVERTISSEMENT: Utilisation élevée de la mémoire ($mem_used_percent%)"
    fi
fi

echo "Healthcheck réussi !"
exit 0  # Succès