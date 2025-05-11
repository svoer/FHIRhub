/**
 * Middleware de validation des clés API
 * Vérifie que les requêtes API contiennent une clé API valide
 */

const apiKeyService = require('../../services/apiKeyService');
const conversionLogService = require('../../services/conversionLogService');

/**
 * Extraire la clé API de la requête
 * Priorise l'ordre suivant: header > query param > body
 * @param {Object} req - Requête Express
 * @returns {string|null} Clé API ou null si non trouvée
 */
function extractApiKey(req) {
  // 1. Chercher dans le header X-API-Key
  const headerKey = req.headers['x-api-key'];
  if (headerKey) return headerKey;
  
  // 2. Chercher dans les paramètres de requête
  const queryKey = req.query.apiKey || req.query.api_key;
  if (queryKey) return queryKey;
  
  // 3. Chercher dans le body (pour les requêtes POST)
  const bodyKey = req.body?.apiKey || req.body?.api_key;
  if (bodyKey) return bodyKey;
  
  // Aucune clé trouvée
  return null;
}

/**
 * Middleware pour vérifier la clé API
 * @param {Object} options - Options du middleware
 * @returns {Function} Middleware Express
 */
function apiKeyAuth(options = {}) {
  const { optional = false, logAccess = true } = options;
  
  return async (req, res, next) => {
    try {
      // Extraire la clé API
      const apiKey = extractApiKey(req);
      
      // Si aucune clé n'est fournie
      if (!apiKey) {
        // Si la clé est optionnelle, continuer sans authentification
        if (optional) {
          req.apiAuth = { authenticated: false };
          return next();
        }
        
        // Sinon, retourner une erreur
        return res.status(401).json({
          error: 'Authentification requise',
          message: 'Vous devez fournir une clé API valide'
        });
      }
      
      // Valider la clé API
      const apiAuth = await apiKeyService.validateApiKey(apiKey);
      
      // Si la clé est invalide
      if (!apiAuth) {
        return res.status(401).json({
          error: 'Clé API invalide',
          message: 'La clé API fournie est invalide, inactive ou expirée'
        });
      }
      
      // Enregistrer les informations d'authentification dans la requête
      req.apiAuth = { 
        authenticated: true,
        apiKeyId: apiAuth.apiKeyId,
        applicationId: apiAuth.applicationId,
        applicationName: apiAuth.applicationName
      };
      
      // Journaliser l'accès si demandé
      if (logAccess) {
        // Enregistrement asynchrone du log d'accès (ne bloque pas la requête)
        conversionLogService.createConversionLog({
          applicationId: apiAuth.applicationId,
          apiKeyId: apiAuth.apiKeyId,
          requestType: 'api_access',
          status: 'success',
          message: `Accès API: ${req.method} ${req.originalUrl}`,
          requestIp: req.ip,
          requestEndpoint: req.originalUrl
        }).catch(err => {
          console.error('[API] Erreur lors de la journalisation de l\'accès:', err);
        });
      }
      
      // Continuer le traitement de la requête
      next();
    } catch (error) {
      console.error('[API] Erreur lors de l\'authentification:', error);
      res.status(500).json({
        error: 'Erreur serveur',
        message: 'Une erreur est survenue lors de l\'authentification'
      });
    }
  };
}

module.exports = apiKeyAuth;