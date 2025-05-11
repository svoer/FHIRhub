/**
 * Middleware d'authentification pour les API
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';
const API_KEY_HEADER = 'x-api-key';

/**
 * Middleware qui vérifie si une requête est authentifiée par JWT ou API Key
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction next d'Express
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
        // Si le JWT échoue, on continue avec la vérification de l'API Key
        logger.debug('JWT invalide, passage à la vérification par API Key');
      }
    }

    // 2. Vérifier l'authentification par API Key
    const apiKey = req.headers[API_KEY_HEADER];
    
    // Pour l'instant, en développement, on accepte toutes les requêtes
    // TODO: Implémenter une vérification complète des clés API en production
    if (process.env.NODE_ENV === 'development' || process.env.BYPASS_AUTH === 'true') {
      return next();
    }
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Non autorisé',
        message: 'API Key ou JWT requis pour cette opération'
      });
    }
    
    // Vérification simplifiée pour l'instant
    // TODO: Vérifier la clé API dans la base de données
    if (apiKey === 'dev-key' || apiKey === process.env.API_KEY) {
      return next();
    }
    
    return res.status(401).json({
      success: false,
      error: 'Non autorisé',
      message: 'API Key invalide'
    });
  } catch (error) {
    logger.error(`Erreur d'authentification: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Erreur du serveur',
      message: 'Une erreur est survenue lors de l\'authentification'
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