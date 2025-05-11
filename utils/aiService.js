/**
 * Service d'IA centralisé qui gère tous les fournisseurs d'IA de manière uniforme
 * @module utils/aiService
 */

const { getActiveAIProvider } = require('./aiProviderService');
const mistralClient = require('./mistralClient');
const ollamaClient = require('./ollamaClient');
const fetch = require('node-fetch');

/**
 * Méthode unique qui génère une réponse depuis n'importe quel fournisseur d'IA configuré comme actif
 * @param {Object} options - Options pour la génération
 * @param {string} options.prompt - Le prompt à envoyer à l'IA
 * @param {string} options.systemPrompt - Prompt système optionnel (pour les modèles qui le supportent)
 * @param {number} options.maxTokens - Nombre maximum de tokens à générer (défaut: 1000)
 * @param {number} options.temperature - Température de la génération (défaut: 0.7)
 * @param {number} options.retryCount - Nombre de tentatives en cas d'erreur (défaut: 2)
 * @returns {Promise<string>} - La réponse générée par l'IA
 */
async function generateResponse({ prompt, systemPrompt = '', maxTokens = 1000, temperature = 0.7, retryCount = 2 }) {
    try {
        // Récupérer le fournisseur d'IA actif
        const aiProvider = await getActiveAIProvider();
        
        if (!aiProvider) {
            throw new Error('Aucun fournisseur d\'IA actif configuré');
        }
        
        console.log(`[AI-SERVICE] Utilisation du fournisseur: ${aiProvider.provider_type}`);

        // Utiliser le fournisseur approprié en fonction du type
        switch (aiProvider.provider_type) {
            case 'mistral':
                // Utiliser le client Mistral
                return await mistralClient.generateResponse(prompt, {
                    model: aiProvider.model_id || 'mistral-large-2411',
                    temperature,
                    maxTokens,
                    retryCount,
                    systemPrompt
                });
                
            case 'ollama':
                // Utiliser le client Ollama
                return await ollamaClient.generateText(prompt);
                
            case 'deepseek':
                // Utiliser DeepSeek (API compatible OpenAI)
                const endpoint = aiProvider.endpoint || aiProvider.api_url || 'https://api.deepseek.com/v1';
                const apiKey = aiProvider.api_key;
                
                if (!apiKey) {
                    throw new Error('Clé API DeepSeek manquante');
                }
                
                // Préparer les messages pour DeepSeek (format OpenAI)
                const messages = [];
                if (systemPrompt) {
                    messages.push({ role: 'system', content: systemPrompt });
                }
                messages.push({ role: 'user', content: prompt });
                
                // Faire l'appel API
                const deepseekResponse = await fetch(`${endpoint}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: aiProvider.model_id || 'deepseek-chat',
                        messages,
                        temperature,
                        max_tokens: maxTokens
                    })
                });
                
                if (!deepseekResponse.ok) {
                    const errorData = await deepseekResponse.json();
                    throw new Error(errorData.error?.message || `Erreur HTTP: ${deepseekResponse.status}`);
                }
                
                const data = await deepseekResponse.json();
                return data.choices[0]?.message?.content || "Je n'ai pas pu générer une réponse cohérente.";
                
            default:
                throw new Error(`Fournisseur d'IA ${aiProvider.provider_type} non pris en charge`);
        }
    } catch (error) {
        console.error(`[AI-SERVICE] Erreur lors de la génération de texte:`, error);
        throw error;
    }
}

/**
 * Vérifie si un fournisseur d'IA est disponible et configuré
 * @returns {Promise<boolean>} - true si au moins un fournisseur d'IA est disponible
 */
async function isAvailable() {
    try {
        const aiProvider = await getActiveAIProvider();
        return !!aiProvider;
    } catch (error) {
        console.error(`[AI-SERVICE] Erreur lors de la vérification de disponibilité:`, error);
        return false;
    }
}

/**
 * Récupère la liste des modèles disponibles pour le fournisseur d'IA actif
 * @returns {Promise<Array>} Liste des modèles disponibles
 */
async function listModels() {
    try {
        // Récupérer le fournisseur d'IA actif
        const aiProvider = await getActiveAIProvider();
        
        if (!aiProvider) {
            throw new Error('Aucun fournisseur d\'IA actif configuré');
        }
        
        // Utiliser le fournisseur approprié en fonction du type
        switch (aiProvider.provider_type) {
            case 'mistral':
                // Utiliser le client Mistral
                return await mistralClient.listModels();
                
            case 'ollama':
                // Utiliser le client Ollama pour lister les modèles
                return await ollamaClient.listModels();
                
            case 'deepseek':
                // DeepSeek API (compatible OpenAI)
                const endpoint = aiProvider.endpoint || aiProvider.api_url || 'https://api.deepseek.com/v1';
                const apiKey = aiProvider.api_key;
                
                if (!apiKey) {
                    throw new Error('Clé API DeepSeek manquante');
                }
                
                // Faire l'appel API pour lister les modèles
                const modelsResponse = await fetch(`${endpoint}/models`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });
                
                if (!modelsResponse.ok) {
                    const errorData = await modelsResponse.json();
                    throw new Error(errorData.error?.message || `Erreur HTTP: ${modelsResponse.status}`);
                }
                
                const modelData = await modelsResponse.json();
                return modelData.data || [];
                
            default:
                throw new Error(`Fournisseur d'IA ${aiProvider.provider_type} non pris en charge pour lister les modèles`);
        }
    } catch (error) {
        console.error(`[AI-SERVICE] Erreur lors de la récupération des modèles:`, error);
        throw error;
    }
}

/**
 * Récupère les informations sur le modèle actuellement utilisé par le fournisseur d'IA actif
 * @returns {Promise<Object>} - Informations sur le modèle actuel {id, name}
 */
async function getCurrentModel() {
    try {
        // Récupérer le fournisseur d'IA actif
        const aiProvider = await getActiveAIProvider();
        
        if (!aiProvider) {
            throw new Error('Aucun fournisseur d\'IA actif configuré');
        }
        
        // Selon le type de fournisseur, récupérer les informations sur le modèle actuel
        switch (aiProvider.provider_type) {
            case 'mistral':
                // Pour Mistral, le modèle est spécifié dans la configuration
                const mistralModelId = aiProvider.model_id || 'mistral-large-latest';
                // Tenter d'obtenir un nom plus lisible si c'est un modèle connu
                let mistralModelName = mistralModelId;
                if (mistralModelId === 'mistral-large-latest') mistralModelName = 'Mistral Large (latest)';
                else if (mistralModelId === 'mistral-large-2411') mistralModelName = 'Mistral Large (2411)';
                else if (mistralModelId === 'mistral-medium') mistralModelName = 'Mistral Medium';
                else if (mistralModelId === 'mistral-small-latest') mistralModelName = 'Mistral Small (latest)';
                
                return {
                    id: mistralModelId,
                    name: mistralModelName
                };
                
            case 'ollama':
                // Pour Ollama, récupérer le modèle actuel via le client Ollama
                if (typeof ollamaClient.getCurrentModel === 'function') {
                    const ollamaModel = await ollamaClient.getCurrentModel();
                    return ollamaModel;
                }
                
                // Si la fonction n'existe pas dans le client, utiliser la configuration
                const ollamaModelId = aiProvider.model_id || 'llama3';
                return {
                    id: ollamaModelId,
                    name: ollamaModelId
                };
                
            case 'openai':
            case 'deepseek':
                // Pour OpenAI et DeepSeek, récupérer le modèle depuis la configuration
                const defaultModelId = aiProvider.provider_type === 'openai' ? 
                    'gpt-4o' : 'deepseek-reasoner';
                
                // Chercher d'abord dans model_id, puis dans models, puis valeur par défaut
                const aiModelId = aiProvider.model_id || aiProvider.models || defaultModelId;
                
                // Personnaliser le nom du modèle pour une meilleure lisibilité
                let aiModelName = aiModelId;
                if (aiProvider.provider_type === 'deepseek') {
                    if (aiModelId === 'deepseek-reasoner') aiModelName = 'DeepSeek Reasoner';
                    if (aiModelId === 'deepseek-chat') aiModelName = 'DeepSeek Chat';
                    if (aiModelId === 'deepseek-coder') aiModelName = 'DeepSeek Coder';
                }
                
                return {
                    id: aiModelId,
                    name: aiModelName
                };
                
            default:
                return {
                    id: 'unknown',
                    name: 'Modèle inconnu'
                };
        }
    } catch (error) {
        console.error(`[AI-SERVICE] Erreur lors de la récupération du modèle actuel:`, error);
        throw error;
    }
}

module.exports = {
    generateResponse,
    isAvailable,
    listModels,
    getCurrentModel
};