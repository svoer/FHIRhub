# Guide de Déploiement Docker pour FHIRHub

Ce document détaille le processus de déploiement de FHIRHub et HAPI FHIR à l'aide de Docker. Cette approche permet un déploiement rapide et cohérent dans différents environnements.

## Prérequis

- Docker Engine (version 20.10.0 ou supérieure)
- Docker Compose (version 2.0.0 ou supérieure)
- 2 Go de RAM minimum
- 5 Go d'espace disque disponible
- Ports 5000 et 8080 disponibles

## Architecture des conteneurs

Le déploiement comprend deux services principaux :

1. **FHIRHub** : l'application Node.js pour la conversion HL7 vers FHIR et l'interface utilisateur
2. **HAPI FHIR** : le serveur FHIR de référence pour le stockage des ressources FHIR

Ces services sont configurés pour fonctionner ensemble via un réseau Docker partagé, avec des volumes persistants pour assurer la durabilité des données.

## Organisation des données persistantes

Toutes les données sont stockées en dehors des conteneurs pour assurer leur persistance :

```
./data/
├── fhirhub/
│   ├── storage/
│   │   ├── db/            # Base de données SQLite
│   │   └── data/cache/    # Cache des ressources converties
│   ├── french_terminology/ # Terminologies médicales françaises
│   ├── logs/              # Journaux d'application
│   └── temp/              # Fichiers temporaires
└── hapi-fhir/             # Base de données H2 de HAPI FHIR
```

## Installation

### Méthode automatisée (recommandée)

1. Clonez ou téléchargez le projet FHIRHub
2. Rendez le script d'installation exécutable :
   ```bash
   chmod +x docker-install.sh
   ```
3. Exécutez le script d'installation :
   ```bash
   ./docker-install.sh
   ```

Le script effectuera les actions suivantes :
- Vérification de l'installation de Docker
- Création des répertoires nécessaires
- Configuration des permissions
- Construction et démarrage des conteneurs Docker
- Vérification de la disponibilité des services

### Installation manuelle

Si vous préférez une installation manuelle :

1. Créez les répertoires de données :
   ```bash
   mkdir -p ./data/fhirhub/storage/db
   mkdir -p ./data/fhirhub/storage/data/cache
   mkdir -p ./data/fhirhub/french_terminology
   mkdir -p ./data/fhirhub/logs
   mkdir -p ./data/fhirhub/temp
   mkdir -p ./data/hapi-fhir
   chmod -R 755 ./data
   chmod -R 777 ./data/fhirhub/storage ./data/fhirhub/logs ./data/fhirhub/temp
   ```

2. Démarrez les conteneurs :
   ```bash
   docker compose up -d
   ```

## Accès aux applications

Une fois le déploiement terminé, les services sont accessibles aux adresses suivantes :

- **FHIRHub** : http://localhost:5000
- **HAPI FHIR** : http://localhost:8080/fhir

Les identifiants par défaut pour FHIRHub :
- Utilisateur : admin
- Mot de passe : admin123

## Surveillance et maintenance

### Vérification de l'état des conteneurs

```bash
docker compose ps
```

### Affichage des journaux

```bash
# Tous les journaux
docker compose logs

# Journaux en temps réel
docker compose logs -f

# Journaux d'un service spécifique
docker compose logs fhirhub
docker compose logs hapi-fhir
```

### Redémarrage des services

```bash
# Redémarrer tous les services
docker compose restart

# Redémarrer un service spécifique
docker compose restart fhirhub
docker compose restart hapi-fhir
```

### Arrêt des services

```bash
# Arrêter sans supprimer les conteneurs
docker compose stop

# Arrêter et supprimer les conteneurs (les données persistent)
docker compose down

# Arrêter, supprimer les conteneurs et les volumes (⚠️ perte de données)
docker compose down -v
```

## Paramètres avancés

Le fichier `docker-compose.yml` peut être modifié pour personnaliser divers aspects du déploiement :

### Modification des ports exposés

Pour changer les ports d'accès externes, modifiez la section `ports` dans le fichier `docker-compose.yml` :

```yaml
ports:
  - "8081:5000"  # Changez 5000 pour FHIRHub
  - "8082:8080"  # Changez 8080 pour HAPI FHIR
```

### Personnalisation des variables d'environnement

Modifiez la section `environment` pour chaque service pour ajuster les paramètres :

```yaml
environment:
  - NODE_ENV=production
  - PORT=5000
  - HAPI_FHIR_URL=http://hapi-fhir:8080/fhir
  # Ajoutez d'autres variables selon vos besoins
```

## Dépannage

### FHIRHub ne démarre pas

Vérifiez les journaux pour identifier la cause :
```bash
docker compose logs fhirhub
```

Causes possibles :
- Problème de permission sur les volumes
- Conflit de port
- Problème de configuration

### HAPI FHIR ne démarre pas

Vérifiez les journaux :
```bash
docker compose logs hapi-fhir
```

Causes possibles :
- Mémoire insuffisante (le serveur HAPI FHIR nécessite au moins 512 Mo de RAM)
- Problème de permission sur les volumes
- Conflit de port

### Problèmes de connexion entre FHIRHub et HAPI FHIR

Vérifiez que les deux services sont en cours d'exécution :
```bash
docker compose ps
```

Si les services fonctionnent mais ne peuvent pas communiquer, vérifiez la configuration du réseau et les URL de connexion.

## Mise à jour

Pour mettre à jour les conteneurs vers une nouvelle version :

1. Tirez les dernières modifications du code :
   ```bash
   git pull
   ```
   
2. Reconstruisez et redémarrez les conteneurs :
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

## Sauvegarde et restauration des données

### Sauvegarde

1. Sauvegardez le répertoire `./data` complet :
   ```bash
   tar -czf fhirhub_backup_$(date +%Y%m%d).tar.gz ./data
   ```

### Restauration

1. Arrêtez les services :
   ```bash
   docker compose down
   ```

2. Restaurez le répertoire de données à partir de la sauvegarde :
   ```bash
   tar -xzf fhirhub_backup_YYYYMMDD.tar.gz
   ```

3. Redémarrez les services :
   ```bash
   docker compose up -d
   ```

## Support

Pour toute assistance supplémentaire ou en cas de problèmes, veuillez consulter la documentation complète du projet ou utiliser le chatbot intégré dans l'interface FHIRHub.