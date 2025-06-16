# Architecture Docker pour FHIRHub

Ce document décrit l'architecture Docker mise en place pour FHIRHub, expliquant comment les services sont organisés et comment les données sont gérées pour garantir persistance et séparation claire.

## Vue d'ensemble

L'architecture Docker de FHIRHub repose sur deux services séparés mais coordonnés :

1. **FHIRHub** - Application principale Node.js pour la conversion HL7 vers FHIR et la gestion des données
2. **HAPI FHIR** - Serveur FHIR autonome pour le stockage et la recherche de ressources FHIR

Ces services sont configurés pour être lancés ensemble avec un seul clic, tout en maintenant une séparation claire qui permet de les mettre à jour indépendamment.

## Organisation des données

Toutes les données sont stockées dans un dossier centralisé `data/` subdivisé par service :

```
data/
├── fhirhub/                # Données FHIRHub
│   ├── db/                 # Base de données SQLite
│   ├── storage/            # Stockage des données
│   ├── logs/               # Journaux
│   ├── terminology/        # Terminologies
│   └── backups/            # Sauvegardes
└── hapifhir/               # Données HAPI FHIR
```

Cette structure garantit que toutes les données sont conservées même lors des mises à jour des conteneurs Docker, et que chaque service a son propre espace de stockage isolé.

## Volumes Docker

Les volumes Docker sont configurés pour assurer la persistance des données et une organisation claire :

- `data_fhirhub_db` : Base de données SQLite
- `data_fhirhub_storage` : Stockage des données FHIRHub
- `data_fhirhub_logs` : Journaux d'application
- `data_fhirhub_terminology` : Terminologies française, etc.
- `data_hapifhir` : Données du serveur HAPI FHIR

## Communication entre services

Les services communiquent entre eux via le réseau Docker interne :

- FHIRHub utilise `http://hapifhir:8080/fhir` pour accéder au serveur HAPI FHIR
- Cette communication est transparente et sécurisée au sein du réseau Docker

## Accès externe

Les services sont exposés sur les ports suivants :

- **FHIRHub** : Port 5000
- **HAPI FHIR** : Port 8080

Ces ports peuvent être modifiés dans le fichier `.env` généré automatiquement.

## Fichiers de configuration

### docker-compose.yml

Définit les services, volumes et réseaux Docker.

### .env

Contient les variables d'environnement pour Docker, généré automatiquement par `docker-init-data.sh`.

## Scripts utilitaires

### docker-init-data.sh

Initialise la structure de dossiers pour les données et crée le fichier `.env`.

```bash
./docker-init-data.sh
```

### docker-launch.sh

Lance les services Docker en un seul clic.

```bash
./docker-launch.sh
```

## Avantages de cette architecture

1. **Séparation des services** : Chaque service peut être mis à jour indépendamment
2. **Persistance des données** : Toutes les données sont conservées dans le dossier `data/`
3. **Lancement en un clic** : Démarrage simple avec `./docker-launch.sh`
4. **Extensibilité** : Possibilité d'ajouter facilement d'autres services FHIR au besoin

## Utilisation en production

Pour un déploiement en production, il est recommandé de :

1. Utiliser des mots de passe sécurisés (modifiez le fichier `.env`)
2. Configurer HTTPS pour les communications externes
3. Limiter les accès réseau selon vos besoins
4. Mettre en place une stratégie de sauvegarde régulière des dossiers `data/`