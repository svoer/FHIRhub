# Nettoyage complet du dépôt Git

Ce document explique comment nettoyer complètement un dépôt Git qui contient des fichiers volumineux empêchant le push vers GitHub.

## Problème rencontré

Lorsque vous essayez de pousser un dépôt vers GitHub, vous pouvez rencontrer cette erreur :

```
remote: error: File .git_backup_with_large_files/objects/32/d21c73d9b7ab72a03e27a02fac4472afae6119 is 197.06 MB; this exceeds GitHub's file size limit of 100.00 MB
remote: error: GH001: Large files detected. You may want to try Git Large File Storage.
To https://github.com/svoer/FHIRhub.git
 ! [remote rejected] main -> main (pre-receive hook declined)
```

Cette erreur indique qu'un fichier volumineux est présent dans l'historique Git, même s'il a été supprimé dans les commits récents.

## Solution : Nettoyage complet

Pour nettoyer complètement le dépôt, nous avons créé un script `clean-repo.sh` qui :

1. Sauvegarde tous les fichiers actuels (sauf `.git`) dans un dossier temporaire
2. Supprime complètement le dossier `.git` (historique Git)
3. Crée un nouveau dépôt Git propre
4. Ajoute tous les fichiers du projet
5. Configure le dépôt distant (GitHub)

### Instructions d'utilisation

1. Assurez-vous que tous vos changements sont commités localement
2. Exécutez le script : `./clean-repo.sh`
3. Poussez le nouveau dépôt propre vers GitHub : `git push -f origin main`

## Prévention future

Pour éviter ce problème à l'avenir :

### 1. Règles .gitignore

Assurez-vous que votre fichier `.gitignore` exclut tous les fichiers volumineux :

```
# Backup Git avec fichiers volumineux
.git_backup*
*/.git_backup*

# Fichiers volumineux
*.jar
*.war
*.ear
*.zip
*.tar.gz
*.rar
*.iso
```

### 2. Utilisation des scripts de téléchargement automatique

Utilisez le script `download-dependencies.sh` pour télécharger automatiquement les dépendances volumineuses comme le serveur HAPI FHIR, au lieu de les inclure dans le dépôt Git.

### 3. Considérez Git LFS

Pour les projets avec des besoins réguliers en fichiers volumineux, considérez l'utilisation de Git Large File Storage (LFS) :

```
git lfs install
git lfs track "*.jar"
git add .gitattributes
```

## Points importants à retenir

1. GitHub limite la taille des fichiers à 100 Mo
2. Un fichier volumineux dans l'historique Git reste problématique même s'il est supprimé ultérieurement
3. La suppression complète de l'historique Git est une solution radicale mais efficace
4. La prévention via `.gitignore` et les scripts de téléchargement est la meilleure approche