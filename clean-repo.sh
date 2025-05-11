#!/bin/bash

# Ce script nettoie complètement le dépôt Git des fichiers volumineux
# en créant un nouveau dépôt propre sans historique

set -e  # Arrêter en cas d'erreur

echo "🔄 Nettoyage complet du dépôt Git - Création d'un nouveau dépôt propre"
echo "⚠️  AVERTISSEMENT: Cette opération va supprimer l'historique Git complet"
echo "    mais préserver tous vos fichiers actuels."
echo ""
echo "Étape 1: Sauvegarde des fichiers actuels dans un dossier temporaire"

# Créer un dossier temporaire et y copier tous les fichiers sauf .git
TEMP_DIR=$(mktemp -d)
echo "   Dossier temporaire créé: $TEMP_DIR"

echo "   Copie des fichiers en cours..."
find . -mindepth 1 -not -path "*/\.git*" -not -path "*/node_modules*" -not -path "*/venv*" -exec cp -r {} $TEMP_DIR \;

echo "Étape 2: Suppression du dossier .git"
rm -rf .git
rm -rf .git_backup_with_large_files

echo "Étape 3: Création d'un nouveau dépôt Git"
git init
echo "   Nouveau dépôt Git initialisé"

# Configurer le dépôt distant
echo "Étape 4: Configuration du dépôt distant"
git remote add origin https://github.com/svoer/FHIRhub.git

echo "Étape 5: Ajout des fichiers au nouveau dépôt"
git add .
git commit -m "Initial commit - Dépôt nettoyé des fichiers volumineux"

echo "📋 Instructions pour finaliser:"
echo ""
echo "Pour pousser ce nouveau dépôt propre vers GitHub, exécutez:"
echo "   git push -f origin main"
echo ""
echo "✅ Nettoyage terminé! Votre dépôt est maintenant prêt à être poussé."