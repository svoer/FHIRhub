# Guide d'intégration de l'IA dans FHIRHub

## Introduction

FHIRHub intègre des capacités d'intelligence artificielle pour améliorer l'analyse des données de santé et fournir une assistance contextuelle aux utilisateurs. Ce document détaille l'architecture technique de l'intégration IA et présente les différentes fonctionnalités disponibles.

## Architecture de l'intégration IA

### Service unifié d'IA (`aiService.js`)

Le cœur de l'intégration IA est le service unifié `aiService.js` qui fournit une interface cohérente pour tous les fournisseurs d'IA :

```javascript
// utils/aiService.js
const mistralService = require('./aiProviders/mistralService');
const ollamaService = require('./aiProviders/ollamaService');
const openaiService = require('./aiProviders/openaiService');
const deepseekService = require('./aiProviders/deepseekService');
const aiProviderService = require('./aiProviderService');
const chatbotKnowledgeService = require('./chatbotKnowledgeService');

// Fonction principale qui achemine les requêtes vers le bon fournisseur
async function queryAIProvider(prompt, options = {}) {
  // Récupère le fournisseur actif depuis la base de données
  const activeProvider = await aiProviderService.getActiveProvider();
  
  if (!activeProvider) {
    throw new Error("Aucun fournisseur d'IA n'est configuré comme actif");
  }
  
  // Sélectionne le service approprié en fonction du type de fournisseur
  switch (activeProvider.provider_type) {
    case 'mistral':
      return mistralService.generateResponse(prompt, options);
    case 'ollama':
      return ollamaService.generateResponse(prompt, options);
    case 'openai':
      return openaiService.generateResponse(prompt, options);
    case 'deepseek':
      return deepseekService.generateResponse(prompt, options);
    default:
      throw new Error(`Fournisseur d'IA non pris en charge: ${activeProvider.provider_type}`);
  }
}
```

### Système de gestion des fournisseurs d'IA (`aiProviderService.js`)

Ce service gère les fournisseurs d'IA disponibles et leurs configurations :

```javascript
// utils/aiProviderService.js
const db = require('./dbService');

// Récupère le fournisseur d'IA actuellement configuré comme actif
async function getActiveProvider() {
  try {
    const [activeProvider] = await db.query(
      "SELECT * FROM ai_providers WHERE is_active = 1"
    );
    return activeProvider;
  } catch (error) {
    console.error("Erreur lors de la récupération du fournisseur d'IA actif:", error);
    return null;
  }
}

// Active un fournisseur d'IA spécifique
async function setActiveProvider(providerId) {
  try {
    // Désactive tous les fournisseurs
    await db.query("UPDATE ai_providers SET is_active = 0");
    
    // Active le fournisseur spécifié
    await db.query(
      "UPDATE ai_providers SET is_active = 1 WHERE id = ?",
      [providerId]
    );
    
    return true;
  } catch (error) {
    console.error("Erreur lors de l'activation du fournisseur d'IA:", error);
    return false;
  }
}
```

## Fonctionnalités d'IA implémentées

### 1. Analyse de données patient

L'analyse de données patient utilise l'IA pour générer un résumé clinique à partir des ressources FHIR d'un patient :

```javascript
// routes/ai-fhir-analyze.js
router.post('/analyze-patient', async (req, res) => {
  try {
    const { patientData } = req.body;
    
    // Validation des données
    if (!patientData) {
      return res.status(400).json({ error: 'Données patient manquantes' });
    }
    
    // Construction du prompt avec contexte médical
    const prompt = `
      En tant que professionnel de santé, analyser les données médicales suivantes 
      du patient et fournir un résumé clinique concis mais complet.
      
      Données patient: ${JSON.stringify(patientData)}
      
      Format de réponse:
      1. Résumé général
      2. Problèmes de santé principaux
      3. Résultats de laboratoire importants
      4. Médicaments et traitements
      5. Recommandations de suivi (basées uniquement sur les données fournies)
    `;
    
    // Appel au service IA unifié
    const analysis = await aiService.queryAIProvider(prompt, {
      maxTokens: 3000,
      temperature: 0.2  // Faible température pour des réponses plus factuelles
    });
    
    res.json({ analysis });
  } catch (error) {
    console.error('Erreur lors de l\'analyse IA:', error);
    res.status(500).json({ error: 'Erreur lors de l\'analyse des données patient' });
  }
});
```

### 2. Chatbot d'assistance (avec RAG)

Le chatbot d'assistance utilise le système RAG (Retrieval-Augmented Generation) pour répondre aux questions des utilisateurs sur FHIRHub :

```javascript
// routes/ai-chat.js
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    
    // Récupération des informations pertinentes de la base de connaissances
    const relevantInfo = await chatbotKnowledgeService.getRelevantInfo(message);
    
    // Construction du prompt avec contexte et instructions anti-hallucination
    const prompt = `
      Tu es un assistant expert pour le logiciel FHIRHub, une plateforme de 
      conversion HL7 vers FHIR et d'interopérabilité en santé.
      
      Voici des informations spécifiques sur FHIRHub qui pourraient être pertinentes 
      pour répondre à la question de l'utilisateur:
      
      ${relevantInfo}
      
      Historique de la conversation:
      ${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}
      
      Question de l'utilisateur: ${message}
      
      INSTRUCTIONS IMPORTANTES:
      - Réponds en utilisant UNIQUEMENT les informations fournies ci-dessus.
      - Si tu ne connais pas la réponse exacte, indique clairement que tu n'as pas 
        cette information spécifique.
      - Ne fabrique JAMAIS de fonctionnalités ou d'informations qui ne sont pas 
        mentionnées explicitement.
      - Sois concis et précis.
    `;
    
    // Appel au service IA unifié
    const response = await aiService.queryAIProvider(prompt, {
      maxTokens: 1000,
      temperature: 0.7
    });
    
    res.json({ response });
  } catch (error) {
    console.error('Erreur lors de la génération de réponse:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de réponse' });
  }
});
```

## Configuration des fournisseurs d'IA

Les administrateurs peuvent configurer les fournisseurs d'IA via l'interface graphique ou via l'API :

```javascript
// routes/ai-providers.js
// GET /api/ai-providers - Obtenir tous les fournisseurs d'IA
router.get('/', async (req, res) => {
  try {
    const providers = await aiProviderService.getAllProviders();
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai-providers - Ajouter un nouveau fournisseur
router.post('/', async (req, res) => {
  try {
    const { name, provider_type, api_key, api_url, model_name } = req.body;
    const newProvider = await aiProviderService.addProvider({
      name, provider_type, api_key, api_url, model_name
    });
    res.status(201).json(newProvider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ai-providers/:id/activate - Activer un fournisseur spécifique
router.put('/:id/activate', async (req, res) => {
  try {
    const result = await aiProviderService.setActiveProvider(req.params.id);
    if (result) {
      res.json({ success: true, message: 'Fournisseur activé avec succès' });
    } else {
      res.status(500).json({ error: 'Échec de l\'activation du fournisseur' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Fournisseurs d'IA pris en charge

FHIRHub prend en charge plusieurs fournisseurs d'IA :

### 1. Mistral AI

Implémentation de l'accès aux modèles Mistral AI, conforme au RGPD et adapté au contexte médical européen.

### 2. Ollama

Intégration d'Ollama pour le fonctionnement hors-ligne et local, idéal pour les environnements sécurisés ou sans accès Internet.

### 3. OpenAI (optionnel)

Support pour les modèles OpenAI comme alternative.

### 4. DeepSeek (optionnel)

Support pour les modèles DeepSeek comme alternative.

## Performance et sécurité

- Toutes les requêtes IA sont asynchrones et utilisent un système de timeout pour éviter les blocages
- Les clés API sont stockées de manière sécurisée dans la base de données
- Les données patient ne sont jamais stockées après l'analyse
- Un indicateur visuel affiche le fournisseur d'IA actuellement actif sur l'interface

## Extensibilité

Le système est conçu pour être facilement extensible à d'autres fournisseurs d'IA. Pour ajouter un nouveau fournisseur :

1. Créer un nouveau service dans `utils/aiProviders/`
2. Implémenter l'interface standard avec `generateResponse()`
3. Ajouter le nouveau fournisseur au switch dans `aiService.js`
4. Mettre à jour le schéma de base de données (si nécessaire)