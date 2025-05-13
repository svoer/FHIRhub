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
        // Si le cache est récent (< 10 min), l'utiliser pour plus d'efficacité
        const cacheAge = lastLoadTime ? (new Date() - lastLoadTime) / 1000 / 60 : null;
        
        if (cacheAge !== null && cacheAge < 10 && knowledgeCache) {
            console.log('[KNOWLEDGE] Utilisation du cache de connaissances (âge:', cacheAge.toFixed(2), 'minutes)');
            return knowledgeCache;
        }
        
        // Charger le fichier directement depuis le système de fichiers avec un timeout
        const loadFileWithTimeout = async (filePath, timeoutMs = 2000) => {
            return Promise.race([
                fs.readFile(filePath, 'utf8'),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Timeout (${timeoutMs}ms) lors du chargement du fichier`)), timeoutMs)
                )
            ]);
        };
        
        const filePath = path.resolve('./data/chatbot-knowledge.json');
        const fileContent = await loadFileWithTimeout(filePath);
        const data = JSON.parse(fileContent);
        
        if (data) {
            // Validation basique de la structure
            const hasValidStructure = 
                Array.isArray(data.faq) || 
                Array.isArray(data.features) || 
                Array.isArray(data.commands);
                
            if (!hasValidStructure) {
                console.warn('[KNOWLEDGE] Structure de données invalide dans le fichier de connaissances');
                throw new Error('Structure de données invalide');
            }
            
            knowledgeCache = data;
            lastLoadTime = new Date();
            
            console.log('[KNOWLEDGE] Base de connaissances chargée avec succès depuis le fichier');
            // Journaliser quelques statistiques pour diagnostiquer
            const stats = {
                faq: data.faq?.length || 0,
                features: data.features?.length || 0,
                commands: data.commands?.length || 0,
                total: (data.faq?.length || 0) + (data.features?.length || 0) + (data.commands?.length || 0)
            };
            console.log('[KNOWLEDGE] Statistiques:', stats);
            
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
    
    // Limiter la longueur de la requête pour éviter les problèmes de performance
    const truncatedQuery = query.length > 200 ? query.substring(0, 200) + '...' : query;
    // Normaliser la requête pour la recherche
    const normalizedQuery = truncatedQuery.toLowerCase().trim();
    
    try {
        // S'assurer que le cache est chargé - avec un timeout pour éviter les blocages
        let knowledge;
        try {
            knowledge = await Promise.race([
                loadKnowledgeBase(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout lors du chargement de la base de connaissances')), 3000)
                )
            ]);
        } catch (error) {
            console.error('[KNOWLEDGE] Erreur de timeout lors du chargement:', error.message);
            return [];
        }
        
        // Si nous n'avons pas pu charger la base de connaissances
        if (!knowledge || (!knowledge.faq && !knowledge.features && !knowledge.commands)) {
            console.log('[KNOWLEDGE] Base de connaissances non disponible');
            return [];
        }
        
        console.log(`[KNOWLEDGE] Recherche locale d'informations pour: "${truncatedQuery.substring(0, 50)}..."`);
        
        // Fonction optimisée pour calculer un score de pertinence
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
            // Optimisation: limiter le nombre de mots-clés pour éviter des calculs trop lourds
            const keywords = queryText
                .replace(/[^\w\sàáâãäåçèéêëìíîïðòóôõöùúûüýÿ-]/g, '') // Autorise les accents et tirets
                .split(/\s+/)
                .filter(word => word.length > 3)
                .slice(0, 10); // Limiter à 10 mots-clés maximum
            
            // Obtenir les mots uniques pour éviter de compter plusieurs fois le même mot
            const uniqueKeywords = [...new Set(keywords)];
            
            // Vérifier la présence de mots-clés - version optimisée
            for (const keyword of uniqueKeywords) {
                const keywordLower = keyword.toLowerCase();
                
                if (normalizedText.includes(keywordLower)) {
                    // Poids de base pour la présence d'un mot-clé
                    score += 2;
                    
                    // Bonus pour les mots-clés au début du texte
                    if (normalizedText.startsWith(keywordLower)) {
                        score += 1;
                    }
                    
                    // Version simplifiée pour éviter les regex coûteuses
                    const keywordWithBoundaries = ` ${keywordLower} `;
                    const normalizedTextWithSpaces = ` ${normalizedText} `;
                    const parts = normalizedTextWithSpaces.split(keywordWithBoundaries);
                    const occurrences = parts.length - 1;
                    
                    if (occurrences > 1) {
                        score += Math.min(occurrences - 1, 3); // Maximum +3 pour éviter les abus
                    }
                }
            }
            
            // Ensembles thématiques simplifiés et optimisés
            const themeTerms = {
                fhir: ['fhir', 'ressource', 'patient', 'observation'],
                hl7: ['hl7', 'message', 'conversion', 'segment'],
                ai: ['ia', 'ai', 'mistral', 'ollama', 'deepseek', 'intelligence']
            };
            
            // Check des thèmes optimisé
            for (const [theme, terms] of Object.entries(themeTerms)) {
                const hasSharedTerms = terms.some(term => 
                    normalizedText.includes(term) && normalizedQuery.includes(term));
                
                if (hasSharedTerms) {
                    score += 3;
                    break; // Une seule correspondance thématique suffit
                }
            }
            
            return score;
        }
        
        // Recherche optimisée avec gestion des erreurs pour chaque section
        let relevantFaq = [];
        let relevantFeatures = [];
        let relevantCommands = [];
        
        // Fonction pour traiter chaque section en toute sécurité
        const processSectionSafely = (items, type, fieldName, descriptionField) => {
            if (!items || !Array.isArray(items)) return [];
            
            try {
                return items.map(item => ({
                    type,
                    [fieldName]: item[fieldName],
                    [descriptionField]: item[descriptionField],
                    score: calculateRelevance(item[fieldName], truncatedQuery) * 2 + 
                           calculateRelevance(item[descriptionField], truncatedQuery)
                })).filter(item => item.score > 0);
            } catch (error) {
                console.error(`[KNOWLEDGE] Erreur lors du traitement de la section ${type}:`, error.message);
                return [];
            }
        };
        
        // Traiter chaque section indépendamment
        relevantFaq = processSectionSafely(knowledge.faq, 'faq', 'question', 'answer');
        relevantFeatures = processSectionSafely(knowledge.features, 'feature', 'name', 'description');
        relevantCommands = processSectionSafely(knowledge.commands, 'command', 'name', 'description');
        
        // Fusionner et trier par score
        const allRelevant = [...relevantFaq, ...relevantFeatures, ...relevantCommands]
            .sort((a, b) => b.score - a.score);
        
        // Version optimisée de la diversification des résultats
        let diverseResults = [];
        const typeCounts = { faq: 0, feature: 0, command: 0 };
        const maxPerType = 2;
        
        // Première passe: prendre les meilleurs éléments de chaque type
        for (const item of allRelevant) {
            if (typeCounts[item.type] < maxPerType) {
                diverseResults.push(item);
                typeCounts[item.type]++;
                
                // Arrêter si nous avons atteint la limite totale
                if (diverseResults.length >= 4) break;
            }
        }
        
        // Seconde passe: compléter jusqu'à 4 résultats si nécessaire
        if (diverseResults.length < 4 && allRelevant.length > diverseResults.length) {
            const usedItems = new Set();
            
            // Identifier les éléments déjà utilisés
            for (const item of diverseResults) {
                const itemId = item.type === 'faq' ? item.question : item.name;
                usedItems.add(`${item.type}-${itemId}`);
            }
            
            // Ajouter les meilleurs éléments restants
            for (const item of allRelevant) {
                const itemId = item.type === 'faq' ? item.question : item.name;
                const fullId = `${item.type}-${itemId}`;
                
                if (!usedItems.has(fullId)) {
                    diverseResults.push(item);
                    usedItems.add(fullId);
                    if (diverseResults.length >= 4) break;
                }
            }
        }
        
        console.log(`[KNOWLEDGE] ${diverseResults.length} informations pertinentes et diversifiées trouvées (scores: ${diverseResults.map(r => r.score).join(', ')})`);
        
        // Limiter à 4 résultats maximum
        return diverseResults.slice(0, 4);
    } catch (error) {
        console.error('[KNOWLEDGE] Erreur lors de la recherche de connaissances:', error.message);
        // En cas d'erreur critique, retourner un tableau vide plutôt que de faire échouer l'appel
        return [];
    }
}

/**
 * Formate les résultats de recherche pour les inclure dans un prompt système
 * Version optimisée pour réduire la taille du prompt et améliorer les performances
 * @param {Array} results - Les résultats de recherche
 * @returns {string} Le texte formaté pour le prompt système
 */
function formatKnowledgeForPrompt(results) {
    // Validation des entrées pour éviter les erreurs
    if (!results || !Array.isArray(results) || results.length === 0) {
        return "Aucune information spécifique trouvée dans la base de connaissances FHIRHub.";
    }
    
    // Version optimisée et plus concise du texte d'introduction
    let formattedText = "INFORMATIONS PERTINENTES DE LA BASE DE CONNAISSANCES FHIRHUB:\n\n";
    
    try {
        // Trier par type pour regrouper les éléments similaires - version simplifiée
        const typeOrder = { 'faq': 1, 'feature': 2, 'command': 3 };
        
        // Tri stable pour maintenir l'ordre des éléments de même type et score
        const sortedResults = [...results].sort((a, b) => {
            // D'abord trier par type
            const typeA = a.type || 'unknown';
            const typeB = b.type || 'unknown';
            const typeDiff = (typeOrder[typeA] || 99) - (typeOrder[typeB] || 99);
            if (typeDiff !== 0) return typeDiff;
            
            // Puis par score (du plus élevé au plus bas)
            return (b.score || 0) - (a.score || 0);
        });
        
        // Ajouter des séparateurs clairs entre les sections - version optimisée
        let currentType = null;
        
        // Mapper les titres de section pour éviter les switch répétitifs
        const sectionTitles = {
            'faq': 'QUESTIONS FRÉQUENTES',
            'feature': 'FONCTIONNALITÉS',
            'command': 'COMMANDES'
        };
        
        // Limiter à 4 résultats maximum pour réduire la taille du prompt
        const limitedResults = sortedResults.slice(0, 4);
        
        limitedResults.forEach((item, index) => {
            // Vérification de sécurité pour éviter les erreurs avec des éléments invalides
            if (!item || typeof item !== 'object') return;
            
            // Ajouter un séparateur de section si nous changeons de type
            if (currentType !== item.type) {
                currentType = item.type;
                if (index > 0) formattedText += "---\n\n";
                
                // Ajouter un titre de section
                const sectionTitle = sectionTitles[item.type] || 'AUTRES INFORMATIONS';
                formattedText += `SECTION ${sectionTitle}:\n\n`;
            }
            
            // Formater chaque élément avec des références - version simplifiée et optimisée
            const infoNum = index + 1;
            
            // Valider que les champs nécessaires existent
            if (item.type === 'faq' && item.question && item.answer) {
                formattedText += `[INFO-${infoNum}] Q: "${item.question}"\nR: "${item.answer}"\n\n`;
            } else if (item.type === 'feature' && item.name && item.description) {
                formattedText += `[INFO-${infoNum}] Fonctionnalité: "${item.name}"\nDescription: "${item.description}"\n\n`;
            } else if (item.type === 'command' && item.name && item.description) {
                formattedText += `[INFO-${infoNum}] Commande: "${item.name}"\nDescription: "${item.description}"\n\n`;
            }
        });
        
        // Ajouter un pied de page concis avec instructions
        formattedText += "---\n\n";
        formattedText += "INSTRUCTIONS: Ces informations proviennent de la documentation officielle FHIRHub. Utilise-les comme source principale et référence-les avec [INFO-X] ou 'selon la documentation FHIRHub'.";
        
        return formattedText;
    } catch (error) {
        console.error('[KNOWLEDGE] Erreur lors du formatage des connaissances:', error.message);
        // En cas d'erreur, retourner un texte minimal mais fonctionnel
        return "Informations issues de la base de connaissances FHIRHub:\n\n" + 
               results.map((r, i) => `[INFO-${i+1}] ${r.question || r.name || 'Information'}`).join('\n');
    }
}

/**
 * Obtient un prompt système enrichi avec des connaissances pertinentes
 * Version optimisée pour réduire la taille du prompt final et accélérer le traitement
 * @param {string} basePrompt - Le prompt système de base
 * @param {string} userQuery - La question de l'utilisateur
 * @returns {Promise<string>} Le prompt système enrichi
 */
async function getEnhancedPrompt(basePrompt, userQuery) {
    // Timeout pour l'enrichissement du prompt (7 secondes maximum)
    const ENRICHMENT_TIMEOUT_MS = 7000;
    
    try {
        // Validation de base
        if (!userQuery || typeof userQuery !== 'string' || userQuery.trim() === '') {
            console.log('[KNOWLEDGE] Aucune requête utilisateur valide pour enrichir le prompt');
            return basePrompt;
        }
        
        // Tronquer la requête si elle est trop longue
        const truncatedQuery = userQuery.length > 300 
            ? userQuery.substring(0, 300) + '...' 
            : userQuery;
            
        console.log(`[KNOWLEDGE] Recherche de connaissances pour enrichir le prompt: "${truncatedQuery.substring(0, 40)}..."`);
        
        // Récupérer les connaissances pertinentes avec un timeout de sécurité
        let relevantInfo = [];
        try {
            relevantInfo = await Promise.race([
                findRelevantKnowledge(truncatedQuery),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Timeout (${ENRICHMENT_TIMEOUT_MS}ms) lors de la recherche de connaissances`)), 
                    ENRICHMENT_TIMEOUT_MS)
                )
            ]);
        } catch (error) {
            console.warn('[KNOWLEDGE] Timeout lors de la recherche de connaissances:', error.message);
            // Continuer sans connaissances enrichies
        }
        
        // Validation des résultats
        if (!Array.isArray(relevantInfo)) {
            console.warn('[KNOWLEDGE] Résultats invalides, utilisation du prompt de base');
            return basePrompt;
        }
        
        // Générer le texte formaté à partir des connaissances trouvées
        const hasRelevantInfo = relevantInfo && relevantInfo.length > 0;
        const knowledgeText = hasRelevantInfo 
            ? formatKnowledgeForPrompt(relevantInfo) 
            : "Aucune information pertinente n'a été trouvée dans la base de connaissances.";
        
        // Construire un prompt enrichi structuré mais concis
        const trimmedBasePrompt = basePrompt.trim();
        
        // Version optimisée avec séparateurs plus courts
        const enhancedPrompt = `${trimmedBasePrompt}

===== BASE DE CONNAISSANCES =====
${knowledgeText}
===== FIN BASE DE CONNAISSANCES =====

DIRECTIVES:
${hasRelevantInfo 
    ? `• Utilise prioritairement les ${relevantInfo.length} informations ci-dessus pour répondre.
• Cite les informations avec [INFO-X].` 
    : `• Aucune information spécifique n'a été trouvée dans la base de connaissances.
• Sois prudent et indique les limites de tes connaissances.`}
• N'invente pas de fonctionnalités ou détails techniques non mentionnés.
• Réponds dans la même langue que la question (français ou anglais).
• Structure ta réponse avec des titres et puces pour faciliter la lecture.`;
        
        // Journaliser des informations sur le prompt enrichi
        const promptLength = enhancedPrompt.length;
        console.log(`[KNOWLEDGE] Prompt enrichi: ${hasRelevantInfo ? relevantInfo.length + ' informations' : 'aucune info pertinente'} - ${promptLength} caractères`);
        
        return enhancedPrompt;
    } catch (error) {
        console.error('[KNOWLEDGE] Erreur lors de l\'enrichissement du prompt:', error);
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