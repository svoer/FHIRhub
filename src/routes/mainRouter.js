/**
 * Router principal de l'API FHIRHub
 * Configure les routes pour tous les services de l'API
 */

const express = require('express');
const router = express.Router();
const apiKeyRouter = require('./apiKeyRouter');
const applicationRouter = require('./applicationRouter');
const { tempApiAuth } = require('../middleware/authMiddleware');

// Route racine de l'API
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API FHIRHub - Service de conversion HL7 vers FHIR',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// Route de documentation
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    message: 'Documentation de l\'API FHIRHub',
    routes: {
      '/api': 'Informations sur l\'API',
      '/api/docs': 'Documentation de l\'API',
      '/api/health': 'État de santé de l\'API',
      '/api/convert': 'Convertir un message HL7 en FHIR',
      '/api/applications': 'Gestion des applications',
      '/api/keys': 'Gestion des clés API',
      '/api/stats': 'Statistiques de l\'API'
    }
  });
});

// Route de vérification de l'état de santé
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Route pour récupérer des statistiques système
router.get('/stats', tempApiAuth, async (req, res) => {
  try {
    // TODO: Implémenter des statistiques système réelles
    const stats = {
      system: {
        memory: {
          total: process.memoryUsage().heapTotal / 1024 / 1024,
          used: process.memoryUsage().heapUsed / 1024 / 1024,
          external: process.memoryUsage().external / 1024 / 1024,
          rss: process.memoryUsage().rss / 1024 / 1024
        },
        uptime: process.uptime(),
        loadAverage: process.cpuUsage()
      },
      api: {
        conversions: {
          total: 0,
          success: 0,
          error: 0,
          averageTime: 0
        },
        requests: {
          total: 0,
          lastHour: 0,
          lastDay: 0
        },
        keys: {
          total: 0,
          active: 0,
          revoked: 0
        },
        applications: {
          total: 0,
          active: 0,
          inactive: 0
        }
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[MAIN-ROUTER] Erreur lors de la récupération des statistiques:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur interne',
      message: 'Une erreur est survenue lors de la récupération des statistiques'
    });
  }
});

// Route temporaire pour la conversion HL7 vers FHIR (sera remplacée par une route dédiée)
router.post('/convert', tempApiAuth, (req, res) => {
  // Cette route sera implémentée dans un routeur dédié plus tard
  res.status(200).json({
    success: true,
    message: 'Conversion en cours de développement',
    data: {
      source: req.body.hl7 || 'Message HL7 non fourni',
      result: {
        resourceType: 'Bundle',
        type: 'collection',
        entry: []
      }
    }
  });
});

// Routes pour les conversions
// TODO: Implémenter le routeur de conversion complet
// router.use('/convert', conversionRouter);

// Routes pour les applications
router.use('/applications', applicationRouter);

// Routes pour les clés API
router.use('/keys', apiKeyRouter);

// Routes pour les journaux de conversion
// TODO: Implémenter le routeur de journaux de conversion
// router.use('/logs', logsRouter);

// Routes pour les terminologies
// TODO: Implémenter le routeur de terminologies
// router.use('/terminology', terminologyRouter);

// Gestion des routes non trouvées
router.use('/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    message: `La route ${req.originalUrl} n'existe pas`
  });
});

module.exports = router;