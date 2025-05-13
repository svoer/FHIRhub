/**
 * Service de gestion de la base de connaissances pour le chatbot
 * Ce module utilise les API /api/ai-knowledge/* pour accéder aux informations de la base de connaissances
 */

const axios = require('axios');

// Cache pour éviter de faire trop d'appels API
let knowledgeCache = null;
let lastLoadTime = null;

// Fonction utilitaire pour construire les URLs d'API (gère les appels internes et externes)
function getApiUrl(endpoint) {
    // En production, les appels sont faits à l'interne directement
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction ? 'http://localhost:5000' : 'http://localhost:5000';
    return `${baseUrl}${endpoint}`;
}

/**
 * Charge la base de connaissances depuis l'API
 * @returns {Promise<Object>} La base de connaissances
 */
async function loadKnowledgeBase() {
    try {
        // Si le cache est récent (< 5 min), l'utiliser
        const cacheAge = lastLoadTime ? (new Date() - lastLoadTime) / 1000 / 60 : null;
        
        if (cacheAge !== null && cacheAge < 5 && knowledgeCache) {
            console.log('[KNOWLEDGE] Utilisation du cache de connaissances (âge:', cacheAge.toFixed(2), 'minutes)');
            return knowledgeCache;
        }
        
        // Utiliser l'API pour récupérer la base de connaissances complète
        const response = await axios.get(getApiUrl('/api/ai-knowledge/full'));
        
        if (response.data) {
            knowledgeCache = response.data;
            lastLoadTime = new Date();
            
            console.log('[KNOWLEDGE] Base de connaissances chargée avec succès via API');
            return knowledgeCache;
        } else {
            throw new Error('Réponse API vide ou invalide');
        }
    } catch (error) {
        console.error('[KNOWLEDGE] Erreur lors du chargement de la base de connaissances via API:', error.message);
        return { faq: [], features: [], commands: [] };
    }
}

/**
 * Recherche des informations pertinentes dans la base de connaissances 
 * @param {string} query - La question de l'utilisateur
 * @returns {Promise<Object>} Les informations pertinentes trouvées
 */
async function findRelevantKnowledge(query) {
    if (!query || query.trim() === '') {
        console.log('[KNOWLEDGE] Requête vide, impossible de rechercher des informations');
        return [];
    }
    
    // Normaliser la requête pour la recherche
    const normalizedQuery = query.toLowerCase().trim();
    
    try {
        // S'assurer que le cache est chargé
        const knowledge = await loadKnowledgeBase();
        
        // Si nous n'avons pas pu charger la base de connaissances
        if (!knowledge || (!knowledge.faq && !knowledge.features && !knowledge.commands)) {
            console.log('[KNOWLEDGE] Base de connaissances non disponible');
            return [];
        }
        
        console.log(`[KNOWLEDGE] Recherche locale d'informations pour: "${query.substring(0, 50)}..."`);
        
        // Fonction pour calculer un score de pertinence simple
        function calculateRelevance(text, queryText) {
            if (!text) return 0;
            
            const normalizedText = text.toLowerCase();
            let score = 0;
            
            // Vérifier la présence de la requête complète
            if (normalizedText.includes(normalizedQuery)) {
                score += 3;
            }
            
            // Extraire les mots-clés (mots de plus de 3 caractères)
            const keywords = queryText
                .replace(/[^\w\sàáâãäåçèéêëìíîïðòóôõöùúûüýÿ-]/g, '') // Autorise les accents et tirets
                .split(/\s+/)
                .filter(word => word.length > 3);
            
            // Vérifier la présence de mots-clés
            keywords.forEach(keyword => {
                if (normalizedText.includes(keyword.toLowerCase())) {
                    score += 1;
                }
            });
            
            return score;
        }
        
        // Rechercher dans la FAQ
        const relevantFaq = knowledge.faq
            ? knowledge.faq.map(item => ({
                type: 'faq',
                question: item.question,
                answer: item.answer,
                score: calculateRelevance(item.question, query) * 2 + 
                       calculateRelevance(item.answer, query)
              })).filter(item => item.score > 0)
            : [];
        
        // Rechercher dans les fonctionnalités
        const relevantFeatures = knowledge.features
            ? knowledge.features.map(item => ({
                type: 'feature',
                name: item.name,
                description: item.description,
                score: calculateRelevance(item.name, query) * 2 + 
                       calculateRelevance(item.description, query)
              })).filter(item => item.score > 0)
            : [];
            
        // Rechercher dans les commandes
        const relevantCommands = knowledge.commands
            ? knowledge.commands.map(item => ({
                type: 'command',
                name: item.name,
                description: item.description,
                score: calculateRelevance(item.name, query) * 2 + 
                       calculateRelevance(item.description, query)
              })).filter(item => item.score > 0)
            : [];
        
        // Fusionner et trier par score
        const allRelevant = [...relevantFaq, ...relevantFeatures, ...relevantCommands]
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);  // Prendre les 3 résultats les plus pertinents
        
        console.log(`[KNOWLEDGE] ${allRelevant.length} informations pertinentes trouvées dans le cache local`);
        
        return allRelevant;
    } catch (error) {
        console.error('[KNOWLEDGE] Erreur lors de la recherche locale:', error.message);
        return [];
    }
}

/**
 * Formate les résultats de recherche pour les inclure dans un prompt système
 * @param {Array} results - Les résultats de recherche
 * @returns {string} Le texte formaté pour le prompt système
 */
function formatKnowledgeForPrompt(results) {
    if (!results || results.length === 0) {
        return "Aucune information spécifique trouvée dans la base de connaissances FHIRHub.";
    }
    
    let formattedText = "Voici des informations pertinentes trouvées dans la base de connaissances FHIRHub:\n\n";
    
    results.forEach((item, index) => {
        if (item.type === 'faq') {
            formattedText += `[FAQ] Question: ${item.question}\nRéponse: ${item.answer}\n\n`;
        } else if (item.type === 'feature') {
            formattedText += `[FONCTIONNALITÉ] ${item.name}\n${item.description}\n\n`;
        } else if (item.type === 'command') {
            formattedText += `[COMMANDE] ${item.name}\n${item.description}\n\n`;
        }
    });
    
    return formattedText;
}

/**
 * Obtient un prompt système enrichi avec des connaissances pertinentes
 * @param {string} basePrompt - Le prompt système de base
 * @param {string} userQuery - La question de l'utilisateur
 * @returns {Promise<string>} Le prompt système enrichi
 */
async function getEnhancedPrompt(basePrompt, userQuery) {
    if (!userQuery) {
        return basePrompt;
    }
    
    const relevantKnowledge = await findRelevantKnowledge(userQuery);
    const knowledgeText = formatKnowledgeForPrompt(relevantKnowledge);
    const hasRelevantInfo = relevantKnowledge && relevantKnowledge.length > 0;
    
    const enhancedPrompt = `${basePrompt}

${knowledgeText}

INSTRUCTIONS IMPORTANTES:
1. Réponds UNIQUEMENT en te basant sur les informations fournies ci-dessus.
2. Si la question n'est pas couverte par ces informations, dis clairement "Je n'ai pas suffisamment d'informations dans ma base de connaissances pour répondre à cette question avec précision. Voici ce que je peux dire:" puis fournis une réponse générale sur le sujet.
3. NE JAMAIS inventer des fonctionnalités, des processus ou des détails techniques qui ne sont pas explicitement mentionnés dans les informations fournies.
4. Si tu n'es pas sûr, indique les limites de ta connaissance.
5. Informe l'utilisateur que sa question sera transmise à l'équipe pour enrichir la base de connaissances si nécessaire.

${hasRelevantInfo ? 'Des informations pertinentes ont été trouvées dans la base de connaissances. Utilise-les pour répondre.' : 'Aucune information spécifique n\'a été trouvée dans la base de connaissances pour cette question. Sois très prudent dans ta réponse et indique clairement les limites de tes connaissances.'}`;
    
    return enhancedPrompt;
}

// Exposer les fonctions
module.exports = {
    loadKnowledgeBase,
    findRelevantKnowledge,
    formatKnowledgeForPrompt,
    getEnhancedPrompt
};