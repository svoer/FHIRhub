# Résolution des problèmes de fichiers volumineux dans Git

Ce document explique comment résoudre les problèmes liés aux fichiers volumineux dans le dépôt Git qui empêchent le push vers GitHub.

## Problème identifié

Un répertoire `.git_backup_with_large_files` a été détecté dans le dépôt, contenant un fichier de 197 Mo, ce qui dépasse la limite de 100 Mo imposée par GitHub :

```
remote: error: File .git_backup_with_large_files/objects/32/d21c73d9b7ab72a03e27a02fac4472afae6119 is 197.06 MB; this exceeds GitHub's file size limit of 100.00 MB
```

## Solution recommandée

### 1. Suppression physique du répertoire

Supprimez d'abord le répertoire de votre système de fichiers :

```bash
rm -rf .git_backup_with_large_files
```

### 2. Mise à jour du .gitignore

Assurez-vous que votre fichier `.gitignore` contient les règles pour exclure les fichiers volumineux et les dossiers de backup Git :

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

### 3. Suppression du répertoire de l'index Git

Pour supprimer le répertoire de l'index Git sans modifier l'historique complet :

```bash
git rm -r --cached .git_backup_with_large_files
git commit -m "Suppression du dossier .git_backup_with_large_files de l'index Git"
```

### 4. Tentative de push

Essayez maintenant de pousser vos modifications vers GitHub :

```bash
git push
```

## Solutions avancées (si le problème persiste)

Si après les étapes ci-dessus, vous rencontrez toujours des erreurs lors du push, le fichier volumineux pourrait être présent dans l'historique de commits. Dans ce cas, vous aurez besoin d'outils plus avancés :

### Utilisation de BFG Repo-Cleaner

BFG est un outil spécialisé pour nettoyer les dépôts Git contenant des fichiers volumineux :

1. Téléchargez BFG : [https://rtyley.github.io/bfg-repo-cleaner/](https://rtyley.github.io/bfg-repo-cleaner/)
2. Créez une copie brute de votre dépôt :
   ```bash
   git clone --mirror git@github.com:votre-organisation/votre-repo.git
   ```
3. Exécutez BFG pour supprimer les fichiers volumineux :
   ```bash
   java -jar bfg.jar --strip-blobs-bigger-than 100M votre-repo.git
   ```
4. Nettoyez et poussez le dépôt :
   ```bash
   cd votre-repo.git
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push
   ```

### Utilisation de git-filter-branch

Si vous n'avez pas accès à BFG, vous pouvez utiliser git-filter-branch (plus lent mais intégré à Git) :

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch -r .git_backup_with_large_files" \
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all
```

## Prévention pour l'avenir

Pour éviter ces problèmes à l'avenir :

1. Utilisez toujours le script `download-dependencies.sh` pour gérer les fichiers volumineux
2. Maintenez à jour votre fichier `.gitignore` 
3. Évitez de stocker des backups du dépôt Git à l'intérieur du dépôt lui-même
4. Considérez l'utilisation de Git LFS pour les fichiers volumineux si nécessaire

## Ressources supplémentaires

- [Documentation GitHub sur les limites de taille](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
- [Git LFS (Large File Storage)](https://git-lfs.github.com/)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)