/**
 * Middleware d'authentification par clé API pour FHIRHub
 * Vérifie la validité de la clé API fournie dans les requêtes
 */

const apiKeyService = require('../services/apiKeyService');

/**
 * Middleware pour vérifier l'authentification par clé API
 * @returns {Function} Middleware Express
 */
function apiKeyAuth() {
  return async (req, res, next) => {
    try {
      // Récupérer la clé API depuis les paramètres de requête, les en-têtes ou le corps de la requête
      const apiKey = req.query.apiKey || req.query.api_key || 
                    req.headers['x-api-key'] || req.body.apiKey;
      
      // Si aucune clé API n'est fournie, renvoyer une erreur
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Authentification requise',
          message: 'Une clé API valide est requise pour accéder à cette ressource'
        });
      }
      
      // Vérifier la validité de la clé API
      const keyInfo = await apiKeyService.verifyApiKey(apiKey);
      
      // Si la clé API n'est pas valide, renvoyer une erreur
      if (!keyInfo) {
        return res.status(401).json({
          success: false,
          error: 'Clé API invalide',
          message: 'La clé API fournie est invalide, expirée ou a dépassé les limites d\'utilisation'
        });
      }
      
      // Stocker les informations de la clé API dans la requête pour une utilisation ultérieure
      req.apiKey = keyInfo;
      
      // Continuer le traitement de la requête
      next();
    } catch (error) {
      console.error('[API-KEY-AUTH] Erreur lors de la vérification de la clé API:', error);
      
      // En mode développement, autoriser les requêtes avec la clé de développement malgré les erreurs
      if ((req.query.apiKey === 'dev-key' || req.headers['x-api-key'] === 'dev-key') && 
          process.env.NODE_ENV !== 'production') {
        console.log('[API-KEY-AUTH] Mode développement: authentification contournée malgré l\'erreur');
        
        req.apiKey = {
          id: 0,
          key: 'dev-key',
          name: 'Clé de développement',
          environment: 'development',
          application_id: 1,
          active: true,
          isDevKey: true,
          error: error.message
        };
        
        return next();
      }
      
      return res.status(500).json({
        success: false,
        error: 'Erreur d\'authentification',
        message: 'Une erreur est survenue lors de la vérification de la clé API'
      });
    }
  };
}

/**
 * Middleware pour vérifier l'environnement de la clé API
 * @param {string|string[]} allowedEnvironments - Environnement(s) autorisé(s)
 * @returns {Function} Middleware Express
 */
function requireEnvironment(allowedEnvironments) {
  // Convertir un seul environnement en tableau
  const environments = Array.isArray(allowedEnvironments) ? allowedEnvironments : [allowedEnvironments];
  
  return (req, res, next) => {
    // Vérifier si la requête a une clé API valide
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise',
        message: 'Une clé API valide est requise pour accéder à cette ressource'
      });
    }
    
    // Vérifier si l'environnement de la clé API est autorisé
    if (!environments.includes(req.apiKey.environment)) {
      return res.status(403).json({
        success: false,
        error: 'Environnement non autorisé',
        message: `Cette ressource nécessite une clé API d'environnement ${environments.join(' ou ')}`
      });
    }
    
    // Environnement autorisé, continuer le traitement de la requête
    next();
  };
}

/**
 * Middleware pour vérifier les limites de taux d'utilisation de la clé API
 * @param {Object} options - Options de limitation de taux
 * @returns {Function} Middleware Express
 */
function rateLimit(options = {}) {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,  // 15 minutes par défaut
    max: 100,                  // 100 requêtes par fenêtre par défaut
    message: 'Trop de requêtes, veuillez réessayer plus tard'
  };
  
  // Fusionner les options par défaut avec les options fournies
  const opts = { ...defaultOptions, ...options };
  
  // Stocker les compteurs d'utilisation dans la mémoire
  const requestCounts = new Map();
  
  // Nettoyer les compteurs expirés toutes les minutes
  setInterval(() => {
    const now = Date.now();
    
    for (const [key, value] of requestCounts.entries()) {
      if (now - value.startTime > opts.windowMs) {
        requestCounts.delete(key);
      }
    }
  }, 60 * 1000);
  
  return (req, res, next) => {
    // Vérifier si la requête a une clé API valide
    if (!req.apiKey) {
      return next();
    }
    
    // Utiliser l'ID de la clé API comme clé pour le compteur
    const keyId = req.apiKey.id || req.apiKey.key;
    
    // Récupérer ou initialiser le compteur pour cette clé API
    if (!requestCounts.has(keyId)) {
      requestCounts.set(keyId, {
        count: 0,
        startTime: Date.now()
      });
    }
    
    const counter = requestCounts.get(keyId);
    
    // Réinitialiser le compteur si la fenêtre est passée
    if (Date.now() - counter.startTime > opts.windowMs) {
      counter.count = 0;
      counter.startTime = Date.now();
    }
    
    // Incrémenter le compteur
    counter.count++;
    
    // Vérifier si la limite est dépassée
    if (counter.count > opts.max) {
      return res.status(429).json({
        success: false,
        error: 'Limite de taux dépassée',
        message: opts.message
      });
    }
    
    // Ajouter les en-têtes de limitation de taux
    res.setHeader('X-RateLimit-Limit', opts.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, opts.max - counter.count));
    res.setHeader('X-RateLimit-Reset', counter.startTime + opts.windowMs);
    
    // Continue le traitement de la requête
    next();
  };
}

/**
 * Middleware pour journaliser les requêtes API
 * @returns {Function} Middleware Express
 */
function apiActivityLogger() {
  return (req, res, next) => {
    // Stocker l'heure de début de la requête
    const startTime = Date.now();
    
    // Enregistrer la requête une fois terminée
    res.on('finish', () => {
      // Ne rien faire si la requête n'a pas de clé API
      if (!req.apiKey) {
        return;
      }
      
      // Calculer le temps de réponse
      const responseTime = Date.now() - startTime;
      
      // Journaliser l'activité dans la console
      console.log(`[API-ACTIVITY] ${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`);
      
      // TODO: Ajouter l'enregistrement dans la base de données
      // Cette fonctionnalité sera implémentée ultérieurement avec le service de journalisation API
    });
    
    // Continuer le traitement de la requête
    next();
  };
}

module.exports = {
  apiKeyAuth,
  requireEnvironment,
  rateLimit,
  apiActivityLogger
};