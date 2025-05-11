#!/bin/bash

# Script pour supprimer les liens "Documentation" et "API Reference" dans tous les footers
# Selon la demande du client

for file in ./public/*.html; do
  # Remplacer le contenu entre les balises footer-links
  sed -i 's/<ul class="footer-links">.*<\/ul>/<ul class="footer-links"><\/ul>/g' "$file"
  
  # Supprimer les balises footer-links vides (pour nettoyer)
  sed -i 's/<ul class="footer-links"><\/ul>//g' "$file"
  
  echo "Traitement de $file terminé"
done

echo "Suppression des liens terminée dans tous les fichiers HTML"