FROM node:20-alpine

WORKDIR /app

# Installation d'outils supplémentaires pour la supervision
RUN apk add --no-cache curl tini

# Copier les fichiers de configuration du projet
COPY package*.json ./
COPY tsconfig.json ./

# Installer les dépendances en mode production
RUN npm ci --only=production && npm cache clean --force

# Copier le code source et les fichiers nécessaires
COPY . .

# Créer les répertoires nécessaires avec une structure plus claire
RUN mkdir -p /app/storage/data \
             /app/storage/data/conversions \
             /app/storage/data/history \
             /app/storage/data/outputs \
             /app/storage/data/test \
             /app/storage/data/cache \
             /app/storage/data/ai_responses \
             /app/storage/logs \
             /app/storage/backups \
             /app/storage/db \
             /app/metrics

# Créer des répertoires compatibles avec l'ancienne structure pour la rétrocompatibilité
RUN mkdir -p /app/data \
             /app/data/cache \
             /app/data/ai_responses \
             /app/data/conversions \
             /app/data/history \
             /app/data/outputs \
             /app/data/test

# S'assurer que les permissions sont correctes pour l'utilisateur non-root
RUN chmod -R 777 /app/storage /app/data

# Volume mounts points (organisés selon la nouvelle structure)
VOLUME ["/app/storage/db", "/app/storage/data", "/app/storage/logs", "/app/french_terminology"]

# Exposer uniquement le port principal de l'application
EXPOSE 5000

# Utiliser un utilisateur non-root pour plus de sécurité
RUN addgroup -S fhirhub && adduser -S fhirhub -G fhirhub
RUN chown -R fhirhub:fhirhub /app
USER fhirhub

# Utiliser tini comme init pour une meilleure gestion des signaux
ENTRYPOINT ["/sbin/tini", "--"]

# Copier et rendre exécutable le script de démarrage Docker
COPY docker-startup.sh /app/
RUN chmod +x /app/docker-startup.sh

# Script de démarrage
CMD ["/app/docker-startup.sh"]