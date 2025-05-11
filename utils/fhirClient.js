/**
 * Client optimisé pour les requêtes FHIR
 * Inclut une gestion intelligente des requêtes pour éviter les erreurs 429
 */
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Délai entre les requêtes pour éviter les erreurs 429 (en ms)
const REQUEST_DELAY = 500;

// File d'attente de requêtes pour limiter le taux
const requestQueue = {
  queue: [],
  processing: false,
  lastRequestTime: 0
};

/**
 * Ajoute une requête à la file d'attente et la traite selon le principe FIFO
 * 
 * @param {Function} requestFn - Fonction qui exécute la requête réelle
 * @returns {Promise<any>} - Résultat de la requête
 */
async function enqueueRequest(requestFn) {
  return new Promise((resolve, reject) => {
    // Ajouter la requête à la file
    requestQueue.queue.push({
      requestFn,
      resolve,
      reject
    });
    
    // Lancer le traitement si ce n'est pas déjà en cours
    if (!requestQueue.processing) {
      processQueue();
    }
  });
}

/**
 * Traite les requêtes de la file d'attente une par une avec un délai
 */
async function processQueue() {
  if (requestQueue.queue.length === 0) {
    requestQueue.processing = false;
    return;
  }
  
  requestQueue.processing = true;
  
  // Temps écoulé depuis la dernière requête
  const now = Date.now();
  const elapsed = now - requestQueue.lastRequestTime;
  
  // Attendre si nécessaire pour respecter le délai minimum
  const waitTime = Math.max(0, REQUEST_DELAY - elapsed);
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Traiter la prochaine requête
  const { requestFn, resolve, reject } = requestQueue.queue.shift();
  
  try {
    // Exécuter la requête
    const result = await requestFn();
    requestQueue.lastRequestTime = Date.now();
    resolve(result);
  } catch (error) {
    reject(error);
  }
  
  // Traiter la requête suivante
  setTimeout(processQueue, 0);
}

/**
 * Récupère la configuration des serveurs FHIR
 * 
 * @returns {Object} Configuration des serveurs FHIR
 */
function getServersConfig() {
  try {
    const configPath = path.join(__dirname, '../config/fhir-servers.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    logger.error(`Erreur lors de la lecture de la configuration des serveurs FHIR: ${error.message}`);
    return { servers: [] };
  }
}

/**
 * Récupère les informations d'un serveur FHIR par son ID
 * 
 * @param {string} serverId - ID du serveur FHIR
 * @returns {Object|null} Informations du serveur ou null si non trouvé
 */
function getServerById(serverId) {
  const config = getServersConfig();
  return config.servers.find(s => s.id === serverId) || null;
}

/**
 * Crée une configuration pour Axios pour les requêtes FHIR
 * 
 * @param {Object} server - Informations du serveur FHIR
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Configuration Axios
 */
function createAxiosConfig(server, options = {}) {
  const headers = {
    'Accept': 'application/fhir+json',
    ...options.headers
  };
  
  let config = { 
    timeout: options.timeout || 15000,
    headers
  };
  
  // Authentification si nécessaire
  if (server.auth === 'basic' && server.username && server.password) {
    config.auth = {
      username: server.username,
      password: server.password
    };
  } else if (server.auth === 'token' && server.token) {
    headers['Authorization'] = `Bearer ${server.token}`;
  }
  
  return config;
}

/**
 * Effectue une requête GET vers un serveur FHIR
 * 
 * @param {string} serverId - ID du serveur FHIR
 * @param {string} path - Chemin de la requête (sans l'URL du serveur)
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<Object>} Réponse du serveur FHIR
 */
async function getFhirResource(serverId, path, options = {}) {
  const server = getServerById(serverId);
  if (!server) {
    throw new Error(`Serveur FHIR avec l'ID ${serverId} non trouvé`);
  }
  
  // S'assurer que le chemin commence par "/"
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Créer l'URL complète
  const url = `${server.url}${normalizedPath}`;
  
  return enqueueRequest(async () => {
    try {
      logger.info(`Requête FHIR: GET ${url}`);
      const response = await axios.get(url, createAxiosConfig(server, options));
      return response.data;
    } catch (error) {
      if (error.response) {
        // Erreur de réponse du serveur
        logger.error(`Erreur ${error.response.status} lors de la requête FHIR: ${url}`);
        throw new Error(`Erreur ${error.response.status}: ${error.response.data?.issue?.[0]?.diagnostics || error.message}`);
      } else if (error.request) {
        // Erreur de réseau
        logger.error(`Erreur réseau lors de la requête FHIR: ${url}`);
        throw new Error(`Erreur réseau: ${error.message}`);
      } else {
        // Autre erreur
        logger.error(`Erreur lors de la requête FHIR: ${error.message}`);
        throw error;
      }
    }
  });
}

/**
 * Effectue une requête POST vers un serveur FHIR
 * 
 * @param {string} serverId - ID du serveur FHIR
 * @param {string} path - Chemin de la requête (sans l'URL du serveur)
 * @param {Object} data - Données à envoyer
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<Object>} Réponse du serveur FHIR
 */
async function postFhirResource(serverId, path, data, options = {}) {
  const server = getServerById(serverId);
  if (!server) {
    throw new Error(`Serveur FHIR avec l'ID ${serverId} non trouvé`);
  }
  
  // S'assurer que le chemin commence par "/"
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Créer l'URL complète
  const url = `${server.url}${normalizedPath}`;
  
  return enqueueRequest(async () => {
    try {
      logger.info(`Requête FHIR: POST ${url}`);
      const response = await axios.post(url, data, createAxiosConfig(server, options));
      return response.data;
    } catch (error) {
      if (error.response) {
        // Erreur de réponse du serveur
        logger.error(`Erreur ${error.response.status} lors de la requête FHIR: ${url}`);
        throw new Error(`Erreur ${error.response.status}: ${error.response.data?.issue?.[0]?.diagnostics || error.message}`);
      } else if (error.request) {
        // Erreur de réseau
        logger.error(`Erreur réseau lors de la requête FHIR: ${url}`);
        throw new Error(`Erreur réseau: ${error.message}`);
      } else {
        // Autre erreur
        logger.error(`Erreur lors de la requête FHIR: ${error.message}`);
        throw error;
      }
    }
  });
}

/**
 * Exécute une requête FHIR générée par l'IA
 * 
 * @param {string} serverId - ID du serveur FHIR
 * @param {string} query - Requête FHIR (sans l'URL du serveur)
 * @returns {Promise<Object>} Réponse du serveur FHIR
 */
async function executeFhirQuery(serverId, query) {
  // Nettoyer la requête
  const cleanQuery = query.replace(/^\/?/, '/');
  
  return getFhirResource(serverId, cleanQuery, {
    timeout: 20000 // Timeout plus long pour les requêtes générées par l'IA
  });
}

/**
 * Récupère les métadonnées (CapabilityStatement) d'un serveur FHIR
 * 
 * @param {string} serverId - ID du serveur FHIR
 * @returns {Promise<Object>} CapabilityStatement du serveur
 */
async function getCapabilityStatement(serverId) {
  return getFhirResource(serverId, '/metadata', {
    timeout: 10000
  });
}

module.exports = {
  getFhirResource,
  postFhirResource,
  executeFhirQuery,
  getCapabilityStatement,
  getServerById,
  getServersConfig
};