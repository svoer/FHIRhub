/**
 * Middleware de sécurité avancé
 * Headers de sécurité et protection contre les attaques communes
 */

const helmet = require('helmet');

/**
 * Configuration des headers de sécurité avec Helmet
 */
function configureSecurityHeaders(app) {
  // Configuration Helmet avec des règles strictes
  app.use(helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Nécessaire pour les scripts intégrés
          "cdnjs.cloudflare.com",
          "cdn.jsdelivr.net",
          "unpkg.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Nécessaire pour les styles intégrés
          "cdnjs.cloudflare.com",
          "fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "fonts.gstatic.com",
          "cdnjs.cloudflare.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "*.githubusercontent.com"
        ],
        connectSrc: [
          "'self'",
          "api.mistral.ai",
          "api.openai.com",
          "api.anthropic.com",
          "hapi.fhir.org",
          "localhost:*"
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Désactivé pour compatibilité
    
    // Référer Policy
    referrerPolicy: {
      policy: ["no-referrer", "strict-origin-when-cross-origin"]
    },
    
    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    
    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },
    
    // X-Content-Type-Options
    noSniff: true,
    
    // X-XSS-Protection (bien que dépréciée, encore utile pour les anciens navigateurs)
    xssFilter: true,
    
    // X-Download-Options
    ieNoOpen: true,
    
    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false
    }
  }));

  // Header personnalisé pour l'identification de l'application
  app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'FHIRHub/1.5.0');
    res.setHeader('X-Application', 'FHIRHub-HL7-FHIR-Converter');
    
    // Headers de sécurité supplémentaires
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    
    // Cache control pour les ressources sensibles
    if (req.path.includes('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    next();
  });
}

/**
 * Middleware de validation des origines CORS personnalisé
 */
function validateCorsOrigin(req, res, next) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'https://localhost:5000'
  ];
  
  // Ajouter les origines autorisées depuis la configuration de l'application
  if (req.application && req.application.cors_origins) {
    try {
      const appOrigins = JSON.parse(req.application.cors_origins);
      allowedOrigins.push(...appOrigins);
    } catch (error) {
      console.warn('[SECURITY] Erreur lors du parsing des origines CORS de l\'application:', error);
    }
  }
  
  // Validation stricte en production
  if (process.env.NODE_ENV === 'production' && origin && !allowedOrigins.includes(origin)) {
    console.warn(`[SECURITY] Origine CORS non autorisée: ${origin}`);
    return res.status(403).json({
      error: 'Origine non autorisée',
      code: 'CORS_ORIGIN_NOT_ALLOWED'
    });
  }
  
  next();
}

/**
 * Middleware de détection d'attaques par injection
 */
function detectInjectionAttempts(req, res, next) {
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /union\s+select/gi,
    /drop\s+table/gi,
    /delete\s+from/gi,
    /'.*or.*'.*=.*'/gi,
    /\.\.\//g,
    /%2e%2e%2f/gi
  ];
  
  function checkForInjection(obj, path = '') {
    if (typeof obj === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(obj)) {
          console.warn(`[SECURITY] Tentative d'injection détectée dans ${path}: ${obj.substring(0, 100)}`);
          return true;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (checkForInjection(value, `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  }
  
  // Vérifier le body, les paramètres et les headers
  if (checkForInjection(req.body, 'body') || 
      checkForInjection(req.query, 'query') || 
      checkForInjection(req.params, 'params')) {
    
    return res.status(400).json({
      error: 'Contenu suspect détecté dans la requête',
      code: 'INJECTION_ATTEMPT_DETECTED'
    });
  }
  
  next();
}

module.exports = {
  configureSecurityHeaders,
  validateCorsOrigin,
  detectInjectionAttempts
};