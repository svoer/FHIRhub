# 🚀 Guide d'Installation FHIRHub

## 📋 Aperçu Rapide

FHIRHub est une plateforme de conversion HL7 v2.5 vers FHIR R4 spécialisée dans l'interopérabilité des données de santé françaises.

**Deux méthodes d'installation disponibles :**
- 🐳 **Docker (Recommandée)** - Installation en 5 minutes
- 💻 **Installation Native** - Installation manuelle complète

## 🎯 Installation Rapide (Docker)

### Prérequis
```bash
Docker Engine >= 20.10.0
Docker Compose >= 2.0.0
RAM >= 4 Go (recommandé 8 Go)
Espace disque >= 10 Go
```

### Installation en Une Commande
```bash
curl -fsSL https://raw.githubusercontent.com/fhirhub/fhirhub/main/scripts/install-docker.sh | bash
```

### Installation Manuelle Docker
```bash
# 1. Cloner le projet
git clone https://github.com/fhirhub/fhirhub.git
cd fhirhub

# 2. Créer la structure de données
mkdir -p data/{fhirhub/{config,logs,cache,terminologies,uploads},hapi-fhir/{database,lucene}}

# 3. Configurer les permissions
chmod -R 755 data/
chmod -R 770 data/fhirhub/{logs,cache,uploads}
chmod -R 770 data/hapi-fhir

# 4. Démarrer les services
docker-compose up -d

# 5. Vérifier l'installation
curl http://localhost:5000/api/system/health
curl http://localhost:8080/fhir/metadata
```

## 🏥 Services Disponibles

Une fois installé, FHIRHub expose plusieurs services :

| Service | URL | Description |
|---------|-----|-------------|
| **FHIRHub** | http://localhost:5000 | Interface principale de conversion |
| **API REST** | http://localhost:5000/api | API de conversion HL7→FHIR |
| **HAPI FHIR** | http://localhost:8080/fhir | Serveur FHIR R4 complet |
| **Documentation** | http://localhost:5000/api-reference.html | Documentation API interactive |

## 🔧 Configuration Post-Installation

### 1. Configuration Initiale
```bash
# Créer un utilisateur administrateur
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_secure_password","email":"admin@hospital.fr"}'

# Créer une clé API
curl -X POST http://localhost:5000/api/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name":"Production Key","description":"Clé pour production"}'
```

### 2. Test de Conversion
```bash
# Test de conversion HL7→FHIR
curl -X POST http://localhost:5000/api/convert \
  -H "X-API-KEY: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "hl7Message": "MSH|^~\\&|HIS|HOPITAL|REC|REC|20241216120000||ADT^A01|12345|P|2.5|||NE|NE|FR\rPID|1||123456789^^^HOPITAL^PI||MARTIN^JEAN^CLAUDE||19800101|M||2106-3|123 RUE DE LA PAIX^^PARIS^^75001^FR||(01)23456789^PRN^CP||(01)98765432^WPN^CP||FR|RC||123456789|"
  }'
```

## 📁 Structure des Dossiers

```
fhirhub/
├── 📂 app.js                     # Point d'entrée principal
├── 📂 data/                      # Données persistantes (IMPORTANT: À sauvegarder)
│   ├── 📂 fhirhub/              # Données FHIRHub
│   │   ├── 📂 config/           # Configuration application
│   │   ├── 📂 logs/             # Logs application (770)
│   │   ├── 📂 cache/            # Cache IA et conversions (770)
│   │   ├── 📂 terminologies/    # Terminologies ANS/FR Core
│   │   └── 📂 uploads/          # Fichiers téléchargés (770)
│   └── 📂 hapi-fhir/            # Données HAPI FHIR
│       ├── 📂 database/         # Base H2 (770)
│       └── 📂 lucene/           # Index de recherche (770)
├── 📂 docker/                   # Configuration Docker
│   ├── 📂 fhirhub/             # Config FHIRHub
│   └── 📂 hapi-fhir/           # Config HAPI FHIR
└── 📂 scripts/                  # Scripts d'installation et maintenance
```

## 🔐 Sécurité et Permissions

### Permissions Linux/macOS
```bash
# Utilisateur FHIRHub (recommandé)
sudo useradd -r -s /bin/false fhirhub
sudo chown -R fhirhub:fhirhub data/

# Permissions spécifiques
chmod 755 data/                          # Lecture générale
chmod 750 data/fhirhub/config/          # Configuration protégée
chmod 770 data/fhirhub/{logs,cache,uploads}/  # Écriture application
chmod 770 data/hapi-fhir/               # Base de données HAPI
```

### Variables d'Environnement de Sécurité
```bash
# Dans .env ou docker-compose.yml
NODE_ENV=production
JWT_SECRET=your_very_long_secret_key_here
API_RATE_LIMIT=1000
CONVERSION_RATE_LIMIT=30
AUTH_RATE_LIMIT=10
ENABLE_SECURITY_HEADERS=true
```

## 📊 Monitoring et Maintenance

### Commandes de Gestion Docker
```bash
# État des services
docker-compose ps

# Logs en temps réel
docker-compose logs -f fhirhub
docker-compose logs -f hapi-fhir

# Redémarrage d'un service
docker-compose restart fhirhub

# Mise à jour
docker-compose pull
docker-compose up -d

# Arrêt propre
docker-compose down
```

### Sauvegarde
```bash
# Sauvegarde complète
tar -czf fhirhub-backup-$(date +%Y%m%d-%H%M%S).tar.gz data/

# Sauvegarde base de données uniquement
tar -czf fhirhub-db-$(date +%Y%m%d).tar.gz data/fhirhub/storage/ data/hapi-fhir/database/

# Restauration
tar -xzf fhirhub-backup-YYYYMMDD-HHMMSS.tar.gz
docker-compose restart
```

### Health Checks
```bash
# Vérification FHIRHub
curl -f http://localhost:5000/api/system/health || echo "FHIRHub DOWN"

# Vérification HAPI FHIR
curl -f http://localhost:8080/fhir/metadata || echo "HAPI FHIR DOWN"

# Vérification conversion
curl -X POST http://localhost:5000/api/convert \
  -H "X-API-KEY: test-key" \
  -H "Content-Type: application/json" \
  -d '{"hl7Message":"MSH|^~\\&|TEST|TEST|||20241216||ADT^A01|1|P|2.5"}' || echo "CONVERSION FAILED"
```

## 🚨 Dépannage Rapide

### Problèmes Courants

**1. Port 5000 déjà utilisé**
```bash
# Vérifier les processus utilisant le port
sudo lsof -i :5000
# Modifier le port dans docker-compose.yml
ports:
  - "5001:5000"  # Utiliser le port 5001 à la place
```

**2. Erreur de permissions**
```bash
# Corriger les permissions
sudo chown -R $(whoami):$(whoami) data/
chmod -R 755 data/
chmod -R 770 data/fhirhub/{logs,cache,uploads}
```

**3. HAPI FHIR ne démarre pas**
```bash
# Vérifier les logs
docker-compose logs hapi-fhir
# Nettoyer et redémarrer
docker-compose down
docker volume prune
docker-compose up -d
```

**4. Conversion échoue**
```bash
# Vérifier les logs de conversion
docker-compose logs fhirhub | grep CONVERTER
# Tester avec un message simple
curl -X POST http://localhost:5000/api/convert \
  -H "X-API-KEY: dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hl7Message":"MSH|^~\\&|TEST|TEST|||20241216||ADT^A01|1|P|2.5"}'
```

## 📚 Documentation Complète

Pour une installation native sans Docker ou une configuration avancée :
- [Installation Native Détaillée](INSTALL-NATIVE.md)
- [Guide de Configuration](CONFIGURATION.md)
- [Guide de Dépannage](TROUBLESHOOTING.md)
- [Documentation API](http://localhost:5000/api-reference.html)

## 🎯 Prochaines Étapes

1. **Accéder à l'interface** : http://localhost:5000
2. **Créer un compte administrateur**
3. **Configurer une clé API**
4. **Tester une conversion HL7→FHIR**
5. **Configurer les terminologies françaises**
6. **Intégrer avec vos systèmes**

---

**Support** : Pour toute question technique, consultez les logs avec `docker-compose logs` ou référez-vous au guide de dépannage complet.