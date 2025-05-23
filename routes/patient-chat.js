const express = require('express');
const router = express.Router();
const { getAiService } = require('../utils/aiServiceUnified');

router.post('/patient-chat', async (req, res) => {
    try {
        console.log('[PATIENT-CHAT] Nouvelle requête de chatbot patient');
        console.log('[PATIENT-CHAT] Paramètres reçus:', {
            hasMessages: !!req.body.messages,
            messageCount: req.body.messages?.length || 0,
            maxTokens: req.body.max_tokens
        });

        const { messages, max_tokens = 500 } = req.body;

        if (!messages || messages.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Messages manquants'
            });
        }

        // Récupérer le service IA unifié
        const aiService = await getAiService();
        if (!aiService) {
            return res.status(500).json({
                success: false,
                error: 'Aucun fournisseur d\'IA configuré'
            });
        }

        console.log('[PATIENT-CHAT] Utilisation du service IA:', aiService.getProviderType());
        console.log('[PATIENT-CHAT] Question posée:', messages[messages.length - 1]?.content);

        // Appeler directement le service IA sans passer par le système de connaissances
        const response = await aiService.generateResponse(messages, {
            max_tokens,
            temperature: 0.3
        });

        console.log('[PATIENT-CHAT] Réponse générée avec succès');

        res.json({
            success: true,
            content: response
        });

    } catch (error) {
        console.error('[PATIENT-CHAT] Erreur:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;