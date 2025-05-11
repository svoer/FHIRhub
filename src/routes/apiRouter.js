/**
 * Router pour les API de FHIRHub
 * Gère les routes d'API, y compris conversion, statistiques et historique
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const { convertHL7ToFHIR } = require('../services/conversionService');
const conversionLogService = require('../services/conversionLogService');
const terminologyService = require('../services/terminologyService');

// Middleware d'authentification par clé API
router.use(apiKeyAuth);

/**
 * GET /api/health
 * Vérifier l'état du serveur
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/convert
 * Convertir un message HL7 en FHIR
 */
router.post('/convert', async (req, res) => {
  try {
    const { content, options = {} } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Contenu HL7 manquant',
        message: 'Le corps de la requête doit contenir un champ "content" avec le message HL7 à convertir'
      });
    }
    
    const result = await convertHL7ToFHIR(content, options, req.apiKey);
    
    res.json(result);
  } catch (error) {
    console.error('[API] Erreur lors de la conversion:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur de conversion',
      message: error.message
    });
  }
});

/**
 * GET /api/stats
 * Obtenir les statistiques de conversion pour l'application associée à la clé API
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await conversionLogService.getAppStats(req.apiKey.application_id);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des statistiques:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des statistiques'
    });
  }
});

/**
 * GET /api/conversions
 * Obtenir l'historique des conversions pour l'application associée à la clé API
 */
router.get('/conversions', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const history = await conversionLogService.getConversions(req.apiKey.application_id, parseInt(limit), parseInt(page));
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération de l\'historique des conversions:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération de l\'historique des conversions'
    });
  }
});

/**
 * GET /api/conversions/:id
 * Obtenir les détails d'une conversion spécifique
 */
router.get('/conversions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversion = await conversionLogService.getConversion(parseInt(id), req.apiKey.application_id);
    
    if (!conversion) {
      return res.status(404).json({
        success: false,
        error: 'Conversion non trouvée',
        message: `La conversion avec l'ID ${id} n'a pas été trouvée ou n'appartient pas à cette application`
      });
    }
    
    res.json({
      success: true,
      data: conversion
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des détails de la conversion:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des détails de la conversion'
    });
  }
});

/**
 * GET /api/terminology/validate
 * Valider un code dans un système donné
 */
router.get('/terminology/validate', async (req, res) => {
  try {
    const { system, code } = req.query;
    
    if (!system || !code) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants',
        message: 'Les paramètres "system" et "code" sont obligatoires'
      });
    }
    
    const isValid = await terminologyService.validateCode(system, code);
    
    res.json({
      success: true,
      result: {
        system,
        code,
        valid: isValid
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de la validation du code:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la validation du code'
    });
  }
});

/**
 * POST /api/terminology/validate-bundle
 * Valider tous les codes trouvés dans un bundle FHIR
 */
router.post('/terminology/validate-bundle', async (req, res) => {
  try {
    const bundle = req.body;
    
    if (!bundle || !bundle.resourceType || bundle.resourceType !== 'Bundle') {
      return res.status(400).json({
        success: false,
        error: 'Bundle FHIR invalide',
        message: 'Le corps de la requête doit être un Bundle FHIR valide'
      });
    }
    
    const validationResults = await terminologyService.validateBundle(bundle);
    
    res.json({
      success: true,
      result: validationResults
    });
  } catch (error) {
    console.error('[API] Erreur lors de la validation du bundle:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la validation du bundle'
    });
  }
});

/**
 * GET /api/terminology/systems
 * Récupérer la liste de tous les systèmes de terminologie français
 */
router.get('/terminology/systems', async (req, res) => {
  try {
    const systems = await terminologyService.getTerminologySystems();
    
    res.json({
      success: true,
      data: systems
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des systèmes de terminologie:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des systèmes de terminologie'
    });
  }
});

module.exports = router;