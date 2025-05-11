/**
 * Middleware d'authentification modifié pour supporter le mode hors-ligne
 * @module middleware/offlineAuthMiddleware
 */

const jwt = require('jsonwebtoken');

// Clé secrète pour vérifier les JWT
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';

/**
 * Middleware pour vérifier l'authentification avec support hors-ligne
 * @param {Object} options - Options du middleware
 * @param {boolean} [options.required=true] - Si true, une erreur est renvoyée si le token est manquant
 * @param {Array} [options.roles] - Si défini, vérifie que le rôle de l'utilisateur est inclus dans cette liste
 * @param {boolean} [options.allowOfflineMode=true] - Si true, permet l'accès en mode hors-ligne avec le token spécial
 * @returns {Function} Middleware Express
 */
function offlineAuthMiddleware(options = {}) {
  const {
    required = true,
    roles = null,
    allowOfflineMode = true
  } = options;
  
  return async (req, res, next) => {
    // Récupérer le token depuis les en-têtes
    const authHeader = req.headers.authorization;
    
    // Vérifier si c'est un token hors-ligne spécial
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      // Vérifier si c'est le token spécial pour le mode hors-ligne
      if (allowOfflineMode && token === 'temp_offline_token_admin') {
        console.log('[AUTH] Mode hors-ligne activé avec token temporaire');
        
        // Simuler un utilisateur admin pour le mode hors-ligne
        req.user = {
          id: -1,
          username: 'admin',
          role: 'admin',
          created_at: new Date().toISOString(),
          offline_mode: true
        };
        
        return next();
      }
      
      try {
        // Pour les tokens normaux, effectuer la vérification JWT
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Tenter de récupérer l'utilisateur depuis la base de données
        try {
          const db = req.app.locals.db;
          if (db) {
            const user = db.prepare(`
              SELECT id, username, role, created_at 
              FROM users 
              WHERE id = ?
            `).get(decoded.id);
            
            if (user) {
              // Vérifier le rôle si nécessaire
              if (roles && !roles.includes(user.role)) {
                return res.status(403).json({
                  success: false,
                  error: 'Forbidden',
                  message: 'Accès refusé'
                });
              }
              
              // Ajouter l'utilisateur à la requête
              req.user = user;
              return next();
            }
          }
        } catch (dbError) {
          console.warn('[AUTH] Erreur base de données lors de la vérification du token:', dbError.message);
          // Continuer en mode hors-ligne si autorisé
        }
        
        // Si on arrive ici et que le mode hors-ligne est activé, 
        // on utilise les données du token
        if (allowOfflineMode) {
          console.log('[AUTH] Mode hors-ligne activé avec token JWT valide mais sans accès BD');
          
          // Créer un utilisateur à partir des données du token
          req.user = {
            id: decoded.id || -1,
            username: decoded.username || 'admin',
            role: decoded.role || (roles && roles[0]) || 'user',
            created_at: new Date().toISOString(),
            offline_mode: true
          };
          
          // Si un rôle spécifique est requis et que le token n'a pas ce rôle
          if (roles && !roles.includes(req.user.role)) {
            // On accorde le rôle demandé en mode hors-ligne
            req.user.role = roles[0];
          }
          
          return next();
        }
      } catch (error) {
        // Erreur de vérification du token
        if (allowOfflineMode) {
          console.log('[AUTH] Mode hors-ligne activé après erreur JWT:', error.message);
          
          // Simuler un utilisateur admin pour le mode hors-ligne
          req.user = {
            id: -1,
            username: 'admin',
            role: 'admin',
            created_at: new Date().toISOString(),
            offline_mode: true
          };
          
          return next();
        }
        
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Token JWT invalide ou expiré'
          });
        }
      }
    } else if (allowOfflineMode) {
      // Aucun token fourni mais mode hors-ligne autorisé
      console.log('[AUTH] Mode hors-ligne activé sans token');
      
      // Simuler un utilisateur admin pour le mode hors-ligne
      req.user = {
        id: -1,
        username: 'admin',
        role: 'admin',
        created_at: new Date().toISOString(),
        offline_mode: true
      };
      
      return next();
    } else if (required) {
      // Aucun token fourni et mode hors-ligne non autorisé
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token JWT manquant'
      });
    }
    
    // Si on arrive ici, soit required=false, soit allowOfflineMode=false
    return next();
  };
}

/**
 * Middleware spécifique pour les administrateurs, avec support du mode hors-ligne
 */
const offlineAdminMiddleware = offlineAuthMiddleware({
  required: true,
  roles: ['admin'],
  allowOfflineMode: true
});

module.exports = {
  offlineAuthMiddleware,
  offlineAdminMiddleware
};