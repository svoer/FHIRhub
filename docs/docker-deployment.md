# Guide de déploiement Docker pour FHIRHub + HAPI FHIR

Ce document explique comment déployer FHIRHub et HAPI FHIR dans des conteneurs Docker pour créer un environnement de développement ou de production complet.

## Prérequis

- Docker Engine (version 20.10.0 ou supérieure)
- Docker Compose (version 2.0.0 ou supérieure)
- 2 Go de RAM minimum
- 5 Go d'espace disque pour les images et les données

## Architecture

L'architecture de déploiement comprend deux services principaux :

1. **FHIRHub** (port 5000) : Application de conversion HL7v2 vers FHIR et explorateur de ressources FHIR
2. **HAPI FHIR** (port 8080) : Serveur FHIR R4 pour stocker et interroger les ressources FHIR

Les données sont stockées de manière persistante dans les répertoires suivants :

```
./data/
├── fhirhub/
│   ├── french_terminology/ # Terminologies médicales françaises
│   ├── logs/               # Journaux d'application
│   ├── storage/            # Base de données SQLite et cache
│   └── temp/               # Fichiers temporaires
└── hapi-fhir/              # Base de données H2 du serveur HAPI FHIR
```

## Installation rapide

Pour déployer l'environnement complet, exécutez simplement :

```bash
chmod +x docker-install.sh
./docker-install.sh
```

Ce script :
1. Vérifie la présence de Docker et Docker Compose
2. Crée les répertoires nécessaires pour les données persistantes
3. Construit et démarre les conteneurs
4. Effectue des tests de connectivité basiques

## Déploiement manuel

Si vous préférez une installation manuelle, suivez ces étapes :

1. Créer les répertoires de données nécessaires :
   ```bash
   mkdir -p data/fhirhub/storage/db
   mkdir -p data/fhirhub/storage/data/cache
   mkdir -p data/fhirhub/french_terminology
   mkdir -p data/fhirhub/logs
   mkdir -p data/fhirhub/temp
   mkdir -p data/hapi-fhir
   chmod -R 777 data/fhirhub/storage data/fhirhub/logs data/fhirhub/temp
   ```

2. Démarrer les conteneurs :
   ```bash
   docker compose up -d
   ```

3. Vérifier le statut des conteneurs :
   ```bash
   docker compose ps
   ```

## Accès aux applications

- **FHIRHub** : http://localhost:5000
- **HAPI FHIR** : http://localhost:8080/fhir

## Visualisation des journaux

Pour afficher les journaux en temps réel :

```bash
docker compose logs -f
```

Pour visualiser uniquement les journaux de FHIRHub :

```bash
docker compose logs -f fhirhub
```

## Arrêt et suppression des conteneurs

Pour arrêter les conteneurs sans les supprimer :

```bash
docker compose stop
```

Pour arrêter et supprimer les conteneurs (les données persistantes sont conservées dans le répertoire `./data/`) :

```bash
docker compose down
```

## Sauvegarde des données

Les données sont stockées dans le répertoire `./data/` et peuvent être sauvegardées simplement en copiant ce répertoire. Pour une sauvegarde à chaud :

```bash
# Arrêter les conteneurs
docker compose stop

# Sauvegarder les données
tar -czf fhirhub-backup-$(date +%Y%m%d).tar.gz data/

# Redémarrer les conteneurs
docker compose start
```

## Résolution des problèmes

### Si FHIRHub ne démarre pas

Vérifiez les journaux :
```bash
docker compose logs fhirhub
```

Les problèmes courants incluent :
- Erreurs de permission sur les répertoires de données
- Ports déjà utilisés par d'autres applications

### Si HAPI FHIR ne démarre pas

Vérifiez les journaux :
```bash
docker compose logs hapi-fhir
```

HAPI FHIR peut prendre jusqu'à 2 minutes pour démarrer complètement, particulièrement lors du premier démarrage lorsque la base de données est initialisée.

## Configuration HTTPS (optionnel)

Pour activer le HTTPS, nous recommandons d'utiliser un reverse proxy comme Nginx ou Traefik. Un exemple de configuration Nginx est fourni ci-dessous :

```nginx
server {
    listen 443 ssl;
    server_name fhirhub.example.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name hapi-fhir.example.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Sécurité

Pour renforcer la sécurité en production, envisagez ces mesures additionnelles :

1. Ne pas exposer les ports directement sur Internet
2. Utiliser un pare-feu pour limiter l'accès aux ports 5000 et 8080
3. Configurer l'authentification pour les deux services
4. Activer HTTPS via un reverse proxy