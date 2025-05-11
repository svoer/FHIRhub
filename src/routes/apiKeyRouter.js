/**
 * Router pour la gestion des clés API
 * Gère les routes pour la création, récupération, mise à jour et suppression des clés API
 */

const express = require('express');
const router = express.Router();
const apiKeyService = require('../services/apiKeyService');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

/**
 * @route GET /api/keys
 * @desc Récupérer toutes les clés API
 * @access Privé (Admin uniquement)
 */
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const keys = await apiKeyService.getAllApiKeys();
    
    res.json({
      success: true,
      data: keys
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la récupération des clés API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des clés API',
      message: error.message
    });
  }
});

/**
 * @route GET /api/keys/stats
 * @desc Récupérer les statistiques d'utilisation des clés API
 * @access Privé (Admin uniquement)
 */
router.get('/stats', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const stats = await apiKeyService.getApiKeyStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la récupération des statistiques des clés API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques des clés API',
      message: error.message
    });
  }
});

/**
 * @route GET /api/keys/application/:id
 * @desc Récupérer toutes les clés API d'une application
 * @access Privé
 */
router.get('/application/:id', isAuthenticated, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    // Cette vérification sera implémentée ultérieurement avec le service d'applications
    
    const keys = await apiKeyService.getApiKeysByApplication(applicationId);
    
    res.json({
      success: true,
      data: keys
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la récupération des clés API par application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des clés API',
      message: error.message
    });
  }
});

/**
 * @route GET /api/keys/:id
 * @desc Récupérer une clé API par son ID
 * @access Privé
 */
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const keyId = parseInt(req.params.id);
    const key = await apiKeyService.getApiKey(keyId);
    
    if (!key) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `Aucune clé API trouvée avec l'ID ${keyId}`
      });
    }
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    // Cette vérification sera implémentée ultérieurement avec le service d'applications
    
    res.json({
      success: true,
      data: key
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la récupération de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la clé API',
      message: error.message
    });
  }
});

/**
 * @route POST /api/keys
 * @desc Créer une nouvelle clé API
 * @access Privé
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { application_id, name, environment, expires_at, rate_limit, ip_restrictions, daily_limit, monthly_limit } = req.body;
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    // Cette vérification sera implémentée ultérieurement avec le service d'applications
    
    if (!application_id || !name) {
      return res.status(400).json({
        success: false,
        error: 'Données incomplètes',
        message: 'Le nom et l\'identifiant de l\'application sont obligatoires'
      });
    }
    
    const keyData = {
      application_id,
      name,
      environment: environment || 'development',
      expires_at: expires_at || null,
      rate_limit: rate_limit || 100,
      ip_restrictions: ip_restrictions || null,
      daily_limit: daily_limit || 1000,
      monthly_limit: monthly_limit || 10000
    };
    
    const newKey = await apiKeyService.createApiKey(keyData);
    
    res.status(201).json({
      success: true,
      message: 'Clé API créée avec succès',
      data: newKey
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la création de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la clé API',
      message: error.message
    });
  }
});

/**
 * @route PUT /api/keys/:id
 * @desc Mettre à jour une clé API
 * @access Privé
 */
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const keyId = parseInt(req.params.id);
    const updateData = req.body;
    
    // Vérifier si la clé API existe
    const existingKey = await apiKeyService.getApiKey(keyId);
    
    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `Aucune clé API trouvée avec l'ID ${keyId}`
      });
    }
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    // Cette vérification sera implémentée ultérieurement avec le service d'applications
    
    // Mettre à jour la clé API
    await apiKeyService.updateApiKey(keyId, updateData);
    
    // Récupérer la clé API mise à jour
    const updatedKey = await apiKeyService.getApiKey(keyId);
    
    res.json({
      success: true,
      message: 'Clé API mise à jour avec succès',
      data: updatedKey
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la mise à jour de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour de la clé API',
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/keys/:id
 * @desc Supprimer une clé API
 * @access Privé
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const keyId = parseInt(req.params.id);
    
    // Vérifier si la clé API existe
    const existingKey = await apiKeyService.getApiKey(keyId);
    
    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `Aucune clé API trouvée avec l'ID ${keyId}`
      });
    }
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    // Cette vérification sera implémentée ultérieurement avec le service d'applications
    
    // Supprimer la clé API
    const deleted = await apiKeyService.deleteApiKey(keyId);
    
    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: 'Échec de la suppression',
        message: 'La clé API n\'a pas pu être supprimée'
      });
    }
    
    res.json({
      success: true,
      message: 'Clé API supprimée avec succès',
      data: {
        id: keyId
      }
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la suppression de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de la clé API',
      message: error.message
    });
  }
});

/**
 * @route POST /api/keys/:id/revoke
 * @desc Révoquer une clé API
 * @access Privé
 */
router.post('/:id/revoke', isAuthenticated, async (req, res) => {
  try {
    const keyId = parseInt(req.params.id);
    
    // Vérifier si la clé API existe
    const existingKey = await apiKeyService.getApiKey(keyId);
    
    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `Aucune clé API trouvée avec l'ID ${keyId}`
      });
    }
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    // Cette vérification sera implémentée ultérieurement avec le service d'applications
    
    // Révoquer la clé API
    const revoked = await apiKeyService.revokeApiKey(keyId);
    
    if (!revoked) {
      return res.status(500).json({
        success: false,
        error: 'Échec de la révocation',
        message: 'La clé API n\'a pas pu être révoquée'
      });
    }
    
    // Récupérer la clé API mise à jour
    const updatedKey = await apiKeyService.getApiKey(keyId);
    
    res.json({
      success: true,
      message: 'Clé API révoquée avec succès',
      data: updatedKey
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la révocation de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la révocation de la clé API',
      message: error.message
    });
  }
});

/**
 * @route POST /api/keys/verify
 * @desc Vérifier une clé API
 * @access Public
 */
router.post('/verify-key', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Données incomplètes',
        message: 'La clé API est obligatoire'
      });
    }
    
    const keyInfo = await apiKeyService.verifyApiKey(key);
    
    if (!keyInfo) {
      return res.status(401).json({
        success: false,
        error: 'Clé API invalide',
        message: 'La clé API fournie est invalide, expirée ou a dépassé les limites d\'utilisation'
      });
    }
    
    res.json({
      success: true,
      message: 'Clé API valide',
      data: {
        key: keyInfo.key,
        name: keyInfo.name,
        environment: keyInfo.environment,
        application_id: keyInfo.application_id,
        application_name: keyInfo.application_name
      }
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la vérification de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification de la clé API',
      message: error.message
    });
  }
});

module.exports = router;