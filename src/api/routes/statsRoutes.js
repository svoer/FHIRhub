/**
 * Routes de statistiques et de journaux de conversion
 */

const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authenticated, adminRequired } = require('../middleware/authMiddleware');

// Toutes les routes nécessitent une authentification
router.use(authenticated);

// Routes des statistiques
router.get('/summary', statsController.getStatsSummary);
router.get('/metrics', statsController.getDashboardMetrics);

// Routes des logs de conversion
router.get('/logs', statsController.getConversionLogs);
router.get('/logs/:id', statsController.getConversionLogById);

// Routes administrateur pour la maintenance
router.post('/logs/cleanup', adminRequired, statsController.cleanupOldLogs);
router.post('/metrics/update', adminRequired, statsController.updateDashboardMetrics);

module.exports = router;