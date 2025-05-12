# Documentation sur l'intégration de l'IA dans FHIRHub

## Introduction

FHIRHub intègre plusieurs technologies d'intelligence artificielle pour améliorer l'expérience utilisateur et faciliter l'analyse des données médicales. Cette documentation détaille les fonctionnalités d'IA disponibles, leur configuration et leur utilisation.

## Table des matières

1. [Architecture d'IA](#architecture-dia)
2. [Fournisseurs d'IA supportés](#fournisseurs-dia-supportés)
3. [Configuration des fournisseurs d'IA](#configuration-des-fournisseurs-dia)
4. [Système RAG (Retrieval-Augmented Generation)](#système-rag-retrieval-augmented-generation)
5. [Analyse avancée des données patient](#analyse-avancée-des-données-patient)
6. [Chatbot d'assistance](#chatbot-dassistance)
7. [Timeouts et limites](#timeouts-et-limites)
8. [Guide de dépannage](#guide-de-dépannage)

## Architecture d'IA

L'architecture d'IA de FHIRHub repose sur un service unifié qui permet d'interagir avec différents fournisseurs d'IA de manière cohérente. Le système utilise les composants suivants :

- **aiService.js** : Service central qui gère toutes les interactions avec les fournisseurs d'IA
- **aiProviderService.js** : Service qui gère la configuration et la sélection des fournisseurs d'IA
- **mistralClient.js**, **ollamaClient.js**, etc. : Clients spécifiques à chaque fournisseur d'IA
- **chatbotKnowledgeService.js** : Service qui gère la base de connaissances pour le chatbot (RAG)

Le diagramme simplifié de l'architecture est le suivant :

```
Interface utilisateur 
       ↓
   aiService.js
       ↓
aiProviderService.js → Fournisseur actif → Clients spécifiques (mistralClient.js, etc.)
       ↓
chatbotKnowledgeService.js (pour le RAG)
```

## Fournisseurs d'IA supportés

FHIRHub prend en charge les fournisseurs d'IA suivants :

| Fournisseur | Type | Modèles supportés | Usage recommandé |
|-------------|------|-------------------|------------------|
| Mistral AI | API Cloud | mistral-tiny, mistral-small, mistral-medium, mistral-large | Production |
| Ollama | Local | mistral, llama2, codellama, etc. | Développement, environnements sécurisés |
| DeepSeek | API Cloud | deepseek-coder, deepseek-chat | Production |
| OpenAI | API Cloud | gpt-3.5-turbo, gpt-4, gpt-4o | Production |

## Configuration des fournisseurs d'IA

Pour configurer un fournisseur d'IA :

1. Accédez à la page "Paramètres IA" dans le menu Administration
2. Sélectionnez le fournisseur à configurer
3. Entrez la clé API (pour les fournisseurs cloud) ou l'URL (pour les fournisseurs locaux)
4. Sélectionnez le modèle à utiliser
5. Cochez "Actif" pour définir ce fournisseur comme celui à utiliser par défaut
6. Cliquez sur "Enregistrer"

**Important** : Un seul fournisseur peut être actif à la fois. Toutes les fonctionnalités d'IA de l'application utiliseront automatiquement le fournisseur marqué comme actif.

## Système RAG (Retrieval-Augmented Generation)

FHIRHub implémente un système RAG (Retrieval-Augmented Generation) pour son chatbot d'assistance. Cette approche permet d'enrichir les réponses du modèle d'IA avec des informations spécifiques provenant de la base de connaissances de l'application.

### Fonctionnement du système RAG

1. L'utilisateur pose une question au chatbot
2. Le système analyse la question et recherche des informations pertinentes dans la base de connaissances
3. Les informations trouvées sont injectées dans le prompt envoyé au modèle d'IA
4. Le modèle génère une réponse en se basant sur ces informations et ses connaissances générales
5. Le système applique des restrictions strictes pour éviter les hallucinations (inventions de réponses)

### Structure de la base de connaissances

La base de connaissances est stockée dans un fichier JSON situé à `data/chatbot-knowledge.json`. Ce fichier contient trois sections principales :

- **FAQ** : Questions fréquemment posées et leurs réponses
- **Features** : Description des fonctionnalités de FHIRHub
- **Commands** : Liste des commandes et scripts disponibles

### Comment enrichir la base de connaissances

Pour ajouter de nouvelles informations à la base de connaissances :

1. Ouvrez le fichier `data/chatbot-knowledge.json`
2. Ajoutez de nouvelles entrées dans les sections appropriées en suivant le format existant
3. Sauvegardez le fichier

Exemple d'ajout dans la section FAQ :

```json
{
  "question": "Comment puis-je exporter mes données en CSV ?",
  "answer": "Pour exporter vos données en CSV, accédez à la page 'Explorateur FHIR', effectuez votre recherche, puis cliquez sur le bouton 'Exporter en CSV' en haut à droite des résultats. Le fichier CSV sera automatiquement téléchargé."
}
```

### Avantages du système RAG

- **Réponses précises** : Informations spécifiques à l'application
- **Contrôle du contenu** : Évite les hallucinations et les réponses incorrectes
- **Maintenance facile** : Mise à jour simple de la base de connaissances
- **Économie de jetons** : Ne recherche que les informations pertinentes pour chaque question

### Algorithme de recherche

L'algorithme de recherche dans la base de connaissances fonctionne comme suit :

1. Extraction des mots-clés de la question de l'utilisateur
2. Calcul d'un score de pertinence pour chaque entrée de la base de connaissances
3. Sélection des entrées les plus pertinentes (top 3)
4. Formatage des informations pour le prompt système

## Analyse avancée des données patient

FHIRHub utilise l'IA pour générer des analyses complètes des données patient. Cette fonctionnalité est disponible dans le visualiseur patient.

### Fonctionnalités principales

- **Analyse multimodale** : Prend en compte toutes les données du patient (informations personnelles, conditions médicales, observations, médicaments, consultations)
- **Génération de rapports** : Crée un rapport médical synthétique basé sur l'ensemble des données
- **Identification des problèmes potentiels** : Met en évidence les anomalies ou points d'attention

### Configuration

L'analyse des données patient utilise le fournisseur d'IA actif configuré dans les paramètres. Les timeouts ont été augmentés pour cette fonctionnalité afin de permettre une analyse complète des données :

- Timeout côté client : 90 secondes
- Timeout côté serveur : 4 minutes
- Limite de tokens : 3000

## Chatbot d'assistance

Le chatbot d'assistance est accessible depuis toutes les pages de l'application via l'icône de chat en bas à droite. Il utilise le système RAG pour fournir des réponses précises aux questions des utilisateurs.

### Fonctionnalités

- **Réponses contextuelles** : Basées sur la base de connaissances de l'application
- **Indication claire des limites** : Signale explicitement quand il ne dispose pas d'informations
- **Préservation du contexte** : Maintient l'historique de la conversation

## Timeouts et limites

Les différentes fonctionnalités d'IA ont des timeouts et des limites adaptés à leur usage :

| Fonctionnalité | Timeout client | Timeout serveur | Limite de tokens |
|----------------|---------------|----------------|-----------------|
| Chatbot | 30 secondes | 45 secondes | 1500 tokens |
| Analyse patient | 90 secondes | 4 minutes | 3000 tokens |
| Autres fonctions d'IA | 30 secondes | 45 secondes | 1500 tokens |

## Guide de dépannage

Problèmes courants et solutions :

| Problème | Cause possible | Solution |
|----------|---------------|----------|
| "Erreur de connexion au fournisseur d'IA" | Clé API invalide ou expirée | Vérifier et mettre à jour la clé API dans les paramètres IA |
| "Timeout dépassé" lors de l'analyse patient | Données patient très volumineuses | Augmenter les timeouts dans le fichier .env ou réduire la quantité de données à analyser |
| Réponses incorrectes du chatbot | Base de connaissances insuffisante | Enrichir la base de connaissances avec les informations manquantes |
| "Modèle indisponible" | Le modèle sélectionné n'est pas disponible | Sélectionner un modèle différent ou vérifier l'état du fournisseur d'IA |

Pour tout autre problème, consultez les logs du serveur qui contiennent des informations détaillées sur les erreurs rencontrées.