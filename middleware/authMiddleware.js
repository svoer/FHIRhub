/**
 * Middleware d'authentification pour les routes protégées
 * Permet de restreindre l'accès aux routes en fonction du rôle de l'utilisateur
 * 
 * @module middleware/authMiddleware
 */

const dbService = require('../src/services/dbService');

/**
 * Middleware qui vérifie si l'utilisateur est authentifié ou si une clé API valide est fournie
 * @returns {Function} Middleware Express
 */
async function authenticatedOrApiKey(req, res, next) {
  // Vérifier si une clé API est fournie dans les headers
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    try {
      // Vérifier si la clé API est valide
      const keyData = await dbService.query(`
          SELECT ak.*, a.name as app_name
          FROM api_keys ak
          JOIN applications a ON ak.application_id = a.id
          WHERE ak.key = ? AND ak.is_active = 1`,
        [apiKey]
      );
      
      if (keyData && keyData.length > 0) {
        // Clé API valide, on continue
        req.apiKey = keyData[0];
        return next();
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la clé API:', error);
    }
  }
  
  // Si pas de clé API valide, on vérifie l'authentification classique
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  // Ni clé API ni authentification
  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Authentification ou clé API valide requise'
  });
}

/**
 * Middleware qui vérifie si l'utilisateur est authentifié
 * @returns {Function} Middleware Express
 */
function authenticated(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentification requise'
    });
  }
  
  next();
}

/**
 * Middleware qui vérifie si l'utilisateur est un administrateur
 * @returns {Function} Middleware Express
 */
function adminRequired(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentification requise'
    });
  }
  
  // Vérifier si l'utilisateur est un administrateur
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Vous devez être administrateur pour accéder à cette ressource'
    });
  }
  
  next();
}

module.exports = {
  authenticated,
  adminRequired,
  authenticatedOrApiKey
};