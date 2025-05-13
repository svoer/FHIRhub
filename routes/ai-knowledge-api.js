/**
 * Routes pour l'API de connaissances dédiée à l'IA
 * Permet à l'IA d'accéder directement à la base de connaissances du chatbot
 * @module routes/ai-knowledge-api
 */

const express = require('express');
const router = express.Router();
const chatbotKnowledgeService = require('../utils/chatbotKnowledgeService');
const path = require('path');
const fs = require('fs');

/**
 * @swagger
 * /api/ai-knowledge/search:
 *   post:
 *     summary: Recherche des informations dans la base de connaissances (POST)
 *     description: Permet à l'IA de rechercher des informations pertinentes dans la base de connaissances
 *     tags:
 *       - IA Knowledge
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: La requête de recherche
 *     responses:
 *       200:
 *         description: Résultats de recherche
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 *   get:
 *     summary: Recherche des informations dans la base de connaissances (GET)
 *     description: Permet à l'IA de rechercher des informations pertinentes dans la base de connaissances
 *     tags:
 *       - IA Knowledge
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: true
 *         description: La requête de recherche
 *     responses:
 *       200:
 *         description: Résultats de recherche
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 */

// POST endpoint pour la recherche (compatible avec JSON body)
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'La requête de recherche est requise'
            });
        }
        
        // Utiliser le service existant pour rechercher des connaissances pertinentes
        const relevantKnowledge = await chatbotKnowledgeService.findRelevantKnowledge(query);
        
        return res.status(200).json({
            success: true,
            results: relevantKnowledge
        });
    } catch (error) {
        console.error('Erreur lors de la recherche dans la base de connaissances (POST):', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche dans la base de connaissances',
            error: error.message
        });
    }
});

// GET endpoint pour la recherche (compatible avec paramètres d'URL)
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre "query" est requis'
            });
        }
        
        console.log(`[AI-KNOWLEDGE] Recherche GET avec query: "${query.substring(0, 50)}..."`);
        
        // Utiliser le service existant pour rechercher des connaissances pertinentes
        const relevantKnowledge = await chatbotKnowledgeService.findRelevantKnowledge(query);
        
        return res.status(200).json({
            success: true,
            results: relevantKnowledge
        });
    } catch (error) {
        console.error('Erreur lors de la recherche dans la base de connaissances (GET):', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche dans la base de connaissances',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/ai-knowledge/full:
 *   get:
 *     summary: Obtient la base de connaissances complète
 *     description: Permet à l'IA d'accéder à la base de connaissances complète
 *     tags:
 *       - IA Knowledge
 *     responses:
 *       200:
 *         description: Base de connaissances complète
 *       500:
 *         description: Erreur serveur
 */
router.get('/full', async (req, res) => {
    try {
        // Charger la base de connaissances complète
        const knowledgeBase = await chatbotKnowledgeService.loadKnowledgeBase();
        
        return res.status(200).json({
            success: true,
            knowledgeBase
        });
    } catch (error) {
        console.error('Erreur lors du chargement de la base de connaissances:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement de la base de connaissances',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/ai-knowledge/file:
 *   get:
 *     summary: Obtient le fichier de base de connaissances brut
 *     description: Permet à l'IA d'accéder directement au fichier de connaissances
 *     tags:
 *       - IA Knowledge
 *     responses:
 *       200:
 *         description: Fichier de connaissances brut
 *       500:
 *         description: Erreur serveur
 */
router.get('/file', async (req, res) => {
    try {
        const knowledgePath = path.join(__dirname, '../data/chatbot-knowledge.json');
        
        if (!fs.existsSync(knowledgePath)) {
            return res.status(404).json({
                success: false,
                message: 'Fichier de connaissances non trouvé'
            });
        }
        
        // Renvoyer le fichier JSON brut
        return res.sendFile(knowledgePath);
    } catch (error) {
        console.error('Erreur lors de l\'accès au fichier de connaissances:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'accès au fichier de connaissances',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/ai-knowledge/update:
 *   post:
 *     summary: Met à jour la base de connaissances
 *     description: Permet d'ajouter ou de mettre à jour des connaissances (nécessite une authentification)
 *     tags:
 *       - IA Knowledge
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 description: Type de connaissance (faq, feature, command)
 *               content:
 *                 type: object
 *                 description: Contenu de la connaissance
 *     responses:
 *       200:
 *         description: Base de connaissances mise à jour
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/update', async (req, res) => {
    try {
        // Cette fonction nécessiterait une implémentation plus complète pour la mise à jour sécurisée du fichier
        // Pour l'instant, nous renvoyons simplement un message indiquant que cette fonctionnalité n'est pas implémentée
        
        return res.status(501).json({
            success: false,
            message: 'La mise à jour de la base de connaissances via API n\'est pas encore implémentée'
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la base de connaissances:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de la base de connaissances',
            error: error.message
        });
    }
});

/**
 * Route de test pour vérifier le formatage des connaissances pour le prompt
 */
router.get('/test-format', async (req, res) => {
    try {
        const query = req.query.query || 'visualiseur patient';
        console.log(`[AI-KNOWLEDGE-TEST] Test de formatage pour la query: "${query}"`);
        
        // Rechercher les connaissances pertinentes
        console.log('[AI-KNOWLEDGE-TEST] Appel à findRelevantKnowledge');
        const relevantInfo = await chatbotKnowledgeService.findRelevantKnowledge(query);
        console.log(`[AI-KNOWLEDGE-TEST] ${relevantInfo.length} informations trouvées`);
        
        // Formater pour le prompt
        console.log('[AI-KNOWLEDGE-TEST] Appel à formatKnowledgeForPrompt');
        const formattedText = chatbotKnowledgeService.formatKnowledgeForPrompt(relevantInfo);
        console.log(`[AI-KNOWLEDGE-TEST] Texte formaté de ${formattedText.length} caractères`);
        
        // Retourner les résultats avec des informations détaillées
        res.json({
            success: true,
            query,
            relevantInfo: relevantInfo.map(info => ({
                type: info.type,
                title: info.question || info.name || 'Inconnu',
                score: info.score
            })),
            formattedText,
            textLength: formattedText.length
        });
    } catch (error) {
        console.error(`[AI-KNOWLEDGE-TEST] Erreur test formatage: ${error.message}`, error.stack);
        res.status(500).json({ error: `Erreur lors du test de formatage: ${error.message}` });
    }
});

module.exports = router;