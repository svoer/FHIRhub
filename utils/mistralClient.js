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
  
  try {
    const modelList = await mistralClient.models.list();
    
    // Vérifier si la réponse contient la propriété 'data' attendue
    if (modelList && Array.isArray(modelList.data)) {
      return modelList;
    }
    
    // Si la structure est différente, retourner un format compatible
    return {
      data: Array.isArray(modelList) ? modelList : [
        { id: "mistral-large-2411", object: "model" },
        { id: "mistral-medium", object: "model" },
        { id: "mistral-small-latest", object: "model" }
      ]
    };
  } catch (error) {
    logger.error(`Erreur lors de la récupération des modèles Mistral: ${error.message}`);
    // Retourner des modèles par défaut en cas d'erreur
    return {
      data: [
        { id: "mistral-large-2411", object: "model" },
        { id: "mistral-medium", object: "model" },
        { id: "mistral-small-latest", object: "model" }
      ]
    };
  }
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
  
  // Ajouter un message système si fourni
  if (systemMessage) {
    messages.push({ role: 'system', content: systemMessage });
  }
  
  // Vérifier si le prompt est une chaîne ou un objet
  if (typeof prompt === 'string') {
    // Simple prompt texte
    messages.push({ role: 'user', content: prompt });
  } else if (typeof prompt === 'object' && prompt !== null) {
    // Si le prompt est déjà un objet message ou une liste de messages
    if (Array.isArray(prompt)) {
      // C'est une liste de messages, on les ajoute tous
      prompt.forEach(msg => {
        if (msg && typeof msg === 'object' && msg.role && msg.content) {
          messages.push(msg);
        } else if (msg && typeof msg === 'string') {
          messages.push({ role: 'user', content: msg });
        }
      });
    } else if (prompt.role && prompt.content) {
      // C'est un seul message formaté
      messages.push(prompt);
    } else if (prompt.messages && Array.isArray(prompt.messages)) {
      // Format spécial avec une liste de messages
      prompt.messages.forEach(msg => {
        if (msg && typeof msg === 'object' && msg.role && msg.content) {
          messages.push(msg);
        }
      });
    } else {
      // Fallback - on le transforme en string
      messages.push({ role: 'user', content: JSON.stringify(prompt) });
    }
  } else {
    // Fallback pour les cas non gérés
    messages.push({ role: 'user', content: String(prompt || '') });
  }
  
  // S'assurer qu'il y a au moins un message utilisateur
  if (messages.length === 0 || messages.every(m => m.role !== 'user')) {
    messages.push({ role: 'user', content: 'Analyser les données médicales fournies' });
  }
  
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
      
      // Vérification de la clé API (sans la révéler)
      try {
        console.log(`[MISTRAL-CLIENT] Vérification de la clé API configurée:`, 
          apiKey ? `*****${apiKey.substring(apiKey.length - 5)}` : 'NON DÉFINIE');
        
        if (!apiKey) {
          throw new Error('API_KEY_MISSING');
        }
      } catch (apiKeyError) {
        console.error(`[MISTRAL-CLIENT] Erreur de configuration - Clé API manquante ou invalide`);
        throw new Error('API_KEY_MISSING');
      }
      
      // Vérification du endpoint de l'API
      try {
        console.log(`[MISTRAL-CLIENT] Endpoint configuré:`, 
          mistralClient?.basePath || 'NON DÉFINI');
          
        if (!mistralClient?.basePath) {
          throw new Error('API_ENDPOINT_MISSING');
        }
      } catch (endpointError) {
        console.error(`[MISTRAL-CLIENT] Erreur de configuration - Endpoint API manquant ou invalide`);
        throw new Error('API_ENDPOINT_MISSING');
      }
      
      // Préparation des paramètres d'appel
      const chatParams = {
        model,
        messages,
        temperature
      };
      
      // Ajouter max_tokens uniquement si valide
      if (maxTokens && maxTokens > 0) {
        chatParams.max_tokens = maxTokens;
      }
      
      // Log détaillé pour le débogage
      logger.info(`Appel Mistral avec modèle: ${model}, ${messages.length} messages`);
      
      // Lancer l'appel avec un délai variable selon le nombre de tentatives
      console.log(`Tentative d'appel à l'API Mistral (${attempt+1}/${retryCount+1})`);
      console.log(`Appel Mistral avec modèle: ${model}, ${messages.length} messages`);
      
      // Afficher un échantillon du contenu pour vérifier ce qui est envoyé
      if (messages && messages.length > 0 && messages[messages.length - 1].content) {
        const lastMessageContent = messages[messages.length - 1].content;
        const contentSample = typeof lastMessageContent === 'string' 
          ? lastMessageContent.substring(0, 200) + '...' 
          : JSON.stringify(lastMessageContent).substring(0, 200) + '...';
        console.log(`Échantillon du dernier message: ${contentSample}`);
      }
      
      // Vérification que le modèle est bien défini
      if (!model) {
        console.error(`[MISTRAL-CLIENT] Erreur de configuration - Modèle non spécifié`);
        throw new Error('MODEL_MISSING');
      }
      
      try {
        console.log('[MISTRAL-CLIENT] Vérification de la méthode mistralClient.chat.complete', 
          typeof mistralClient.chat.complete === 'function' ? 'OK' : 'NON DISPONIBLE');
      } catch (methodError) {
        console.error('[MISTRAL-CLIENT] Erreur lors de la vérification des méthodes clients:', methodError);
      }
        
      // Évaluer si le client est bien initialisé et a les méthodes requises
      if (!mistralClient?.chat?.complete || typeof mistralClient.chat.complete !== 'function') {
        console.error('[MISTRAL-CLIENT] Client Mistral mal initialisé - Méthode chat.complete manquante');
        throw new Error('CLIENT_METHOD_MISSING');
      }
       
      console.log('[MISTRAL-CLIENT] Paramètres de l\'appel:', JSON.stringify({
        model: chatParams.model,
        temperature: chatParams.temperature,
        max_tokens: chatParams.max_tokens,
        messages_count: messages.length
      }));
      
      // Version simplifiée de l'appel avec try/catch explicite pour capturer les erreurs
      let apiPromise;
      try {
        console.log('[MISTRAL-CLIENT] Tentative d\'appel direct à mistralClient.chat.complete()');
        apiPromise = mistralClient.chat.complete(chatParams);
      } catch (directError) {
        console.error('[MISTRAL-CLIENT] Erreur directe lors de l\'appel:', directError);
        throw directError;
      }
      
      // Ajouter un gestionnaire d'erreur au niveau de la promesse
      apiPromise = apiPromise.catch(err => {
        console.error(`[MISTRAL-CLIENT] Erreur dans l'appel de base à Mistral:`, err);
        logger.error(`Erreur dans l'appel de base à Mistral: ${err.message}`);
        
        // Log plus détaillé du contexte d'erreur
        try {
          console.error(`Contexte de l'erreur: API URL=${mistralClient?.basePath}, ` +
            `Paramètres API=${JSON.stringify({
              model: chatParams.model,
              temperature: chatParams.temperature,
              max_tokens: chatParams.max_tokens,
              nb_messages: messages.length
            })}`);
        } catch (debugError) {
          console.error("Erreur lors de l'affichage du contexte:", debugError.message);
        }
        
        throw new Error(`MISTRAL_API_ERROR: ${err.message}`);
      });
      
      // Utiliser celui qui se termine en premier
      const response = await Promise.race([apiPromise, timeoutPromise]).catch(err => {
        logger.error(`Erreur dans Promise.race: ${err.message}`);
        throw err;
      });
      
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