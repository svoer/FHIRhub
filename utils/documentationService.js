/**
 * Service de gestion de la documentation pour FHIRHub
 * Ce module charge et fournit le contenu de la documentation et de la FAQ
 * pour être utilisé par le chatbot IA et d'autres services
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const cheerio = require('cheerio');

// Cache pour éviter de relire les fichiers à chaque requête
let documentationCache = null;
let faqCache = null;
let markdownDocsCache = {};

// Timestamp de dernier chargement
let lastLoadTime = null;

/**
 * Charge le contenu de la documentation HTML
 * @returns {Promise<string>} Le contenu extrait de la documentation
 */
async function loadDocumentation() {
    try {
        if (documentationCache) return documentationCache;
        
        const htmlPath = path.join(__dirname, '../public/documentation.html');
        const html = await readFileAsync(htmlPath, 'utf8');
        
        // Utiliser cheerio pour extraire le contenu pertinent
        const $ = cheerio.load(html);
        
        // Extraire le contenu principal (en excluant header, footer, etc.)
        let content = '';
        
        // Extraire les sections principales de documentation
        $('.documentation-section, .main-content, article, .content-wrapper').each((i, el) => {
            content += $(el).text() + '\n\n';
        });
        
        // Si aucune structure spécifique n'est trouvée, extraire le body en entier
        if (!content.trim()) {
            content = $('body').text();
        }
        
        // Nettoyer le texte (supprimer les espaces excessifs)
        content = content.replace(/\s+/g, ' ').trim();
        
        documentationCache = content;
        lastLoadTime = new Date();
        
        console.log('[DOC] Documentation HTML chargée avec succès, taille:', content.length);
        return content;
    } catch (error) {
        console.error('[DOC] Erreur lors du chargement de la documentation HTML:', error);
        return 'Documentation non disponible';
    }
}

/**
 * Charge le contenu de la FAQ HTML
 * @returns {Promise<string>} Le contenu extrait de la FAQ
 */
async function loadFAQ() {
    try {
        if (faqCache) return faqCache;
        
        const htmlPath = path.join(__dirname, '../public/faq.html');
        const html = await readFileAsync(htmlPath, 'utf8');
        
        // Utiliser cheerio pour extraire le contenu pertinent
        const $ = cheerio.load(html);
        
        // Extraire les questions et réponses
        let content = 'QUESTIONS FRÉQUEMMENT POSÉES (FAQ):\n\n';
        
        // Extraire spécifiquement les questions/réponses
        $('.faq-item, .accordion-item, .question-answer, .faq-section').each((i, el) => {
            const question = $(el).find('.question, .accordion-header, h3, h4').text().trim();
            const answer = $(el).find('.answer, .accordion-body, p').text().trim();
            
            if (question && answer) {
                content += `Q: ${question}\nR: ${answer}\n\n`;
            }
        });
        
        // Si aucune structure spécifique n'est trouvée, extraire le body en entier
        if (content === 'QUESTIONS FRÉQUEMMENT POSÉES (FAQ):\n\n') {
            content += $('body').text().replace(/\s+/g, ' ').trim();
        }
        
        faqCache = content;
        lastLoadTime = new Date();
        
        console.log('[DOC] FAQ HTML chargée avec succès, taille:', content.length);
        return content;
    } catch (error) {
        console.error('[DOC] Erreur lors du chargement de la FAQ HTML:', error);
        return 'FAQ non disponible';
    }
}

/**
 * Charge les fichiers markdown de documentation technique
 * @returns {Promise<string>} Le contenu combiné des fichiers markdown
 */
async function loadMarkdownDocs() {
    try {
        const docsDir = path.join(__dirname, '../docs');
        const files = fs.readdirSync(docsDir).filter(file => file.endsWith('.md'));
        
        let allContent = 'DOCUMENTATION TECHNIQUE:\n\n';
        
        for (const file of files) {
            const filePath = path.join(docsDir, file);
            
            // Utiliser le cache si disponible
            if (markdownDocsCache[filePath]) {
                allContent += markdownDocsCache[filePath] + '\n\n';
                continue;
            }
            
            try {
                const content = await readFileAsync(filePath, 'utf8');
                // Formatage pour rendre le document plus lisible pour l'IA
                const formattedContent = `## ${file.replace('.md', '')}\n${content}`;
                
                // Mettre en cache pour les prochaines utilisations
                markdownDocsCache[filePath] = formattedContent;
                
                allContent += formattedContent + '\n\n';
            } catch (err) {
                console.error(`[DOC] Erreur lors de la lecture du fichier ${file}:`, err);
            }
        }
        
        console.log('[DOC] Documentation Markdown chargée avec succès, fichiers:', files.length);
        return allContent;
    } catch (error) {
        console.error('[DOC] Erreur lors du chargement de la documentation Markdown:', error);
        return 'Documentation technique non disponible';
    }
}

/**
 * Charge tout le contenu de documentation disponible
 * @returns {Promise<string>} Le contenu complet de documentation
 */
async function loadAllDocumentation() {
    // Si le cache est récent (<15 min), l'utiliser
    const cacheAge = lastLoadTime ? (new Date() - lastLoadTime) / 1000 / 60 : null;
    
    if (cacheAge !== null && cacheAge < 15 && 
        documentationCache && faqCache && Object.keys(markdownDocsCache).length > 0) {
        console.log('[DOC] Utilisation du cache de documentation (âge:', cacheAge.toFixed(2), 'minutes)');
        
        return {
            documentation: documentationCache,
            faq: faqCache,
            technical: Object.values(markdownDocsCache).join('\n\n')
        };
    }
    
    // Charger tout le contenu en parallèle
    const [documentation, faq, technical] = await Promise.all([
        loadDocumentation(),
        loadFAQ(),
        loadMarkdownDocs()
    ]);
    
    return { documentation, faq, technical };
}

/**
 * Recherche les informations pertinentes dans la documentation en fonction de la question
 * @param {string} query - La question de l'utilisateur
 * @returns {Promise<string>} Les extraits pertinents de documentation
 */
async function findRelevantDocumentation(query) {
    // Normaliser la requête pour la recherche
    const normalizedQuery = query.toLowerCase().trim();
    
    // Mots-clés à rechercher
    const keywords = normalizedQuery
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3); // Ignorer les mots trop courts
    
    // Charger toute la documentation
    const docs = await loadAllDocumentation();
    
    // Fonction pour trouver les passages pertinents dans un texte
    const findRelevantPassages = (text, source) => {
        if (!text || text.length < 10) return [];
        
        // Découper le texte en paragraphes
        const paragraphs = text.split(/\n{2,}/);
        
        // Attribuer un score à chaque paragraphe basé sur les correspondances de mots-clés
        const scoredParagraphs = paragraphs.map(paragraph => {
            const normalizedParagraph = paragraph.toLowerCase();
            let score = 0;
            
            // Augmenter le score pour chaque mot-clé trouvé
            keywords.forEach(keyword => {
                if (normalizedParagraph.includes(keyword)) {
                    score += 1;
                }
            });
            
            // Bonus si le paragraphe contient plusieurs mots-clés
            if (score > 1) score += 1;
            
            // Bonus si le paragraphe contient des mots exacts de la question
            if (normalizedParagraph.includes(normalizedQuery)) score += 3;
            
            return { paragraph, score, source };
        });
        
        // Filtrer les paragraphes avec un score positif et trier par score
        return scoredParagraphs
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3); // Prendre les 3 meilleurs passages
    };
    
    // Rechercher dans chaque source de documentation
    const relevantFAQ = findRelevantPassages(docs.faq, 'FAQ');
    const relevantDocs = findRelevantPassages(docs.documentation, 'Documentation');
    const relevantTech = findRelevantPassages(docs.technical, 'Documentation Technique');
    
    // Combiner tous les résultats et prendre les meilleurs passages (max 5)
    const allRelevant = [...relevantFAQ, ...relevantDocs, ...relevantTech]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    
    // Formater les résultats
    if (allRelevant.length === 0) {
        return "Aucune information pertinente trouvée dans la documentation. Répondez en vous basant sur vos connaissances générales sur l'application.";
    }
    
    let result = `Informations pertinentes trouvées dans la documentation:\n\n`;
    
    allRelevant.forEach((item, index) => {
        result += `[${item.source}]\n${item.paragraph.trim()}\n\n`;
    });
    
    console.log(`[DOC] ${allRelevant.length} extraits pertinents trouvés pour la requête: "${query.substring(0, 50)}..."`);
    return result;
}

/**
 * Obtient un prompt enrichi avec la documentation pertinente pour le chatbot
 * @param {string} basePrompt - Le prompt système de base
 * @param {string} userQuery - La question de l'utilisateur
 * @returns {Promise<string>} Le prompt enrichi avec la documentation pertinente
 */
async function getEnhancedSystemPrompt(basePrompt, userQuery) {
    if (!userQuery) {
        return basePrompt;
    }
    
    // Récupérer les informations pertinentes
    const relevantInfo = await findRelevantDocumentation(userQuery);
    
    // Créer un prompt enrichi
    const enhancedPrompt = `${basePrompt}

${relevantInfo}

Utilise ces informations pour répondre à la question de l'utilisateur. Ton objectif est de fournir l'information la plus précise en tenant compte du contexte FHIRHub. Si la question n'est pas couverte dans les informations fournies, réponds en utilisant tes connaissances générales sur les systèmes de santé et FHIR.`;

    return enhancedPrompt;
}

/**
 * Force le rechargement du cache de documentation
 */
function invalidateCache() {
    documentationCache = null;
    faqCache = null;
    markdownDocsCache = {};
    lastLoadTime = null;
    console.log('[DOC] Cache de documentation invalidé');
}

// Exporter les fonctions publiques
module.exports = {
    loadDocumentation,
    loadFAQ,
    loadMarkdownDocs,
    loadAllDocumentation,
    getEnhancedSystemPrompt,
    invalidateCache
};