const express = require('express');
const router = express.Router();

// Fonction pour extraire le contenu de la documentation
function extractDocumentationContent() {
    return `
# FHIRHub - Documentation Technique Complète

## Vue d'ensemble
FHIRHub est une plateforme sophistiquée de conversion HL7v2.5 vers FHIR R4 conforme aux standards ANS (Agence du Numérique en Santé). 
Cette solution portable sans dépendances lourdes offre une API REST sécurisée, une base de données SQLite pour les logs, 
et une interface React avec un dégradé rouge-orange.

## Architecture du Système

### Composants Principaux
1. **Serveur Node.js** : API REST pour la conversion HL7 vers FHIR
2. **Interface React** : Interface utilisateur moderne avec design rouge-orange
3. **Base de données SQLite** : Stockage des logs de conversion et métadonnées
4. **Serveur HAPI FHIR** : Serveur FHIR R4 pour le stockage des ressources
5. **Système de terminologies** : Terminologies françaises ANS et FR Core

### Technologies Utilisées
- **Backend** : Node.js, Express.js, SQLite3
- **Frontend** : HTML5, CSS3, JavaScript vanilla, React components
- **FHIR** : HAPI FHIR Server (R4)
- **Containerisation** : Docker, Docker Compose
- **IA** : Intégration Mistral AI, Ollama, DeepSeek

## API Endpoints Principaux

### Conversion HL7 vers FHIR
- `POST /api/convert` : Conversion simple d'un message HL7
- `POST /api/convert/raw` : Conversion avec retour du bundle FHIR complet
- `POST /api/convert/batch` : Conversion par lots de plusieurs messages

### Gestion FHIR
- `GET /api/fhir/patients` : Récupération des patients
- `POST /api/fhir/push-bundle` : Envoi d'un bundle vers HAPI FHIR
- `GET /api/fhir/metadata` : Métadonnées du serveur FHIR

### Administration
- `GET /api/stats` : Statistiques de conversion
- `POST /api/reset-stats` : Réinitialisation des statistiques
- `GET /api/system/health` : État de santé du système

## Configuration et Installation

### Installation Locale
1. Cloner le projet
2. Installer les dépendances : \`npm install\`
3. Lancer le serveur : \`npm start\`
4. Accéder à l'interface : http://localhost:5000

### Installation Docker
1. Exécuter : \`./docker-install.sh\`
2. Services disponibles :
   - FHIRHub : http://localhost:5000
   - HAPI FHIR : http://localhost:8080/fhir

### Variables d'Environnement
- \`NODE_ENV\` : Environnement (development/production)
- \`PORT\` : Port du serveur (défaut: 5000)
- \`HAPI_FHIR_URL\` : URL du serveur HAPI FHIR
- \`MISTRAL_API_KEY\` : Clé API Mistral pour l'IA

## Standards FHIR et Terminologies

### Profils FR Core
Le système supporte les profils FR Core :
- Patient français
- Practitioner français
- Organization française
- Encounter français

### Terminologies ANS
- Systèmes de codage français
- OID (Object Identifier) nationaux
- Codes communs ANS
- JDV (Jeux de Valeurs) officiels

## Fonctionnalités Avancées

### Visualiseur Patient
- Affichage des données patient FHIR
- Navigation par onglets (Démographie, Rencontres, Observations, etc.)
- Analyse IA des données cliniques
- Export des données

### Explorateur FHIR
- Navigation dans les ressources FHIR
- Recherche avancée
- Validation des données
- Interface de requête

### Intelligence Artificielle
- Analyse automatique des données cliniques
- Génération de comptes-rendus médicaux
- Support multi-fournisseurs (Mistral, Ollama, DeepSeek)
- Configuration dynamique des modèles

## Sécurité et Conformité

### Sécurité
- Authentification par JWT
- Chiffrement des communications
- Logs d'audit complets
- Gestion des permissions utilisateur

### Conformité RGPD
- Anonymisation des données
- Droit à l'oubli
- Portabilité des données
- Consentement explicite

## Monitoring et Logs

### Logs Système
- Logs de conversion détaillés
- Métriques de performance
- Alertes automatiques
- Dashboard de monitoring

### Métriques
- Temps de conversion moyen
- Nombre de ressources générées
- Taux de succès/échec
- Utilisation mémoire et CPU

## Dépannage et Support

### Problèmes Courants
1. **Erreur de conversion** : Vérifier la structure du message HL7
2. **HAPI FHIR indisponible** : Redémarrer le conteneur HAPI
3. **Terminologies manquantes** : Réinstaller les terminologies françaises

### Logs de Débogage
- Fichiers de logs dans \`./logs/\`
- Niveau de log configurable
- Rotation automatique des logs

### Support Technique
- Documentation complète en ligne
- Exemples d'utilisation
- FAQ détaillée
- Guide de migration

## Performance et Optimisation

### Optimisations Backend
- Cache en mémoire pour les terminologies
- Pool de connexions base de données
- Compression gzip
- CDN pour les ressources statiques

### Optimisations Frontend
- Lazy loading des composants
- Mise en cache des ressources
- Optimisation des images
- Minification du code

Cette documentation couvre l'ensemble des fonctionnalités et aspects techniques de FHIRHub.
    `;
}

// Route pour le chatbot de documentation
router.post('/ask', async (req, res) => {
    try {
        const { question, conversation_history = [] } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                error: 'Question requise'
            });
        }

        // Vérifier la configuration de l'IA
        const aiConfig = global.aiConfigManager?.getActiveProvider();
        if (!aiConfig || aiConfig.provider_type !== 'mistral') {
            return res.status(400).json({
                success: false,
                error: 'Mistral AI n\'est pas configuré comme fournisseur actif'
            });
        }

        // Préparer le contexte avec la documentation
        const documentationContent = extractDocumentationContent();
        
        // Construire le prompt avec le contexte de la documentation
        const systemPrompt = `Tu es un assistant technique expert pour FHIRHub, une plateforme de conversion HL7 vers FHIR.

CONTEXTE DE LA DOCUMENTATION :
${documentationContent}

INSTRUCTIONS :
1. Réponds uniquement aux questions liées à FHIRHub et ses fonctionnalités
2. Base tes réponses sur la documentation fournie ci-dessus
3. Sois précis et technique dans tes explications
4. Si la question concerne une fonctionnalité non documentée, indique-le clairement
5. Utilise un ton professionnel et bienveillant
6. Propose des exemples concrets quand c'est pertinent
7. Si la question ne concerne pas FHIRHub, redirige poliment vers la documentation

Réponds en français et reste dans le domaine de l'interopérabilité santé et de FHIRHub.`;

        // Construire l'historique de conversation
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Ajouter l'historique de conversation récent (garder seulement les 5 derniers échanges)
        const recentHistory = conversation_history.slice(-10);
        messages.push(...recentHistory);

        // Ajouter la question actuelle
        messages.push({ role: 'user', content: question });

        // Appeler l'API Mistral
        const response = await fetch(aiConfig.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiConfig.api_key}`
            },
            body: JSON.stringify({
                model: aiConfig.models,
                messages: messages,
                max_tokens: 1000,
                temperature: 0.3 // Température basse pour des réponses plus précises
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur API Mistral: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content;

        if (!answer) {
            throw new Error('Réponse vide de l\'API Mistral');
        }

        res.json({
            success: true,
            question,
            answer,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erreur dans le chatbot documentation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du traitement de la question',
            details: error.message
        });
    }
});

// Route pour obtenir des suggestions de questions
router.get('/suggestions', (req, res) => {
    const suggestions = [
        "Comment installer FHIRHub localement ?",
        "Quels sont les endpoints de l'API de conversion ?",
        "Comment configurer les terminologies françaises ?",
        "Que sont les profils FR Core ?",
        "Comment utiliser le visualiseur patient ?",
        "Comment configurer Mistral AI ?",
        "Quelles sont les métriques de performance disponibles ?",
        "Comment résoudre les erreurs de conversion HL7 ?",
        "Comment utiliser Docker avec FHIRHub ?",
        "Quelles sont les fonctionnalités de sécurité ?"
    ];

    res.json({
        success: true,
        suggestions
    });
});

module.exports = router;