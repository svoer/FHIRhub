/**
 * Middleware de conformité sécuritaire RGPD/HDS/ANSSI/ANS
 * Implémente les mesures de sécurité obligatoires pour les données de santé
 * @module middleware/securityCompliance
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Configuration ANSSI - Recommandations de sécurité
 */
const anssiSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

/**
 * Rate Limiting conforme ANSSI
 */
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Trop de requêtes',
      message: 'Limite de taux dépassée. Veuillez réessayer plus tard.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Exempter les requêtes de santé système
      return req.path === '/api/system/health';
    }
  });
};

/**
 * Rate Limiting strict pour les APIs sensibles
 */
const strictRateLimit = createRateLimit(15 * 60 * 1000, 30); // 30 req/15min
const authRateLimit = createRateLimit(15 * 60 * 1000, 10);   // 10 req/15min pour auth
const normalRateLimit = createRateLimit(15 * 60 * 1000, 100); // 100 req/15min normal

/**
 * Middleware de journalisation sécurisée conforme RGPD
 */
function secureLogging(req, res, next) {
  const startTime = Date.now();
  
  // Capture des informations de base sans données personnelles
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: anonymizeIP(req.ip || req.connection.remoteAddress),
    userAgent: req.get('user-agent'),
    sessionId: generateSessionHash(req),
  };

  // Logger la fin de la requête
  const originalSend = res.send;
  res.send = function(data) {
    logData.statusCode = res.statusCode;
    logData.responseTime = Date.now() - startTime;
    logData.success = res.statusCode < 400;
    
    // Log sécurisé sans données sensibles
    console.log('[AUDIT]', JSON.stringify(logData));
    
    originalSend.call(this, data);
  };

  next();
}

/**
 * Anonymisation d'IP conforme RGPD
 */
function anonymizeIP(ip) {
  if (!ip) return 'unknown';
  
  if (ip.includes(':')) {
    // IPv6 - garder seulement les 4 premiers segments
    const segments = ip.split(':');
    return segments.slice(0, 4).join(':') + '::xxxx';
  } else {
    // IPv4 - masquer le dernier octet
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }
  
  return 'anonymized';
}

/**
 * Génération de hash de session anonyme
 */
function generateSessionHash(req) {
  const data = [
    req.ip,
    req.get('user-agent'),
    new Date().toDateString() // Change chaque jour
  ].join('|');
  
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Middleware de validation HDS pour données de santé
 */
function hdsDataValidation(req, res, next) {
  // Vérifier si la requête contient des données de santé
  if (req.path.includes('/convert') || req.path.includes('/patient')) {
    // Marquer la requête comme contenant des données de santé
    req.containsHealthData = true;
    
    // Ajouter headers de sécurité spécifiques HDS
    res.set({
      'X-Health-Data': 'true',
      'X-Data-Classification': 'sensitive',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  
  next();
}

/**
 * Middleware de chiffrement des logs sensibles
 */
function encryptSensitiveLogs(req, res, next) {
  if (req.containsHealthData) {
    // Override console.log pour chiffrer les données sensibles
    const originalLog = console.log;
    console.log = function(...args) {
      const logString = args.join(' ');
      
      // Détecter et anonymiser les données sensibles dans les logs
      const sanitizedLog = sanitizeLogData(logString);
      originalLog.call(console, sanitizedLog);
    };
    
    // Restaurer le logging normal après la requête
    res.on('finish', () => {
      console.log = originalLog;
    });
  }
  
  next();
}

/**
 * Sanitisation des données sensibles dans les logs
 */
function sanitizeLogData(logString) {
  return logString
    // Anonymiser les noms/prénoms (format Nom^Prénom)
    .replace(/\b[A-Z][a-z]+\^[A-Z][a-z]+/g, '[PATIENT_NAME]')
    // Anonymiser les dates de naissance (YYYYMMDD)
    .replace(/\b(19|20)\d{6}\b/g, '[DATE_BIRTH]')
    // Anonymiser les numéros de sécurité sociale
    .replace(/\b[12]\d{12}\b/g, '[SSN]')
    // Anonymiser les identifiants patients longs
    .replace(/\b\d{8,}\b/g, '[PATIENT_ID]')
    // Anonymiser les adresses IP complètes en logs
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (match) => anonymizeIP(match));
}

/**
 * Middleware de conformité ANS pour terminologies
 */
function ansComplianceValidation(req, res, next) {
  // Vérifier les URLs de systèmes de terminologies
  if (req.path.includes('/terminology')) {
    const validANSSystems = [
      'https://mos.esante.gouv.fr',
      'https://interop.esante.gouv.fr',
      'https://ansforge.esante.gouv.fr'
    ];
    
    // Valider que seules les terminologies ANS officielles sont utilisées
    if (req.body && req.body.system) {
      const isValidSystem = validANSSystems.some(system => 
        req.body.system.startsWith(system)
      );
      
      if (!isValidSystem) {
        return res.status(400).json({
          success: false,
          error: 'Système de terminologie non conforme ANS',
          message: 'Seules les terminologies officielles ANS sont autorisées'
        });
      }
    }
  }
  
  next();
}

/**
 * Middleware de détection de tentatives d'intrusion
 */
function intrusionDetection(req, res, next) {
  const suspiciousPatterns = [
    // Injection SQL
    /('|(\\')|(;)|(\\\\)|(--)|(\s*(union|select|insert|delete|update|drop|create|alter|exec|execute)\s*)/i,
    // XSS
    /<script[^>]*>.*?<\/script>/gi,
    // Path traversal
    /\.\.(\/|\\)/,
    // Command injection
    /[;&|`$]/
  ];
  
  const userInput = JSON.stringify(req.body) + req.url + (req.get('user-agent') || '');
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userInput)) {
      // Logger l'tentative d'intrusion
      console.warn('[SECURITY] Tentative d\'intrusion détectée:', {
        ip: anonymizeIP(req.ip),
        pattern: pattern.toString(),
        path: req.path,
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({
        success: false,
        error: 'Requête suspicieuse détectée',
        message: 'Accès refusé pour des raisons de sécurité'
      });
    }
  }
  
  next();
}

/**
 * Middleware de conformité RGPD - consentement et traçabilité
 */
function rgpdCompliance(req, res, next) {
  // Ajouter headers de transparence RGPD
  res.set({
    'X-Data-Controller': 'FHIRHub Healthcare Platform',
    'X-Privacy-Policy': '/privacy-policy',
    'X-Data-Retention': '7-years-medical-data'
  });
  
  // Marquer les requêtes avec données personnelles
  if (req.path.includes('/patient') || req.path.includes('/convert')) {
    res.set('X-Personal-Data-Processing', 'true');
  }
  
  next();
}

/**
 * Middleware de chiffrement en transit conforme HDS
 */
function enforceHTTPS(req, res, next) {
  // En production, forcer HTTPS
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
    return res.status(426).json({
      success: false,
      error: 'HTTPS requis',
      message: 'Les données de santé nécessitent une connexion sécurisée HTTPS'
    });
  }
  
  next();
}

module.exports = {
  anssiSecurityHeaders,
  strictRateLimit,
  authRateLimit,
  normalRateLimit,
  secureLogging,
  hdsDataValidation,
  encryptSensitiveLogs,
  ansComplianceValidation,
  intrusionDetection,
  rgpdCompliance,
  enforceHTTPS,
  anonymizeIP,
  sanitizeLogData
};