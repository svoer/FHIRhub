/**
 * Middleware de limitation de débit (Rate Limiting)
 * Protection contre les abus et attaques DDoS
 */

const rateLimit = require('express-rate-limit');

// Limitation globale pour toutes les APIs
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limite de 1000 requêtes par fenêtre par IP
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer dans 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Retourne les headers `RateLimit-*`
  legacyHeaders: false, // Désactive les headers `X-RateLimit-*`
  handler: (req, res) => {
    console.warn(`[SECURITY] Rate limit dépassé pour IP: ${req.ip}, URL: ${req.url}`);
    res.status(429).json({
      error: 'Trop de requêtes depuis cette IP, veuillez réessayer dans 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

// Limitation stricte pour les conversions HL7
const conversionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limite de 30 conversions par minute par IP
  message: {
    error: 'Trop de conversions depuis cette IP, veuillez réessayer dans 1 minute.',
    code: 'CONVERSION_RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    // Utiliser l'IP et la clé API si disponible pour un meilleur tracking
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    return apiKey ? `conversion_${req.ip}_${apiKey}` : `conversion_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(`[SECURITY] Conversion rate limit dépassé pour IP: ${req.ip}, API Key: ${req.headers['x-api-key'] || 'none'}`);
    res.status(429).json({
      error: 'Trop de conversions depuis cette IP, veuillez réessayer dans 1 minute.',
      code: 'CONVERSION_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

// Limitation pour les requêtes d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limite de 10 tentatives de connexion par IP
  message: {
    error: 'Trop de tentatives de connexion depuis cette IP, veuillez réessayer dans 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true, // Ne pas compter les requêtes réussies
  handler: (req, res) => {
    console.warn(`[SECURITY] Auth rate limit dépassé pour IP: ${req.ip}, tentative: ${req.body?.username || 'unknown'}`);
    res.status(429).json({
      error: 'Trop de tentatives de connexion depuis cette IP, veuillez réessayer dans 15 minutes.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

// Limitation pour les APIs d'IA
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limite de 10 requêtes IA par minute par IP
  message: {
    error: 'Trop de requêtes IA depuis cette IP, veuillez réessayer dans 1 minute.',
    code: 'AI_RATE_LIMIT_EXCEEDED'
  },
  handler: (req, res) => {
    console.warn(`[SECURITY] AI rate limit dépassé pour IP: ${req.ip}`);
    res.status(429).json({
      error: 'Trop de requêtes IA depuis cette IP, veuillez réessayer dans 1 minute.',
      code: 'AI_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

module.exports = {
  globalLimiter,
  conversionLimiter,
  authLimiter,
  aiLimiter
};