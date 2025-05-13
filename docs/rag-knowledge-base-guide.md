# Guide du système RAG et de la base de connaissances

## Introduction au système RAG

Le système RAG (Retrieval-Augmented Generation) de FHIRHub est conçu pour améliorer la précision et la pertinence des réponses du chatbot d'assistance en récupérant des informations contextuelles spécifiques avant de générer une réponse. Cette approche permet de :

- Fournir des réponses factuelles et précises sur les fonctionnalités de FHIRHub
- Éviter les "hallucinations" (génération d'informations inexactes ou inventées)
- Maintenir la cohérence des réponses même après les mises à jour du système
- Assurer que le chatbot reste à jour avec les dernières fonctionnalités

## Architecture du système RAG

### Composants principaux

1. **Base de connaissances structurée** (`data/chatbot-knowledge.json`)
2. **Service de récupération** (`utils/chatbotKnowledgeService.js`)
3. **Intégration avec le service IA** (`routes/ai-chat.js`)

### Diagramme d'architecture

```
┌──────────────────┐     ┌─────────────────────┐     ┌───────────────┐
│ Question         │────▶│ chatbotKnowledge    │────▶│ Informations  │
│ utilisateur      │     │ Service             │     │ pertinentes   │
└──────────────────┘     └─────────────────────┘     └───────┬───────┘
                                   │                         │
                                   ▼                         ▼
                         ┌─────────────────────┐   ┌─────────────────┐
                         │ Base de             │   │ aiService       │
                         │ connaissances JSON  │   │ (requête IA)    │
                         └─────────────────────┘   └────────┬────────┘
                                                            │
                                                            ▼
                                                  ┌─────────────────┐
                                                  │ Réponse finale  │
                                                  │ au format       │
                                                  │ Markdown        │
                                                  └─────────────────┘
```

## Structure de la base de connaissances

La base de connaissances est stockée dans `data/chatbot-knowledge.json` sous forme d'un document JSON structuré en sections thématiques :

```json
{
  "faq": [
    {
      "question": "Comment convertir un message HL7 vers FHIR ?",
      "answer": "Pour convertir un message HL7 vers FHIR, accédez à la page 'Conversion' dans le menu principal. Collez votre message HL7 dans la zone de texte, sélectionnez les options de conversion souhaitées et cliquez sur le bouton 'Convertir'. Le résultat au format FHIR apparaîtra dans la zone de droite. Vous pourrez ensuite le télécharger ou l'envoyer directement à un serveur FHIR."
    },
    // ... autres entrées FAQ
  ],
  "features": [
    {
      "name": "Conversion HL7 vers FHIR",
      "description": "Convertit les messages HL7v2.5 en ressources FHIR R4 (v4.0.1) conformes aux spécifications de l'ANS française. Prend en charge les types de messages courants comme ADT, ORU, ORM, MDM, SIU, etc. Les ressources générées peuvent être visualisées, téléchargées ou envoyées directement à un serveur FHIR."
    },
    // ... autres fonctionnalités
  ],
  "commands": [
    {
      "name": "install.sh / install.bat",
      "description": "Script d'installation qui configure l'environnement et télécharge les dépendances nécessaires. À exécuter une seule fois avant la première utilisation de FHIRHub."
    },
    // ... autres commandes
  ]
}
```

Chaque section est conçue pour répondre à différents types de questions :
- **faq** : Questions fréquemment posées avec leurs réponses détaillées
- **features** : Descriptions des fonctionnalités principales de FHIRHub
- **commands** : Informations sur les commandes et scripts disponibles

## Service de récupération d'informations

Le service `chatbotKnowledgeService.js` est responsable de :

1. Charger la base de connaissances
2. Analyser les questions des utilisateurs
3. Identifier et extraire les informations pertinentes
4. Formater ces informations pour l'inclusion dans le prompt

```javascript
// utils/chatbotKnowledgeService.js
const fs = require('fs').promises;
const path = require('path');

// Chemin vers la base de connaissances
const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../data/chatbot-knowledge.json');

// Charge la base de connaissances
async function loadKnowledgeBase() {
  try {
    const data = await fs.readFile(KNOWLEDGE_BASE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors du chargement de la base de connaissances:', error);
    return { faq: [], features: [], commands: [] };
  }
}

// Calcul de pertinence simple basé sur la correspondance de mots-clés
function calculateRelevance(text, query) {
  const textLower = text.toLowerCase();
  const queryTerms = query.toLowerCase().split(/\s+/);
  
  // Compte le nombre de termes de la requête présents dans le texte
  let matchCount = 0;
  for (const term of queryTerms) {
    if (term.length > 3 && textLower.includes(term)) {
      matchCount++;
    }
  }
  
  return matchCount / queryTerms.length;
}

// Récupère les informations pertinentes pour une question donnée
async function getRelevantInfo(question, threshold = 0.3) {
  const kb = await loadKnowledgeBase();
  const relevantInfo = [];
  
  // Recherche dans les FAQ
  for (const faqItem of kb.faq) {
    const relevanceQuestion = calculateRelevance(faqItem.question, question);
    if (relevanceQuestion > threshold) {
      relevantInfo.push(`Question fréquente: ${faqItem.question}\nRéponse: ${faqItem.answer}`);
    }
  }
  
  // Recherche dans les fonctionnalités
  for (const feature of kb.features) {
    const relevanceName = calculateRelevance(feature.name, question);
    const relevanceDesc = calculateRelevance(feature.description, question);
    
    if (Math.max(relevanceName, relevanceDesc) > threshold) {
      relevantInfo.push(`Fonctionnalité: ${feature.name}\nDescription: ${feature.description}`);
    }
  }
  
  // Recherche dans les commandes
  for (const command of kb.commands) {
    const relevanceName = calculateRelevance(command.name, question);
    const relevanceDesc = calculateRelevance(command.description, question);
    
    if (Math.max(relevanceName, relevanceDesc) > threshold) {
      relevantInfo.push(`Commande: ${command.name}\nUtilisation: ${command.description}`);
    }
  }
  
  // Limite le nombre d'informations retournées pour éviter de surcharger le contexte
  return relevantInfo.slice(0, 3).join('\n\n');
}

module.exports = {
  getRelevantInfo,
  loadKnowledgeBase
};
```

## Intégration dans le système de chatbot

Le système RAG s'intègre au chatbot via la route `/api/ai/chat` :

```javascript
// routes/ai-chat.js
const express = require('express');
const router = express.Router();
const aiService = require('../utils/aiService');
const chatbotKnowledgeService = require('../utils/chatbotKnowledgeService');

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
      
      ${relevantInfo || "Aucune information spécifique trouvée dans la base de connaissances."}
      
      Historique de la conversation:
      ${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}
      
      Question de l'utilisateur: ${message}
      
      INSTRUCTIONS IMPORTANTES:
      - Réponds en utilisant UNIQUEMENT les informations fournies ci-dessus.
      - Si tu ne connais pas la réponse exacte, indique clairement que tu n'as pas 
        cette information spécifique. Exemple: "Je ne trouve pas d'information précise 
        sur ce sujet dans ma base de connaissances FHIRHub."
      - Ne fabrique JAMAIS de fonctionnalités ou d'informations qui ne sont pas 
        mentionnées explicitement.
      - Sois concis et précis.
      - Réponds en français.
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

module.exports = router;
```

## Mise à jour de la base de connaissances

La base de connaissances est conçue pour être facilement mise à jour :

1. Ouvrir le fichier `data/chatbot-knowledge.json`
2. Ajouter, modifier ou supprimer des entrées dans les sections appropriées
3. Enregistrer le fichier - les modifications sont prises en compte immédiatement

### Bonnes pratiques pour les entrées FAQ

- Écrire des questions claires et complètes, telles qu'un utilisateur pourrait les poser
- Fournir des réponses détaillées mais concises
- Inclure des instructions pas à pas quand c'est pertinent
- Éviter le jargon technique excessif
- Mettre à jour les réponses quand les fonctionnalités évoluent

### Exemples d'enrichissement

Pour les nouvelles fonctionnalités :

```json
{
  "name": "Nouvelle Fonctionnalité",
  "description": "Description détaillée de la nouvelle fonctionnalité, ses capacités, et comment l'utiliser efficacement."
}
```

Pour de nouvelles FAQ :

```json
{
  "question": "Comment utiliser la nouvelle fonctionnalité X?",
  "answer": "Pour utiliser la fonctionnalité X, accédez à la page 'X' via le menu principal. Ensuite, configurez les paramètres selon vos besoins et cliquez sur 'Appliquer'. Vous verrez les résultats s'afficher immédiatement."
}
```

## Améliorations futures

Le système RAG peut être amélioré de plusieurs façons :

1. **Recherche sémantique avancée** : Remplacer la correspondance par mots-clés par des embeddings vectoriels pour une meilleure compréhension sémantique
2. **Expansion de la base de connaissances** : Ajouter des sections pour les tutoriels, les études de cas et les erreurs courantes
3. **Feedback utilisateur** : Intégrer un système de feedback pour identifier les questions fréquentes mal répondues
4. **Indexation automatique** : Développer un système qui indexe automatiquement la documentation technique
5. **Personnalisation contextuelle** : Adapter les réponses en fonction du rôle de l'utilisateur (développeur, administrateur, utilisateur final)