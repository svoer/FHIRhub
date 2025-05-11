/**
 * Routes pour la gestion des clés API
 * Fournit les endpoints API pour créer, gérer et valider des clés API
 */

const express = require('express');
const router = express.Router();
const apiKeyService = require('../services/apiKeyService');
const applicationService = require('../services/applicationService');

/**
 * GET /api/keys
 * Récupérer les clés API, filtrage possible par application
 */
router.get('/', (req, res) => {
  try {
    const appId = req.query.appId ? parseInt(req.query.appId) : null;
    
    if (appId) {
      // Vérifier si l'application existe
      if (!applicationService.applicationExists(appId)) {
        return res.status(404).json({ success: false, error: 'Application non trouvée' });
      }
      
      // Récupérer les clés pour cette application
      const apiKeys = apiKeyService.listApiKeys(appId, {
        active_only: req.query.active_only === 'true',
        environment: req.query.environment
      });
      
      return res.json({ success: true, data: apiKeys });
    }
    
    // Si aucun appId n'est fourni, récupérer toutes les clés
    return res.status(400).json({ 
      success: false, 
      error: 'L\'ID de l\'application est requis (appId)' 
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des clés API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/keys/:id
 * Récupérer une clé API par son ID
 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    const apiKey = apiKeyService.getApiKeyById(id);
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'Clé API non trouvée' });
    }
    
    res.json({ success: true, data: apiKey });
  } catch (error) {
    console.error('Erreur lors de la récupération de la clé API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/keys
 * Créer une nouvelle clé API
 */
router.post('/', (req, res) => {
  try {
    const { appId, name, description, environment, expiresAt } = req.body;
    
    if (!appId) {
      return res.status(400).json({ success: false, error: 'L\'ID de l\'application est requis' });
    }
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Le nom de la clé est requis' });
    }
    
    // Vérifier si l'application existe
    if (!applicationService.applicationExists(parseInt(appId))) {
      return res.status(404).json({ success: false, error: 'Application non trouvée' });
    }
    
    const apiKey = apiKeyService.createApiKey(parseInt(appId), {
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
 * PUT /api/keys/:id/revoke
 * Révoquer une clé API
 */
router.put('/:id/revoke', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    const result = apiKeyService.revokeApiKey(id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Clé API non trouvée' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la révocation de la clé API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/keys/:id/extend
 * Prolonger la validité d'une clé API
 */
router.put('/:id/extend', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    const days = req.body.days ? parseInt(req.body.days) : 30;
    if (isNaN(days) || days <= 0) {
      return res.status(400).json({ success: false, error: 'Nombre de jours invalide' });
    }
    
    const apiKey = apiKeyService.extendApiKeyValidity(id, days);
    
    res.json({ success: true, data: apiKey });
  } catch (error) {
    console.error('Erreur lors de la prolongation de la clé API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/keys/:id
 * Supprimer une clé API
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    
    const result = apiKeyService.deleteApiKey(id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Clé API non trouvée' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression de la clé API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/keys/validate
 * Valider une clé API
 */
router.post('/validate', (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'La clé API est requise' });
    }
    
    const validationResult = apiKeyService.validateApiKey(apiKey);
    
    if (!validationResult) {
      return res.status(401).json({ success: false, error: 'Clé API invalide' });
    }
    
    res.json({ success: true, data: validationResult });
  } catch (error) {
    console.error('Erreur lors de la validation de la clé API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;