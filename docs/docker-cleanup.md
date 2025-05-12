# Guide de nettoyage et maintenance Docker

Ce document décrit les procédures de nettoyage et de maintenance pour l'architecture Docker FHIRHub.

## Fichiers temporaires

Pour nettoyer tous les fichiers temporaires et les ressources non utilisées, exécutez :

```bash
./clean-temp-files.sh
```

Ce script supprime :
- Les réponses d'IA stockées dans `storage/data/ai_responses/`
- Les contenus du dossier `attached_assets/`
- Les scripts de nettoyage temporaires (`clean-*-backup.sh`, etc.)
- Les fichiers de logs temporaires (sauf les logs HAPI FHIR principaux)

## Structure des données

La structure des données est organisée comme suit :

```
data/                       # Dossier racine
├── fhirhub/                # Données FHIRHub
│   ├── db/                 # Base de données SQLite
│   ├── storage/            # Stockage des données
│   ├── logs/               # Journaux
│   ├── terminology/        # Terminologies
│   ├── backups/            # Sauvegardes
│   └── src/                # Dossier source pour compatibilité
├── hapifhir/               # Données HAPI FHIR
import/                     # Dossier d'importation
export/                     # Dossier d'exportation
```

## Fichiers ignorés par Git

Les fichiers et dossiers suivants sont exclus du dépôt Git pour maintenir la propreté :

- `attached_assets/` - Fichiers d'assets temporaires
- `storage/data/ai_responses/` - Réponses IA stockées
- Scripts de nettoyage temporaires
- Fichiers volumineux (JAR, WAR, ZIP, etc.)
- Fichiers de log générés par HAPI FHIR

## Architecture Docker

L'architecture Docker FHIRHub utilise des services séparés pour :

1. **FHIRHub** - Application principale Node.js pour la conversion HL7-FHIR
2. **HAPI FHIR** - Serveur FHIR pour le stockage et la gestion des ressources FHIR

Cette architecture a été optimisée pour :
- Séparer clairement les données entre les services
- Utiliser des bind mounts au lieu de volumes Docker pour une meilleure gestion
- Assurer une compatibilité avec l'application standalone

## Procédure de nettoyage Git

Pour nettoyer complètement le dépôt Git des fichiers volumineux, vous pouvez utiliser :

```bash
./clean-repo.sh
```

Ce script :
1. Sauvegarde tous les fichiers actuels dans un dossier temporaire
2. Supprime le dossier `.git` et tout l'historique
3. Initialise un nouveau dépôt Git propre
4. Configure le dépôt distant
5. Crée un commit initial avec tous les fichiers courants

**Note importante :** Cette opération supprime définitivement tout l'historique Git.