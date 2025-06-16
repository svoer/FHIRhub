# FHIRHub - Plateforme de Conversion HL7 vers FHIR

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com/fhirhub/fhirhub)
[![Node.js](https://img.shields.io/badge/node.js-20.x-green.svg)](https://nodejs.org/)
[![FHIR](https://img.shields.io/badge/FHIR-R4-orange.svg)](https://hl7.org/fhir/R4/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)]()

FHIRHub est une plateforme sophistiquée de conversion HL7 v2.5 vers FHIR R4, spécialement conçue pour l'interopérabilité des données de santé en France. Elle intègre les terminologies françaises (ANS/FR Core) et offre des capacités d'IA avancées pour l'analyse des données patients.

## 🚀 Caractéristiques principales

### Conversion et Interopérabilité
- **Conversion HL7 v2.5 → FHIR R4** : Support complet des messages ADT, ORU, ORM, MDM, SIU
- **Terminologies françaises** : Intégration native des référentiels ANS et profils FR Core
- **Cache intelligent** : Optimisation des performances avec mise en cache des conversions
- **Validation avancée** : Vérification syntaxique et sémantique des messages

### Interface et Gestion
- **Interface web multilingue** : Interface utilisateur en français avec support international
- **Tableau de bord temps réel** : Métriques, statistiques et monitoring avancé
- **Gestion des applications** : Support multi-tenant avec isolation des données
- **API RESTful complète** : Documentation interactive Swagger/OpenAPI

### IA et Analyse
- **Chatbot patient intelligent** : Analyse contextuelle des dossiers FHIR avec Mistral AI
- **Support multi-fournisseurs IA** : Anthropic Claude, OpenAI GPT, Mistral AI
- **Analyse sémantique** : Extraction d'insights à partir des données FHIR

### Déploiement et Infrastructure
- **Mode hospitalier (offline)** : Déploiement autonome avec HAPI FHIR local
- **Mode SaaS** : Architecture cloud-native avec Docker
- **Haute disponibilité** : Support de la persistance et de la montée en charge

## 📋 Prérequis

### Système
- **Node.js** : Version 20.x ou supérieure
- **Java** : OpenJDK 21 (pour HAPI FHIR)
- **SQLite** : Base de données intégrée
- **Docker** : Optionnel pour le déploiement conteneurisé

### Ressources recommandées
- **RAM** : 2 GB minimum, 4 GB recommandé
- **Stockage** : 5 GB d'espace libre
- **Réseau** : Accès Internet pour les terminologies ANS (optionnel en mode offline)

## 🛠️ Installation

### Installation rapide (Mode développement)

```bash
# Cloner le repository
git clone https://github.com/fhirhub/fhirhub.git
cd fhirhub

# Installer les dépendances
npm install

# Initialiser la structure de données
./start.sh
```

### Installation Docker (Mode production)

```bash
# Initialiser l'environnement Docker
./docker-install.sh

# Démarrer les services
docker-compose up -d
```

### Installation mode hospitalier (Offline)

```bash
# Installation complète avec HAPI FHIR local
./install.sh

# Démarrer FHIRHub
./start.sh

# Démarrer HAPI FHIR (terminal séparé)
./run-hapi-fhir-simple.sh
```

## 🚀 Démarrage rapide

### 1. Configuration initiale

```bash
# Démarrer l'application
npm start

# Ou utiliser le script complet
./start.sh
```

L'application sera accessible à l'adresse : **http://localhost:5000**

### 2. Authentification

**Compte administrateur par défaut :**
- Nom d'utilisateur : `admin`
- Mot de passe : `admin123`

**Clé API de développement :** `dev-key`

### 3. Premier test de conversion

```bash
# Test avec curl
curl -X POST "http://localhost:5000/api/convert" \
  -H "X-API-KEY: dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "hl7Message": "MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|202501011200||ADT^A01|123456|P|2.5|||NE|NE|FR"
  }'
```

## 📖 Documentation

### Architecture du système

```
FHIRHub/
├── app.js                 # Point d'entrée principal
├── src/                   # Code source
│   ├── converters/        # Moteurs de conversion HL7→FHIR
│   ├── terminology/       # Gestionnaire terminologies françaises
│   ├── cache/             # Système de cache intelligent
│   └── services/          # Services métiers
├── routes/                # Routes API Express.js
├── middleware/            # Authentification et validation
├── public/                # Interface web
├── data/                  # Données persistantes
│   ├── db/               # Base SQLite
│   ├── terminologies/    # Référentiels ANS
│   └── cache/            # Cache de conversion
└── hapi-fhir/            # Serveur HAPI FHIR intégré
```

### APIs principales

#### Conversion
- `POST /api/convert` - Conversion HL7 → FHIR (JSON)
- `POST /api/convert/raw` - Conversion texte brut
- `POST /api/convert/validate` - Validation syntaxique
- `POST /api/convert/file` - Upload de fichiers HL7

#### Authentification
- `POST /api/auth/login` - Connexion utilisateur
- `POST /api/auth/refresh` - Renouvellement token JWT
- `GET /api/auth/verify` - Vérification token

#### Gestion des données
- `GET /api/stats` - Statistiques de conversion
- `GET /api/applications` - Gestion des applications
- `GET /api/terminologies` - Terminologies disponibles

#### IA et Analyse
- `POST /api/ai/chat` - Chatbot patient
- `POST /api/ai/analyze-patient` - Analyse de dossier FHIR

### Authentification et sécurité

FHIRHub implémente un système d'authentification double :

1. **JWT (JSON Web Tokens)** : Pour l'interface web
2. **Clés API** : Pour l'intégration programmatique

```javascript
// Exemple d'authentification JWT
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
});

// Exemple d'utilisation de clé API
const conversion = await fetch('/api/convert', {
  method: 'POST',
  headers: {
    'X-API-KEY': 'dev-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ hl7Message: '...' })
});
```

## 🏥 Déploiement hospitalier (Mode offline)

### Configuration HAPI FHIR local

```bash
# Démarrer HAPI FHIR
./run-hapi-fhir-simple.sh

# Vérifier le statut
curl http://localhost:8080/fhir/metadata
```

### Configuration des terminologies françaises

```bash
# Mettre à jour les terminologies ANS
python3 get_french_terminology.py

# Recharger les mappings
curl -X POST "http://localhost:5000/api/terminology/refresh" \
  -H "X-API-KEY: dev-key"
```

### Service systemd (Production)

```bash
# Installation du service
sudo cp fhirhub.service /etc/systemd/system/
sudo systemctl enable fhirhub
sudo systemctl start fhirhub

# Vérification du statut
sudo systemctl status fhirhub
```

## 🐳 Déploiement Docker

### Configuration Docker Compose

```yaml
# docker-compose.yml (extrait)
version: '3.8'
services:
  fhirhub:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - ./data/fhirhub:/app/storage
    environment:
      - NODE_ENV=production
      - HAPI_FHIR_URL=http://hapi-fhir:8080/fhir

  hapi-fhir:
    image: hapiproject/hapi:latest
    ports:
      - "8080:8080"
    volumes:
      - ./data/hapi-fhir:/data/hapi
```

### Commandes Docker

```bash
# Construction et démarrage
docker-compose up -d

# Monitoring
docker-compose logs -f fhirhub
docker-compose logs -f hapi-fhir

# Sauvegarde des données
docker-compose exec fhirhub ./backup-docker-data.sh
```

## 🔧 Configuration avancée

### Variables d'environnement

```bash
# Configuration Node.js
export NODE_ENV=production
export PORT=5000

# Configuration FHIR
export HAPI_FHIR_URL=http://localhost:8080/fhir
export FHIR_REQUEST_TIMEOUT=30000

# Configuration IA
export MISTRAL_API_KEY=your_mistral_key
export OPENAI_API_KEY=your_openai_key

# Configuration cache
export CACHE_MAX_SIZE=1000
export CACHE_TTL=3600
```

### Personnalisation des terminologies

```json
{
  "version": "1.1.0",
  "systems": {
    "COUNTRY": "https://mos.esante.gouv.fr/NOS/TRE_R20-Pays/FHIR/TRE-R20-Pays",
    "GENDER": "https://mos.esante.gouv.fr/NOS/TRE_R303-HL7v3AdministrativeGender/FHIR/TRE-R303-HL7v3AdministrativeGender",
    "PROFESSION": "https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante"
  }
}
```

## 📊 Monitoring et métriques

### Métriques disponibles
- **Conversions par seconde** : Débit de traitement
- **Temps de réponse moyen** : Performance du système
- **Taux de succès** : Fiabilité des conversions
- **Utilisation mémoire** : Consommation ressources
- **Cache hit ratio** : Efficacité du cache

### Endpoints de monitoring

```bash
# Statistiques système
curl http://localhost:5000/api/stats

# Santé de l'application
curl http://localhost:5000/api/system/health

# Métriques Prometheus (optionnel)
curl http://localhost:5000/metrics
```

## 🧪 Tests et validation

### Tests d'intégration

```bash
# Test de conversion basique
npm test

# Test avec message HL7 complet
curl -X POST "http://localhost:5000/api/convert/validate" \
  -H "X-API-KEY: dev-key" \
  -d "MSH|^~\&|SENDING_APP|..."
```

### Validation des terminologies

```bash
# Vérification des mappings ANS
curl http://localhost:5000/api/terminology/french

# Test de résolution de codes
curl "http://localhost:5000/api/terminology/resolve?system=GENDER&code=M"
```

## 🚨 Résolution des problèmes

### Problèmes courants

**1. HAPI FHIR ne démarre pas**
```bash
# Vérifier Java
java -version

# Nettoyer et redémarrer
pkill -f hapi-fhir
./run-hapi-fhir-simple.sh
```

**2. Erreurs de permissions sur la base de données**
```bash
# Corriger les permissions
chmod 666 storage/db/fhirhub.db
chown $USER:$USER storage/db/fhirhub.db
```

**3. Terminologies françaises non disponibles**
```bash
# Recharger les terminologies
python3 get_french_terminology.py
curl -X POST http://localhost:5000/api/terminology/refresh
```

### Logs et débogage

```bash
# Logs FHIRHub
tail -f data/logs/app.log

# Logs HAPI FHIR
tail -f data/hapi-fhir/logs/hapi-fhir.log

# Mode debug
DEBUG=fhirhub:* npm start
```

## 🤝 Contribution

### Structure du projet
- **Backend** : Node.js/Express avec architecture modulaire
- **Frontend** : HTML5/CSS3/JavaScript vanilla
- **Base de données** : SQLite avec Better-SQLite3
- **Tests** : Jest pour les tests unitaires
- **Documentation** : JSDoc pour l'API

### Standards de code
- **Style** : Utilisation d'ESLint avec configuration standard
- **Commits** : Messages descriptifs en français
- **Branches** : GitFlow avec branches feature/develop/main

## 📄 Licence et conformité

### Conformité réglementaire
- **RGPD** : Gestion complète des données personnelles
- **HDS** : Compatible hébergement de données de santé
- **ANSSI** : Recommandations de sécurité appliquées
- **ANS** : Conformité aux référentiels nationaux

### Sécurité
- **Chiffrement** : TLS 1.3 pour les communications
- **Authentification** : Tokens JWT avec rotation
- **Audit** : Logs complets des accès et modifications
- **Isolation** : Séparation stricte des données par application

## 📞 Support

### Documentation complète
- **Interface web** : http://localhost:5000/documentation.html
- **API Reference** : http://localhost:5000/api-reference.html
- **FAQ** : http://localhost:5000/faq.html

### Contact technique
- **Issues GitHub** : Pour les bugs et demandes de fonctionnalités
- **Documentation** : Wiki du projet pour les guides détaillés
- **Support entreprise** : Contact commercial disponible

---

**FHIRHub** - Développé avec ❤️ pour l'interopérabilité en santé française