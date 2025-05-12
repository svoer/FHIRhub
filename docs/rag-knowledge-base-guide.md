# Guide d'enrichissement de la base de connaissances RAG

## Introduction

Ce guide détaille la procédure pour enrichir et maintenir la base de connaissances utilisée par le système RAG (Retrieval-Augmented Generation) dans le chatbot de FHIRHub. La bonne maintenance de cette base de connaissances est essentielle pour garantir des réponses précises et utiles aux utilisateurs.

## Structure de la base de connaissances

La base de connaissances est stockée dans un fichier JSON situé à `data/chatbot-knowledge.json`. Ce fichier contient trois sections principales :

1. **FAQ** : Questions fréquemment posées et leurs réponses
2. **Features** : Description des fonctionnalités de FHIRHub
3. **Commands** : Liste des commandes et scripts disponibles

## Comment ajouter de nouvelles connaissances

### Ajouter une nouvelle FAQ

Pour ajouter une nouvelle question à la FAQ :

```json
{
  "question": "Votre nouvelle question ici ?",
  "answer": "Réponse détaillée à la question. Essayez d'être précis et complet, tout en restant concis."
}
```

Exemple concret :

```json
{
  "question": "Comment puis-je extraire des statistiques sur les messages traités ?",
  "answer": "Pour extraire des statistiques sur les messages traités, utilisez l'API /api/stats qui renvoie un JSON avec toutes les données de performance. Vous pouvez spécifier une période avec les paramètres start_date et end_date au format YYYY-MM-DD. Ces statistiques sont également visibles dans le tableau de bord sous forme de graphiques."
}
```

### Ajouter une nouvelle fonctionnalité

Pour documenter une nouvelle fonctionnalité :

```json
{
  "name": "Nom de la fonctionnalité",
  "description": "Description détaillée de la fonctionnalité, son utilité, et comment l'utiliser."
}
```

Exemple concret :

```json
{
  "name": "Export de données en CSV",
  "description": "Permet d'exporter les résultats de recherche FHIR au format CSV pour une analyse dans des outils externes comme Excel. Cette fonctionnalité est accessible depuis l'explorateur FHIR via le bouton 'Exporter' en haut à droite des résultats. L'export inclut toutes les propriétés principales des ressources et peut être filtré selon les mêmes critères que la recherche."
}
```

### Ajouter une nouvelle commande

Pour documenter un nouvel utilitaire ou script :

```json
{
  "name": "nom-du-script.sh / nom-du-script.bat",
  "description": "Description de ce que fait le script, quand l'utiliser, et les paramètres qu'il accepte."
}
```

Exemple concret :

```json
{
  "name": "reset-admin-compatible.js",
  "description": "Script qui réinitialise le mot de passe administrateur à 'admin123' de manière compatible avec tous les hachages supportés (pbkdf2, bcrypt, etc.). À utiliser en cas de perte du mot de passe administrateur. Exécutez 'node reset-admin-compatible.js' depuis la racine du projet."
}
```

## Bonnes pratiques pour la base de connaissances

### Qualité des informations

- **Précision** : Vérifiez que toutes les informations sont exactes et à jour
- **Concision** : Soyez clair et direct, mais fournissez suffisamment de contexte
- **Cohérence** : Utilisez une terminologie cohérente dans toute la base de connaissances
- **Complétude** : Couvrez tous les aspects importants de chaque sujet

### Organisation et maintenance

- **Catégorisation** : Placez chaque information dans la section appropriée
- **Suppression des doublons** : Évitez les entrées redondantes ou très similaires
- **Mise à jour régulière** : Révisez et actualisez la base de connaissances lorsque l'application évolue
- **Vérification des références** : Assurez-vous que les chemins de fichiers, noms de commandes, etc. sont corrects

## Comment tester la base de connaissances

Après avoir ajouté de nouvelles informations, il est recommandé de tester le chatbot pour vérifier que les réponses sont correctes.

### Procédure de test

1. Redémarrez le serveur FHIRHub pour recharger la base de connaissances
2. Accédez au tableau de bord et ouvrez le chatbot
3. Posez des questions liées aux nouvelles informations ajoutées
4. Vérifiez que les réponses sont précises et contiennent les informations attendues
5. Testez également avec des variantes de la question pour évaluer la robustesse

### Exemples de tests

Si vous avez ajouté une FAQ sur l'exportation CSV, testez avec :
- "Comment exporter en CSV ?"
- "Est-il possible d'obtenir mes données en format Excel ?"
- "Où se trouve le bouton d'exportation ?"

## Algorithme de recherche et optimisation

### Comment fonctionne l'algorithme

L'algorithme de recherche dans `chatbotKnowledgeService.js` fonctionne comme suit :

1. La requête de l'utilisateur est normalisée (minuscules, suppression des caractères spéciaux)
2. Des mots-clés sont extraits (mots de plus de 3 caractères)
3. Un score de pertinence est calculé pour chaque entrée de la base de connaissances :
   - Correspondance exacte de la requête : +3 points
   - Correspondance de mots-clés individuels : +1 point par mot-clé
4. Les entrées avec les scores les plus élevés sont sélectionnées

### Optimisation pour la recherche

Pour améliorer la détectabilité de vos entrées :

- **Utilisez des termes descriptifs** : Incluez les termes que les utilisateurs sont susceptibles d'utiliser dans leurs questions
- **Variez le vocabulaire** : Utilisez différentes formulations pour décrire le même concept
- **Incluez des synonymes** : Pensez aux différentes façons dont les utilisateurs pourraient décrire une fonctionnalité
- **Structurez les réponses** : Commencez par l'information la plus importante, puis ajoutez des détails

## Format complet du fichier JSON

```json
{
  "faq": [
    {
      "question": "Question 1 ?",
      "answer": "Réponse 1"
    },
    {
      "question": "Question 2 ?",
      "answer": "Réponse 2"
    }
  ],
  "features": [
    {
      "name": "Fonctionnalité 1",
      "description": "Description de la fonctionnalité 1"
    },
    {
      "name": "Fonctionnalité 2",
      "description": "Description de la fonctionnalité 2"
    }
  ],
  "commands": [
    {
      "name": "commande1.sh",
      "description": "Description de la commande 1"
    },
    {
      "name": "commande2.sh",
      "description": "Description de la commande 2"
    }
  ]
}
```

## Gestion des versions et sauvegarde

- **Versionnez la base de connaissances** : Utilisez Git pour suivre les modifications
- **Créez des sauvegardes** : Avant d'effectuer des modifications importantes
- **Documentez les changements** : Notez pourquoi et quand des modifications ont été apportées

## Extension future du système RAG

Le système RAG peut être étendu de plusieurs façons :

1. **Ajout de nouvelles catégories** : Par exemple, "troubleshooting", "glossary", "api_endpoints"
2. **Intégration de sources externes** : Documentation technique, articles de blog, manuels d'utilisation
3. **Apprentissage automatique** : Amélioration de l'algorithme de recherche avec des techniques d'apprentissage automatique
4. **Feedback utilisateur** : Ajout d'un mécanisme permettant aux utilisateurs de signaler des réponses incorrectes ou incomplètes

Pour étendre la structure actuelle, modifiez à la fois `chatbotKnowledgeService.js` et `data/chatbot-knowledge.json` en ajoutant les nouvelles catégories et les fonctions de recherche correspondantes.