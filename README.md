# 🔥 FHIRHub 🔥

## 🏥 Vue d'ensemble
FHIRHub est une plateforme d'interopérabilité santé propriétaire conçue pour recevoir des messages HL7, les convertir au format FHIR (Fast Healthcare Interoperability Resources), et éventuellement stocker les données FHIR résultantes dans un entrepôt de données HAPI FHIR. La plateforme sert de hub central pour la transformation et la gestion des données de santé interopérables, alliant performance ⚡ et analyse intelligente des données médicales.

## 🏥 Qu'est-ce que HAPI FHIR?
HAPI FHIR est un serveur FHIR open-source officiel développé et maintenu par la communauté HL7.org. Il fournit une implémentation complète des spécifications FHIR, comprenant le stockage des ressources, la validation, et la prise en charge des requêtes. FHIRHub s'interface directement avec un ou plusieurs serveurs HAPI FHIR.

## ✨ Fonctionnalités principales

### 👥 Gestion des utilisateurs
- Contrôle d'accès basé sur les rôles
- Privilèges différents entre administrateurs et utilisateurs réguliers

### 📊 Tableau de bord
Indicateurs en temps réel comprenant:
- Nombre total de conversions
- Applications enregistrées
- Clés API actives
- Temps économisé ⏱️
- Taux de réussite
- Ressources générées
- Métriques avancées

### 🔄 Interface de conversion HL7 vers FHIR
- Test et prévisualisation des messages HL7
- Vérification de la conversion correcte au format FHIR
- Support de multiples versions de messages HL7
- Performances optimisées ⚡

### 🔍 Explorateur FHIR
- Exploration des ressources FHIR stockées
- Affichage du nombre de ressources par type
- Vérification de l'état du référentiel de données

### 📤 Téléchargement manuel de bundles FHIR
- Support pour le téléchargement manuel de bundles FHIR
- Validation et tests de stockage
- Possibilité de pousser les bundles vers le serveur HAPI FHIR

### 📚 Documentation Swagger
- Documentation disponible pour les endpoints HAPI FHIR
- Exploration interactive des API

### ⚙️ Configuration des serveurs
- Configuration de plusieurs serveurs FHIR (locaux ou externes)
- Options pour la lecture/écriture des données
- Gestion des paramètres de connexion et d'authentification

### 👨‍⚕️ Visualiseur de patients
- Interface permettant aux professionnels de santé de sélectionner un patient
- Affichage des données médicales organisées par onglet (consultations, prescriptions, organisations, etc.)
- Génération d'un résumé IA 🤖 du dossier médical du patient basé sur toutes les données disponibles

### 🔑 Outils d'administration
- Gestion des clés API par application
- Configuration de sécurité via CORS
- Interfaces de suivi des performances et d'utilisation

### 📖 Gestion de la terminologie FHIR
- Mise à jour et gestion des terminologies FHIR directement depuis la plateforme
- Support complet des terminologies françaises ANS (Agence du Numérique en Santé)
- Implémentation complète des profils FR Core (HL7 France)
- Adaptation des systèmes de codage internationaux

### 🤖 Configuration IA
- Intégration avec des outils comme OLLAMA pour exécuter des modèles IA localement
- Fonctionnement sans connectivité externe requise
- Support pour plusieurs fournisseurs d'IA (Mistral, DeepSeek, etc.)
- Configuration flexible des modèles et des paramètres

### 🌟 Autres fonctionnalités
- Prise en charge multilingue (français/anglais)
- Proxy FHIR pour contourner les limitations CORS
- Gestion des erreurs avancée et mécanismes de reprise
- Système de logs détaillé pour le suivi des conversions
- Interface réactive avec design en dégradé rouge-orange

## 🔧 Architecture technique
- API REST Node.js pour le backend
- Interface utilisateur en JavaScript/HTML5
- Base de données SQLite pour les logs et la configuration
- Conteneurisation Docker pour un déploiement simplifié ⚡
- Fonctionnement possible en mode portable, sans dépendances externes

## 🐳 Déploiement avec Docker

FHIRHub et HAPI FHIR peuvent être déployés facilement avec Docker. Le déploiement inclut :

### 📋 Prérequis
- Docker Engine v20.10.0+
- Docker Compose v2.0.0+
- 2 Go de RAM minimum
- 5 Go d'espace disque

### 🚀 Installation en un clic
```bash
# Rendre le script d'installation exécutable
chmod +x docker-install.sh

# Lancer l'installation
./docker-install.sh
```

### 📁 Organisation des données
Les données sont stockées de manière persistante dans le répertoire `./data/` :
- `./data/fhirhub/` : Configuration, logs, cache et terminologies de FHIRHub
- `./data/hapi-fhir/` : Base de données H2 de HAPI FHIR

### 🌐 Accès aux applications
- FHIRHub : http://localhost:5000
- HAPI FHIR : http://localhost:8080/fhir

Pour plus de détails sur le déploiement Docker, consultez la [documentation détaillée](./docs/docker-deployment.md).

## ⚠️ Licence
FHIRHub est un logiciel propriétaire. Tous droits réservés. Non disponible en licence open-source.

---

Le FHIRHub représente une solution complète pour l'interopérabilité des données de santé, permettant un flux efficace ⚡ des informations entre les systèmes utilisant HL7 et ceux basés sur FHIR, avec des capacités d'analyse avancées pour améliorer l'utilisation clinique des données.