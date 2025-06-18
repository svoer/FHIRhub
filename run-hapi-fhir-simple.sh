#!/bin/bash

echo "===== Démarrage HAPI FHIR simplifié pour Replit ====="

# Arrêter les processus existants
pkill -f "hapi-fhir" || true
sleep 2

# Variables
HAPI_DIR="./hapi-fhir"
JAR_FILE="$HAPI_DIR/hapi-fhir-server-starter-6.10.5.jar"

# Vérifier que le JAR existe, sinon télécharger
if [ ! -f "$JAR_FILE" ]; then
    echo "JAR HAPI FHIR manquant. Téléchargement en cours..."
    mkdir -p "$HAPI_DIR"
    
    # Télécharger la version compatible Java 21
    curl -L -o "$JAR_FILE" \
        "https://github.com/hapifhir/hapi-fhir-jpaserver-starter/releases/download/v6.10.5/hapi-fhir-jpaserver-starter-6.10.5.jar" \
        --connect-timeout 30 --max-time 120
    
    if [ ! -f "$JAR_FILE" ] || [ ! -s "$JAR_FILE" ]; then
        echo "⚠️ Échec du téléchargement. Utilisation du serveur FHIR public en fallback."
        echo "FHIRHub continuera de fonctionner avec https://hapi.fhir.org/baseR4"
        exit 0
    fi
    echo "✅ JAR téléchargé avec succès"
fi

# Créer les répertoires nécessaires
mkdir -p data/hapi-fhir/{database,logs}

# Configuration JVM optimisée pour Java 21 et Replit
export JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseG1GC -Dserver.port=8080 --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED"

# Démarrer HAPI FHIR
echo "Démarrage du serveur HAPI FHIR..."
cd "$HAPI_DIR"

# Lancer en arrière-plan
java $JAVA_OPTS \
    -Dspring.datasource.url=jdbc:h2:file:../data/hapi-fhir/database/h2;DB_CLOSE_DELAY=-1 \
    -Dspring.datasource.username=sa \
    -Dspring.datasource.password=sa \
    -Dspring.jpa.hibernate.ddl-auto=update \
    -Dhapi.fhir.fhir_version=R4 \
    -Dhapi.fhir.server_address=http://localhost:8080/fhir \
    -Dlogging.level.root=WARN \
    -jar hapi-fhir-server-starter-6.10.5.jar > ../data/hapi-fhir/logs/hapi-fhir.log 2>&1 &

HAPI_PID=$!
echo "HAPI FHIR PID: $HAPI_PID"
echo $HAPI_PID > hapi-fhir.pid

# Attendre que le serveur démarre
echo "Attente du démarrage (jusqu'à 90 secondes)..."
for i in {1..18}; do
    sleep 5
    if curl -s -f http://localhost:8080/fhir/metadata > /dev/null 2>&1; then
        echo "✅ HAPI FHIR opérationnel sur http://localhost:8080/fhir"
        exit 0
    fi
    echo "Attente... ($i/18)"
done

echo "⚠️ Timeout - Vérification des logs:"
tail -n 10 ../data/hapi-fhir/logs/hapi-fhir.log
exit 1