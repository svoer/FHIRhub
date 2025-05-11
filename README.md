# FHIRHub - Écosystème d'interopérabilité santé (HL7v2.5 vers FHIR)

FHIRHub est une plateforme complète d'interopérabilité pour la santé qui convertit les messages HL7v2.5 vers le format FHIR (standard R4 version 4.0.1 conforme ANS). Cette solution portable fonctionne sans dépendances lourdes et intègre un CRM/DPI médical intelligent.

## Fonctionnalités clés

- Conversion de messages HL7v2.5 vers FHIR R4 (v4.0.1)
- Interface utilisateur moderne avec design en dégradé rouge-orange
- API REST sécurisée avec système d'authentification
- Base de données SQLite pour les logs et la persistance des données
- Terminologies médicales françaises préchargées
- Fonctionnement hors-ligne sans appels API externes
- Éditeur de workflow visuel (EAI)
- Navigation intelligente des ressources FHIR et exploration des données patient
- Intégration native avec divers fournisseurs d'IA (Mistral, Ollama, OpenAI, DeepSeek)
- Visualisateur patient avec génération de rapports assistée par IA
- Exportation et importation de templates en JSON

## Architecture optimisée

Version production qui présente :

- Une arborescence de fichiers nettoyée sans données de test
- Une base de données réinitialisée et optimisée
- Des volumes Docker nommés pour une isolation et persistance des données
- Téléchargement automatique des dépendances volumineuses
- Support du fonctionnement hors-ligne avec fichiers préchargés
- Une solution légère sans services de monitoring
- Une configuration adaptée à la production (journalisation optimisée, authentification obligatoire)

## Installation

### Prérequis

- Node.js 18+ et NPM (installation standalone)
- ou Docker et Docker Compose v2.0+ (installation containerisée)
- Java 11+ (pour le serveur HAPI FHIR local)

### Installation standalone

```bash
# Cloner le dépôt
git clone https://github.com/svoer/FHIRhub.git
cd FHIRhub

# Installer les dépendances et configurer l'application
bash ./install.sh

# Télécharger les dépendances volumineuses (HAPI FHIR, terminologies françaises)
bash ./download-dependencies.sh

# Démarrer l'application
npm start
```

### Installation Docker

```bash
# Cloner le dépôt (ou télécharger l'archive)
git clone https://github.com/votre-organisation/fhirhub.git
cd fhirhub

# Démarrer l'application avec Docker
docker-compose up -d
```

## Accès à l'application

- Interface Web: http://localhost:5000
- API: http://localhost:5000/api
- Serveur HAPI FHIR: http://localhost:8080/fhir

## Identifiants par défaut

- Utilisateur: admin
- Mot de passe: admin123

## Structure des dossiers

- `data/` - Données persistantes (historique, conversions, cache, etc.)
- `storage/` - Structure optimisée pour les données locales
  - `db/` - Base de données SQLite
  - `data/` - Cache et résultats d'analyses IA
  - `logs/` - Journaux d'application
  - `backups/` - Sauvegardes automatiques
- `french_terminology/` - Terminologies médicales françaises
- `public/` - Interface utilisateur
- `routes/` - Routes API
- `utils/` - Utilitaires et services
- `middleware/` - Middleware d'authentification et de sécurité

## Configuration

Le fichier `.env` contient toutes les variables de configuration. Pour la production, assurez-vous de :

- Générer un `SESSION_SECRET` fort et unique
- Configurer `NODE_ENV=production`
- Désactiver `BYPASS_AUTH=false` pour renforcer la sécurité
- Configurer `METRICS_ENABLED=false` pour optimiser les performances

## Intégration IA

FHIRHub intègre plusieurs modèles d'IA pour l'analyse des données patient :

- Mistral AI (via API)
- Ollama (local)
- OpenAI
- DeepSeek

Pour utiliser l'IA, configurez la clé API correspondante dans le fichier `.env` ou dans l'interface d'administration.

## Documentation technique

Pour plus de détails sur le fonctionnement interne du code et les API disponibles, consultez la documentation technique disponible à l'adresse `/documentation.html` après le démarrage de l'application.

## Support et maintenance

Pour toute question ou assistance, consultez la documentation incluse ou contactez l'équipe de support.

---

© 2025 FHIRHub - Écosystème d'interopérabilité HL7-FHIR et CRM/DPI intelligent pour la santé numérique