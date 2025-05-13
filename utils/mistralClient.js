/**
 * Service d'intégration avec l'API Mistral AI
 * Fournit des fonctions utilitaires pour interagir avec l'API Mistral AI
 */
const logger = require('./logger');
const { Mistral } = require('@mistralai/mistralai');
const aiProviderService = require('./aiProviderService');

// Client Mistral AI
let mistralClient = null;

/**
 * Initialise ou réinitialise le client Mistral avec la clé API du fournisseur actif
 * @returns {Promise<boolean>} True si l'initialisation a réussi, false sinon
 */
async function initializeClient() {
  try {
    // Récupérer le fournisseur d'IA actif depuis la base de données
    const activeProvider = await aiProviderService.getActiveAIProvider();
    
    if (!activeProvider || activeProvider.provider_type !== 'mistral' || !activeProvider.api_key) {
      logger.warn('Pas de fournisseur Mistral actif ou clé API manquante dans la base de données');
      return false;
    }
    
    // Créer un nouveau client avec la clé API du fournisseur actif
    mistralClient = new Mistral({ 
      apiKey: activeProvider.api_key,
      // Configuration améliorée pour gérer les problèmes de timeout
      maxRetries: 3,
      timeout: 180000 // Définir un timeout de 180 secondes (3 minutes)
    });
    
    logger.info('Client Mistral initialisé avec succès avec la clé API du fournisseur actif');
    return true;
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation du client Mistral: ${error.message}`);
    return false;
  }
}

// Initialiser le client au démarrage (mais sans bloquer)
initializeClient().catch(err => {
  logger.error(`Erreur lors de l'initialisation initiale du client Mistral: ${err.message}`);
});

/**
 * Vérifie si l'API Mistral est configurée et disponible
 * @returns {Promise<boolean>} True si l'API est disponible
 */
async function isAvailable() {
  if (!mistralClient) {
    // Essayer d'initialiser le client
    const success = await initializeClient();
    if (!success) return false;
  }
  return !!mistralClient;
}

/**
 * Récupère la liste des modèles disponibles
 * @returns {Promise<Array>} Liste des modèles disponibles
 */
async function listModels() {
  if (!mistralClient) {
    // Essayer d'initialiser le client avant de continuer
    const success = await initializeClient();
    if (!success) {
      throw new Error('Client Mistral non disponible - Veuillez configurer un fournisseur Mistral actif dans les paramètres');
    }
  }
  
  return await mistralClient.models.list();
}

/**
 * Génère une réponse à partir d'un prompt avec gestion améliorée des erreurs
 */
async function generateResponse(prompt, {
  model = 'mistral-large-2411',
  temperature = 0.3,
  maxTokens = 1000,
  systemMessage = null,
  retryCount = 2
} = {}) {
  if (!mistralClient) {
    // Essayer d'initialiser le client avant de continuer
    const success = await initializeClient();
    if (!success) {
      throw new Error('Client Mistral non disponible - Veuillez configurer un fournisseur Mistral actif dans les paramètres');
    }
  }
  
  // Préparation des messages
  const messages = [];
  
  if (systemMessage) {
    messages.push({ role: 'system', content: systemMessage });
  }
  
  messages.push({ role: 'user', content: prompt });
  
  // Implémentation des tentatives avec backoff exponentiel
  let attempt = 0;
  let lastError = null;
  
  while (attempt <= retryCount) {
    try {
      logger.info(`Tentative d'appel à l'API Mistral (${attempt+1}/${retryCount+1})`);
      
      // Ajouter un timeout explicite en utilisant Promise.race
      // Augmenter à 180 secondes pour laisser plus de temps à l'analyse des grands bundles FHIR
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout dépassé pour l\'appel à l\'API Mistral')), 180000);
      });
      
      // Lancer l'appel avec un délai variable selon le nombre de tentatives
      const apiPromise = mistralClient.chat.complete({
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      });
      
      // Utiliser celui qui se termine en premier
      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      // Si on arrive ici, on a une réponse valide
      logger.info(`Réponse API Mistral reçue avec succès (tentative ${attempt+1})`);
      return response.choices[0].message.content.trim();
    } catch (error) {
      lastError = error;
      logger.error(`Erreur lors de l'appel à Mistral (tentative ${attempt+1}/${retryCount+1}): ${error.message}`);
      
      // Si c'est la dernière tentative, laisser l'erreur remonter
      if (attempt >= retryCount) {
        break;
      }
      
      // Attendre avant de réessayer avec backoff exponentiel
      const backoffTime = Math.pow(2, attempt) * 1000;
      logger.info(`Nouvel essai dans ${backoffTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      attempt++;
    }
  }
  
  // Si on arrive ici, toutes les tentatives ont échoué
  throw new Error(`Impossible d'obtenir une réponse de Mistral après ${retryCount+1} tentatives: ${lastError?.message || 'Erreur inconnue'}`);
}

/**
 * Convertit une question en langage naturel en requête FHIR
 */
async function naturalLanguageToFhirQuery(question, {
  model = 'mistral-large-2411',
  temperature = 0.2
} = {}) {
  if (!mistralClient) {
    // Essayer d'initialiser le client avant de continuer
    const success = await initializeClient();
    if (!success) {
      throw new Error('Client Mistral non disponible - Veuillez configurer un fournisseur Mistral actif dans les paramètres');
    }
  }
  
  const systemMessage = `
Tu es un assistant spécialisé dans la conversion de requêtes en langage naturel en requêtes FHIR REST API valides.
Génère uniquement l'URL relative de la requête REST FHIR, sans aucune explication ou texte supplémentaire.
N'inclus jamais l'URL de base ou le protocole, seulement le chemin relatif.
Respecte la syntaxe exacte des URLs FHIR et utilise les paramètres de recherche standard.
`;
  
  const prompt = `
Convertis cette question en requête FHIR:
"${question}"

Exemples:
- "Montre-moi tous les patients diabétiques" → "/Condition?code=E11&_include=Condition:patient"
- "Quels sont les résultats des analyses sanguines de Maria Lopez?" → "/Patient?name=Maria+Lopez&_revinclude=Observation:patient&category=laboratory"
- "Combien de patients ont une glycémie supérieure à 2g/L?" → "/Observation?code=http://loinc.org|2339-0&value-quantity=gt2"

URL FHIR:
`;
  
  const response = await mistralClient.chat.complete({
    model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ],
    temperature,
    max_tokens: 300
  });
  
  const fhirQuery = response.choices[0].message.content.trim();
  
  // Sanitizer la requête
  return sanitizeFhirQuery(fhirQuery);
}

/**
 * Sanitize une requête FHIR pour éviter les injections
 */
function sanitizeFhirQuery(query) {
  // Sanitize l'URL pour éviter les injections ou les requêtes malveillantes
  const sanitizedQuery = query
    .replace(/\/\/+/g, '/') // Éviter les doubles slashes
    .replace(/\.\./g, '') // Éviter les path traversal
    .replace(/;/g, '') // Éviter les commandes multiples
    .trim();
  
  // Vérifier que la requête ne contient que des caractères valides
  if (!/^[a-zA-Z0-9\-_\/?=&%.:,+]*$/.test(sanitizedQuery)) {
    throw new Error('La requête FHIR contient des caractères non autorisés');
  }
  
  return sanitizedQuery;
}

/**
 * Génère un résumé médical à partir de données FHIR
 */
async function generateMedicalSummary(fhirData, {
  model = 'mistral-large-2411',
  temperature = 0.3,
  maxTokens = 2000
} = {}) {
  if (!mistralClient) {
    // Essayer d'initialiser le client avant de continuer
    const success = await initializeClient();
    if (!success) {
      throw new Error('Client Mistral non disponible - Veuillez configurer un fournisseur Mistral actif dans les paramètres');
    }
  }
  
  const systemMessage = `
Tu es un assistant médical spécialisé dans l'interprétation et la synthèse de données médicales au format FHIR.
À partir des données FHIR fournies, crée un résumé clinique concis et pertinent.
Utilise uniquement les informations présentes dans les données, sans inventer.
Structure ton résumé de manière claire: identité du patient, problèmes médicaux, résultats biologiques, traitements, dernières consultations.
Utilise un langage médical précis mais accessible aux professionnels de santé.
Signale les valeurs anormales et les points d'attention clinique.
Reste factuel et objectif.
`;
  
  let fhirDataStr;
  if (typeof fhirData === 'string') {
    fhirDataStr = fhirData;
  } else {
    fhirDataStr = JSON.stringify(fhirData, null, 2);
  }
  
  const prompt = `
Voici des données médicales au format FHIR à analyser et résumer:

\`\`\`json
${fhirDataStr}
\`\`\`

Génère un résumé clinique structuré et concis de ces données.
`;
  
  const response = await mistralClient.chat.complete({
    model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ],
    temperature,
    max_tokens: maxTokens
  });
  
  return response.choices[0].message.content.trim();
}

/**
 * Analyse une observation médicale et fournit une interprétation
 */
async function analyzeObservation(observation, patientInfo = null, {
  model = 'mistral-large-2411',
  temperature = 0.3,
  maxTokens = 1000
} = {}) {
  if (!mistralClient) {
    // Essayer d'initialiser le client avant de continuer
    const success = await initializeClient();
    if (!success) {
      throw new Error('Client Mistral non disponible - Veuillez configurer un fournisseur Mistral actif dans les paramètres');
    }
  }
  
  const systemMessage = `
Tu es un expert médical spécialisé dans l'interprétation des résultats d'analyses médicales.
Analyse et interprète l'observation médicale fournie au format FHIR.
Fournis une analyse complète et professionnelle incluant:
1. Type d'analyse et code médical
2. Valeur et unité de mesure
3. Interprétation clinique (normal, anormal, critique)
4. Signification médicale et pertinence clinique
5. Plage de référence et écart par rapport à la normale
6. Recommandations ou points d'attention pour le médecin
`;
  
  let observationStr;
  if (typeof observation === 'string') {
    observationStr = observation;
  } else {
    observationStr = JSON.stringify(observation, null, 2);
  }
  
  let prompt = `
Voici une observation médicale au format FHIR à analyser:

\`\`\`json
${observationStr}
\`\`\`
`;
  
  if (patientInfo) {
    let patientInfoStr;
    if (typeof patientInfo === 'string') {
      patientInfoStr = patientInfo;
    } else {
      patientInfoStr = JSON.stringify(patientInfo, null, 2);
    }
    
    prompt += `
Informations sur le patient:
\`\`\`json
${patientInfoStr}
\`\`\`
`;
  }
  
  prompt += `
Fais une analyse complète et professionnelle de cette observation.
`;
  
  const response = await mistralClient.chat.complete({
    model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ],
    temperature,
    max_tokens: maxTokens
  });
  
  return response.choices[0].message.content.trim();
}

/**
 * Analyse l'évolution des observations d'un patient sur une période donnée
 */
async function analyzeTrends(observations, patientInfo = null, {
  model = 'mistral-large-2411',
  temperature = 0.3,
  maxTokens = 1200
} = {}) {
  if (!mistralClient) {
    // Essayer d'initialiser le client avant de continuer
    const success = await initializeClient();
    if (!success) {
      throw new Error('Client Mistral non disponible - Veuillez configurer un fournisseur Mistral actif dans les paramètres');
    }
  }
  
  const systemMessage = `
Tu es un expert médical spécialisé dans l'analyse des tendances d'observations médicales au cours du temps.
Analyse l'évolution des valeurs dans le temps pour un même patient.
Fournis une analyse approfondie incluant:
1. Type d'analyse et signification clinique
2. Tendance générale (stable, en hausse, en baisse, fluctuante)
3. Identification des valeurs anormales et de leur contexte temporel
4. Corrélation avec des périodes ou événements spécifiques si identifiables
5. Interprétation médicale de ces tendances
6. Recommandations cliniques basées sur cette évolution
`;
  
  let observationsStr;
  if (typeof observations === 'string') {
    observationsStr = observations;
  } else {
    observationsStr = JSON.stringify(observations, null, 2);
  }
  
  let prompt = `
Voici une série d'observations médicales au format FHIR pour un même patient:

\`\`\`json
${observationsStr}
\`\`\`
`;
  
  if (patientInfo) {
    let patientInfoStr;
    if (typeof patientInfo === 'string') {
      patientInfoStr = patientInfo;
    } else {
      patientInfoStr = JSON.stringify(patientInfo, null, 2);
    }
    
    prompt += `
Informations sur le patient:
\`\`\`json
${patientInfoStr}
\`\`\`
`;
  }
  
  prompt += `
Fais une analyse approfondie de l'évolution de ces valeurs dans le temps.
`;
  
  const response = await mistralClient.chat.complete({
    model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ],
    temperature,
    max_tokens: maxTokens
  });
  
  return response.choices[0].message.content.trim();
}

/**
 * Génère une réponse pour le chatbot (avec support de l'historique de conversation)
 * @param {Array} messages - Historique des messages au format [{role, content}]
 * @param {Object} options - Options pour la génération (model, temperature, etc.)
 * @returns {Object} - Réponse formatée pour le chatbot
 */
async function generateChatCompletion(messages, {
  model = 'mistral-large-2411',
  temperature = 0.7,
  max_tokens = 1000
} = {}) {
  if (!mistralClient) {
    // Essayer d'initialiser le client avant de continuer
    const success = await initializeClient();
    if (!success) {
      throw new Error('Client Mistral non disponible - Veuillez configurer un fournisseur Mistral actif dans les paramètres');
    }
  }
  
  try {
    // Vérifier le format des messages
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Format de messages invalide - doit être un tableau non vide');
    }
    
    // Convertir le format si nécessaire (pour assurer la compatibilité)
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Appeler l'API Mistral avec l'historique des messages
    const response = await mistralClient.chat.complete({
      model,
      messages: formattedMessages,
      temperature,
      max_tokens
    });
    
    // Extraire et formater la réponse
    if (response && response.choices && response.choices.length > 0) {
      return {
        content: response.choices[0].message.content.trim(),
        model: response.model,
        usage: response.usage
      };
    } else {
      throw new Error('Réponse invalide de l\'API Mistral');
    }
  } catch (error) {
    logger.error(`Erreur lors de la génération de réponse pour le chatbot: ${error.message}`);
    throw error;
  }
}

module.exports = {
  mistralClient,
  isAvailable,
  listModels,
  generateResponse,
  naturalLanguageToFhirQuery,
  generateMedicalSummary,
  analyzeObservation,
  analyzeTrends,
  generateChatCompletion
};