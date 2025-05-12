/**
 * Middleware pour la validation des clés API
 * Ce middleware permet de valider les clés API envoyées dans les requêtes HTTP
 * et d'associer les informations de la clé à l'objet de requête
 */

const logger = require('../utils/logger');
const { hashValue } = require('../utils/crypto');
const db = require('../src/database');

/**
 * Middleware de validation des clés API
 * @param {Object} req - L'objet requête HTTP
 * @param {Object} res - L'objet réponse HTTP
 * @param {Function} next - Fonction pour passer au middleware suivant
 */
function apiKeyMiddleware(req, res, next) {
  // Récupérer la clé API depuis les en-têtes ou les paramètres de requête
  const apiKey = req.headers['x-api-key'] || req.query.apiKey || req.query.api_key;
  
  // Si aucune clé API n'est fournie, continuer sans validation
  if (!apiKey) {
    logger.debug('[API_KEY] Aucune clé API fournie');
    return next();
  }
  
  try {
    // Hacher la clé API pour la comparaison
    const hashedKey = hashValue(apiKey);
    
    // Récupérer les informations de la clé API depuis la base de données
    const apiKeyData = db.prepare(`
      SELECT ak.*, a.name as application_name 
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      WHERE hashed_key = ? AND ak.status = 'active'
    `).get(hashedKey);
    
    // Si la clé API n'est pas trouvée ou n'est pas active
    if (!apiKeyData) {
      logger.warn(`[API_KEY] Clé API invalide ou inactive: ${apiKey.substring(0, 8)}...`);
      // Continuer sans bloquer la requête, mais sans attacher les données d'API key
      return next();
    }
    
    // Mettre à jour le compteur d'utilisation de la clé API
    db.prepare(`
      UPDATE api_keys
      SET usage_count = usage_count + 1,
          last_used_at = datetime('now')
      WHERE id = ?
    `).run(apiKeyData.id);
    
    // Attacher les informations de la clé API à l'objet de requête
    req.apiKeyData = apiKeyData;
    req.authenticated = true;
    
    logger.debug(`[API_KEY] Clé API validée pour l'application: ${apiKeyData.application_name}`);
    
    return next();
  } catch (error) {
    logger.error(`[API_KEY] Erreur lors de la validation de la clé API: ${error.message}`);
    // Continuer sans bloquer la requête en cas d'erreur
    return next();
  }
}

module.exports = apiKeyMiddleware;