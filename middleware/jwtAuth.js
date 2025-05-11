/**
 * Middleware d'authentification JWT
 * Vérifie la présence d'un token JWT valide dans les en-têtes d'autorisation
 */
const jwt = require('jsonwebtoken');

// Clé secrète pour vérifier les JWT (à déplacer dans une variable d'environnement en production)
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';

/**
 * Middleware pour vérifier l'authentification JWT
 * @param {Object} options - Options du middleware
 * @param {boolean} [options.required=true] - Si true, une erreur est renvoyée si le token est manquant
 * @param {Array} [options.roles] - Si défini, vérifie que le rôle de l'utilisateur est inclus dans cette liste
 * @returns {Function} Middleware Express
 */
function jwtAuth(options = {}) {
  const {
    required = true,
    roles = null
  } = options;
  
  return async (req, res, next) => {
    // Récupérer le token depuis les en-têtes
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (required) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Token JWT manquant'
        });
      } else {
        return next();
      }
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      // Vérifier et décoder le token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Récupérer l'utilisateur depuis la base de données
      const db = req.app.locals.db;
      const user = db.prepare(`
        SELECT id, username, role, created_at 
        FROM users 
        WHERE id = ?
      `).get(decoded.id);
      
      if (!user) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Utilisateur non trouvé'
          });
        } else {
          return next();
        }
      }
      
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
      
      next();
    } catch (error) {
      if (required) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Token JWT invalide ou expiré'
        });
      } else {
        next();
      }
    }
  };
}

module.exports = jwtAuth;