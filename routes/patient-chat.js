const express = require('express');
const router = express.Router();
const aiService = require('../utils/aiService');

router.post('/patient-chat', async (req, res) => {
    try {
        console.log('[PATIENT-CHAT] Question:', req.body.question);
        
        const { question, patientData } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                error: 'Question manquante'
            });
        }

        // Créer un prompt simple et direct pour réponses courtes
        const prompt = `Tu es un assistant médical. Réponds UNIQUEMENT à la question posée de manière concise et directe.

Question: ${question}

Données du patient:
- Nom: ${patientData?.patient?.name?.[0]?.given?.[0]} ${patientData?.patient?.name?.[0]?.family}
- Conditions: ${patientData?.conditions?.map(c => c.code?.text || c.code?.coding?.[0]?.display).filter(Boolean).join(', ') || 'Aucune'}
- Praticiens: ${patientData?.practitioners?.map(p => `${p.name?.[0]?.given?.[0]} ${p.name?.[0]?.family}`).filter(Boolean).join(', ') || 'Aucun'}
- Observations récentes: ${patientData?.observations?.slice(0,3).map(o => o.code?.text || o.code?.coding?.[0]?.display).filter(Boolean).join(', ') || 'Aucune'}

IMPORTANT: Réponds par une phrase courte et directe uniquement, pas de rapport complet.`;

        // Utiliser le service IA qui fonctionne
        const response = await aiService.generateResponse(prompt, {
            maxTokens: 150,
            temperature: 0.3
        });

        res.json({
            success: true,
            content: response
        });

    } catch (error) {
        console.error('[PATIENT-CHAT] Erreur:', error.message);
        res.status(500).json({
            success: false,
            error: 'Désolé, je rencontre un problème technique. Veuillez réessayer.'
        });
    }
});

module.exports = router;