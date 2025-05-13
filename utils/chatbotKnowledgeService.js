/**
 * Service de gestion de la base de connaissances pour le chatbot
 * Ce module utilise les API /api/ai-knowledge/* pour accéder aux informations de la base de connaissances
 */

const axios = require('axios');

// Cache pour éviter de faire trop d'appels API
let knowledgeCache = null;
let lastLoadTime = null;

// Fonction utilitaire pour construire les URLs d'API (gère les appels internes et externes)
// Désactivée pour éviter les boucles infinies - nous utilisons maintenant les données du cache local directement
function getApiUrl(endpoint) {
    return endpoint; // Juste pour référence, cette fonction n'est plus utilisée
}

const fs = require('fs').promises;
const path = require('path');

/**
 * Charge la base de connaissances directement depuis le fichier JSON
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
        
        // Charger le fichier directement depuis le système de fichiers
        const filePath = path.resolve('./data/chatbot-knowledge.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        if (data) {
            knowledgeCache = data;
            lastLoadTime = new Date();
            
            console.log('[KNOWLEDGE] Base de connaissances chargée avec succès depuis le fichier');
            return knowledgeCache;
        } else {
            throw new Error('Fichier de connaissances vide ou invalide');
        }
    } catch (error) {
        console.error('[KNOWLEDGE] Erreur lors du chargement de la base de connaissances:', error.message);
        
        // En cas d'erreur, retourner une structure vide mais valide
        return { 
            faq: [], 
            features: [], 
            commands: [] 
        };
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
        
        // Fonction améliorée pour calculer un score de pertinence
        function calculateRelevance(text, queryText) {
            if (!text) return 0;
            
            const normalizedText = text.toLowerCase();
            let score = 0;
            
            // Vérifier la présence de la requête complète (plus fort coefficient)
            if (normalizedText.includes(normalizedQuery)) {
                score += 5;
                
                // Bonus si la requête est au début du texte
                if (normalizedText.startsWith(normalizedQuery)) {
                    score += 3;
                }
            }
            
            // Extraire les mots-clés (mots de plus de 3 caractères)
            const keywords = queryText
                .replace(/[^\w\sàáâãäåçèéêëìíîïðòóôõöùúûüýÿ-]/g, '') // Autorise les accents et tirets
                .split(/\s+/)
                .filter(word => word.length > 3);
            
            // Obtenir les mots uniques pour éviter de compter plusieurs fois le même mot
            const uniqueKeywords = [...new Set(keywords)];
            
            // Vérifier la présence de mots-clés
            uniqueKeywords.forEach(keyword => {
                const keywordLower = keyword.toLowerCase();
                
                if (normalizedText.includes(keywordLower)) {
                    // Poids de base pour la présence d'un mot-clé
                    score += 2;
                    
                    // Bonus pour les mots-clés au début du texte
                    if (normalizedText.startsWith(keywordLower)) {
                        score += 1;
                    }
                    
                    // Bonus pour les mots-clés qui apparaissent plusieurs fois
                    const occurrences = (normalizedText.match(new RegExp(`\\b${keywordLower}\\b`, 'g')) || []).length;
                    if (occurrences > 1) {
                        score += Math.min(occurrences - 1, 3); // Maximum +3 pour éviter les abus
                    }
                }
            });
            
            // Détection d'expressions thématiques dans la requête
            const fhirTerms = ['fhir', 'ressource', 'patient', 'observation'];
            const hl7Terms = ['hl7', 'message', 'conversion', 'segment'];
            const aiTerms = ['ia', 'ai', 'mistral', 'ollama', 'deepseek', 'intelligence'];
            
            // Vérifier si le texte et la requête partagent des termes thématiques
            const hasFhirTheme = fhirTerms.some(term => normalizedText.includes(term) && normalizedQuery.includes(term));
            const hasHl7Theme = hl7Terms.some(term => normalizedText.includes(term) && normalizedQuery.includes(term));
            const hasAiTheme = aiTerms.some(term => normalizedText.includes(term) && normalizedQuery.includes(term));
            
            // Bonus pour les correspondances thématiques
            if (hasFhirTheme || hasHl7Theme || hasAiTheme) {
                score += 3;
            }
            
            return score;
        }
        
        // Rechercher dans la FAQ
        const relevantFaq = knowledge.faq
            ? knowledge.faq.map(item => ({
                type: 'faq',
                question: item.question,
                answer: item.answer,
                score: calculateRelevance(item.question, query) * 2.5 + // Augmentation de la pondération des questions
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
            .sort((a, b) => b.score - a.score);
        
        // Diversifier les résultats en prenant au maximum 2 éléments de chaque type
        // pour éviter d'avoir que des FAQs ou que des fonctionnalités
        let diverseResults = [];
        const typeCounts = { faq: 0, feature: 0, command: 0 };
        const maxPerType = 2;
        
        for (const item of allRelevant) {
            if (typeCounts[item.type] < maxPerType) {
                diverseResults.push(item);
                typeCounts[item.type]++;
                
                // Arrêter si nous avons atteint la limite totale
                if (diverseResults.length >= 4) break;
            }
        }
        
        // Si nous n'avons pas suffisamment de résultats avec la diversification,
        // compléter avec les meilleurs scores restants
        if (diverseResults.length < 3 && allRelevant.length > diverseResults.length) {
            const usedItems = new Set(diverseResults.map(item => 
                item.type === 'faq' ? item.question : item.name));
            
            for (const item of allRelevant) {
                const itemId = item.type === 'faq' ? item.question : item.name;
                if (!usedItems.has(itemId)) {
                    diverseResults.push(item);
                    usedItems.add(itemId);
                    if (diverseResults.length >= 4) break;
                }
            }
        }
        
        console.log(`[KNOWLEDGE] ${diverseResults.length} informations pertinentes et diversifiées trouvées dans le cache local`);
        
        // Limiter à 4 résultats maximum (au lieu de 3)
        return diverseResults.slice(0, 4);
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
    
    let formattedText = "Voici des informations pertinentes issues de la base de connaissances FHIRHub que tu dois utiliser pour répondre à la question de l'utilisateur:\n\n";
    
    // Trier par type pour regrouper les éléments similaires
    const typeOrder = { 'faq': 1, 'feature': 2, 'command': 3 };
    const sortedResults = [...results].sort((a, b) => {
        // D'abord trier par type
        const typeDiff = typeOrder[a.type] - typeOrder[b.type];
        if (typeDiff !== 0) return typeDiff;
        
        // Puis par score (du plus élevé au plus bas)
        return b.score - a.score;
    });
    
    // Ajouter des séparateurs clairs entre les sections
    let currentType = null;
    
    sortedResults.forEach((item, index) => {
        // Ajouter un séparateur de section si nous changeons de type
        if (currentType !== item.type) {
            currentType = item.type;
            if (index > 0) formattedText += "----\n\n";
            
            // Ajouter un titre de section
            switch (item.type) {
                case 'faq':
                    formattedText += "SECTION QUESTIONS FRÉQUENTES:\n\n";
                    break;
                case 'feature':
                    formattedText += "SECTION FONCTIONNALITÉS:\n\n";
                    break;
                case 'command':
                    formattedText += "SECTION COMMANDES:\n\n";
                    break;
            }
        }
        
        // Formater chaque élément avec des références pour faciliter la citation
        if (item.type === 'faq') {
            formattedText += `[INFO-${index+1}] Question: "${item.question}"\nRéponse: "${item.answer}"\n\n`;
        } else if (item.type === 'feature') {
            formattedText += `[INFO-${index+1}] Fonctionnalité: "${item.name}"\nDescription: "${item.description}"\n\n`;
        } else if (item.type === 'command') {
            formattedText += `[INFO-${index+1}] Commande: "${item.name}"\nDescription: "${item.description}"\n\n`;
        }
    });
    
    // Ajouter un pied de page avec des instructions supplémentaires
    formattedText += "----\n\n";
    formattedText += "Les informations ci-dessus sont issues de la documentation officielle de FHIRHub. ";
    formattedText += "Tu dois les utiliser comme source principale pour répondre aux questions. ";
    formattedText += "Quand tu te réfères à ces informations dans ta réponse, tu peux mentionner 'selon la documentation de FHIRHub' ";
    formattedText += "ou utiliser les références [INFO-X] pour indiquer la source spécifique.";
    
    return formattedText;
}

/**
 * Obtient un prompt système enrichi avec des connaissances pertinentes
 * @param {string} basePrompt - Le prompt système de base
 * @param {string} userQuery - La question de l'utilisateur
 * @returns {Promise<string>} Le prompt système enrichi
 */
async function getEnhancedPrompt(basePrompt, userQuery) {
    try {
        if (!userQuery || userQuery.trim() === '') {
            console.log('[KNOWLEDGE] Aucune requête utilisateur fournie pour enrichir le prompt');
            return basePrompt;
        }
        
        console.log(`[KNOWLEDGE] Recherche de connaissances pour enrichir le prompt sur: "${userQuery.substring(0, 50)}..."`);
        
        // Récupérer les connaissances pertinentes avec notre algorithme amélioré
        const relevantInfo = await findRelevantKnowledge(userQuery);
        
        // Générer le texte formaté à partir des connaissances trouvées
        const knowledgeText = formatKnowledgeForPrompt(relevantInfo);
        const hasRelevantInfo = relevantInfo && relevantInfo.length > 0;
        
        // Construire un prompt enrichi structuré
        let enhancedPrompt = basePrompt.trim();
        
        // Ajouter un séparateur entre le prompt de base et nos informations
        enhancedPrompt += "\n\n==== BASE DE CONNAISSANCES FHIRHUB ====\n\n";
        enhancedPrompt += knowledgeText;
        enhancedPrompt += "\n==== FIN DE LA BASE DE CONNAISSANCES ====\n\n";
        
        // Ajouter des instructions détaillées pour le LLM sur l'utilisation des connaissances
        enhancedPrompt += "INSTRUCTIONS POUR RÉPONDRE:\n";
        
        if (hasRelevantInfo) {
            enhancedPrompt += `1. Des informations pertinentes (${relevantInfo.length} entrées) ont été trouvées dans la base de connaissances. Utilise-les PRIORITAIREMENT pour répondre.\n`;
            enhancedPrompt += "2. Cite ces informations en utilisant les références [INFO-X] présentes dans le texte.\n";
        } else {
            enhancedPrompt += "1. AUCUNE information spécifique n'a été trouvée dans la base de connaissances pour cette question.\n";
            enhancedPrompt += "2. Sois très prudent dans ta réponse et indique clairement les limites de tes connaissances.\n";
        }
        
        // Instructions communes quelle que soit la présence d'informations
        enhancedPrompt += "3. Si la question n'est pas entièrement couverte par la base de connaissances, commence par répondre avec ce que tu sais puis précise: 'Pour cette partie, je n'ai pas d'information spécifique dans ma base de connaissances'.\n";
        enhancedPrompt += "4. NE JAMAIS inventer des fonctionnalités, processus ou détails techniques qui ne sont pas explicitement mentionnés.\n";
        enhancedPrompt += "5. Réponds dans la même langue que la question de l'utilisateur (français ou anglais).\n";
        enhancedPrompt += "6. Présente les informations de manière structurée, avec des titres et des puces si nécessaire pour faciliter la lecture.\n";
        
        // Journaliser des informations sur le prompt enrichi
        const promptLength = enhancedPrompt.length;
        console.log(`[KNOWLEDGE] Prompt enrichi: ${hasRelevantInfo ? relevantInfo.length + ' informations trouvées' : 'aucune information pertinente'}`);
        console.log(`[KNOWLEDGE] Taille totale du prompt: ${promptLength} caractères`);
        
        return enhancedPrompt;
    } catch (error) {
        console.error('[KNOWLEDGE] Erreur lors de l\'enrichissement du prompt:', error);
        console.error('[KNOWLEDGE-DEBUG] Détail de l\'erreur:', error.stack);
        // En cas d'erreur, retourner le prompt de base
        return basePrompt;
    }
}

// Exposer les fonctions
module.exports = {
    loadKnowledgeBase,
    findRelevantKnowledge,
    formatKnowledgeForPrompt,
    getEnhancedPrompt
};