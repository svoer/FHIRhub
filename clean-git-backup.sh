#!/bin/bash

echo "Nettoyage du dossier Git backup volumineux..."

# Vérifier si le dossier existe
if [ -d .git_backup_with_large_files ]; then
  echo "Dossier .git_backup_with_large_files trouvé."
  
  # Supprimer physiquement le dossier
  echo "Suppression physique du dossier..."
  rm -rf .git_backup_with_large_files
  
  # Vérification
  if [ ! -d .git_backup_with_large_files ]; then
    echo "✅ Dossier .git_backup_with_large_files supprimé avec succès."
  else
    echo "❌ Échec de la suppression du dossier .git_backup_with_large_files."
  fi
else
  echo "Le dossier .git_backup_with_large_files n'existe pas."
fi

echo ""
echo "Instructions pour nettoyer l'historique Git :"
echo "----------------------------------------------"
echo "Pour supprimer complètement le dossier de l'historique Git, exécutez manuellement ces commandes :"
echo ""
echo "git rm -r --cached .git_backup_with_large_files"
echo "git commit -m \"Suppression du dossier .git_backup_with_large_files de l'index Git\""
echo ""
echo "Ensuite, pour pousser les modifications vers GitHub :"
echo ""
echo "git push"
echo ""
echo "Si vous rencontrez encore des problèmes, vous devrez peut-être utiliser BFG Repo-Cleaner ou git-filter-branch."
echo "----------------------------------------------"

echo "Nettoyage terminé."