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

        // Créer un prompt simple avec les données formatées
        const prompt = `Réponds précisément à cette question : "${question}"

Voici les données du patient :

INFORMATIONS PATIENT:
${JSON.stringify(patientData?.patient || {}, null, 2)}

CONDITIONS MÉDICALES (${patientData?.conditions?.length || 0}):
${JSON.stringify(patientData?.conditions || [], null, 2)}

PRATICIENS (${patientData?.practitioners?.length || 0}):
${JSON.stringify(patientData?.practitioners || [], null, 2)}

OBSERVATIONS (${patientData?.observations?.length || 0}):
${JSON.stringify(patientData?.observations || [], null, 2)}

Instructions :
- Réponds SEULEMENT à la question posée
- Sois concis et direct  
- Base-toi uniquement sur les données fournies
- Si l'info n'est pas disponible, dis-le simplement`;

        // Utiliser le service IA avec le même format que l'analyse intelligente
        const response = await aiService.generateResponse({
            prompt: prompt,
            systemPrompt: 'Tu es un assistant médical spécialisé dans l\'analyse de données FHIR.',
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