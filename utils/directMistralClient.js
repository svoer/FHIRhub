/**
 * Client d'API Mistral direct utilisant fetch
 * Ne dépend pas du SDK officiel, utilisé pour les tests de connectivité
 */

const logger = require('./logger');

// Configuration de base
const DEFAULT_ENDPOINT = 'https://api.mistral.ai/v1';
const DEFAULT_MODEL = 'mistral-large-latest';

/**
 * Teste la connexion à l'API Mistral et récupère la liste des modèles disponibles
 * 
 * @param {Object} options Options de configuration
 * @param {string} options.apiKey Clé API Mistral
 * @param {string} [options.endpoint] Point d'accès (endpoint) personnalisé
 * @returns {Promise<Array>} Liste des modèles disponibles
 */
async function testConnection({ apiKey, endpoint = DEFAULT_ENDPOINT }) {
  if (!apiKey) {
    throw new Error('Clé API Mistral requise');
  }

  try {
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    logger.error(`Erreur de connexion directe à Mistral API: ${error.message}`);
    throw error;
  }
}

/**
 * Génère une réponse simple en utilisant l'API Chat
 * 
 * @param {Object} options Options de configuration
 * @param {string} options.apiKey Clé API Mistral
 * @param {string} options.prompt Message à envoyer
 * @param {string} [options.model] Modèle à utiliser
 * @param {string} [options.endpoint] Point d'accès (endpoint) personnalisé
 * @returns {Promise<string>} Réponse générée
 */
async function generateSimpleResponse({ apiKey, prompt, model = DEFAULT_MODEL, endpoint = DEFAULT_ENDPOINT }) {
  if (!apiKey) {
    throw new Error('Clé API Mistral requise');
  }

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    logger.error(`Erreur lors de la génération de réponse via Mistral API: ${error.message}`);
    throw error;
  }
}

module.exports = {
  testConnection,
  generateSimpleResponse
};