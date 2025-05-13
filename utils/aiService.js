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
async function generateResponse({ prompt, systemPrompt = '', maxTokens = 1000, temperature = 0.7, retryCount = 2, systemMessage = null }) {
    let debugInfo = {};
    
    try {
        // Vérifier et nettoyer les paramètres
        if (!prompt && !Array.isArray(prompt)) {
            console.warn(`[AI-SERVICE] Aucun prompt fourni. Utilisation d'une valeur par défaut.`);
            prompt = "Analyser les données médicales disponibles";
        }
        
        // Utiliser systemMessage comme fallback si systemPrompt n'est pas fourni
        if (!systemPrompt && systemMessage) {
            systemPrompt = systemMessage;
        }
        
        // S'assurer que maxTokens est un nombre valide
        maxTokens = parseInt(maxTokens, 10) || 1000;
        
        // S'assurer que temperature est un nombre valide
        temperature = parseFloat(temperature) || 0.7;
        if (temperature < 0) temperature = 0;
        if (temperature > 1) temperature = 1;
        
        console.log(`[AI-SERVICE] Paramètres validés: maxTokens=${maxTokens}, temperature=${temperature}, retryCount=${retryCount}`);
        
        // Récupérer le fournisseur d'IA actif
        const aiProvider = await getActiveAIProvider();
        
        debugInfo.aiProvider = aiProvider ? {
            id: aiProvider.id || aiProvider.provider_id,
            type: aiProvider.provider_type,
            name: aiProvider.name || aiProvider.provider_name,
            hasApiKey: !!aiProvider.api_key
        } : null;
        
        if (!aiProvider) {
            console.error(`[AI-SERVICE] Erreur: Aucun fournisseur d'IA actif configuré`);
            throw new Error('Aucun fournisseur d\'IA actif configuré');
        }
        
        console.log(`[AI-SERVICE] Utilisation du fournisseur: ${aiProvider.provider_type || aiProvider.type}, modèle: ${aiProvider.model_id || aiProvider.model_name || 'par défaut'}`);

        // Utiliser le fournisseur approprié en fonction du type
        switch (aiProvider.provider_type) {
            case 'mistral':
                // Récupérer le modèle (en tenant compte des différentes façons de le stocker)
                const mistralModel = aiProvider.model_id || aiProvider.model_name || 'mistral-large-2411';
                
                console.log(`[AI-SERVICE] Appel Mistral avec modèle: ${mistralModel}`);
                
                try {
                    const response = await mistralClient.generateResponse(prompt, {
                        model: mistralModel,
                        temperature,
                        maxTokens,
                        systemMessage: systemPrompt, // Utiliser systemPrompt comme fallback
                        retryCount
                    });
                    
                    console.log(`[AI-SERVICE] Réponse Mistral reçue avec succès`);
                    return response;
                } catch (mistralError) {
                    console.error(`[AI-SERVICE] Erreur avec le client Mistral:`, mistralError);
                    // Ne pas relancer l'erreur ici, mais utiliser le fallback local si configuré
                    throw new Error(`Erreur du service Mistral: ${mistralError.message}`);
                }
                
            case 'ollama':
                // Utiliser le client Ollama
                console.log(`[AI-SERVICE] Appel Ollama`);
                try {
                    const response = await ollamaClient.generateText(prompt);
                    console.log(`[AI-SERVICE] Réponse Ollama reçue avec succès`);
                    return response;
                } catch (ollamaError) {
                    console.error(`[AI-SERVICE] Erreur avec le client Ollama:`, ollamaError);
                    throw new Error(`Erreur du service Ollama: ${ollamaError.message}`);
                }
                
            case 'deepseek':
                // Utiliser DeepSeek (API compatible OpenAI)
                const endpoint = aiProvider.endpoint || aiProvider.api_url || 'https://api.deepseek.com/v1';
                const apiKey = aiProvider.api_key;
                
                if (!apiKey) {
                    console.error(`[AI-SERVICE] Erreur: Clé API DeepSeek manquante`);
                    throw new Error('Clé API DeepSeek manquante');
                }
                
                console.log(`[AI-SERVICE] Appel DeepSeek via endpoint: ${endpoint}`);
                
                // Préparer les messages pour DeepSeek (format OpenAI)
                const messages = [];
                if (systemPrompt) {
                    messages.push({ role: 'system', content: systemPrompt });
                }
                
                // Adapter le prompt selon son type
                if (typeof prompt === 'string') {
                    messages.push({ role: 'user', content: prompt });
                } else if (Array.isArray(prompt)) {
                    // Si c'est un tableau, considérer que ce sont des messages
                    prompt.forEach(msg => {
                        if (typeof msg === 'string') {
                            messages.push({ role: 'user', content: msg });
                        } else if (msg && typeof msg === 'object' && msg.role && msg.content) {
                            messages.push(msg);
                        }
                    });
                } else if (prompt && typeof prompt === 'object') {
                    // Si c'est un objet, l'ajouter comme message utilisateur
                    messages.push({ role: 'user', content: JSON.stringify(prompt) });
                }
                
                try {
                    // Faire l'appel API
                    const deepseekResponse = await fetch(`${endpoint}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: aiProvider.model_id || aiProvider.model_name || 'deepseek-chat',
                            messages,
                            temperature,
                            max_tokens: maxTokens
                        })
                    });
                    
                    if (!deepseekResponse.ok) {
                        let errorMessage = `Erreur HTTP: ${deepseekResponse.status}`;
                        try {
                            const errorData = await deepseekResponse.json();
                            errorMessage = errorData.error?.message || errorMessage;
                        } catch (parseError) {
                            // Si on ne peut pas parser la réponse JSON, utiliser le message d'erreur HTTP
                        }
                        console.error(`[AI-SERVICE] Erreur DeepSeek: ${errorMessage}`);
                        throw new Error(errorMessage);
                    }
                    
                    const data = await deepseekResponse.json();
                    console.log(`[AI-SERVICE] Réponse DeepSeek reçue avec succès`);
                    return data.choices[0]?.message?.content || "Je n'ai pas pu générer une réponse cohérente.";
                } catch (deepseekError) {
                    console.error(`[AI-SERVICE] Erreur avec le client DeepSeek:`, deepseekError);
                    throw new Error(`Erreur du service DeepSeek: ${deepseekError.message}`);
                }
                
            default:
                console.error(`[AI-SERVICE] Erreur: Fournisseur non pris en charge: ${aiProvider.provider_type}`);
                throw new Error(`Fournisseur d'IA ${aiProvider.provider_type} non pris en charge`);
        }
    } catch (error) {
        console.error(`[AI-SERVICE] Erreur lors de la génération de texte:`, error.message);
        console.error(`[AI-SERVICE] Détails du contexte:`, JSON.stringify(debugInfo));
        
        // Génération d'une réponse de fallback en dernier recours
        if (prompt && typeof prompt === 'object' && prompt.patientData) {
            console.log(`[AI-SERVICE] Tentative de génération d'un résumé basique comme fallback`);
            return generateBasicSummary(prompt.patientData);
        }
        
        throw error;
    }
}

/**
 * Génère un résumé basique des données patient en cas d'échec de l'IA
 * @param {Object} patientData - Données du patient
 * @returns {string} - Résumé formaté en HTML
 */
function generateBasicSummary(patientData) {
    try {
        if (!patientData) return "Impossible de générer un résumé: données patient manquantes.";

        const patient = patientData.patient || {};
        const conditions = patientData.conditions || [];
        const observations = patientData.observations || [];
        const medications = patientData.medications || [];
        const encounters = patientData.encounters || [];

        let summary = `<h3>Résumé du patient (généré localement)</h3>`;
        
        // Informations patient
        summary += `<p><strong>Patient:</strong> ${patient.name || 'Non spécifié'}, `;
        summary += `${patient.gender ? (patient.gender === 'male' ? 'Homme' : (patient.gender === 'female' ? 'Femme' : patient.gender)) : 'Genre non spécifié'}, `;
        summary += `${patient.birthDate ? `né(e) le ${patient.birthDate}` : 'date de naissance non spécifiée'}</p>`;
        
        // Problèmes médicaux
        if (conditions && conditions.length > 0) {
            summary += `<p><strong>Problèmes médicaux (${conditions.length}):</strong></p><ul>`;
            conditions.slice(0, 5).forEach(condition => {
                summary += `<li>${condition.code?.text || condition.code?.coding?.[0]?.display || 'Non codé'} `;
                if (condition.onsetDateTime) summary += `(début: ${condition.onsetDateTime.substring(0, 10)})`;
                summary += `</li>`;
            });
            if (conditions.length > 5) summary += `<li>... et ${conditions.length - 5} autres conditions</li>`;
            summary += `</ul>`;
        }
        
        // Observations
        if (observations && observations.length > 0) {
            summary += `<p><strong>Observations récentes (${observations.length}):</strong></p><ul>`;
            observations.slice(0, 5).forEach(obs => {
                const value = obs.valueQuantity ? 
                    `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}` : 
                    (obs.valueString || obs.valueCodeableConcept?.text || 'Non spécifié');
                summary += `<li>${obs.code?.text || obs.code?.coding?.[0]?.display || 'Non codé'}: ${value}</li>`;
            });
            if (observations.length > 5) summary += `<li>... et ${observations.length - 5} autres observations</li>`;
            summary += `</ul>`;
        }
        
        // Médicaments
        if (medications && medications.length > 0) {
            summary += `<p><strong>Médicaments (${medications.length}):</strong></p><ul>`;
            medications.forEach(med => {
                summary += `<li>${med.medicationCodeableConcept?.text || med.medicationCodeableConcept?.coding?.[0]?.display || 'Médicament non codé'}`;
                if (med.dosageInstruction && med.dosageInstruction.length > 0) {
                    const dosage = med.dosageInstruction[0];
                    if (dosage.text) summary += ` (${dosage.text})`;
                }
                summary += `</li>`;
            });
            summary += `</ul>`;
        }
        
        // Visites
        if (encounters && encounters.length > 0) {
            summary += `<p><strong>Dernières visites (${encounters.length}):</strong></p><ul>`;
            encounters.slice(0, 3).forEach(encounter => {
                summary += `<li>${encounter.type?.[0]?.text || encounter.class?.display || 'Visite'} `;
                if (encounter.period?.start) summary += `(${encounter.period.start.substring(0, 10)})`;
                summary += `</li>`;
            });
            if (encounters.length > 3) summary += `<li>... et ${encounters.length - 3} autres visites</li>`;
            summary += `</ul>`;
        }
        
        summary += `<p><em>Note: Ce résumé a été généré localement suite à une indisponibilité du service d'IA.</em></p>`;
        
        return summary;
    } catch (error) {
        console.error('[AI-SERVICE] Erreur lors de la génération du résumé basique:', error);
        return "<p>Le service d'IA n'est pas disponible actuellement et la génération du résumé de secours a échoué. Veuillez réessayer plus tard.</p>";
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