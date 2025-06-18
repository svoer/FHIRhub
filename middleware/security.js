/**
 * Middleware de sécurité avancé pour FHIRHub
 * Protection contre les injections, XSS, et autres attaques
 */

const helmet = require('helmet');
const jwt = require('jsonwebtoken');

// Configuration des en-têtes de sécurité
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "localhost:*", "127.0.0.1:*"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Détection d'injections SQL
const sqlInjectionDetector = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\w*['"]\s*=\s*['"][^'"]*['"])/i,
    /(--|\/\*|\*\/|;)/,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bEXEC\b.*\bXP_)/i
  ];

  const checkValue = (value, path = '') => {
    if (typeof value === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          console.warn(`[SECURITY] Tentative d'injection SQL détectée: ${path} = ${value.substring(0, 100)}`);
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        if (checkValue(val, `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };

  // Vérifier tous les paramètres
  if (checkValue(req.query, 'query') || 
      checkValue(req.body, 'body') || 
      checkValue(req.params, 'params')) {
    return res.status(400).json({
      success: false,
      error: 'Requête non autorisée',
      message: 'Contenu suspect détecté dans la requête'
    });
  }

  next();
};

// Détection XSS
const xssDetector = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript\s*:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[^>]*javascript:/gi,
    /<\s*\/?\s*(script|iframe|object|embed|form|meta|link)\s*[^>]*>/gi
  ];

  const checkXSS = (value, path = '') => {
    if (typeof value === 'string') {
      for (const pattern of xssPatterns) {
        if (pattern.test(value)) {
          console.warn(`[SECURITY] Tentative XSS détectée: ${path} = ${value.substring(0, 100)}`);
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        if (checkXSS(val, `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkXSS(req.query, 'query') || 
      checkXSS(req.body, 'body') || 
      checkXSS(req.params, 'params')) {
    return res.status(400).json({
      success: false,
      error: 'Requête non autorisée',
      message: 'Contenu suspect détecté dans la requête'
    });
  }

  next();
};

// Validation stricte des en-têtes
const headerValidator = (req, res, next) => {
  // Vérifier la longueur des en-têtes
  const maxHeaderLength = 8192;
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string' && value.length > maxHeaderLength) {
      console.warn(`[SECURITY] En-tête trop long détecté: ${key}`);
      return res.status(400).json({
        success: false,
        error: 'En-tête invalide',
        message: 'Taille d\'en-tête dépassée'
      });
    }
  }

  // Vérifier les caractères dangereux dans les en-têtes
  const dangerousHeaderPatterns = /[\r\n\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string' && dangerousHeaderPatterns.test(value)) {
      console.warn(`[SECURITY] Caractères dangereux dans l'en-tête: ${key}`);
      return res.status(400).json({
        success: false,
        error: 'En-tête invalide',
        message: 'Caractères non autorisés dans les en-têtes'
      });
    }
  }

  next();
};

// Protection contre le path traversal
const pathTraversalProtection = (req, res, next) => {
  const pathTraversalPatterns = [
    /\.\./,
    /\/\.\./,
    /\.\.\//,
    /\\\.\\\.[\\/]/,
    /%2e%2e%2f/i,
    /%2e%2e%5c/i,
    /%2e%2e[\\/]/i
  ];

  const checkPath = (value) => {
    if (typeof value === 'string') {
      for (const pattern of pathTraversalPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkPath(req.url) || checkPath(req.path)) {
    console.warn(`[SECURITY] Tentative de path traversal: ${req.url}`);
    return res.status(400).json({
      success: false,
      error: 'Chemin non autorisé',
      message: 'Accès au chemin refusé'
    });
  }

  next();
};

// Validation de la taille du body
const bodySizeValidator = (req, res, next) => {
  const maxBodySize = 10 * 1024 * 1024; // 10 MB
  
  if (req.headers['content-length']) {
    const contentLength = parseInt(req.headers['content-length']);
    if (contentLength > maxBodySize) {
      console.warn(`[SECURITY] Taille de body excessive: ${contentLength} bytes`);
      return res.status(413).json({
        success: false,
        error: 'Contenu trop volumineux',
        message: 'Taille de la requête dépassée'
      });
    }
  }

  next();
};

// Log des activités suspectes
const securityLogger = (req, res, next) => {
  const suspiciousPatterns = [
    /admin/i,
    /password/i,
    /token/i,
    /key/i,
    /secret/i,
    /config/i,
    /\.env/i,
    /backup/i,
    /database/i
  ];

  const url = req.url.toLowerCase();
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url));

  if (isSuspicious) {
    console.warn(`[SECURITY] Accès suspect: ${req.method} ${req.url} depuis ${req.ip}`);
  }

  next();
};

module.exports = {
  securityHeaders,
  sqlInjectionDetector,
  xssDetector,
  headerValidator,
  pathTraversalProtection,
  bodySizeValidator,
  securityLogger
};