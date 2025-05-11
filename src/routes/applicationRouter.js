/**
 * Router pour la gestion des applications
 * Gère les routes pour la création, récupération, mise à jour et suppression des applications
 */

const express = require('express');
const router = express.Router();
const applicationService = require('../services/applicationService');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

/**
 * @route GET /api/applications
 * @desc Récupérer toutes les applications
 * @access Privé
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Construire les options de filtrage à partir des paramètres de requête
    const options = {
      owner_id: req.query.owner_id ? parseInt(req.query.owner_id) : null,
      status: req.query.status,
      search: req.query.search,
      orderBy: req.query.orderBy || 'created_at',
      order: req.query.order || 'DESC',
      limit: req.query.limit ? parseInt(req.query.limit) : null,
      offset: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 20) : null
    };
    
    // Si l'utilisateur n'est pas un administrateur, filtrer par owner_id
    if (req.user.role !== 'admin') {
      options.owner_id = req.user.id;
    }
    
    const applications = await applicationService.getAllApplications(options);
    
    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la récupération des applications:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des applications',
      message: error.message
    });
  }
});

/**
 * @route GET /api/applications/:id
 * @desc Récupérer une application par son ID
 * @access Privé
 */
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    const application = await applicationService.getApplication(applicationId);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée',
        message: `Aucune application trouvée avec l'ID ${applicationId}`
      });
    }
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    if (req.user.role !== 'admin' && application.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'êtes pas autorisé à accéder à cette application'
      });
    }
    
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la récupération de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'application',
      message: error.message
    });
  }
});

/**
 * @route GET /api/applications/:id/stats
 * @desc Récupérer les statistiques d'une application
 * @access Privé
 */
router.get('/:id/stats', isAuthenticated, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    
    // Vérifier si l'application existe
    const application = await applicationService.getApplication(applicationId);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée',
        message: `Aucune application trouvée avec l'ID ${applicationId}`
      });
    }
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    if (req.user.role !== 'admin' && application.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'êtes pas autorisé à accéder à cette application'
      });
    }
    
    // Récupérer les statistiques
    const stats = await applicationService.getApplicationStats(applicationId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la récupération des statistiques de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques de l\'application',
      message: error.message
    });
  }
});

/**
 * @route POST /api/applications
 * @desc Créer une nouvelle application
 * @access Privé
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { name, description, status } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Données incomplètes',
        message: 'Le nom de l\'application est obligatoire'
      });
    }
    
    // Par défaut, l'utilisateur est le propriétaire de l'application
    const appData = {
      name,
      description: description || '',
      status: status || 'active',
      owner_id: req.user.id
    };
    
    const newApplication = await applicationService.createApplication(appData);
    
    res.status(201).json({
      success: true,
      message: 'Application créée avec succès',
      data: newApplication
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la création de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de l\'application',
      message: error.message
    });
  }
});

/**
 * @route PUT /api/applications/:id
 * @desc Mettre à jour une application
 * @access Privé
 */
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    const updateData = req.body;
    
    // Vérifier si l'application existe
    const existingApp = await applicationService.getApplication(applicationId);
    
    if (!existingApp) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée',
        message: `Aucune application trouvée avec l'ID ${applicationId}`
      });
    }
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    if (req.user.role !== 'admin' && existingApp.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'êtes pas autorisé à modifier cette application'
      });
    }
    
    // Interdire la modification du propriétaire pour les non-administrateurs
    if (updateData.owner_id && req.user.role !== 'admin') {
      delete updateData.owner_id;
    }
    
    // Mettre à jour l'application
    await applicationService.updateApplication(applicationId, updateData);
    
    // Récupérer l'application mise à jour
    const updatedApp = await applicationService.getApplication(applicationId);
    
    res.json({
      success: true,
      message: 'Application mise à jour avec succès',
      data: updatedApp
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la mise à jour de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour de l\'application',
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/applications/:id
 * @desc Supprimer une application
 * @access Privé
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    
    // Vérifier si l'application existe
    const existingApp = await applicationService.getApplication(applicationId);
    
    if (!existingApp) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée',
        message: `Aucune application trouvée avec l'ID ${applicationId}`
      });
    }
    
    // Vérifier si l'utilisateur est un administrateur ou le propriétaire de l'application
    if (req.user.role !== 'admin' && existingApp.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'êtes pas autorisé à supprimer cette application'
      });
    }
    
    // Supprimer l'application
    const deleted = await applicationService.deleteApplication(applicationId);
    
    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: 'Échec de la suppression',
        message: 'L\'application n\'a pas pu être supprimée'
      });
    }
    
    res.json({
      success: true,
      message: 'Application supprimée avec succès',
      data: {
        id: applicationId
      }
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la suppression de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de l\'application',
      message: error.message
    });
  }
});

module.exports = router;