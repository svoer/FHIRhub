# 🚨 Guide de Dépannage FHIRHub

## 📋 Aperçu

Ce guide vous aide à diagnostiquer et résoudre les problèmes courants avec FHIRHub, couvrant l'installation, la configuration, et l'utilisation.

## 🔍 Diagnostic Initial

### Commandes de Diagnostic Rapide

```bash
# Vérification complète du système
./scripts/health-check.sh

# État des services
docker-compose ps                     # Docker
systemctl status fhirhub hapi-fhir  # Native Linux
launchctl list | grep fhirhub       # macOS

# Connectivité réseau
curl -I http://localhost:5000/api/system/health
curl -I http://localhost:8080/fhir/metadata

# Logs en temps réel
docker-compose logs -f               # Docker
journalctl -u fhirhub -f            # Linux systemd
tail -f /var/log/fhirhub.log        # Général
```

### Script de Diagnostic Automatique

```bash
#!/bin/bash
# scripts/health-check.sh

echo "🔍 Diagnostic FHIRHub"
echo "===================="

# 1. Vérification des processus
echo "📊 État des services:"
if docker-compose ps 2>/dev/null | grep -q "Up"; then
    echo "✅ Docker services actifs"
    docker-compose ps
elif systemctl is-active --quiet fhirhub; then
    echo "✅ Services systemd actifs"
    systemctl status fhirhub hapi-fhir --no-pager
else
    echo "❌ Aucun service actif détecté"
fi

# 2. Connectivité
echo -e "\n🌐 Tests de connectivité:"
for endpoint in "localhost:5000/api/system/health" "localhost:8080/fhir/metadata"; do
    if curl -sf "http://$endpoint" >/dev/null; then
        echo "✅ $endpoint accessible"
    else
        echo "❌ $endpoint inaccessible"
    fi
done

# 3. Ressources système
echo -e "\n💾 Ressources système:"
echo "RAM: $(free -h | grep Mem | awk '{print $3"/"$2}')"
echo "Disque: $(df -h . | tail -1 | awk '{print $3"/"$2" ("$5" utilisé)"}')"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)% utilisé"

# 4. Ports
echo -e "\n🔌 Ports en écoute:"
netstat -tuln | grep -E ":(5000|8080|9090)" || echo "Aucun port FHIRHub détecté"

# 5. Logs récents
echo -e "\n📄 Dernières erreurs:"
if [ -f "data/fhirhub/logs/error.log" ]; then
    tail -5 data/fhirhub/logs/error.log
else
    echo "Aucun log d'erreur trouvé"
fi
```

## 🐳 Problèmes Docker

### 1. Conteneurs qui ne démarrent pas

**Symptômes:**
- `docker-compose up -d` échoue
- Services en état "Exited" ou "Restarting"

**Diagnostic:**
```bash
# Vérifier les logs des conteneurs
docker-compose logs fhirhub
docker-compose logs hapi-fhir

# Vérifier les ressources Docker
docker system df
docker system prune  # Nettoyer si nécessaire
```

**Solutions:**
```bash
# 1. Problème de mémoire
# Augmenter la mémoire allouée à Docker (Docker Desktop: Settings > Resources)

# 2. Problème de permissions
sudo chown -R $(whoami):$(whoami) data/
chmod -R 755 data/

# 3. Problème de ports
# Modifier docker-compose.yml pour utiliser d'autres ports
ports:
  - "5001:5000"  # au lieu de 5000:5000
  - "8081:8080"  # au lieu de 8080:8080

# 4. Reconstruire les conteneurs
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 2. Problèmes de Réseau Docker

**Symptômes:**
- FHIRHub ne peut pas atteindre HAPI FHIR
- Erreurs de connectivité entre services

**Diagnostic:**
```bash
# Vérifier le réseau Docker
docker network ls
docker network inspect fhirhub_fhir-network

# Tester la connectivité inter-conteneurs
docker exec fhirhub ping hapi-fhir
docker exec fhirhub curl http://hapi-fhir:8080/fhir/metadata
```

**Solutions:**
```bash
# Recréer le réseau Docker
docker-compose down
docker network prune
docker-compose up -d

# Vérifier la configuration DNS dans docker-compose.yml
```

### 3. Problèmes de Volumes Docker

**Symptômes:**
- Données perdues au redémarrage
- Erreurs de permissions sur les fichiers

**Diagnostic:**
```bash
# Vérifier les volumes
docker volume ls
docker volume inspect fhirhub_data

# Vérifier les montages
docker exec fhirhub ls -la /app/data
```

**Solutions:**
```bash
# Corriger les permissions
docker exec fhirhub chown -R node:node /app/data

# Recréer les volumes si corrompus
docker-compose down -v
docker volume prune
docker-compose up -d
```

## 💻 Problèmes Installation Native

### 1. Erreurs de Dépendances Node.js

**Symptômes:**
- `npm ci` échoue
- Erreurs de compilation native
- Modules manquants

**Diagnostic:**
```bash
# Vérifier les versions
node --version
npm --version
python3 --version

# Vérifier les outils de build
gcc --version || echo "GCC manquant"
make --version || echo "Make manquant"
```

**Solutions:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y build-essential python3-dev

# CentOS/RHEL
sudo yum groupinstall -y "Development Tools"
sudo yum install -y python3-devel

# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm cache clean --force
npm ci --production

# Si problème persistant, forcer la recompilation
npm rebuild
```

### 2. Problèmes Java et HAPI FHIR

**Symptômes:**
- HAPI FHIR ne démarre pas
- Erreurs de version Java
- OutOfMemoryError

**Diagnostic:**
```bash
# Vérifier Java
java -version
echo $JAVA_HOME

# Vérifier les processus Java
ps aux | grep java

# Tester HAPI FHIR manuellement
cd /opt/fhirhub/hapi-fhir
java -jar hapi-fhir-jpaserver-starter-*.jar --help
```

**Solutions:**
```bash
# 1. Problème de version Java
# Installer Java 11+
sudo apt install openjdk-21-jdk
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

# 2. Problème de mémoire
# Modifier le service systemd
sudo systemctl edit hapi-fhir
# Ajouter:
[Service]
Environment=JAVA_OPTS=-Xmx4g -Xms2g

# 3. Problème de base de données H2
rm -rf data/hapi-fhir/database/*
systemctl restart hapi-fhir
```

### 3. Problèmes de Services Système

**Symptômes:**
- Services ne démarrent pas automatiquement
- Erreurs systemd/launchd

**Diagnostic:**
```bash
# Linux systemd
systemctl status fhirhub
journalctl -u fhirhub --since="1 hour ago"
systemctl is-enabled fhirhub

# macOS launchd
sudo launchctl list | grep fhirhub
sudo launchctl print system/com.fhirhub
```

**Solutions:**
```bash
# Linux - Réparer les services
sudo systemctl daemon-reload
sudo systemctl enable fhirhub hapi-fhir
sudo systemctl restart fhirhub

# macOS - Réparer les services
sudo launchctl unload /Library/LaunchDaemons/com.fhirhub.plist
sudo launchctl load /Library/LaunchDaemons/com.fhirhub.plist
```

## 🔧 Problèmes de Configuration

### 1. Variables d'Environnement

**Symptômes:**
- Application utilise des valeurs par défaut incorrectes
- Erreurs de configuration manquante

**Diagnostic:**
```bash
# Vérifier les variables d'environnement
env | grep -E "(NODE_ENV|PORT|HAPI_FHIR_URL|JWT_SECRET)"

# Vérifier le fichier .env
cat .env
```

**Solutions:**
```bash
# Copier et modifier le fichier exemple
cp .env.example .env
nano .env

# Générer un nouveau secret JWT
openssl rand -hex 32

# Source le fichier .env
source .env
export $(grep -v '^#' .env | xargs)
```

### 2. Base de Données SQLite

**Symptômes:**
- Erreurs "database is locked"
- Données corrompues
- Migrations échouées

**Diagnostic:**
```bash
# Vérifier le fichier de base de données
ls -la data/fhirhub/fhirhub.db*
file data/fhirhub/fhirhub.db

# Vérifier les processus utilisant la DB
lsof data/fhirhub/fhirhub.db
```

**Solutions:**
```bash
# 1. Libérer les verrous
pkill -f fhirhub
rm -f data/fhirhub/fhirhub.db-wal data/fhirhub/fhirhub.db-shm

# 2. Réparer la base de données
sqlite3 data/fhirhub/fhirhub.db "PRAGMA integrity_check;"
sqlite3 data/fhirhub/fhirhub.db "VACUUM;"

# 3. Restaurer depuis une sauvegarde
cp data/fhirhub/fhirhub.db.backup data/fhirhub/fhirhub.db
```

### 3. Configuration CORS

**Symptômes:**
- Erreurs CORS dans le navigateur
- API inaccessible depuis l'interface web

**Diagnostic:**
```bash
# Tester CORS avec curl
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:5000/api/convert
```

**Solutions:**
```bash
# Modifier la configuration CORS dans .env
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:3000,https://yourdomain.com

# Ou désactiver temporairement CORS pour debug
ENABLE_CORS_VALIDATION=false
```

## 🌐 Problèmes de Connectivité

### 1. Ports Bloqués ou Utilisés

**Symptômes:**
- "Port already in use"
- Services inaccessibles depuis l'extérieur

**Diagnostic:**
```bash
# Vérifier les ports utilisés
netstat -tuln | grep -E ":(5000|8080)"
lsof -i :5000
lsof -i :8080

# Vérifier le firewall
sudo ufw status          # Ubuntu
sudo firewall-cmd --list-all  # CentOS/RHEL
```

**Solutions:**
```bash
# 1. Libérer les ports
sudo kill $(lsof -t -i:5000)
sudo kill $(lsof -t -i:8080)

# 2. Configurer le firewall
sudo ufw allow 5000/tcp
sudo ufw allow 8080/tcp

# 3. Utiliser des ports alternatifs
# Modifier .env ou docker-compose.yml
PORT=5001
```

### 2. Problèmes DNS/Résolution

**Symptômes:**
- FHIRHub ne peut pas résoudre "hapi-fhir"
- Erreurs de connectivité intermittentes

**Diagnostic:**
```bash
# Tester la résolution DNS
nslookup localhost
ping localhost

# Docker - vérifier la résolution interne
docker exec fhirhub nslookup hapi-fhir
```

**Solutions:**
```bash
# Ajouter des entrées dans /etc/hosts si nécessaire
echo "127.0.0.1 hapi-fhir" >> /etc/hosts

# Docker - recréer le réseau
docker network rm fhirhub_fhir-network
docker-compose up -d
```

## 🧠 Problèmes IA

### 1. Erreurs d'API IA

**Symptômes:**
- Timeouts lors des requêtes IA
- Erreurs d'authentification
- Quotas dépassés

**Diagnostic:**
```bash
# Tester les clés API
curl -H "Authorization: Bearer $MISTRAL_API_KEY" \
     https://api.mistral.ai/v1/models

curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

**Solutions:**
```bash
# 1. Vérifier et renouveler les clés API
# Connectez-vous aux consoles des fournisseurs IA

# 2. Augmenter les timeouts
AI_REQUEST_TIMEOUT=120000

# 3. Configurer un fournisseur de fallback
AI_FALLBACK_PROVIDER=ollama
```

### 2. Ollama Local

**Symptômes:**
- Ollama ne répond pas
- Modèles non téléchargés

**Diagnostic:**
```bash
# Vérifier Ollama
ollama list
ollama ps
curl http://localhost:11434/api/version
```

**Solutions:**
```bash
# Installer et configurer Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Télécharger un modèle
ollama pull llama3:8b

# Démarrer Ollama comme service
sudo systemctl enable ollama
sudo systemctl start ollama
```

## 📊 Problèmes de Performance

### 1. Lenteur des Conversions

**Symptômes:**
- Conversions HL7→FHIR très lentes
- Timeouts fréquents

**Diagnostic:**
```bash
# Analyser les logs de performance
grep "Conversion effectuée" data/fhirhub/logs/conversion.log | tail -20

# Monitorer les ressources
top -p $(pgrep node)
htop
```

**Solutions:**
```bash
# 1. Augmenter la mémoire Node.js
NODE_OPTIONS=--max-old-space-size=2048

# 2. Activer le cache
CACHE_MAX_SIZE=5000
CACHE_TTL=7200

# 3. Optimiser la base de données
sqlite3 data/fhirhub/fhirhub.db "VACUUM; ANALYZE;"
```

### 2. Fuites Mémoire

**Symptômes:**
- Utilisation mémoire croissante
- Application qui crash avec "out of memory"

**Diagnostic:**
```bash
# Monitorer la mémoire
watch -n 5 'ps aux | grep node | grep -v grep'

# Analyser les fuites avec clinic.js
npm install -g clinic
clinic doctor -- node app.js
```

**Solutions:**
```bash
# 1. Redémarrage périodique (workaround)
# Ajouter un cron job
0 2 * * * systemctl restart fhirhub

# 2. Augmenter les limites
NODE_OPTIONS=--max-old-space-size=4096

# 3. Activer le garbage collector
NODE_OPTIONS=--expose-gc --optimize-for-size
```

## 📄 Analyse des Logs

### 1. Emplacements des Logs

```bash
# Docker
docker-compose logs fhirhub
docker-compose logs hapi-fhir

# Installation native
/var/log/fhirhub.log              # macOS LaunchDaemons
journalctl -u fhirhub             # Linux systemd
data/fhirhub/logs/access.log      # Logs d'accès
data/fhirhub/logs/error.log       # Logs d'erreur
data/fhirhub/logs/conversion.log  # Logs de conversion
```

### 2. Patterns d'Erreurs Courants

```bash
# Erreurs de connexion HAPI FHIR
grep "ECONNREFUSED.*8080" data/fhirhub/logs/error.log

# Erreurs de conversion
grep "CONVERTER.*ERROR" data/fhirhub/logs/conversion.log

# Erreurs d'authentification
grep "AUTH.*FAILED" data/fhirhub/logs/access.log

# Erreurs de rate limiting
grep "Rate limit exceeded" data/fhirhub/logs/access.log
```

### 3. Script d'Analyse des Logs

```bash
#!/bin/bash
# scripts/analyze-logs.sh

echo "📊 Analyse des logs FHIRHub"

LOG_DIR="data/fhirhub/logs"

if [ -d "$LOG_DIR" ]; then
    echo "Dernières erreurs (10):"
    tail -10 "$LOG_DIR/error.log" 2>/dev/null || echo "Aucun log d'erreur"
    
    echo -e "\nStatistiques de conversion:"
    grep "Conversion effectuée" "$LOG_DIR/conversion.log" | \
        awk '{print $NF}' | sed 's/ms//' | \
        awk '{sum+=$1; count++} END {print "Moyenne:", sum/count "ms, Total:", count " conversions"}'
    
    echo -e "\nErreurs fréquentes:"
    grep "ERROR" "$LOG_DIR"/*.log | cut -d: -f3- | sort | uniq -c | sort -nr | head -5
else
    echo "Répertoire de logs non trouvé: $LOG_DIR"
fi
```

## 🔄 Procédures de Récupération

### 1. Récupération Rapide

```bash
#!/bin/bash
# scripts/quick-recovery.sh

echo "🚑 Récupération rapide FHIRHub"

# 1. Arrêter tous les services
docker-compose down 2>/dev/null || systemctl stop fhirhub hapi-fhir

# 2. Nettoyer les processus zombies
pkill -f fhirhub
pkill -f java

# 3. Corriger les permissions
chown -R $(whoami):$(whoami) data/
chmod -R 755 data/

# 4. Redémarrer
docker-compose up -d || systemctl start hapi-fhir fhirhub

# 5. Vérifier
sleep 30
curl -f http://localhost:5000/api/system/health && echo "✅ FHIRHub OK"
curl -f http://localhost:8080/fhir/metadata && echo "✅ HAPI FHIR OK"
```

### 2. Restauration depuis Sauvegarde

```bash
#!/bin/bash
# scripts/restore-backup.sh

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    exit 1
fi

echo "📦 Restauration depuis $BACKUP_FILE"

# Arrêter les services
docker-compose down

# Sauvegarder l'état actuel
mv data data.old.$(date +%Y%m%d-%H%M%S)

# Restaurer
tar -xzf "$BACKUP_FILE"

# Redémarrer
docker-compose up -d

echo "✅ Restauration terminée"
```

## 📞 Support et Escalade

### Collecte d'Informations pour Support

```bash
#!/bin/bash
# scripts/collect-support-info.sh

SUPPORT_DIR="support-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SUPPORT_DIR"

echo "📋 Collecte d'informations pour le support"

# Informations système
uname -a > "$SUPPORT_DIR/system-info.txt"
docker --version >> "$SUPPORT_DIR/system-info.txt" 2>/dev/null
node --version >> "$SUPPORT_DIR/system-info.txt" 2>/dev/null
java -version >> "$SUPPORT_DIR/system-info.txt" 2>&1

# Configuration
cp .env "$SUPPORT_DIR/" 2>/dev/null
cp docker-compose.yml "$SUPPORT_DIR/" 2>/dev/null

# Logs récents
tail -100 data/fhirhub/logs/*.log > "$SUPPORT_DIR/recent-logs.txt" 2>/dev/null

# État des services
docker-compose ps > "$SUPPORT_DIR/docker-status.txt" 2>/dev/null
systemctl status fhirhub hapi-fhir > "$SUPPORT_DIR/systemd-status.txt" 2>/dev/null

# Créer l'archive
tar -czf "${SUPPORT_DIR}.tar.gz" "$SUPPORT_DIR"
rm -rf "$SUPPORT_DIR"

echo "✅ Informations collectées dans ${SUPPORT_DIR}.tar.gz"
echo "Envoyez ce fichier au support technique"
```

Ce guide couvre la majorité des problèmes rencontrés avec FHIRHub. Pour des problèmes spécifiques non couverts, consultez les logs détaillés et contactez le support technique avec les informations collectées.