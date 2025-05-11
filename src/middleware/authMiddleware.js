/**
 * Middleware d'authentification utilisateur pour FHIRHub
 * Vérifie que l'utilisateur est authentifié et a les permissions nécessaires
 */

const jwt = require('jsonwebtoken');
const dbService = require('../services/dbService');

// Clé secrète pour JWT (à déplacer dans une variable d'environnement en production)
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-jwt-secret-key';

/**
 * Middleware pour vérifier si l'utilisateur est authentifié
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction suivante dans la chaîne de middleware
 * @returns {void}
 */
function isAuthenticated(req, res, next) {
  try {
    // Vérifier si le mode développement est activé
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      console.log('[AUTH-MIDDLEWARE] Mode développement: authentification contournée');
      
      // Définir un utilisateur fictif pour le développement
      req.user = {
        id: 1,
        username: 'admin',
        role: 'admin'
      };
      
      return next();
    }
    
    // Récupérer le token JWT depuis les cookies, l'en-tête Authorization ou les paramètres de requête
    const token = req.cookies.token || 
                  (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null) || 
                  req.query.token;
    
    // Si aucun token n'est fourni, renvoyer une erreur
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise',
        message: 'Vous devez être connecté pour accéder à cette ressource'
      });
    }
    
    // Vérifier et décoder le token JWT
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
          error: 'Session invalide',
          message: 'Votre session a expiré ou est invalide, veuillez vous reconnecter'
        });
      }
      
      try {
        // Vérifier si l'utilisateur existe dans la base de données
        const user = await dbService.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Utilisateur non trouvé',
            message: 'L\'utilisateur associé à cette session n\'existe plus'
          });
        }
        
        // Stocker les informations de l'utilisateur dans la requête
        req.user = user;
        
        // Mettre à jour la date de dernière connexion
        await dbService.run(
          'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
          [user.id]
        );
        
        next();
      } catch (error) {
        console.error('[AUTH-MIDDLEWARE] Erreur lors de la vérification de l\'utilisateur:', error);
        
        return res.status(500).json({
          success: false,
          error: 'Erreur d\'authentification',
          message: 'Une erreur est survenue lors de la vérification de l\'authentification'
        });
      }
    });
  } catch (error) {
    console.error('[AUTH-MIDDLEWARE] Erreur lors de l\'authentification:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Erreur d\'authentification',
      message: 'Une erreur est survenue lors de l\'authentification'
    });
  }
}

/**
 * Middleware pour vérifier si l'utilisateur est un administrateur
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction suivante dans la chaîne de middleware
 * @returns {void}
 */
function isAdmin(req, res, next) {
  // L'utilisateur doit être authentifié
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentification requise',
      message: 'Vous devez être connecté pour accéder à cette ressource'
    });
  }
  
  // Vérifier si l'utilisateur est un administrateur
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Accès refusé',
      message: 'Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource'
    });
  }
  
  // L'utilisateur est un administrateur, autoriser l'accès
  next();
}

/**
 * Middleware pour vérifier les permissions utilisateur
 * @param {string[]} permissions - Liste des permissions requises
 * @returns {Function} Middleware Express
 */
function hasPermission(permissions) {
  return (req, res, next) => {
    // L'utilisateur doit être authentifié
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise',
        message: 'Vous devez être connecté pour accéder à cette ressource'
      });
    }
    
    // Les administrateurs ont toutes les permissions
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Vérifier si l'utilisateur a au moins une des permissions requises
    // Note: Ce code est un placeholder, car nous n'avons pas encore de système de permissions détaillé
    const hasRequiredPermission = permissions.some(permission => {
      return req.user.role === permission;
    });
    
    if (!hasRequiredPermission) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource'
      });
    }
    
    // L'utilisateur a les permissions nécessaires, autoriser l'accès
    next();
  };
}

/**
 * Générer un token JWT pour un utilisateur
 * @param {Object} user - Utilisateur pour lequel générer le token
 * @param {Object} options - Options pour le token (expiresIn, etc.)
 * @returns {string} Token JWT
 */
function generateToken(user, options = {}) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };
  
  // Définir une durée d'expiration par défaut (24 heures)
  const tokenOptions = {
    expiresIn: '24h',
    ...options
  };
  
  return jwt.sign(payload, JWT_SECRET, tokenOptions);
}

/**
 * Middleware pour l'authentification API temporaire (à utiliser pendant le développement)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction suivante dans la chaîne de middleware
 * @returns {void}
 */
function tempApiAuth(req, res, next) {
  // Récupérer la clé API depuis les paramètres de requête ou les en-têtes
  const apiKey = req.query.apiKey || req.headers['x-api-key'];
  
  // Si aucune clé API n'est fournie, renvoyer une erreur
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Authentification requise',
      message: 'Une clé API valide est requise pour accéder à cette ressource'
    });
  }
  
  // Clé de développement pour les tests
  if (apiKey === 'dev-key' && process.env.NODE_ENV !== 'production') {
    req.apiKey = {
      id: 0,
      key: 'dev-key',
      name: 'Clé de développement',
      application_id: 1,
      environment: 'development'
    };
    
    return next();
  }
  
  // Pour d'autres clés API, vérifier dans la base de données
  // Cette partie sera implémentée ultérieurement
  
  // Autoriser toutes les clés en mode développement
  if (process.env.NODE_ENV === 'development') {
    req.apiKey = {
      id: 999,
      key: apiKey,
      name: 'Clé temporaire',
      application_id: 1,
      environment: 'development'
    };
    
    return next();
  }
  
  // En mode production, refuser les clés non reconnues
  return res.status(401).json({
    success: false,
    error: 'Clé API invalide',
    message: 'La clé API fournie est invalide ou a expiré'
  });
}

module.exports = {
  isAuthenticated,
  isAdmin,
  hasPermission,
  generateToken,
  tempApiAuth
};