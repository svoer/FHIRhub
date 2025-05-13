/**
 * FHIR Proxy - Permet d'accéder aux serveurs FHIR externes en contournant les restrictions CORS
 * Implémente un système de limitation de débit pour éviter les erreurs 429 (Too Many Requests)
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { sanitizeUrl } = require('../utils/urlSanitizer');
const logger = require('../utils/logger');

// Système de cache pour éviter les requêtes répétées
const responseCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 secondes de durée de vie du cache

// Files d'attente pour les requêtes FHIR par serveur
const requestQueues = {
  hapi: [],
  local: []
};

// Indicateurs d'activité pour chaque serveur
const isProcessing = {
  hapi: false,
  local: false
};

// Délais entre les requêtes (en ms) pour éviter les erreurs 429
const REQUEST_DELAY = 500; // 500ms entre les requêtes au même serveur

/**
 * Traite la file d'attente des requêtes pour un serveur spécifique
 * @param {string} serverKey - Clé du serveur ('hapi' ou 'local')
 */
function processQueue(serverKey) {
  if (isProcessing[serverKey] || requestQueues[serverKey].length === 0) {
    return;
  }
  
  isProcessing[serverKey] = true;
  
  const nextRequest = requestQueues[serverKey].shift();
  
  setTimeout(() => {
    nextRequest.execute()
      .finally(() => {
        isProcessing[serverKey] = false;
        processQueue(serverKey);
      });
  }, REQUEST_DELAY);
}

/**
 * Ajoute une requête à la file d'attente
 * @param {string} serverKey - Clé du serveur ('hapi' ou 'local')
 * @param {Function} executeFn - Fonction qui exécute la requête
 * @returns {Promise} - Promise qui sera résolue lorsque la requête sera exécutée
 */
function enqueueRequest(serverKey, executeFn) {
  return new Promise((resolve, reject) => {
    requestQueues[serverKey].push({
      execute: async () => {
        try {
          const result = await executeFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    });
    
    processQueue(serverKey);
  });
}

/**
 * Vérifie si une réponse est en cache et si elle est encore valide
 * @param {string} cacheKey - Clé de cache
 * @returns {Object|null} - Données en cache ou null si non trouvé/expiré
 */
function getCachedResponse(cacheKey) {
  const cachedItem = responseCache.get(cacheKey);
  if (!cachedItem) return null;
  
  const isExpired = Date.now() > cachedItem.expiry;
  if (isExpired) {
    responseCache.delete(cacheKey);
    return null;
  }
  
  return cachedItem.data;
}

/**
 * Stocke une réponse dans le cache
 * @param {string} cacheKey - Clé de cache
 * @param {Object} data - Données à mettre en cache
 */
function setCachedResponse(cacheKey, data) {
  responseCache.set(cacheKey, {
    data,
    expiry: Date.now() + CACHE_TTL
  });
}

/**
 * Proxy générique pour les requêtes FHIR avec limitation de débit et mise en cache
 * Cette route permet de contourner les restrictions CORS en relayant les requêtes
 * depuis le serveur FHIRHub vers un serveur FHIR externe
 */
router.get('/:fhirServer/*', async (req, res) => {
  try {
    // Extraction des paramètres
    const fhirServer = req.params.fhirServer;
    const pathWithParams = req.params[0] + (req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '');
    
    // Détermination de l'URL de base du serveur FHIR
    let baseUrl;
    if (fhirServer === 'hapi') {
      baseUrl = 'https://hapi.fhir.org/baseR4/';
    } else if (fhirServer === 'local') {
      baseUrl = process.env.LOCAL_FHIR_SERVER || 'http://localhost:8080/fhir/';
    } else {
      return res.status(400).json({ error: "Serveur FHIR non reconnu. Utilisez 'hapi' ou 'local'." });
    }
    
    // Construction de l'URL complète et sécurisée
    const targetUrl = sanitizeUrl(baseUrl + pathWithParams);
    const cacheKey = `GET:${targetUrl}`;
    
    // Vérifier si la réponse est en cache
    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      logger.info(`[FHIR Proxy] Réponse en cache utilisée pour: ${targetUrl}`);
      return res.status(200).json(cachedResponse);
    }
    
    logger.info(`[FHIR Proxy] Relais de requête vers: ${targetUrl}`);
    
    // Exécution de la requête avec limitation de débit
    try {
      const response = await enqueueRequest(fhirServer, async () => {
        return axios.get(targetUrl, {
          headers: {
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json'
          }
        });
      });
      
      // Mise en cache de la réponse
      setCachedResponse(cacheKey, response.data);
      
      // Envoi de la réponse au client
      res.status(response.status).json(response.data);
      
    } catch (requestError) {
      throw requestError;
    }
    
  } catch (error) {
    logger.error(`[FHIR Proxy] Erreur: ${error.message}`);
    
    // Gestion des erreurs spécifiques
    if (error.response) {
      // Si c'est une erreur 429, on renvoie une réponse 429 avec un message explicatif
      if (error.response.status === 429) {
        logger.warn(`[FHIR Proxy] Erreur 429 (Too Many Requests) pour: ${req.url}`);
        return res.status(429).json({
          error: "Trop de requêtes au serveur FHIR",
          message: "Le serveur FHIR limite le nombre de requêtes. Veuillez réessayer dans quelques instants.",
          detail: "Le proxy FHIR met automatiquement en file d'attente les requêtes. Réessayez ultérieurement."
        });
      }
      
      // Autres erreurs de réponse du serveur FHIR
      res.status(error.response.status).json({
        error: `Erreur du serveur FHIR: ${error.response.status}`,
        message: error.response.data
      });
    } else if (error.request) {
      // Pas de réponse du serveur FHIR
      res.status(503).json({
        error: "Le serveur FHIR n'a pas répondu",
        message: "Vérifiez la disponibilité du serveur FHIR"
      });
    } else {
      // Autres erreurs
      res.status(500).json({
        error: "Erreur interne du proxy FHIR",
        message: error.message
      });
    }
  }
});

/**
 * Proxy POST pour les requêtes FHIR avec limitation de débit
 * Permet d'envoyer des données au serveur FHIR
 */
router.post('/:fhirServer/*', async (req, res) => {
  try {
    // Extraction des paramètres
    const fhirServer = req.params.fhirServer;
    const pathWithParams = req.params[0] + (req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '');
    
    // Détermination de l'URL de base du serveur FHIR
    let baseUrl;
    if (fhirServer === 'hapi') {
      baseUrl = 'https://hapi.fhir.org/baseR4/';
    } else if (fhirServer === 'local') {
      baseUrl = process.env.LOCAL_FHIR_SERVER || 'http://localhost:8080/fhir/';
    } else {
      return res.status(400).json({ error: "Serveur FHIR non reconnu. Utilisez 'hapi' ou 'local'." });
    }
    
    // Construction de l'URL complète et sécurisée
    const targetUrl = sanitizeUrl(baseUrl + pathWithParams);
    // Pas de mise en cache pour les requêtes POST
    
    logger.info(`[FHIR Proxy] Relais de requête POST vers: ${targetUrl}`);
    
    // Exécution de la requête avec limitation de débit
    try {
      const response = await enqueueRequest(fhirServer, async () => {
        return axios.post(targetUrl, req.body, {
          headers: {
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json'
          }
        });
      });
      
      // Envoi de la réponse au client
      res.status(response.status).json(response.data);
      
    } catch (requestError) {
      throw requestError;
    }
    
  } catch (error) {
    logger.error(`[FHIR Proxy] Erreur POST: ${error.message}`);
    
    // Gestion des erreurs spécifiques
    if (error.response) {
      // Si c'est une erreur 429, on renvoie une réponse 429 avec un message explicatif
      if (error.response.status === 429) {
        logger.warn(`[FHIR Proxy] Erreur POST 429 (Too Many Requests) pour: ${req.url}`);
        return res.status(429).json({
          error: "Trop de requêtes au serveur FHIR",
          message: "Le serveur FHIR limite le nombre de requêtes. Veuillez réessayer dans quelques instants.",
          detail: "Le proxy FHIR met automatiquement en file d'attente les requêtes. Réessayez ultérieurement."
        });
      }
      
      // Autres erreurs de réponse du serveur FHIR
      res.status(error.response.status).json({
        error: `Erreur du serveur FHIR: ${error.response.status}`,
        message: error.response.data
      });
    } else if (error.request) {
      // Pas de réponse du serveur FHIR
      res.status(503).json({
        error: "Le serveur FHIR n'a pas répondu",
        message: "Vérifiez la disponibilité du serveur FHIR"
      });
    } else {
      // Autres erreurs
      res.status(500).json({
        error: "Erreur interne du proxy FHIR",
        message: error.message
      });
    }
  }
});

module.exports = router;