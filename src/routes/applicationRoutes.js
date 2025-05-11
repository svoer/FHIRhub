/**
 * Routes pour la gestion des applications
 * Fournit les endpoints API pour créer, lire, mettre à jour et supprimer des applications
 */

const express = require('express');
const router = express.Router();
const applicationService = require('../services/applicationService');
const apiKeyService = require('../services/apiKeyService');
const conversionLogService = require('../services/conversionLogService');

/**
 * GET /api/applications
 * Récupérer toutes les applications
 */
router.get('/', (req, res) => {
  try {
    const applications = applicationService.getAllApplications();
    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Erreur lors de la récupération des applications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/applications/:id
 * Récupérer une application par son ID
 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    const application = applicationService.getApplicationById(id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application non trouvée' });
    }
    
    res.json({ success: true, data: application });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/applications
 * Créer une nouvelle application
 */
router.post('/', (req, res) => {
  try {
    const { name, description, retention_days, parameters } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Le nom est obligatoire' });
    }
    
    const application = applicationService.createApplication({
      name,
      description,
      retention_days,
      parameters
    });
    
    res.status(201).json({ success: true, data: application });
  } catch (error) {
    console.error('Erreur lors de la création de l\'application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/applications/:id
 * Mettre à jour une application
 */
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    const { name, description, retention_days, active, parameters } = req.body;
    
    const application = applicationService.updateApplication(id, {
      name,
      description,
      retention_days,
      active,
      parameters
    });
    
    res.json({ success: true, data: application });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/applications/:id/parameters
 * Mettre à jour les paramètres d'une application
 */
router.put('/:id/parameters', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    const parameters = req.body;
    
    const updatedParams = applicationService.updateApplicationParameters(id, parameters);
    
    res.json({ success: true, data: updatedParams });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/applications/:id/parameters/:paramKey
 * Supprimer un paramètre d'une application
 */
router.delete('/:id/parameters/:paramKey', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    const paramKey = req.params.paramKey;
    
    const result = applicationService.deleteApplicationParameter(id, paramKey);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Paramètre non trouvé' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression du paramètre:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/applications/:id
 * Supprimer une application
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    const result = applicationService.deleteApplication(id);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Application non trouvée' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/applications/:id/keys
 * Générer une nouvelle clé API pour une application
 */
router.post('/:id/keys', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    // Vérifier si l'application existe
    if (!applicationService.applicationExists(id)) {
      return res.status(404).json({ success: false, error: 'Application non trouvée' });
    }
    
    const { name, description, environment, expiresAt } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Le nom de la clé est requis' });
    }
    
    // Créer la clé API
    const apiKey = apiKeyService.createApiKey(id, {
      name,
      description,
      environment,
      expires_at: expiresAt
    });
    
    res.status(201).json({ success: true, data: apiKey });
  } catch (error) {
    console.error('Erreur lors de la création de la clé API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/applications/:id/keys/:keyId
 * Révoquer une clé API d'une application
 */
router.delete('/:id/keys/:keyId', (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const keyId = parseInt(req.params.keyId);
    
    if (isNaN(appId) || isNaN(keyId)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    // Vérifier si l'application existe
    if (!applicationService.applicationExists(appId)) {
      return res.status(404).json({ success: false, error: 'Application non trouvée' });
    }
    
    // Vérifier si la clé appartient à l'application
    const apiKey = apiKeyService.getApiKeyById(keyId);
    if (!apiKey || apiKey.app_id !== appId) {
      return res.status(404).json({ success: false, error: 'Clé API non trouvée pour cette application' });
    }
    
    // Révoquer la clé
    const result = apiKeyService.revokeApiKey(keyId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la révocation de la clé API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;