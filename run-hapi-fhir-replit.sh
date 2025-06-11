#!/bin/bash

echo "===== Démarrage du serveur HAPI FHIR pour Replit ====="

# Variables
HAPI_VERSION="5.7.0"
HAPI_DIR="./hapi-fhir"
DATA_DIR="./data/hapi-fhir"
DATABASE_DIR="$DATA_DIR/database"
CONFIG_DIR="$HAPI_DIR/config"
LOGS_DIR="$DATA_DIR/logs"
WAR_FILE="$HAPI_DIR/hapi-fhir-jpaserver-starter.war"
TOMCAT_VERSION="9.0.73"
TOMCAT_DIR="$HAPI_DIR/tomcat"

# Fonction pour arrêter les processus HAPI FHIR existants
stop_existing_servers() {
  echo "Arrêt des instances précédentes de HAPI FHIR..."
  pkill -f "hapi-fhir-jpaserver-starter" || true
  pkill -f "org.apache.catalina.startup.Bootstrap" || true
  sleep 1
}

# Fonction pour créer tous les répertoires nécessaires
create_directories() {
  echo "Création des répertoires nécessaires..."
  
  # Répertoires principaux
  mkdir -p "$HAPI_DIR"
  mkdir -p "$DATABASE_DIR"
  mkdir -p "$CONFIG_DIR"
  mkdir -p "$LOGS_DIR"
  mkdir -p "$TOMCAT_DIR"
  
  # S'assurer que les permissions sont correctes
  chmod -R 777 "$DATA_DIR" || echo "Avertissement: impossible de modifier les permissions sur $DATA_DIR"
  chmod -R 777 "$HAPI_DIR" || echo "Avertissement: impossible de modifier les permissions sur $HAPI_DIR"
}

# Fonction pour télécharger le fichier WAR HAPI FHIR si nécessaire
download_hapi_fhir() {
  if [ ! -f "$WAR_FILE" ]; then
    echo "Téléchargement de HAPI FHIR $HAPI_VERSION..."
    curl -L -o "$WAR_FILE" "https://github.com/hapifhir/hapi-fhir-jpaserver-starter/releases/download/v$HAPI_VERSION/hapi-fhir-jpaserver-starter.war"
    
    if [ ! -f "$WAR_FILE" ]; then
      echo "ERREUR: Impossible de télécharger HAPI FHIR. Vérifiez votre connexion Internet."
      exit 1
    fi
    
    echo "Téléchargement terminé!"
  else
    echo "Le fichier WAR HAPI FHIR existe déjà."
  fi
}

# Fonction pour créer un fichier application.properties explicite
create_application_properties() {
  echo "Création du fichier application.properties..."
  
  cat > "$CONFIG_DIR/application.properties" << EOL
# Configuration de la base de données
spring.datasource.url=jdbc:h2:file:$DATABASE_DIR/h2;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
spring.datasource.username=sa
spring.datasource.password=sa
spring.datasource.driverClassName=org.h2.Driver
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=update

# Configuration du serveur
server.port=8080
server.servlet.context-path=/

# Configuration du conteneur d'application
spring.main.web-application-type=servlet
spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration

# Configuration FHIR
hapi.fhir.fhir_version=R4
hapi.fhir.default_encoding=json
hapi.fhir.allow_external_references=true
hapi.fhir.allow_multiple_delete=true
hapi.fhir.allow_placeholder_references=true
hapi.fhir.server_address=http://localhost:8080/fhir
hapi.fhir.expunge_enabled=true
hapi.fhir.advanced_lucene_indexing=false

# Désactiver les subscriptions pour éviter les erreurs
hapi.fhir.subscription.resthook_enabled=false
hapi.fhir.subscription.websocket_enabled=false
hapi.fhir.subscription.email_enabled=false

# Configuration de la validation
hapi.fhir.validation.enabled=false
hapi.fhir.validation.request_only=true

# Configuration des interceptions
hapi.fhir.narratives_enabled=false
hapi.fhir.binary_storage_enabled=false
hapi.fhir.bulk_export_enabled=false

# Configuration de la JPA
spring.jpa.properties.hibernate.format_sql=false
spring.jpa.properties.hibernate.show_sql=false
spring.jpa.properties.hibernate.hbm2ddl.auto=update
spring.jpa.properties.hibernate.cache.use_query_cache=false
spring.jpa.properties.hibernate.cache.use_second_level_cache=false
spring.jpa.properties.hibernate.cache.use_structured_entries=false
spring.jpa.properties.hibernate.cache.use_minimal_puts=false

# Configuration de journalisation
logging.level.root=WARN
logging.level.ca.uhn.fhir=WARN
logging.level.org.springframework=WARN
logging.level.org.hibernate=WARN
logging.level.org.quartz=WARN
logging.file.name=$LOGS_DIR/hapi-fhir.log
logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n

# Configuration Spring
spring.main.allow-bean-definition-overriding=true
spring.main.allow-circular-references=true
EOL
}

# Fonction pour lancer HAPI FHIR avec Java directement
run_hapi_fhir() {
  echo "Démarrage du serveur HAPI FHIR..."
  echo "Le serveur sera accessible à l'adresse: http://localhost:8080/fhir"
  
  # Définition des options JVM pour optimiser la performance (réduit pour Replit)
  JAVA_OPTS="-Xmx256m -Xms128m -XX:+UseSerialGC -XX:MaxRAMPercentage=50.0"
  
  # Lancement en arrière-plan avec redirection des logs
  cd "$HAPI_DIR" || exit 1
  mkdir -p "$LOGS_DIR"
  java $JAVA_OPTS -Dspring.config.location=file:./config/application.properties -jar hapi-fhir-jpaserver-starter.war > "$LOGS_DIR/startup.log" 2>&1 &
  
  # Récupération du PID
  HAPI_PID=$!
  echo "HAPI FHIR démarré avec PID: $HAPI_PID"
  mkdir -p "$HAPI_DIR"
  echo "$HAPI_PID" > "$HAPI_DIR/hapi.pid"
  
  # Vérification du démarrage
  echo "Attente du démarrage du serveur (cela peut prendre jusqu'à 60 secondes)..."
  for i in {1..12}; do
    sleep 5
    if curl -s -f http://localhost:8080/fhir/metadata > /dev/null; then
      echo "✅ Le serveur HAPI FHIR est opérationnel!"
      echo "Accédez à http://localhost:8080/fhir"
      exit 0
    else
      echo "Attente... ($i/12)"
    fi
  done
  
  # Vérification des logs en cas d'échec
  echo "⚠️ Le serveur n'a pas démarré correctement dans le temps imparti."
  echo "Vérification des dernières lignes du log de démarrage:"
  tail -n 20 "$LOGS_DIR/startup.log"
  
  # Vérification si le processus est toujours en cours d'exécution
  if ps -p $HAPI_PID > /dev/null; then
    echo "Le processus HAPI FHIR est en cours d'exécution, mais ne répond pas encore. Veuillez vérifier les logs."
  else
    echo "❌ Le processus HAPI FHIR s'est arrêté prématurément. Consultez les logs pour plus de détails."
  fi
}

# Exécution des fonctions
stop_existing_servers
create_directories
download_hapi_fhir
create_application_properties
run_hapi_fhir