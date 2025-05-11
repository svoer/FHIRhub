/**
 * Configuration et exposition des routes API de FHIRHub
 */

const express = require('express');
const router = express.Router();
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const statsRoutes = require('./routes/statsRoutes');
const converterRoutes = require('./routes/converterRoutes');
const apiKeyAuth = require('./middleware/apiKeyMiddleware');

// Middleware pour analyser les cookies
router.use(cookieParser());

// Endpoint racine pour vérifier que l'API est en ligne
router.get('/', (req, res) => {
  res.json({
    name: 'FHIRHub API',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Endpoint de statut (pour les vérifications de santé)
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Monter les routes d'authentification
router.use('/auth', authRoutes);

// Monter les routes de gestion des applications
router.use('/applications', applicationRoutes);

// Monter les routes de statistiques
router.use('/stats', statsRoutes);

// Monter les routes de conversion
router.use('/', converterRoutes);

// Gestion des erreurs 404
router.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: `La route ${req.method} ${req.originalUrl} n'existe pas`
  });
});

// Gestion des erreurs globales
router.use((err, req, res, next) => {
  console.error('[API] Erreur non gérée:', err);
  
  // Si l'erreur vient de multer (téléchargement de fichier)
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: 'Erreur de téléchargement',
      message: err.message
    });
  }
  
  // Erreur générique
  res.status(500).json({
    error: 'Erreur serveur',
    message: 'Une erreur interne est survenue',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;