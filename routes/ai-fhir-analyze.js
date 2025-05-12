/**
 * Routes pour l'analyse de ressources FHIR via des fournisseurs d'IA
 * Comprend également les routes pour le chatbot de support
 * @module routes/ai-fhir-analyze
 */

const express = require('express');
const router = express.Router();
const fhirService = require('../utils/fhirService');
// Service IA unifié
let aiService;
try {
    aiService = require('../utils/aiService');
} catch (error) {
    console.error("Erreur lors de l'importation de aiService:", error.message);
    // Créer un objet fake pour éviter les erreurs
    aiService = {
        generateResponse: async () => "Service IA non disponible"
    };
}
// Vérifier si le module existe et l'importer correctement
let aiProviderService;
try {
    aiProviderService = require('../utils/aiProviderService');
} catch (error) {
    console.error("Erreur lors de l'importation de aiProviderService:", error.message);
    // Créer un objet fake pour éviter les erreurs
    aiProviderService = {
        getActiveAIProvider: async () => null,
        getAllAIProviders: async () => []
    };
}
const { getActiveAIProvider } = aiProviderService;
const { authCombined } = require('../middleware/auth');

// Plus besoin d'importer des fournisseurs d'IA spécifiques
// aiService gère automatiquement le fournisseur actif configuré dans les paramètres

/**
 * @swagger
 * /api/ai/analyze-patient:
 *   post:
 *     summary: Analyse les données d'un patient avec l'IA
 *     description: Utilise le fournisseur d'IA actif pour générer une analyse du patient à partir des ressources FHIR
 *     tags:
 *       - IA
 *     security:
 *       - jwt: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - serverUrl
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: ID du patient à analyser
 *               serverUrl:
 *                 type: string
 *                 description: URL du serveur FHIR
 *               patientData:
 *                 type: object
 *                 description: Données du patient déjà récupérées (optionnel)
 *     responses:
 *       200:
 *         description: Analyse générée avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
// Route pour l'analyse de patient - désactive l'authentification
router.post('/analyze-patient', async (req, res) => {
    // Logs pour debug
    console.log('Route /api/ai/analyze-patient accessible sans authentification - BYPASS_AUTH:', process.env.BYPASS_AUTH);
    
    // Ajouter un timeout global pour la route entière (2 minutes)
    // Ceci permet de s'assurer que la requête répond toujours, même si le service IA est bloqué
    const ROUTE_TIMEOUT = 120000; // 120 secondes = 2 minutes
    let timeoutHandle = setTimeout(() => {
        console.warn('Timeout global dépassé pour l\'analyse du patient après', ROUTE_TIMEOUT/1000, 'secondes');
        if (!res.headersSent) {
            res.status(503).json({
                success: false,
                message: 'Délai d\'attente dépassé pour l\'analyse du patient',
                error: 'Service temporairement indisponible - veuillez réessayer plus tard'
            });
        }
    }, ROUTE_TIMEOUT);
    
    try {
        // S'assurer que le timeout est annulé dans tous les cas (réussite ou échec)
        res.on('finish', () => {
            clearTimeout(timeoutHandle);
        });
        
        const { patientId, serverUrl, patientData } = req.body;
        console.log('[AI-Analyze] Requête avec patientId:', patientId, 'serverUrl:', serverUrl);
        
        if (!patientId || !serverUrl) {
            return res.status(400).json({
                success: false,
                message: 'ID du patient et URL du serveur requis'
            });
        }
        
        // Récupérer les données du patient soit depuis les données fournies, soit depuis le serveur FHIR
        let patientSummary;
        
        if (patientData && typeof patientData === 'object' && Object.keys(patientData).length > 0) {
            console.log('[AI-Analyze] Utilisation des données patient fournies');
            patientSummary = patientData;
        } else {
            try {
                console.log('[AI-Analyze] Récupération des données du patient depuis le serveur FHIR');
                // Note: Dans fhirService.getPatientSummary, le premier paramètre est serverUrl (et non patientId)
                patientSummary = await fhirService.getPatientSummary(serverUrl, patientId);
            } catch (error) {
                console.error('[AI-Analyze] Erreur lors de la récupération des données du patient:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la récupération des données du patient',
                    error: error.message
                });
            }
        }
        
        if (!patientSummary) {
            return res.status(404).json({
                success: false,
                message: 'Patient non trouvé ou données insuffisantes'
            });
        }
        
        // Si les données sont fournies directement, nous devons nous assurer qu'elles sont complètes
        // mais pas nécessairement dans le même format que fhirService.getPatientSummary
        
        let analysis;
        try {
            // Obtenir le fournisseur d'IA actif
            const aiProvider = await getActiveAIProvider();
            
            if (!aiProvider) {
                throw new Error('Aucun fournisseur d\'IA actif configuré');
            }
            
            // Extraire les données des différentes sections si disponibles
            let patientInfo = patientSummary;
            let conditions = [];
            let observations = [];
            let medications = [];
            let encounters = [];
            
            // Si les données sont structurées avec des sections distinctes (envoi depuis patient-viewer.js)
            if (patientSummary.patient && typeof patientSummary.patient === 'object') {
                console.log('[AI-Analyze] Données reçues avec structure complète');
                patientInfo = patientSummary.patient;
                conditions = patientSummary.conditions || [];
                observations = patientSummary.observations || [];
                medications = patientSummary.medications || [];
                encounters = patientSummary.encounters || [];
                
                // Log détaillé des données disponibles pour le débogage
                console.log('[AI-Analyze] Statistiques des données reçues:');
                console.log(`  - Patient: ${patientInfo ? 'Présent' : 'Manquant'}`);
                console.log(`  - Conditions: ${conditions.length} éléments`);
                console.log(`  - Observations: ${observations.length} éléments`);
                console.log(`  - Médicaments: ${medications.length} éléments`);
                console.log(`  - Consultations: ${encounters.length} éléments`);
            }
            
            // Construire le prompt pour l'IA avec toutes les données disponibles
            const prompt = `Tu es un assistant médical qui analyse des données FHIR de patient.
                
En tant qu'expert médical, analyse ces données de patient et génère un rapport médical complet comprenant:
1. Un résumé des informations démographiques
2. Un bilan de l'état de santé actuel
3. Une analyse des problèmes de santé actifs et passés
4. Une synthèse des résultats de laboratoire et observations
5. L'historique des consultations et hospitalisations
6. Une synthèse chronologique des événements majeurs
7. Des recommandations médicales basées sur l'ensemble des données

Voici les données FHIR du patient sous format JSON, incluant les informations des différentes sections (patient, conditions, observations, médicaments, consultations):

INFORMATIONS PATIENT:
${JSON.stringify(patientInfo, null, 2)}

CONDITIONS MÉDICALES (${conditions.length}):
${JSON.stringify(conditions, null, 2)}

OBSERVATIONS ET RÉSULTATS DE LABORATOIRE (${observations.length}):
${JSON.stringify(observations, null, 2)}

MÉDICAMENTS (${medications.length}):
${JSON.stringify(medications, null, 2)}

CONSULTATIONS ET HOSPITALISATIONS (${encounters.length}):
${JSON.stringify(encounters, null, 2)}
                
Réponds avec un rapport HTML bien structuré pour faciliter la lecture. Utilise les éléments HTML comme <div>, <h3>, <ul>, <li>, <p> avec des styles CSS en ligne pour créer un rapport visuellement organisé. Utilise des tableaux pour regrouper les données quand c'est pertinent.

Le rapport doit obligatoirement intégrer et analyser toutes les sections de données disponibles (pas seulement les données de base du patient).`;
            
            // Utiliser notre service d'IA unifié
            console.log("[AI-Analyze] Génération de l'analyse avec le service d'IA unifié");
            analysis = await aiService.generateResponse({
                prompt,
                maxTokens: 1500,
                temperature: 0.3,
                retryCount: 3
            });
            
            console.log(`[AI-Analyze] Analyse générée avec succès via ${aiProvider.name || aiProvider.provider_name}`);
            
        } catch (error) {
            console.error("[AI-Analyze] Erreur lors de la génération de l'analyse avec l'IA:", error);
            
            // Fallback vers une analyse basique en cas d'erreur
            console.log("[AI-Analyze] Utilisation de l'analyse basique en fallback");
            analysis = generateBasicSummary(patientSummary);
        }
        
        return res.status(200).json({
            success: true,
            analysis
        });
        
    } catch (error) {
        console.error('[AI-Analyze] Erreur lors de l\'analyse du patient:', error);
        clearTimeout(timeoutHandle);
        
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'analyse du patient',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Interagit avec le chatbot via l'IA active
 *     description: Utilise le fournisseur d'IA actif pour répondre aux questions du chatbot de support
 *     tags:
 *       - IA
 *     security:
 *       - jwt: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 description: Historique de messages pour la conversation
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant]
 *                     content:
 *                       type: string
 *               max_tokens:
 *                 type: integer
 *                 description: Nombre maximum de tokens pour la réponse
 *     responses:
 *       200:
 *         description: Réponse générée avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
// Route pour le chatbot - désactive complètement l'authentification pour cette route
router.post('/chat', async (req, res) => {
    // Log pour debug
    console.log('Route /api/ai/chat accessible sans authentification - BYPASS_AUTH:', process.env.BYPASS_AUTH);
    
    try {
        const { messages, max_tokens = 1000 } = req.body;
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Messages requis et doivent être un tableau non vide'
            });
        }
        
        // Extraire le message système et l'historique des messages
        const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
        const userMessages = messages.filter(msg => msg.role !== 'system');
        
        // Formater les messages pour notre service d'IA unifié
        const formattedPrompt = userMessages.map(msg => {
            const prefix = msg.role === 'user' ? 'Utilisateur: ' : 'Assistant: ';
            return `${prefix}${msg.content}`;
        }).join('\n\n');
        
        try {
            // Obtenir le fournisseur actif pour le logging
            const aiProvider = await getActiveAIProvider();
            const providerName = aiProvider ? aiProvider.provider_name : 'inconnu';
            
            // Générer la réponse avec notre service d'IA unifié
            const response = await aiService.generateResponse({
                prompt: formattedPrompt,
                systemPrompt: systemMessage,
                maxTokens: max_tokens,
                temperature: 0.7
            });
            
            // Journaliser la requête et la réponse (sans les données sensibles)
            console.log(`[CHATBOT] Interaction avec ${providerName}: ${messages.length} messages traités`);
            
            // Répondre avec la réponse générée
            return res.status(200).json({
                success: true,
                message: 'Réponse générée avec succès',
                content: response,
                provider: providerName
            });
            
        } catch (error) {
            console.error('[AI-CHAT] Erreur lors de la génération de la réponse:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la communication avec le fournisseur d\'IA',
                error: error.message
            });
        }
        
    } catch (error) {
        console.error('[AI-CHAT] Erreur lors du traitement de la requête du chatbot:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors du traitement de la requête',
            error: error.message
        });
    }
});

/**
 * Génère un résumé basique du patient (fallback si l'IA n'est pas disponible)
 * @param {Object} summary - Résumé des données du patient
 * @returns {string} - Résumé HTML basique
 */
function generateBasicSummary(summary) {
    const patient = summary.patient || {};
    const observations = summary.observations || [];
    const conditions = summary.conditions || [];
    const medications = summary.medications || [];
    const encounters = summary.encounters || [];
    
    return `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333;">
            <div style="background: linear-gradient(45deg, #fd7e30, #eb1c24); padding: 15px; border-radius: 10px; margin-bottom: 20px; color: white;">
                <h2 style="margin: 0;">Synthèse Patient</h2>
                <p style="margin: 5px 0 0;">${patient.name?.[0]?.family || 'Nom inconnu'}, ${patient.name?.[0]?.given?.[0] || 'Prénom inconnu'}</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 5px solid #fd7e30;">
                <h3 style="margin-top: 0; color: #fd7e30;">Informations démographiques</h3>
                <p><strong>Date de naissance:</strong> ${patient.birthDate || 'Non spécifiée'}</p>
                <p><strong>Genre:</strong> ${patient.gender || 'Non spécifié'}</p>
                <p><strong>Adresse:</strong> ${patient.address?.[0]?.line?.[0] || ''} ${patient.address?.[0]?.city || ''} ${patient.address?.[0]?.postalCode || ''}</p>
                <p><strong>Contact:</strong> ${patient.telecom?.[0]?.value || 'Non spécifié'}</p>
            </div>
            
            ${observations.length > 0 ? `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 5px solid #fd7e30;">
                <h3 style="margin-top: 0; color: #fd7e30;">Observations récentes</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #fd7e30; color: white;">
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Observation</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Valeur</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${observations.slice(0, 5).map(o => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${o.code?.coding?.[0]?.display || o.code?.text || 'Non spécifiée'}</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;">${getObservationValue(o)}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;">${getEffectiveDate(o) ? new Date(getEffectiveDate(o)).toLocaleDateString('fr-FR') : 'Non spécifiée'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${observations.length > 5 ? `<p style="margin: 10px 0 0; text-align: right; font-style: italic; color: #666;">${observations.length - 5} observations supplémentaires non affichées</p>` : ''}
            </div>` : ''}
            
            ${conditions.length > 0 ? `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 5px solid #fd7e30;">
                <h3 style="margin-top: 0; color: #fd7e30;">Problèmes de santé</h3>
                <ul style="padding-left: 20px;">
                    ${conditions.map(c => `
                        <li style="margin-bottom: 5px;"><strong>${c.code?.coding?.[0]?.display || c.code?.text || 'Non spécifié'}</strong>
                            ${c.clinicalStatus?.coding?.[0]?.code ? ` - Statut: ${c.clinicalStatus.coding[0].code}` : ''}
                            ${c.onsetDateTime ? ` - Début: ${new Date(c.onsetDateTime).toLocaleDateString('fr-FR')}` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>` : ''}
            
            ${medications.length > 0 ? `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 5px solid #fd7e30;">
                <h3 style="margin-top: 0; color: #fd7e30;">Médicaments</h3>
                <ul style="padding-left: 20px;">
                    ${medications.map(m => `
                        <li style="margin-bottom: 5px;">${m.medicationCodeableConcept?.coding?.[0]?.display || m.medicationCodeableConcept?.text || 'Non spécifié'}
                            ${m.dosageInstruction?.[0]?.text ? ` - ${m.dosageInstruction[0].text}` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>` : ''}
            
            ${encounters.length > 0 ? `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 5px solid #fd7e30;">
                <h3 style="margin-top: 0; color: #fd7e30;">Consultations récentes</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #fd7e30; color: white;">
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Type</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Raison</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${encounters.slice(0, 5).map(e => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${e.type || e.class || 'Non spécifié'}</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;">${e.reason || 'Non spécifiée'}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;">${e.period?.start ? new Date(e.period.start).toLocaleDateString('fr-FR') : 'Non spécifiée'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${encounters.length > 5 ? `<p style="margin: 10px 0 0; text-align: right; font-style: italic; color: #666;">${encounters.length - 5} consultations supplémentaires non affichées</p>` : ''}
            </div>` : ''}
            
            <div style="background: rgba(253, 126, 48, 0.1); padding: 10px; border-radius: 6px; margin-top: 15px; text-align: center;">
                <p style="margin: 0; font-style: italic; color: #666;">
                    Cette analyse est purement factuelle, basée uniquement sur les données disponibles dans le dossier.
                </p>
            </div>
        </div>
    `;
}

/**
 * Obtient la valeur d'une observation sous forme de chaîne formatée
 * @param {Object} observation - Ressource Observation FHIR
 * @returns {string} - Valeur formatée
 */
function getObservationValue(observation) {
    if (observation.valueQuantity) {
        return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`;
    } else if (observation.valueCodeableConcept) {
        return observation.valueCodeableConcept.coding?.[0]?.display || observation.valueCodeableConcept.text || 'Non spécifiée';
    } else if (observation.valueString) {
        return observation.valueString;
    } else if (observation.valueBoolean !== undefined) {
        return observation.valueBoolean ? 'Oui' : 'Non';
    } else if (observation.valueInteger !== undefined) {
        return observation.valueInteger.toString();
    } else if (observation.valueRange) {
        return `${observation.valueRange.low?.value || '?'} - ${observation.valueRange.high?.value || '?'} ${observation.valueRange.low?.unit || ''}`;
    } else if (observation.valueRatio) {
        return `${observation.valueRatio.numerator?.value || '?'} : ${observation.valueRatio.denominator?.value || '?'}`;
    } else if (observation.component && observation.component.length > 0) {
        return 'Composants multiples';
    } else {
        return 'Non spécifiée';
    }
}

/**
 * Obtient la date effective d'une observation
 * @param {Object} observation - Ressource Observation FHIR
 * @returns {string} - Date formatée ou chaîne vide
 */
function getEffectiveDate(observation) {
    if (observation.effectiveDateTime) {
        return observation.effectiveDateTime;
    } else if (observation.effectivePeriod && observation.effectivePeriod.start) {
        return observation.effectivePeriod.start;
    } else if (observation.issued) {
        return observation.issued;
    } else {
        return '';
    }
}

// Log pour le débogage des routes
console.log("[DEBUG] Routes AI enregistrées:");
console.log("[DEBUG] - /api/ai/analyze-patient");
console.log("[DEBUG] - /api/ai/chat");

// Export du routeur
module.exports = router;