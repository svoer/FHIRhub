/**
 * Middleware d'authentification sécurisé pour les API
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';
const API_KEY_HEADER = 'x-api-key';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Connexion à la base de données
const dbPath = path.join(__dirname, '..', 'storage', 'db', 'fhirhub.db');
const db = new Database(dbPath);

// Logger simple
const logger = {
  debug: (msg) => console.log(`[DEBUG] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

/**
 * Middleware d'authentification sécurisé avec validation stricte des clés API
 */
const apiKeyAuth = (req, res, next) => {
  try {
    // 1. Vérifier d'abord l'authentification par JWT (prioritaire)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        return next();
      } catch (error) {
        logger.debug('JWT invalide, passage à la vérification par API Key');
      }
    }

    // 2. Validation stricte des clés API
    const apiKey = req.headers[API_KEY_HEADER];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Non autorisé',
        message: 'API Key ou JWT requis pour cette opération'
      });
    }

    // Validation du format de la clé
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      logger.warn(`[SECURITY] Clé API vide ou format invalide depuis ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Non autorisé',
        message: 'Format de clé API invalide'
      });
    }

    // Validation de la longueur (minimum 8 caractères)
    if (apiKey.length < 8 || apiKey.length > 128) {
      logger.warn(`[SECURITY] Longueur de clé API invalide (${apiKey.length} chars) depuis ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Non autorisé',
        message: 'Longueur de clé API invalide'
      });
    }

    // Validation des caractères autorisés
    const validKeyPattern = /^[a-zA-Z0-9\-_]+$/;
    if (!validKeyPattern.test(apiKey)) {
      logger.warn(`[SECURITY] Caractères non autorisés dans la clé API depuis ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Non autorisé',
        message: 'Caractères non autorisés dans la clé API'
      });
    }

    // Protection contre les injections
    const dangerousPatterns = [
      /[<>\"\']/,  // XSS
      /\.\./,      // Path traversal
      /union|select|insert|update|delete|drop/i,  // SQL injection
      /script|javascript|vbscript/i  // Script injection
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(apiKey)) {
        logger.warn(`[SECURITY] Tentative d'injection détectée dans la clé API depuis ${req.ip}: ${apiKey.substring(0, 20)}...`);
        return res.status(401).json({
          success: false,
          error: 'Non autorisé',
          message: 'Clé API contient des caractères dangereux'
        });
      }
    }

    // Mode développement avec validation renforcée
    if (NODE_ENV === 'development' && apiKey === 'dev-key') {
      req.user = { id: 1, username: 'dev', isAdmin: true };
      return next();
    }

    // Recherche de la clé API dans la base de données avec protection SQL injection
    try {
      const query = `
        SELECT ak.*, a.name as app_name
        FROM api_keys ak
        JOIN applications a ON ak.application_id = a.id
        WHERE ak.key = ? AND ak.is_active = 1
      `;
      
      const apiKeyRecord = db.prepare(query).get(apiKey);
      
      if (!apiKeyRecord) {
        logger.warn(`[SECURITY] Tentative d'accès avec clé API invalide depuis ${req.ip}: ${apiKey.substring(0, 20)}...`);
        return res.status(401).json({
          success: false,
          error: 'Non autorisé',
          message: 'Clé API invalide ou expirée'
        });
      }

      // Vérifier l'expiration si définie
      if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
        logger.warn(`[SECURITY] Tentative d'accès avec clé API expirée depuis ${req.ip}`);
        return res.status(401).json({
          success: false,
          error: 'Non autorisé',
          message: 'Clé API expirée'
        });
      }

      // Récupérer les informations de l'utilisateur associé à l'application
      const userQuery = 'SELECT created_by FROM applications WHERE id = ?';
      const application = db.prepare(userQuery).get(apiKeyRecord.application_id);
      
      if (application && application.created_by) {
        const userInfoQuery = 'SELECT * FROM users WHERE id = ?';
        const userInfo = db.prepare(userInfoQuery).get(application.created_by);
        
        if (userInfo) {
          req.user = {
            id: userInfo.id,
            username: userInfo.username,
            isAdmin: userInfo.is_admin === 1,
            apiKey: apiKeyRecord,
            application: {
              id: apiKeyRecord.application_id,
              name: apiKeyRecord.app_name
            }
          };
          logger.debug(`[AUTH] API Key associée à l'utilisateur ${userInfo.username} (ID: ${userInfo.id})`);
        }
      }

      // Mettre à jour la date de dernière utilisation
      const updateQuery = 'UPDATE api_keys SET last_used = ? WHERE id = ?';
      db.prepare(updateQuery).run(new Date().toISOString(), apiKeyRecord.id);

      next();
    } catch (dbError) {
      logger.error(`[SECURITY] Erreur base de données lors de la validation de clé API: ${dbError.message}`);
      return res.status(500).json({
        success: false,
        error: 'Erreur du serveur',
        message: 'Erreur lors de la validation de l\'authentification'
      });
    }

  } catch (error) {
    logger.error(`[SECURITY] Erreur lors de la vérification de la clé API: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Erreur du serveur',
      message: 'Erreur lors de la vérification de l\'authentification'
    });
  }
};

/**
 * Middleware qui vérifie si l'utilisateur est admin
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction next d'Express
 */
const adminRequired = (req, res, next) => {
  try {
    // Vérifier d'abord si l'utilisateur est authentifié
    apiKeyAuth(req, res, () => {
      // En mode développement, considérer tous les utilisateurs comme admin
      if (process.env.NODE_ENV === 'development' || process.env.BYPASS_AUTH === 'true') {
        return next();
      }
      
      // Vérifier si l'utilisateur est admin
      if (req.user && req.user.role === 'admin') {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas les droits d\'administrateur nécessaires'
      });
    });
  } catch (error) {
    logger.error(`Erreur de vérification admin: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Erreur du serveur',
      message: 'Une erreur est survenue lors de la vérification des droits'
    });
  }
};

/**
 * Middleware combiné qui accepte soit JWT, soit API Key
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction next d'Express
 */
const authCombined = (req, res, next) => {
  // Si pas d'authentification nécessaire en développement
  if (process.env.NODE_ENV === 'development' || process.env.BYPASS_AUTH === 'true') {
    return next();
  }
  
  // Vérifier d'abord l'API Key
  const apiKey = req.headers[API_KEY_HEADER];
  if (apiKey) {
    if (apiKey === 'dev-key' || apiKey === process.env.API_KEY) {
      return next();
    }
  }
  
  // Si pas d'API Key valide, vérifier JWT
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        return next();
      } catch (error) {
        logger.debug('JWT invalide dans authCombined:', error.message);
      }
    }
    
    // Si nous avons une session, vérifier si l'utilisateur est connecté
    if (req.session && req.session.user) {
      return next();
    }
    
    // Aucune méthode d'authentification valide
    return res.status(401).json({
      success: false,
      error: 'Non autorisé',
      message: 'Authentification requise'
    });
  } catch (error) {
    logger.error(`Erreur d'authentification combinée: ${error.message}`);
    return res.status(401).json({
      success: false,
      error: 'Non autorisé',
      message: 'Authentification requise'
    });
  }
};

module.exports = {
  apiKeyAuth,
  adminRequired,
  authCombined
};