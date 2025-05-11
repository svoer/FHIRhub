/**
 * Middleware combinant l'authentification JWT et API Key
 * Permet notamment aux administrateurs d'accéder aux routes protégées via Swagger
 * sans avoir à spécifier manuellement une clé API.
 * 
 * @module middleware/authCombined
 */

const jwt = require('jsonwebtoken');

/**
 * Vérifie si l'utilisateur est authentifié, quelle que soit sa méthode d'authentification
 * @returns {Function} Middleware Express
 */
function createAuthCombinedMiddleware() {
  // Renvoyer le middleware
  return function authCombinedMiddleware(req, res, next) {
    const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';
    
    try {
      // S'assurer que req.app et req.app.locals existent
      if (!req.app || !req.app.locals || !req.app.locals.db) {
        return res.status(500).json({
          success: false, 
          error: 'Server Configuration Error',
          message: 'Base de données non initialisée'
        });
      }
      
      const db = req.app.locals.db;
      
      // 1. Vérifier d'abord la présence d'un token JWT
      const authHeader = req.headers.authorization;
      let isJwtAuthenticated = false;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        try {
          // Vérifier et décoder le token
          const decoded = jwt.verify(token, JWT_SECRET);
          
          // Vérifier si l'utilisateur existe
          const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(decoded.id);
          
          if (user) {
            // Stocker les informations utilisateur
            req.user = user;
            req.isAuthenticated = function() { return true; };
            isJwtAuthenticated = true;
          }
        } catch (error) {
          // Erreur avec le JWT - on continue avec la vérification de l'API Key
          console.log('[AUTH] JWT invalide ou expiré, vérification de la clé API');
        }
      }
      
      // 2. Vérifier ensuite la présence d'une clé API si JWT non authentifié
      if (!isJwtAuthenticated) {
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
          // Définir isAuthenticated à false, mais ne pas bloquer
          // la requête ici pour permettre aux routes de gérer 
          // elles-mêmes leur logique d'authentification
          req.isAuthenticated = function() { return false; };
          return next();
        }
        
        // Vérifier si la clé API existe dans la base de données
        const keyData = db.prepare(`
          SELECT ak.*, a.name as app_name
          FROM api_keys ak
          JOIN applications a ON ak.application_id = a.id
          WHERE ak.key = ? AND ak.is_active = 1
        `).get(apiKey);
        
        if (!keyData) {
          req.isAuthenticated = function() { return false; };
          return next();
        }
        
        // Stocker les informations de l'application dans req pour utilisation ultérieure
        req.apiKeyData = keyData;
        req.isAuthenticated = function() { return true; };
        
        // Récupérer l'utilisateur associé à l'application pour les logs
        // Utilise le créateur de l'application comme utilisateur par défaut
        try {
          const appCreator = db.prepare(`SELECT created_by FROM applications WHERE id = ?`).get(keyData.application_id);
          if (appCreator && appCreator.created_by) {
            const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(appCreator.created_by);
            if (user) {
              // Stocker l'utilisateur associé à l'application pour les logs
              req.user = user;
              console.log(`[AUTH] API Key associée à l'utilisateur ${user.username} (ID: ${user.id})`);
            }
          }
        } catch (err) {
          console.error("[AUTH] Erreur lors de la récupération de l'utilisateur associé à l'application:", err);
        }
      }
      
      // Continuer avec la requête
      next();
    } catch (error) {
      console.error('[AUTH COMBINED]', error);
      
      return res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Erreur lors de l\'authentification'
      });
    }
  };
}

// Exporter directement une instance du middleware pour simplifier l'importation
module.exports = createAuthCombinedMiddleware();