# Guide d'Installation FHIRHub

Ce guide détaille les procédures d'installation pour tous les modes de déploiement de FHIRHub.

## Installation Rapide (Mode Développement)

### Prérequis
- Node.js 20.x ou supérieur
- Git
- 2GB RAM minimum

### Étapes d'installation

```bash
# 1. Cloner le repository
git clone https://github.com/fhirhub/fhirhub.git
cd fhirhub

# 2. Installer les dépendances
npm install

# 3. Initialiser l'application
chmod +x start.sh
./start.sh

# 4. Accéder à l'application
# Interface web: http://localhost:5000
# Identifiants: admin / admin123
# API Key de test: dev-key
```

## Installation Mode Hospitalier (Offline)

### Prérequis complets
- Node.js 20.x
- Java OpenJDK 21
- SQLite3
- Python 3.11 (optionnel, pour terminologies)
- 4GB RAM recommandé
- 5GB espace disque

### Installation complète

```bash
# 1. Installation des dépendances système (Ubuntu/Debian)
sudo apt update
sudo apt install -y nodejs npm openjdk-21-jdk sqlite3 python3 python3-pip curl

# 2. Cloner et configurer FHIRHub
git clone https://github.com/fhirhub/fhirhub.git
cd fhirhub

# 3. Installer les dépendances Node.js
npm install

# 4. Installer les dépendances Python (optionnel)
pip3 install requests

# 5. Rendre les scripts exécutables
chmod +x *.sh

# 6. Initialiser la structure de données
./start.sh

# 7. Dans un terminal séparé, démarrer HAPI FHIR
./run-hapi-fhir-simple.sh
```

### Vérification de l'installation

```bash
# Vérifier FHIRHub
curl http://localhost:5000/api/system/health

# Vérifier HAPI FHIR
curl http://localhost:8080/fhir/metadata

# Test de conversion
curl -X POST "http://localhost:5000/api/convert" \
  -H "X-API-KEY: dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hl7Message": "MSH|^~\\&|TEST|TEST|REC|REC|202501011200||ADT^A01|123|P|2.5"}'
```

## Installation Docker (Mode Production)

### Prérequis Docker
- Docker Engine 20.x ou supérieur
- Docker Compose 2.x
- 4GB RAM minimum
- 10GB espace disque

### Installation avec Docker

```bash
# 1. Cloner le repository
git clone https://github.com/fhirhub/fhirhub.git
cd fhirhub

# 2. Initialiser l'environnement Docker
chmod +x docker-install.sh
./docker-install.sh

# 3. Démarrer les services
docker-compose up -d

# 4. Vérifier les services
docker-compose ps
docker-compose logs fhirhub
docker-compose logs hapi-fhir
```

### Configuration Docker avancée

```bash
# Fichier .env personnalisé
cat > .env << EOF
NODE_ENV=production
FHIRHUB_PORT=5000
HAPI_FHIR_PORT=8080
DB_PATH=./data/fhirhub/storage/db
JAVA_OPTS=-Xmx1024m -Xms512m
EOF

# Démarrage avec configuration personnalisée
docker-compose --env-file .env up -d
```

## Installation Service Systemd (Production)

### Configuration du service

```bash
# 1. Créer l'utilisateur système
sudo useradd -r -s /bin/false fhirhub
sudo mkdir -p /opt/fhirhub
sudo chown fhirhub:fhirhub /opt/fhirhub

# 2. Déployer l'application
sudo cp -r * /opt/fhirhub/
sudo chown -R fhirhub:fhirhub /opt/fhirhub

# 3. Installer le service FHIRHub
sudo cp fhirhub.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable fhirhub

# 4. Installer le service HAPI FHIR
sudo cp hapi-fhir.service /etc/systemd/system/
sudo systemctl enable hapi-fhir

# 5. Démarrer les services
sudo systemctl start hapi-fhir
sleep 30
sudo systemctl start fhirhub

# 6. Vérifier les services
sudo systemctl status fhirhub
sudo systemctl status hapi-fhir
```

## Configuration des Terminologies Françaises

### Installation automatique des terminologies ANS

```bash
# 1. Exécuter le script de récupération
python3 get_french_terminology.py

# 2. Vérifier les fichiers téléchargés
ls -la french_terminology/

# 3. Recharger les mappings dans l'application
curl -X POST "http://localhost:5000/api/terminology/refresh" \
  -H "X-API-KEY: dev-key"

# 4. Vérifier le chargement
curl "http://localhost:5000/api/terminology/french"
```

### Configuration manuelle des terminologies

```bash
# 1. Créer le répertoire
mkdir -p french_terminology

# 2. Télécharger les fichiers de base
curl -o french_terminology/ans_terminology_systems.json \
  "https://mos.esante.gouv.fr/NOS/TRE_R20-Pays/FHIR/TRE-R20-Pays"

# 3. Créer le fichier de mappings
cat > data/french_terminology_mappings.json << EOF
{
  "version": "1.1.0",
  "systems": {
    "COUNTRY": "https://mos.esante.gouv.fr/NOS/TRE_R20-Pays/FHIR/TRE-R20-Pays",
    "GENDER": "https://mos.esante.gouv.fr/NOS/TRE_R303-HL7v3AdministrativeGender/FHIR/TRE-R303-HL7v3AdministrativeGender",
    "PROFESSION": "https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante"
  }
}
EOF
```

## Configuration des Fournisseurs IA

### Configuration Mistral AI

```bash
# 1. Obtenir une clé API Mistral
# Rendez-vous sur https://console.mistral.ai/

# 2. Configurer via l'interface web
# - Aller à http://localhost:5000/ai-providers.html
# - Ajouter un nouveau fournisseur Mistral
# - Saisir la clé API

# 3. Ou configurer via API
curl -X POST "http://localhost:5000/api/ai-providers" \
  -H "X-API-KEY: dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mistral AI",
    "provider_type": "mistral",
    "api_key": "votre_cle_mistral",
    "model_name": "mistral-large-latest",
    "is_active": true
  }'
```

### Configuration OpenAI

```bash
# Configuration OpenAI via variables d'environnement
export OPENAI_API_KEY="votre_cle_openai"

# Ou via l'interface web
# http://localhost:5000/ai-providers.html
```

## Configuration de Sécurité

### Configuration des certificats SSL (Production)

```bash
# 1. Installer certbot
sudo apt install certbot

# 2. Obtenir un certificat
sudo certbot certonly --standalone -d votre-domaine.fr

# 3. Configurer le reverse proxy nginx
sudo apt install nginx
cat > /etc/nginx/sites-available/fhirhub << EOF
server {
    listen 443 ssl;
    server_name votre-domaine.fr;
    
    ssl_certificate /etc/letsencrypt/live/votre-domaine.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.fr/privkey.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    
    location /fhir/ {
        proxy_pass http://localhost:8080/fhir/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/fhirhub /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

### Configuration du pare-feu

```bash
# Configuration UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

# Bloquer les ports internes
sudo ufw deny 5000/tcp   # FHIRHub interne
sudo ufw deny 8080/tcp   # HAPI FHIR interne
```

## Sauvegarde et Restauration

### Configuration des sauvegardes automatiques

```bash
# 1. Créer le script de sauvegarde
cat > /opt/fhirhub/backup-daily.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/fhirhub/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Sauvegarde des données
tar -czf "$BACKUP_DIR/fhirhub-data.tar.gz" data/
tar -czf "$BACKUP_DIR/config.tar.gz" *.json *.env

# Sauvegarde de la base de données
sqlite3 storage/db/fhirhub.db ".backup $BACKUP_DIR/fhirhub.db"

# Nettoyage des anciennes sauvegardes (>30 jours)
find /opt/backups/fhirhub/ -type d -mtime +30 -exec rm -rf {} \;
EOF

chmod +x /opt/fhirhub/backup-daily.sh

# 2. Ajouter à crontab
echo "0 2 * * * /opt/fhirhub/backup-daily.sh" | sudo crontab -
```

### Restauration depuis sauvegarde

```bash
# 1. Arrêter les services
sudo systemctl stop fhirhub hapi-fhir

# 2. Restaurer les données
tar -xzf backup/fhirhub-data.tar.gz -C /opt/fhirhub/
tar -xzf backup/config.tar.gz -C /opt/fhirhub/

# 3. Restaurer la base de données
sqlite3 /opt/fhirhub/storage/db/fhirhub.db ".restore backup/fhirhub.db"

# 4. Redémarrer les services
sudo systemctl start hapi-fhir
sleep 30
sudo systemctl start fhirhub
```

## Surveillance et Maintenance

### Configuration du monitoring

```bash
# 1. Installer les outils de monitoring
sudo apt install htop iotop nethogs

# 2. Script de monitoring personnalisé
cat > /opt/fhirhub/monitor.sh << 'EOF'
#!/bin/bash
echo "=== FHIRHub System Status ==="
echo "Date: $(date)"
echo

echo "=== Services Status ==="
systemctl is-active fhirhub
systemctl is-active hapi-fhir
echo

echo "=== Memory Usage ==="
free -h
echo

echo "=== Disk Usage ==="
df -h /opt/fhirhub
echo

echo "=== API Health ==="
curl -s http://localhost:5000/api/system/health | jq .
echo

echo "=== Recent Errors ==="
tail -n 5 /opt/fhirhub/data/logs/app.log | grep ERROR
EOF

chmod +x /opt/fhirhub/monitor.sh
```

### Mise à jour de l'application

```bash
# 1. Script de mise à jour
cat > /opt/fhirhub/update.sh << 'EOF'
#!/bin/bash
echo "=== Mise à jour FHIRHub ==="

# Sauvegarde avant mise à jour
./backup-daily.sh

# Arrêt des services
sudo systemctl stop fhirhub

# Mise à jour du code
git pull origin main
npm install

# Redémarrage
sudo systemctl start fhirhub

echo "=== Mise à jour terminée ==="
EOF

chmod +x /opt/fhirhub/update.sh
```

## Résolution des Problèmes Courants

### Problème: HAPI FHIR ne démarre pas

```bash
# Diagnostic
java -version
ps aux | grep hapi

# Solution 1: Nettoyer et redémarrer
pkill -f hapi-fhir
rm -f hapi-fhir/hapi-fhir.pid
./run-hapi-fhir-simple.sh

# Solution 2: Vérifier les logs
tail -f data/hapi-fhir/logs/startup.log
```

### Problème: Erreurs de permissions base de données

```bash
# Diagnostic
ls -la storage/db/fhirhub.db

# Solution
chown fhirhub:fhirhub storage/db/fhirhub.db
chmod 664 storage/db/fhirhub.db
```

### Problème: Mémoire insuffisante

```bash
# Diagnostic
free -h
ps aux --sort=-%mem | head

# Solution: Optimiser la configuration
export NODE_OPTIONS="--max-old-space-size=1024"
export JAVA_OPTS="-Xmx512m -Xms256m"
```

## Validation de l'Installation

### Tests de fonctionnement complet

```bash
# 1. Test de santé système
curl http://localhost:5000/api/system/health

# 2. Test de conversion HL7
curl -X POST "http://localhost:5000/api/convert" \
  -H "X-API-KEY: dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "hl7Message": "MSH|^~\\&|SENDING|SENDING_FAC|RECEIVING|RECEIVING_FAC|202501011200||ADT^A01|123456|P|2.5|||NE|NE|FR\rPID|1||123456^^^HOSPITAL^MR||DOE^JOHN^MIDDLE^^MR||19800101|M|||123 MAIN ST^^CITY^STATE^12345^FR||(555)123-4567|||S||123456789|123-45-6789"
  }'

# 3. Test interface web
curl -I http://localhost:5000/

# 4. Test HAPI FHIR
curl http://localhost:8080/fhir/metadata

# 5. Test terminologies françaises
curl http://localhost:5000/api/terminology/french
```

### Performance benchmark

```bash
# Test de charge basique
for i in {1..10}; do
  curl -s -w "%{time_total}\n" -o /dev/null \
    -X POST "http://localhost:5000/api/convert" \
    -H "X-API-KEY: dev-key" \
    -H "Content-Type: application/json" \
    -d '{"hl7Message": "MSH|^~\\&|TEST|TEST|REC|REC|202501011200||ADT^A01|'$i'|P|2.5"}'
done | awk '{sum+=$1; count++} END {print "Temps moyen:", sum/count, "secondes"}'
```

L'installation est maintenant complète. Consultez la documentation technique pour les configurations avancées et les optimisations de performance.