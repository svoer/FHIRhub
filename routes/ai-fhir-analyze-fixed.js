/**
 * Routes optimisées pour l'analyse de ressources FHIR via des fournisseurs d'IA
 * Version corrigée avec gestion d'erreurs robuste et optimisations de performance
 * @module routes/ai-fhir-analyze-fixed
 */

const express = require('express');
const router = express.Router();
const fhirService = require('../utils/fhirService');

// Service IA optimisé avec gestion d'erreurs améliorée
let aiService;
try {
    aiService = require('../utils/aiServiceOptimized');
    console.log('[AI-FIXED] Service IA optimisé chargé avec succès');
} catch (error) {
    console.error("Erreur lors de l'importation de aiServiceOptimized:", error.message);
    try {
        aiService = require('../utils/aiService');
        console.log('[AI-FIXED] Fallback vers aiService standard');
    } catch (fallbackError) {
        console.error("Erreur lors du fallback aiService:", fallbackError.message);
        aiService = {
            generateResponse: async () => "Service IA non disponible"
        };
    }
}

let aiProviderService;
try {
    aiProviderService = require('../utils/aiProviderService');
} catch (error) {
    console.error("Erreur lors de l'importation de aiProviderService:", error.message);
    aiProviderService = {
        getActiveAIProvider: async () => null,
        getAllAIProviders: async () => []
    };
}

const getProvider = aiProviderService.getActiveAIProvider;

/**
 * Optimise et filtre les données patient pour l'IA
 * Réduit la taille des données et élimine le bruit
 */
function optimizePatientDataForAI(patientSummary) {
    const optimized = {
        patient: {},
        conditions: [],
        observations: [],
        medications: [],
        encounters: []
    };

    // Optimiser les données patient (garder seulement l'essentiel)
    if (patientSummary.patient) {
        const patient = patientSummary.patient;
        optimized.patient = {
            id: patient.id,
            name: patient.name?.[0] || {},
            gender: patient.gender,
            birthDate: patient.birthDate,
            address: patient.address?.[0] || {},
            telecom: patient.telecom?.slice(0, 2) || [] // Limiter à 2 contacts
        };
    }

    // Filtrer et limiter les conditions (max 10 plus récentes)
    if (patientSummary.conditions && Array.isArray(patientSummary.conditions)) {
        optimized.conditions = patientSummary.conditions
            .filter(condition => condition.code && condition.code.text)
            .slice(0, 10)
            .map(condition => ({
                id: condition.id,
                code: condition.code.text || condition.code.coding?.[0]?.display,
                status: condition.clinicalStatus?.coding?.[0]?.code,
                recordedDate: condition.recordedDate,
                severity: condition.severity?.coding?.[0]?.display
            }));
    }

    // Filtrer et limiter les observations (max 15 plus récentes)
    if (patientSummary.observations && Array.isArray(patientSummary.observations)) {
        optimized.observations = patientSummary.observations
            .filter(obs => obs.code && (obs.code.text || obs.valueQuantity || obs.valueString))
            .slice(0, 15)
            .map(obs => ({
                id: obs.id,
                code: obs.code.text || obs.code.coding?.[0]?.display,
                value: obs.valueQuantity?.value || obs.valueString || obs.valueCodeableConcept?.text,
                unit: obs.valueQuantity?.unit,
                effectiveDateTime: obs.effectiveDateTime,
                status: obs.status
            }));
    }

    // Filtrer et limiter les médicaments (max 10)
    if (patientSummary.medications && Array.isArray(patientSummary.medications)) {
        optimized.medications = patientSummary.medications
            .slice(0, 10)
            .map(med => ({
                id: med.id,
                medication: med.medicationCodeableConcept?.text || med.medicationReference?.display,
                status: med.status,
                authoredOn: med.authoredOn,
                dosage: med.dosageInstruction?.[0]?.text
            }));
    }

    // Filtrer et limiter les consultations (max 8 plus récentes)
    if (patientSummary.encounters && Array.isArray(patientSummary.encounters)) {
        optimized.encounters = patientSummary.encounters
            .slice(0, 8)
            .map(encounter => ({
                id: encounter.id,
                status: encounter.status,
                class: encounter.class?.display,
                type: encounter.type?.[0]?.text,
                period: encounter.period,
                reasonCode: encounter.reasonCode?.[0]?.text
            }));
    }

    return optimized;
}

/**
 * Génère un prompt médical sécurisé et optimisé
 */
function generateMedicalPrompt(optimizedData, isQuestion = false, question = null) {
    // Validation stricte du contexte médical
    if (!optimizedData.patient || !optimizedData.patient.id) {
        throw new Error('Données patient invalides pour l\'analyse médicale');
    }

    const stats = {
        conditions: optimizedData.conditions.length,
        observations: optimizedData.observations.length,
        medications: optimizedData.medications.length,
        encounters: optimizedData.encounters.length
    };

    if (isQuestion && question) {
        return `CONTEXTE MÉDICAL STRICT - RÉPONDRE UNIQUEMENT À LA QUESTION POSÉE

Question du professionnel de santé: "${question}"

DONNÉES PATIENT AUTHENTIFIÉES:
Patient ID: ${optimizedData.patient.id}
Nom: ${JSON.stringify(optimizedData.patient.name)}
Sexe: ${optimizedData.patient.gender}
Date de naissance: ${optimizedData.patient.birthDate}

CONDITIONS MÉDICALES (${stats.conditions} éléments):
${JSON.stringify(optimizedData.conditions, null, 2)}

OBSERVATIONS CLINIQUES (${stats.observations} éléments):
${JSON.stringify(optimizedData.observations, null, 2)}

TRAITEMENTS (${stats.medications} éléments):
${JSON.stringify(optimizedData.medications, null, 2)}

CONSULTATIONS (${stats.encounters} éléments):
${JSON.stringify(optimizedData.encounters, null, 2)}

INSTRUCTIONS STRICTES:
- Répondre UNIQUEMENT à la question posée
- Se baser EXCLUSIVEMENT sur les données médicales fournies
- Rester dans le contexte médical et clinique
- Si l'information n'est pas disponible, le dire clairement
- Réponse concise et professionnelle`;
    }

    return `ANALYSE MÉDICALE COMPLÈTE - DOSSIER PATIENT FHIR

MISSION: Analyser les données médicales FHIR du patient et générer un rapport clinique complet.

DONNÉES PATIENT AUTHENTIFIÉES:
Patient ID: ${optimizedData.patient.id}
Nom: ${JSON.stringify(optimizedData.patient.name)}
Sexe: ${optimizedData.patient.gender}
Date de naissance: ${optimizedData.patient.birthDate}

CONDITIONS MÉDICALES ACTIVES (${stats.conditions} éléments):
${JSON.stringify(optimizedData.conditions, null, 2)}

OBSERVATIONS ET RÉSULTATS (${stats.observations} éléments):
${JSON.stringify(optimizedData.observations, null, 2)}

TRAITEMENTS ET MÉDICAMENTS (${stats.medications} éléments):
${JSON.stringify(optimizedData.medications, null, 2)}

CONSULTATIONS ET SOINS (${stats.encounters} éléments):
${JSON.stringify(optimizedData.encounters, null, 2)}

DIRECTIVES POUR LE RAPPORT MÉDICAL:
1. Générer un rapport HTML médical structuré
2. Inclure OBLIGATOIREMENT toutes les sections disponibles
3. Analyser chronologiquement l'évolution du patient
4. Identifier les problèmes de santé prioritaires
5. Proposer des recommandations cliniques basées sur les données
6. Utiliser un langage médical professionnel
7. Structurer avec des éléments HTML (<div>, <h3>, <ul>, <li>, <table>)
8. Rester STRICTEMENT dans le contexte médical et clinique

Le rapport doit être un document médical authentique, pas un contenu générique.`;
}

/**
 * Génère un résumé de base en cas d'échec de l'IA
 */
function generateBasicMedicalSummary(patientData) {
    const stats = {
        conditions: patientData.conditions?.length || 0,
        observations: patientData.observations?.length || 0,
        medications: patientData.medications?.length || 0,
        encounters: patientData.encounters?.length || 0
    };

    return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #007bff;">
            <h3 style="margin: 0 0 10px 0; color: #007bff;">📋 Résumé Médical de Base</h3>
            <p style="margin: 0; color: #666;">Généré automatiquement depuis les données FHIR</p>
        </div>

        <div style="background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h4 style="color: #333; margin-top: 0;">👤 Informations Patient</h4>
            <p><strong>ID:</strong> ${patientData.patient?.id || 'Non spécifié'}</p>
            <p><strong>Nom:</strong> ${patientData.patient?.name?.[0]?.family || ''} ${patientData.patient?.name?.[0]?.given?.join(' ') || ''}</p>
            <p><strong>Sexe:</strong> ${patientData.patient?.gender || 'Non spécifié'}</p>
            <p><strong>Date de naissance:</strong> ${patientData.patient?.birthDate || 'Non spécifiée'}</p>
        </div>

        <div style="background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h4 style="color: #333; margin-top: 0;">📊 Statistiques du Dossier</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                <div style="text-align: center; padding: 10px; background: #e3f2fd; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${stats.conditions}</div>
                    <div style="color: #666;">Conditions</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #f3e5f5; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: #7b1fa2;">${stats.observations}</div>
                    <div style="color: #666;">Observations</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #e8f5e8; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: #388e3c;">${stats.medications}</div>
                    <div style="color: #666;">Médicaments</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #fff3e0; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: #f57c00;">${stats.encounters}</div>
                    <div style="color: #666;">Consultations</div>
                </div>
            </div>
        </div>

        <div style="background: #fffbf0; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
            <p style="margin: 0; color: #f57c00;"><strong>ℹ️ Note:</strong> Ceci est un résumé de base généré en l'absence du service d'IA. Pour une analyse médicale complète, veuillez configurer un fournisseur d'IA actif.</p>
        </div>
    </div>`;
}

/**
 * Route optimisée pour l'analyse de patient avec gestion robuste des erreurs
 */
router.post('/analyze-patient', async (req, res) => {
    console.log('[AI-FIXED] Analyse patient demandée - version optimisée');
    
    // Timeout réduit mais raisonnable (90 secondes)
    const ROUTE_TIMEOUT = 90000;
    let timeoutHandle = setTimeout(() => {
        console.warn('[AI-FIXED] Timeout atteint après 90 secondes');
        if (!res.headersSent) {
            res.status(503).json({
                success: false,
                message: 'Délai d\'attente dépassé - service temporairement surchargé',
                error: 'TIMEOUT',
                fallback: true
            });
        }
    }, ROUTE_TIMEOUT);
    
    try {
        res.on('finish', () => clearTimeout(timeoutHandle));
        
        const { patientId, serverUrl, patientData, question, chatbot } = req.body;
        
        console.log('[AI-FIXED] Paramètres reçus:', { 
            patientId, 
            serverUrl: serverUrl?.substring(0, 50) + '...', 
            hasPatientData: !!patientData,
            isQuestion: !!(question && chatbot)
        });
        
        if (!patientId || !serverUrl) {
            return res.status(400).json({
                success: false,
                message: 'Paramètres manquants: patientId et serverUrl requis'
            });
        }
        
        // Récupération des données patient avec optimisation
        let patientSummary;
        
        if (patientData && typeof patientData === 'object' && Object.keys(patientData).length > 0) {
            console.log('[AI-FIXED] Utilisation des données patient fournies');
            patientSummary = patientData;
        } else {
            try {
                console.log('[AI-FIXED] Récupération des données depuis le serveur FHIR');
                patientSummary = await fhirService.getPatientSummary(serverUrl, patientId);
            } catch (error) {
                console.error('[AI-FIXED] Erreur récupération FHIR:', error.message);
                return res.status(500).json({
                    success: false,
                    message: 'Impossible de récupérer les données patient',
                    error: error.message
                });
            }
        }
        
        if (!patientSummary || !patientSummary.patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient non trouvé ou données insuffisantes'
            });
        }
        
        // Optimisation des données pour l'IA
        console.log('[AI-FIXED] Optimisation des données patient pour l\'IA');
        const optimizedData = optimizePatientDataForAI(patientSummary);
        
        console.log('[AI-FIXED] Données optimisées:', {
            conditions: optimizedData.conditions.length,
            observations: optimizedData.observations.length,
            medications: optimizedData.medications.length,
            encounters: optimizedData.encounters.length
        });
        
        let analysis;
        
        try {
            // Vérifier la disponibilité d'un fournisseur IA
            const aiProvider = await getProvider();
            
            if (!aiProvider) {
                console.warn('[AI-FIXED] Aucun fournisseur IA actif - utilisation du résumé de base');
                analysis = generateBasicMedicalSummary(optimizedData);
            } else {
                console.log('[AI-FIXED] Fournisseur IA actif:', aiProvider.provider_type);
                
                // Générer un prompt médical sécurisé
                const prompt = generateMedicalPrompt(
                    optimizedData, 
                    !!(question && chatbot), 
                    question
                );
                
                console.log('[AI-FIXED] Longueur du prompt:', prompt.length, 'caractères');
                
                // Paramètres optimisés pour l'IA
                const aiParams = {
                    prompt,
                    maxTokens: question && chatbot ? 1000 : 2500, // Moins de tokens pour les questions
                    temperature: 0.2, // Température faible pour des réponses médicales précises
                    retryCount: 2 // Moins de tentatives pour éviter les timeouts
                };
                
                console.log('[AI-FIXED] Appel IA avec paramètres optimisés');
                analysis = await aiService.generateResponse(aiParams);
                
                console.log('[AI-FIXED] Analyse IA générée avec succès');
            }
            
        } catch (error) {
            console.error('[AI-FIXED] Erreur lors de l\'analyse IA:', error.message);
            
            // Gestion spécifique des erreurs communes
            if (error.message.includes('429') || error.message.includes('capacity')) {
                console.log('[AI-FIXED] Erreur de capacité IA - utilisation du résumé de base');
                analysis = generateBasicMedicalSummary(optimizedData);
            } else if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
                console.log('[AI-FIXED] Timeout IA - utilisation du résumé de base');
                analysis = generateBasicMedicalSummary(optimizedData);
            } else {
                console.log('[AI-FIXED] Erreur IA générique - utilisation du résumé de base');
                analysis = generateBasicMedicalSummary(optimizedData);
            }
        }
        
        // Validation de la réponse
        if (!analysis || analysis.trim().length === 0) {
            console.warn('[AI-FIXED] Analyse vide - génération du résumé de base');
            analysis = generateBasicMedicalSummary(optimizedData);
        }
        
        // Vérification de contamination (détection de contenu non médical)
        if (analysis.includes('appel d\'offres') || analysis.includes('marché public') || analysis.includes('soumission')) {
            console.error('[AI-FIXED] Contamination détectée dans la réponse IA - utilisation du résumé de base');
            analysis = generateBasicMedicalSummary(optimizedData);
        }
        
        clearTimeout(timeoutHandle);
        
        return res.status(200).json({
            success: true,
            analysis,
            metadata: {
                optimized: true,
                dataStats: {
                    conditions: optimizedData.conditions.length,
                    observations: optimizedData.observations.length,
                    medications: optimizedData.medications.length,
                    encounters: optimizedData.encounters.length
                },
                processingTime: Date.now()
            }
        });
        
    } catch (error) {
        console.error('[AI-FIXED] Erreur générale:', error);
        clearTimeout(timeoutHandle);
        
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'analyse du patient',
                error: error.message,
                fallback: true
            });
        }
    }
});

module.exports = router;