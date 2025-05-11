/**
 * Middleware d'authentification par clé API
 * Vérifie la présence d'une clé API valide dans l'en-tête X-API-KEY
 */

/**
 * Middleware pour vérifier l'authentification par clé API
 * @param {Object} options - Options du middleware
 * @param {boolean} [options.required=true] - Si true, une erreur est renvoyée si la clé est manquante
 * @param {boolean} [options.updateLastUsed=true] - Si true, met à jour la date de dernière utilisation
 * @returns {Function} Middleware Express
 */
function apiKeyAuth(options = {}) {
  const {
    required = true,
    updateLastUsed = true
  } = options;
  
  return async (req, res, next) => {
    // Récupérer la clé API depuis les en-têtes
    const apiKey = req.header('X-API-KEY');
    
    if (!apiKey && required) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Clé API manquante'
      });
    }
    
    // Si la clé est facultative et manquante, continuer
    if (!apiKey && !required) {
      return next();
    }
    
    try {
      // Vérifier la clé dans la base de données
      const db = req.app.locals.db;
      // Utiliser hashed_key qui existe selon la structure réelle de la table
      const hashedKey = hashValue(apiKey);
      const keyData = db.prepare(`
        SELECT 
          ak.id, ak.application_id, ak.key, ak.is_active, ak.expires_at,
          a.name as app_name, a.cors_origins, a.settings
        FROM api_keys ak
        JOIN applications a ON ak.application_id = a.id
        WHERE ak.hashed_key = ? AND ak.is_active = 1
      `).get(hashedKey);
      
      if (!keyData) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Clé API invalide'
          });
        } else {
          return next();
        }
      }
      
      // Vérifier si la clé a expiré
      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Clé API expirée'
          });
        } else {
          return next();
        }
      }
      
      // Mettre à jour la date de dernière utilisation si nécessaire
      if (updateLastUsed) {
        db.prepare(`
          UPDATE api_keys
          SET last_used_at = datetime('now')
          WHERE id = ?
        `).run(keyData.id);
      }
      
      // Ajouter les informations de clé API à la requête
      req.apiKey = keyData;
      req.application = {
        id: keyData.application_id,
        name: keyData.app_name,
        settings: keyData.settings ? JSON.parse(keyData.settings) : {},
        corsOrigins: keyData.cors_origins ? keyData.cors_origins.split(',') : []
      };
      
      next();
    } catch (error) {
      console.error('[API KEY AUTH]', error);
      
      if (required) {
        res.status(500).json({
          success: false,
          error: 'Server Error',
          message: 'Erreur lors de la vérification de la clé API'
        });
      } else {
        next();
      }
    }
  };
}

// Fonction pour hacher une valeur (comme celle utilisée pour générer hashed_key)
function hashValue(value) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = apiKeyAuth;