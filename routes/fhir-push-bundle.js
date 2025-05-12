/**
 * Module pour pousser directement un bundle FHIR vers le serveur HAPI FHIR
 * Ce module crée un endpoint qui permet d'envoyer un bundle FHIR complet
 * au serveur HAPI FHIR et renvoie la réponse
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('./fhir-config');
const { getFhirServerUrl } = require('../utils/fhirService');
const logger = require('../utils/logger');
// Pour l'authentification, utiliser l'authentification combinée de l'app principal
// Si le module apiKeyMiddleware est requis directement, nous pouvons utiliser une option plus simple
const authMiddleware = (req, res, next) => {
    // L'authentification est optionnelle pour ce endpoint
    next();
};

/**
 * Endpoint pour pousser un bundle FHIR complet vers le serveur HAPI FHIR
 * @route POST /api/fhir-push-bundle
 * @param {Object} req.body.bundle - Le bundle FHIR à envoyer
 * @param {Boolean} req.body.returnOriginal - Si true, renvoie aussi le bundle original (défaut: true)
 * @param {Boolean} req.query.autoPush - Si présent dans l'URL, active le push automatique
 * @returns {Object} Résultat de l'opération et bundle original si demandé
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const bundle = req.body.bundle;
        const returnOriginal = req.body.returnOriginal !== false; // Par défaut true
        
        if (!bundle || !bundle.resourceType || bundle.resourceType !== 'Bundle') {
            return res.status(400).json({
                success: false,
                error: 'Un bundle FHIR valide est requis',
                details: 'Le body doit contenir un objet bundle avec resourceType "Bundle"'
            });
        }

        // Récupérer l'URL du serveur FHIR selon le serverId spécifié
        const serverId = req.body.serverId || 'hapi-public';
        const fhirServerUrl = getFhirServerUrl(serverId);
        
        logger.info(`[FHIR-BUNDLE-PUSH] Tentative d'envoi d'un bundle contenant ${bundle.entry?.length || 0} ressources`);
        
        // Pousser le bundle vers le serveur FHIR
        const response = await axios.post(`${fhirServerUrl}`, bundle, {
            headers: {
                'Content-Type': 'application/fhir+json',
                'Accept': 'application/fhir+json'
            }
        });
        
        logger.info(`[FHIR-BUNDLE-PUSH] Bundle envoyé avec succès, status: ${response.status}`);
        
        // Construire la réponse
        const result = {
            success: true,
            status: response.status,
            message: 'Bundle FHIR envoyé avec succès',
            serverResponse: response.data
        };
        
        // Ajouter le bundle original si demandé
        if (returnOriginal) {
            result.originalBundle = bundle;
        }
        
        return res.status(200).json(result);
    } catch (error) {
        logger.error(`[FHIR-BUNDLE-PUSH] Erreur: ${error.message}`);
        
        // Construire une réponse d'erreur détaillée
        const errorResponse = {
            success: false,
            error: 'Échec de l\'envoi du bundle FHIR',
            message: error.message
        };
        
        // Ajouter la réponse du serveur si disponible
        if (error.response) {
            errorResponse.status = error.response.status;
            errorResponse.serverResponse = error.response.data;
        }
        
        return res.status(error.response?.status || 500).json(errorResponse);
    }
});

module.exports = router;