/**
 * Client pour l'API DeepSeek
 * @module utils/deepseekClient
 */

const axios = require('axios');
const logger = require('./logger');

// Variable pour stocker le client
let deepseekClient = null;
let clientConfig = {
    apiKey: null,
    apiBaseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-reasoner'
};

/**
 * Initialise ou réinitialise le client DeepSeek avec la clé API fournie
 * @param {Object} config - Configuration du client
 * @param {string} config.apiKey - Clé API DeepSeek
 * @param {string} [config.apiBaseUrl] - URL de base de l'API DeepSeek
 * @param {string} [config.model] - Modèle à utiliser par défaut
 * @returns {Promise<boolean>} True si l'initialisation a réussi
 */
async function initializeClient(config = {}) {
    try {
        // Mise à jour de la configuration
        if (config.apiKey) clientConfig.apiKey = config.apiKey;
        if (config.apiBaseUrl) clientConfig.apiBaseUrl = config.apiBaseUrl;
        if (config.model) clientConfig.model = config.model;

        logger.info('Client DeepSeek initialisé avec succès');
        
        return true;
    } catch (error) {
        logger.error(`Erreur lors de l'initialisation du client DeepSeek: ${error.message}`);
        return false;
    }
}

/**
 * Vérifie si l'API DeepSeek est disponible
 * @returns {Promise<boolean>} True si l'API est disponible
 */
async function isAvailable() {
    if (!clientConfig.apiKey) {
        logger.error('Clé API DeepSeek non configurée');
        return false;
    }

    try {
        const response = await axios.get(`${clientConfig.apiBaseUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${clientConfig.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        return response.status === 200;
    } catch (error) {
        logger.error(`Erreur lors de la vérification de la disponibilité de DeepSeek: ${error.message}`);
        return false;
    }
}

/**
 * Récupère la liste des modèles disponibles
 * @returns {Promise<Array>} Liste des modèles disponibles
 */
async function listModels() {
    if (!clientConfig.apiKey) {
        logger.error('Clé API DeepSeek non configurée');
        return [];
    }

    try {
        const response = await axios.get(`${clientConfig.apiBaseUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${clientConfig.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        // Standardiser le format des modèles pour être compatible avec les autres fournisseurs
        if (response.data && Array.isArray(response.data.data)) {
            return response.data.data.map(model => ({
                id: model.id,
                name: model.id,
                description: model.description || 'Modèle DeepSeek'
            }));
        }
        
        return [];
    } catch (error) {
        logger.error(`Erreur lors de la récupération des modèles DeepSeek: ${error.message}`);
        return [];
    }
}

/**
 * Génère une complétion de texte
 * @param {string|Object} prompt - Texte ou objet de prompt
 * @param {Object} options - Options pour la génération
 * @returns {Promise<string>} Texte généré
 */
async function generateText(prompt, options = {}) {
    if (!clientConfig.apiKey) {
        throw new Error('Clé API DeepSeek non configurée');
    }

    // Format du prompt
    const messages = [];
    if (options.systemPrompt) {
        messages.push({
            role: 'system',
            content: options.systemPrompt
        });
    }

    // Si le prompt est un objet, le convertir en chaîne JSON
    const promptContent = typeof prompt === 'object' ? JSON.stringify(prompt) : prompt;
    
    messages.push({
        role: 'user',
        content: promptContent
    });

    const apiOptions = {
        model: options.model || clientConfig.model,
        messages: messages,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        max_tokens: options.maxTokens || 1000,
        stop: options.stop || null
    };

    try {
        logger.info(`Envoi de requête à DeepSeek avec modèle: ${apiOptions.model}`);
        
        const response = await axios.post(`${clientConfig.apiBaseUrl}/chat/completions`, apiOptions, {
            headers: {
                'Authorization': `Bearer ${clientConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: options.timeout || 90000 // 90 secondes par défaut
        });

        // Extraction du texte généré
        if (response.data && 
            response.data.choices && 
            response.data.choices.length > 0 && 
            response.data.choices[0].message &&
            response.data.choices[0].message.content) {
            return response.data.choices[0].message.content;
        } else {
            throw new Error('Format de réponse DeepSeek inattendu');
        }
    } catch (error) {
        // Amélioration du message d'erreur
        const errorMessage = error.response 
            ? `DeepSeek API Error (${error.response.status}): ${JSON.stringify(error.response.data)}` 
            : `DeepSeek Error: ${error.message}`;
        
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }
}

/**
 * Génère une réponse de chat
 * @param {Array} messages - Messages de l'historique de conversation
 * @param {Object} options - Options pour la génération
 * @returns {Promise<Object>} Réponse formatée pour le chat
 */
async function generateChatCompletion(messages, options = {}) {
    if (!clientConfig.apiKey) {
        throw new Error('Clé API DeepSeek non configurée');
    }

    const apiOptions = {
        model: options.model || clientConfig.model,
        messages: messages,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        max_tokens: options.maxTokens || 1000,
        stop: options.stop || null
    };

    try {
        logger.info(`Envoi de requête chat à DeepSeek avec modèle: ${apiOptions.model}`);
        
        const response = await axios.post(`${clientConfig.apiBaseUrl}/chat/completions`, apiOptions, {
            headers: {
                'Authorization': `Bearer ${clientConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: options.timeout || 60000 // 60 secondes par défaut
        });

        // Format de réponse standardisé
        if (response.data && 
            response.data.choices && 
            response.data.choices.length > 0 && 
            response.data.choices[0].message) {
            
            return {
                role: response.data.choices[0].message.role || 'assistant',
                content: response.data.choices[0].message.content || '',
                model: response.data.model || apiOptions.model,
                created: response.data.created || Date.now(),
                id: response.data.id || `deepseek-${Date.now()}`
            };
        } else {
            throw new Error('Format de réponse DeepSeek inattendu');
        }
    } catch (error) {
        // Amélioration du message d'erreur
        const errorMessage = error.response 
            ? `DeepSeek API Error (${error.response.status}): ${JSON.stringify(error.response.data)}` 
            : `DeepSeek Error: ${error.message}`;
        
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }
}

module.exports = {
    initializeClient,
    isAvailable,
    listModels,
    generateText,
    generateChatCompletion
};