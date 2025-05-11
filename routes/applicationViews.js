/**
 * Routes pour les vues des applications
 */
const express = require('express');
const router = express.Router();
const db = require('../src/services/dbService');
const conversionLogService = require('../src/services/conversionLogService');
const authCombined = require('../middleware/authCombined');

// Toutes les routes nécessitent une authentification
router.use(authCombined);

/**
 * GET /applications
 * Page de gestion des applications
 */
router.get('/', async (req, res) => {
  res.render('applications', { 
    user: req.user,
    title: 'Applications' 
  });
});

/**
 * GET /applications/:id
 * Page de détail d'une application spécifique
 */
router.get('/:id', async (req, res) => {
  const appId = req.params.id;
  
  try {
    // Vérifier si l'application existe
    const app = await db.get('SELECT * FROM applications WHERE id = ?', [appId]);
    
    if (!app) {
      return res.redirect('/applications');
    }
    
    res.render('application-detail', { 
      user: req.user,
      title: `Application - ${app.name}`,
      app
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des détails de l\'application:', error);
    res.redirect('/applications');
  }
});

/**
 * GET /applications/:id/history
 * Page d'historique des conversions d'une application
 */
router.get('/:id/history', async (req, res) => {
  const appId = req.params.id;
  
  try {
    // Vérifier si l'application existe
    const app = await db.get('SELECT * FROM applications WHERE id = ?', [appId]);
    
    if (!app) {
      return res.redirect('/applications');
    }
    
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    
    // Obtenir les statistiques et l'historique des conversions
    const conversions = await conversionLogService.getConversions(appId, limit, page);
    const stats = await conversionLogService.getAppStats(appId);
    
    res.render('application-history', { 
      user: req.user,
      title: `Historique - ${app.name}`,
      app,
      conversions,
      stats,
      page,
      limit
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique des conversions:', error);
    res.redirect(`/applications/${appId}`);
  }
});

module.exports = router;