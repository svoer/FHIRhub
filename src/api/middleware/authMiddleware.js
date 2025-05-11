/**
 * Middleware d'authentification JWT pour l'interface d'administration
 * Vérifie que les requêtes contiennent un token JWT valide
 */

const authService = require('../../services/authService');

/**
 * Extraire le token JWT de la requête
 * @param {Object} req - Requête Express
 * @returns {string|null} Token JWT ou null si non trouvé
 */
function extractToken(req) {
  // Chercher dans le header Authorization (Bearer token)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Enlever 'Bearer '
  }
  
  // Chercher dans les cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  // Aucun token trouvé
  return null;
}

/**
 * Middleware pour vérifier l'authentification JWT
 * @param {Object} options - Options du middleware
 * @returns {Function} Middleware Express
 */
function jwtAuth(options = {}) {
  const { 
    required = true, // Si true, une erreur est retournée si pas de token
    roles = null     // Tableau de rôles autorisés (null = tous les rôles)
  } = options;
  
  return async (req, res, next) => {
    try {
      // Extraire le token
      const token = extractToken(req);
      
      // Si aucun token n'est fourni
      if (!token) {
        // Si le token est requis, retourner une erreur
        if (required) {
          return res.status(401).json({
            error: 'Authentification requise',
            message: 'Vous devez être connecté pour accéder à cette ressource'
          });
        }
        
        // Sinon, continuer sans authentification
        req.auth = { authenticated: false };
        return next();
      }
      
      // Vérifier et décoder le token
      const decoded = authService.verifyToken(token);
      
      // Si le token est invalide
      if (!decoded) {
        return res.status(401).json({
          error: 'Token invalide',
          message: 'Votre session a expiré ou est invalide, veuillez vous reconnecter'
        });
      }
      
      // Vérifier les rôles si nécessaire
      if (roles && !roles.includes(decoded.role)) {
        return res.status(403).json({
          error: 'Accès refusé',
          message: 'Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource'
        });
      }
      
      // Récupérer les informations de l'utilisateur
      const user = await authService.getUserById(decoded.sub);
      
      // Vérifier si l'utilisateur existe toujours et est actif
      if (!user || !user.active) {
        return res.status(401).json({
          error: 'Compte désactivé',
          message: 'Votre compte a été désactivé ou supprimé'
        });
      }
      
      // Enregistrer les informations d'authentification dans la requête
      req.auth = { 
        authenticated: true,
        userId: user.id,
        username: user.username,
        role: user.role,
        user: user
      };
      
      // Continuer le traitement de la requête
      next();
    } catch (error) {
      console.error('[AUTH] Erreur lors de l\'authentification JWT:', error);
      res.status(500).json({
        error: 'Erreur serveur',
        message: 'Une erreur est survenue lors de l\'authentification'
      });
    }
  };
}

// Middleware pour vérifier si l'utilisateur est administrateur
const adminRequired = jwtAuth({ roles: ['admin'] });

// Middleware pour vérifier l'authentification sans rôle spécifique
const authenticated = jwtAuth();

// Middleware optionnel qui attache les informations d'authentification si présentes
const optional = jwtAuth({ required: false });

module.exports = {
  jwtAuth,
  adminRequired,
  authenticated,
  optional
};