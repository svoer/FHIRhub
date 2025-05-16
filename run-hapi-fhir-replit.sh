#!/bin/bash

echo "Démarrage du serveur HAPI FHIR pour Replit..."

# Création du répertoire de base de données
mkdir -p ./hapi-fhir/database
chmod -R 777 ./hapi-fhir/database

# Tuer toute instance existante
pkill -f "hapi-fhir-server-starter" || true

# Définir les propriétés nécessaires pour le serveur HAPI FHIR
cd ./hapi-fhir

# Nous devons créer un fichier application.properties minimal plutôt qu'utiliser YAML
cat > application.properties << EOL
spring.datasource.url=jdbc:h2:file:./database/hapi_fhir_h2
spring.datasource.username=sa
spring.datasource.password=sa
spring.datasource.driverClassName=org.h2.Driver
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect
server.port=8080
hapi.fhir.fhir_version=R4
hapi.fhir.allow_external_references=true
hapi.fhir.expunge_enabled=true
fhir.validation.enabled=false
fhir.validation.request-only=true
hapi.fhir.subscription.resthook_enabled=false
hapi.fhir.subscription.websocket_enabled=false
hapi.fhir.subscription.email_enabled=false
EOL

# Démarrer le serveur avec les propriétés requises
exec java -Xmx512m \
  -Dspring.config.location=file:./application.properties \
  -Dhapi.fhir.fhir_version=R4 \
  -jar hapi-fhir-server-starter-5.4.0.jar