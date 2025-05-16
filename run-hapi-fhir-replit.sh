#!/bin/bash

echo "Démarrage du serveur HAPI FHIR pour Replit..."

# Création des répertoires nécessaires
mkdir -p ./data/hapi-fhir/database
chmod -R 777 ./data

# Vérifier si le JAR existe
if [ ! -f "./hapi-fhir/hapi-fhir-server-starter-5.4.0.jar" ]; then
    echo "Le fichier JAR HAPI FHIR n'existe pas, création du répertoire..."
    mkdir -p ./hapi-fhir
    echo "Téléchargement de HAPI FHIR 5.4.0..."
    curl -L -o ./hapi-fhir/hapi-fhir-server-starter-5.4.0.jar https://github.com/hapifhir/hapi-fhir-jpaserver-starter/releases/download/v5.4.0/hapi-fhir-jpaserver-starter.war
fi

# Tuer toute instance existante
pkill -f "hapi-fhir-server-starter" || true

# Créer un fichier application.properties explicite pour éviter l'utilisation de YAML
cd ./hapi-fhir
cat > application.properties << EOL
# Configuration de la base de données
spring.datasource.url=jdbc:h2:file:../data/hapi-fhir/database/h2;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
spring.datasource.username=sa
spring.datasource.password=sa
spring.datasource.driverClassName=org.h2.Driver
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=update

# Configuration du serveur
server.port=8080

# Configuration FHIR
hapi.fhir.fhir_version=R4
hapi.fhir.default_encoding=json
hapi.fhir.allow_external_references=true
hapi.fhir.expunge_enabled=true
hapi.fhir.subscription.resthook_enabled=false
hapi.fhir.subscription.websocket_enabled=false
hapi.fhir.subscription.email_enabled=false

# Configuration de validation
fhir.validation.enabled=false
fhir.validation.request-only=true

# Configuration de journalisation
logging.level.root=WARN
logging.level.ca.uhn.fhir=WARN
spring.jpa.properties.hibernate.format_sql=false
spring.jpa.properties.hibernate.show_sql=false

# Configuration Spring
spring.main.allow-bean-definition-overriding=true
EOL

# Démarrer le serveur avec le fichier de configuration
java -Xmx512m -Dspring.config.location=file:./application.properties -jar hapi-fhir-server-starter-5.4.0.jar