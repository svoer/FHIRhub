# Nouvelles fonctionnalités FHIRHub 2025

Ce document présente les nouvelles fonctionnalités et améliorations apportées à FHIRHub en 2025. Ces fonctionnalités visent à améliorer l'expérience utilisateur, optimiser les performances et faciliter l'interopérabilité avec les systèmes de santé.

## Table des matières

1. [Système RAG pour le chatbot](#système-rag-pour-le-chatbot)
2. [Amélioration de l'analyse IA des données patient](#amélioration-de-lanalyse-ia-des-données-patient)
3. [Nettoyage automatique des fichiers temporaires](#nettoyage-automatique-des-fichiers-temporaires)
4. [Push automatique vers HAPI FHIR](#push-automatique-vers-hapi-fhir)
5. [Architecture Docker améliorée](#architecture-docker-améliorée)

## Système RAG pour le chatbot

### Description

Le chatbot de FHIRHub a été amélioré avec un système RAG (Retrieval-Augmented Generation) qui lui permet de fournir des réponses précises et contextuelles basées sur une base de connaissances structurée.

### Fonctionnalités

- **Base de connaissances JSON** : Structure organisée contenant FAQ, descriptions de fonctionnalités et commandes
- **Algorithme de recherche intelligent** : Calcule la pertinence des informations selon la question posée
- **Protection contre les hallucinations** : Instructions strictes pour éviter les réponses inventées
- **Enrichissement facile** : Mécanisme simple pour ajouter de nouvelles connaissances

### Documentation

Pour plus de détails sur le système RAG et comment l'enrichir, consultez :
- [Documentation sur l'intégration de l'IA](./ai-integration.md)
- [Guide d'enrichissement de la base de connaissances](./rag-knowledge-base-guide.md)

## Amélioration de l'analyse IA des données patient

### Description

L'analyse IA des données patient a été considérablement améliorée pour fournir des rapports plus complets et pertinents.

### Améliorations

- **Analyse multimodale** : Prise en compte de toutes les données patient (conditions, observations, médicaments, consultations)
- **Timeouts augmentés** : 
  - Côté client : 90 secondes (contre 30 auparavant)
  - Côté serveur : 4 minutes (contre 45 secondes auparavant)
- **Limite de tokens doublée** : 3000 tokens (contre 1500 auparavant)
- **Utilisation du fournisseur d'IA actif** : Utilisation cohérente du même fournisseur pour toutes les fonctionnalités

### Impact

Ces améliorations permettent une analyse beaucoup plus approfondie et pertinente des dossiers patients, particulièrement pour les patients avec des historiques médicaux complexes.

## Nettoyage automatique des fichiers temporaires

### Description

Un nouveau mécanisme de nettoyage automatique des fichiers temporaires a été implémenté pour maintenir les performances et l'hygiène du système.

### Fonctionnalités

- **Script `clean-temp-files.sh`** : Supprime les fichiers temporaires, réponses IA stockées et assets attachés
- **Intégration avec .gitignore** : Patterns ajoutés pour exclure les fichiers temporaires du contrôle de version
- **Documentation** : Instructions d'utilisation dans `docs/docker-cleanup.md`

### Utilisation

```bash
# Nettoyage standard
./clean-temp-files.sh

# Nettoyage avec conservation des logs (option)
./clean-temp-files.sh --keep-logs

# Nettoyage complet (tous les fichiers temporaires)
./clean-temp-files.sh --all
```

## Push automatique vers HAPI FHIR

### Description

FHIRHub peut maintenant automatiquement envoyer (push) les bundles FHIR générés vers un serveur HAPI FHIR, facilitant l'intégration avec les systèmes de stockage FHIR existants.

### Fonctionnalités

- **Endpoint `/api/fhir-push-bundle`** : Pour pousser manuellement un bundle vers HAPI FHIR
- **Option auto-push** : Dans l'API de conversion pour envoyer automatiquement les bundles générés
- **Configuration dynamique des serveurs** : Sélection flexible du serveur FHIR cible

### Utilisation API

```javascript
// Exemple d'auto-push avec l'API de conversion
fetch('/api/convert/raw', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer votre_api_key'
  },
  body: JSON.stringify({
    message: messageHL7,
    auto_push: true,  // Active l'auto-push
    server_id: 1      // ID du serveur FHIR cible (optionnel)
  })
});

// Push manuel d'un bundle existant
fetch('/api/fhir-push-bundle', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer votre_api_key'
  },
  body: JSON.stringify({
    bundle: monBundleFHIR,
    server_id: 1      // ID du serveur FHIR cible
  })
});
```

## Architecture Docker améliorée

### Description

L'architecture Docker a été revue pour améliorer la séparation des données, faciliter les mises à jour et optimiser les performances.

### Améliorations

- **Services séparés** : FHIRHub et HAPI FHIR fonctionnent comme des services distincts mais coordonnés
- **Structure de données clarifiée** : 
  - `/data/hapi-fhir` : Données du serveur HAPI FHIR
  - `/data/fhirhub` : Données de l'application FHIRHub
- **Scripts facilités** : 
  - `docker-launch.sh` : Détecte la version de Docker Compose et utilise la syntaxe appropriée
  - `docker-init-data.sh` : Initialise correctement la structure des dossiers de données

### Documentation

Pour plus de détails sur la nouvelle architecture Docker, consultez :
- [Architecture Docker](./docker-architecture.md)
- [Procédures de nettoyage Docker](./docker-cleanup.md)

## Conclusion

Ces nouvelles fonctionnalités renforcent FHIRHub comme une solution complète pour l'interopérabilité des données de santé, avec une intelligence artificielle améliorée, une meilleure gestion des ressources et une intégration plus fluide avec les systèmes existants.

Pour toute question sur ces fonctionnalités, utilisez le chatbot d'assistance ou contactez l'équipe de support.