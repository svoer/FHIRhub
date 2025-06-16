# Dockerfile pour FHIRHub
# Image de base Node.js LTS
FROM node:20-alpine

# Métadonnées du conteneur
LABEL maintainer="FHIRHub Support"
LABEL description="Convertisseur HL7v2 vers FHIR R4 et explorateur de ressources FHIR"
LABEL version="1.0.0"

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=5000

# Répertoire de travail dans le conteneur
WORKDIR /app

# Installation des dépendances système nécessaires
# curl : pour tests et téléchargements
# bash : nécessaire pour les scripts shell
# sqlite : pour la base de données locale (nom correct du package dans Alpine)
# unzip : pour extraire les terminologies
RUN apk add --no-cache \
    curl \
    bash \
    sqlite \
    unzip

# Copie des fichiers de dépendances avant le reste du code
# pour optimiser le cache Docker lors des builds
COPY package*.json ./

# Installation des dépendances Node.js
# --only=production : n'installe pas les dépendances de développement
# --no-optional : ignore les dépendances optionnelles
RUN npm ci --only=production --no-optional

# Copie du code source dans le conteneur
COPY . .

# Création des répertoires nécessaires
# Ces répertoires seront liés à des volumes pour la persistance des données
RUN mkdir -p \
    /app/storage/db \
    /app/storage/data/cache \
    /app/french_terminology \
    /app/logs \
    /app/data/fhirhub \
    /app/temp

# Attribution des droits d'accès appropriés
RUN chmod -R 755 /app && \
    chmod -R 777 /app/storage /app/french_terminology /app/logs /app/data /app/temp

# Ajout d'un script de vérification de santé pour faciliter le débogage
COPY ./healthcheck.sh /healthcheck.sh
RUN chmod +x /healthcheck.sh

# Port exposé par le serveur
EXPOSE 5000

# Commande de démarrage du serveur
CMD ["node", "app.js"]

# Vérification de santé du conteneur
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /healthcheck.sh