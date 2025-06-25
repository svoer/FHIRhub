# Guide d'Installation FHIRHub

## Vue d'ensemble

FHIRHub est une plateforme de conversion HL7 v2.5 vers FHIR R4 conforme aux standards français. Ce guide décrit l'installation automatisée via les scripts fournis.

## Scripts d'Installation

### `install.sh` - Installation complète

Script d'installation automatisé avec détection multi-plateforme et fonctionnalités avancées.

**Fonctionnalités principales :**
- ✅ Détection automatique de l'OS (Ubuntu, CentOS, Alpine, macOS)
- ✅ Vérification des prérequis système (mémoire, espace disque, architecture)
- ✅ Installation des dépendances système et Node.js
- ✅ Configuration Docker optionnelle
- ✅ Validation de l'environnement
- ✅ Tests de santé automatiques
- ✅ Système de rollback en cas d'erreur
- ✅ Interface colorée avec barres de progression

### `start.sh` - Démarrage et supervision

Script de démarrage avancé avec supervision et monitoring intégré.

**Fonctionnalités principales :**
- ✅ Démarrage/arrêt gracieux de l'application
- ✅ Tests de santé complets (processus, réseau, HTTP)
- ✅ Mode daemon pour l'arrière-plan
- ✅ Monitoring en temps réel
- ✅ Gestion des logs centralisée
- ✅ Détection automatique des processus existants

## Installation Rapide

### Prérequis Minimaux

- **OS**: Linux (Ubuntu 18+, CentOS 7+, Alpine 3.12+) ou macOS 10.15+
- **CPU**: x86_64 ou ARM64
- **RAM**: 2GB minimum, 4GB recommandé
- **Disque**: 1GB d'espace libre
- **Node.js**: v16+ (sera installé si absent)
- **Accès**: sudo pour l'installation des dépendances système

### Installation en Une Commande

```bash
# Cloner le dépôt
git clone https://github.com/your-org/fhirhub.git
cd fhirhub

# Rendre les scripts exécutables
chmod +x install.sh start.sh

# Installation complète
./install.sh

# Démarrage
./start.sh
```

## Options d'Installation

### `install.sh` - Options détaillées

```bash
# Installation standard
./install.sh

# Installation en mode verbeux
./install.sh --verbose

# Installation silencieuse
./install.sh --quiet

# Ignorer Docker
./install.sh --skip-docker

# Forcer la réinstallation
./install.sh --force

# Mode simulation (aucune modification)
./install.sh --dry-run

# Aide
./install.sh --help
```

### `start.sh` - Commandes disponibles

```bash
# Démarrage standard
./start.sh

# Démarrage en arrière-plan
./start.sh --daemon

# Démarrage sans build
./start.sh --no-build

# Redémarrage forcé
./start.sh restart --force

# Vérifier le statut
./start.sh status

# Tests de santé uniquement
./start.sh health

# Monitoring en temps réel
./start.sh monitor

# Affichage des logs
./start.sh logs

# Arrêt de l'application
./start.sh stop
```

## Configuration Avancée

### Variables d'Environnement

Le fichier `.env` est automatiquement créé lors de l'installation. Variables principales :

```bash
# Configuration de base
NODE_ENV=development          # ou production
PORT=5000                    # Port d'écoute
LOG_LEVEL=info              # debug, info, warn, error

# Base de données
DATABASE_URL=sqlite:./storage/db/fhirhub.db

# Sécurité (optionnel)
JWT_SECRET=your-secret-key
API_RATE_LIMIT=100

# FHIR Server (optionnel)
FHIR_SERVER_URL=https://hapi.fhir.org/baseR4
```

### Configuration Docker (Optionnel)

Si Docker est détecté, l'installateur propose une configuration conteneurisée :

```bash
# Installation avec Docker
./install.sh
# Répondre 'y' à la question Docker

# Démarrage avec Docker
docker-compose up -d

# Monitoring Docker
docker-compose logs -f
```

## Supervision et Monitoring

### Mode Monitoring Intégré

```bash
# Lancer le monitoring en temps réel
./start.sh monitor
```

Affiche :
- État du processus et PID
- Utilisation CPU/mémoire
- Temps de réponse HTTP
- Logs récents
- Mise à jour automatique toutes les 5 secondes

### Intégration Systemd (Production)

Pour un déploiement en production, créer un service systemd :

```bash
# Créer le fichier service
sudo cat > /etc/systemd/system/fhirhub.service << 'EOF'
[Unit]
Description=FHIRHub - HL7 to FHIR Converter
After=network.target

[Service]
Type=forking
User=fhirhub
WorkingDirectory=/opt/fhirhub
ExecStart=/opt/fhirhub/start.sh --daemon
ExecStop=/opt/fhirhub/start.sh stop
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Activer et démarrer
sudo systemctl enable fhirhub
sudo systemctl start fhirhub
sudo systemctl status fhirhub
```

## Résolution de Problèmes

### Problèmes Courants

#### 1. Erreur de permissions
```bash
# Solution
sudo chown -R $USER:$USER .
chmod +x install.sh start.sh
```

#### 2. Node.js version incorrecte
```bash
# Vérifier la version
node --version

# Installer Node.js 16+ si nécessaire
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 3. Port déjà utilisé
```bash
# Changer le port
export PORT=3000
./start.sh

# Ou modifier .env
echo "PORT=3000" >> .env
```

#### 4. Échec de compilation better-sqlite3
```bash
# Installer les dépendances de build
sudo apt-get install build-essential python3-dev libsqlite3-dev

# Forcer la recompilation
npm rebuild better-sqlite3 --build-from-source
```

### Logs et Diagnostic

#### Localisation des logs
```bash
# Logs d'installation
cat install.log

# Logs de démarrage
cat logs/startup.log

# Logs d'application
cat logs/app.log
tail -f logs/app.log  # Temps réel
```

#### Mode debug
```bash
# Installation avec debug
./install.sh --verbose

# Démarrage avec debug
./start.sh --verbose

# Tests de santé détaillés
./start.sh health --verbose
```

### Tests de Validation

#### Validation manuelle post-installation
```bash
# Test 1: Vérification des processus
./start.sh status

# Test 2: Test HTTP basique
curl http://localhost:5000/

# Test 3: Test API santé
curl http://localhost:5000/health

# Test 4: Test de conversion
curl -X POST http://localhost:5000/api/convert \
  -H "Content-Type: application/json" \
  -d '{"hl7Message": "MSH|^~\\&|TEST|||20230101000000||ADT^A01|123|P|2.5"}'
```

## Mise à Jour

### Mise à jour automatique
```bash
# Arrêter l'application
./start.sh stop

# Mettre à jour le code
git pull origin main

# Réinstaller les dépendances
./install.sh --force

# Redémarrer
./start.sh
```

### Sauvegarde avant mise à jour
```bash
# Sauvegarde de la base de données
cp -r storage/db storage/db.backup.$(date +%Y%m%d)

# Sauvegarde de la configuration
cp .env .env.backup.$(date +%Y%m%d)
```

## Performance et Tuning

### Configuration Production

```bash
# Variables d'environnement optimisées
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"
export UV_THREADPOOL_SIZE=16

# Démarrage optimisé
./start.sh --daemon
```

### Monitoring Avancé

Pour un monitoring plus poussé, intégrer avec :
- **PM2** : Gestionnaire de processus Node.js
- **Grafana** : Tableaux de bord de monitoring
- **Prometheus** : Collecte de métriques
- **ELK Stack** : Centralisation des logs

## Support

### Documentation
- [Guide Utilisateur](./docs/user-guide.md)
- [API Reference](./docs/api-reference.md)
- [Guide Développeur](./docs/developer-guide.md)

### Communauté
- GitHub Issues : Signalement de bugs
- Discussions : Questions et échanges
- Wiki : Documentation communautaire

### Contact
- Email technique : support@fhirhub.fr
- Slack : #fhirhub-support

---

*Ce guide est maintenu à jour avec chaque version de FHIRHub. Dernière mise à jour : v2.1.0*