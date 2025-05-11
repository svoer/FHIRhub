#!/bin/bash

# Ce script fournit les instructions manuelles pour nettoyer
# complètement le dépôt Git des fichiers volumineux

echo "🔄 Instructions pour nettoyer manuellement le dépôt Git"
echo "⚠️  AVERTISSEMENT: Cette opération va supprimer l'historique Git complet"
echo "    mais préserver tous vos fichiers actuels."
echo ""
echo "Voici les étapes à suivre manuellement :"
echo ""
echo "1. Supprimez le dossier .git et tout backup Git :"
echo "   rm -rf .git .git_backup_with_large_files"
echo ""
echo "2. Initialisez un nouveau dépôt Git propre :"
echo "   git init"
echo ""
echo "3. Configurez le dépôt distant :"
echo "   git remote add origin https://github.com/svoer/FHIRhub.git"
echo ""
echo "4. Ajoutez vos fichiers au nouveau dépôt :"
echo "   git add ."
echo "   git commit -m \"Initial commit - Clean repository\""
echo ""
echo "5. Poussez vers GitHub avec -f (force) :"
echo "   git push -f origin main"
echo ""
echo "Ces commandes vont créer un nouveau dépôt Git propre sans historique,"
echo "ce qui résoudra définitivement le problème des fichiers volumineux."