/**
 * Service de gestion de la base de connaissances pour le chatbot
 * Ce module charge et recherche des informations dans la base de connaissances JSON
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);

// Cache pour éviter de relire les fichiers à chaque requête
let knowledgeCache = null;
let lastLoadTime = null;

/**
 * Charge la base de connaissances depuis le fichier JSON
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
        
        const knowledgePath = path.join(__dirname, '../data/chatbot-knowledge.json');
        const data = await readFileAsync(knowledgePath, 'utf8');
        
        knowledgeCache = JSON.parse(data);
        lastLoadTime = new Date();
        
        console.log('[KNOWLEDGE] Base de connaissances chargée avec succès');
        return knowledgeCache;
    } catch (error) {
        console.error('[KNOWLEDGE] Erreur lors du chargement de la base de connaissances:', error);
        return { faq: [], features: [], commands: [] };
    }
}

/**
 * Recherche des informations pertinentes dans la base de connaissances
 * @param {string} query - La question de l'utilisateur
 * @returns {Promise<Object>} Les informations pertinentes trouvées
 */
async function findRelevantKnowledge(query) {
    // Normaliser la requête pour la recherche
    const normalizedQuery = query.toLowerCase().trim();
    
    // Charger la base de connaissances
    const knowledge = await loadKnowledgeBase();
    
    // Fonction pour calculer un score de pertinence simple
    function calculateRelevance(text, keywords) {
        if (!text) return 0;
        
        const normalizedText = text.toLowerCase();
        let score = 0;
        
        // Vérifier la présence de la requête complète
        if (normalizedText.includes(normalizedQuery)) {
            score += 3;
        }
        
        // Vérifier la présence de mots-clés
        keywords.forEach(keyword => {
            if (normalizedText.includes(keyword)) {
                score += 1;
            }
        });
        
        return score;
    }
    
    // Extraire les mots-clés (mots de plus de 3 caractères)
    const keywords = normalizedQuery
        .replace(/[^\w\sàáâãäåçèéêëìíîïðòóôõöùúûüýÿ-]/g, '') // Autorise les accents et tirets
        .split(/\s+/)
        .filter(word => word.length > 3);
    
    // Si pas assez de mots-clés, prendre tous les mots
    const effectiveKeywords = keywords.length < 2 
        ? normalizedQuery.split(/\s+/).filter(word => word.length > 2) 
        : keywords;
    
    console.log('[KNOWLEDGE] Recherche avec mots-clés:', effectiveKeywords.join(', '));
    
    // Rechercher dans la FAQ
    const relevantFaq = knowledge.faq
        .map(item => ({
            type: 'faq',
            question: item.question,
            answer: item.answer,
            score: calculateRelevance(item.question, effectiveKeywords) * 2 + 
                   calculateRelevance(item.answer, effectiveKeywords)
        }))
        .filter(item => item.score > 0);
    
    // Rechercher dans les fonctionnalités
    const relevantFeatures = knowledge.features
        .map(item => ({
            type: 'feature',
            name: item.name,
            description: item.description,
            score: calculateRelevance(item.name, effectiveKeywords) * 2 + 
                   calculateRelevance(item.description, effectiveKeywords)
        }))
        .filter(item => item.score > 0);
    
    // Rechercher dans les commandes
    const relevantCommands = knowledge.commands
        .map(item => ({
            type: 'command',
            name: item.name,
            description: item.description,
            score: calculateRelevance(item.name, effectiveKeywords) * 2 + 
                   calculateRelevance(item.description, effectiveKeywords)
        }))
        .filter(item => item.score > 0);
    
    // Fusionner et trier par score
    const allRelevant = [...relevantFaq, ...relevantFeatures, ...relevantCommands]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);  // Prendre les 3 résultats les plus pertinents
    
    console.log(`[KNOWLEDGE] ${allRelevant.length} informations pertinentes trouvées pour la requête: "${query.substring(0, 50)}..."`);
    
    return allRelevant;
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
    
    const enhancedPrompt = `${basePrompt}

${knowledgeText}

Utilise ces informations pour répondre à la question de l'utilisateur. Si la question n'est pas couverte par ces informations, utilise tes connaissances générales sur les systèmes de santé et FHIR pour fournir une réponse utile.`;
    
    return enhancedPrompt;
}

// Exposer les fonctions
module.exports = {
    loadKnowledgeBase,
    findRelevantKnowledge,
    formatKnowledgeForPrompt,
    getEnhancedPrompt
};