/**
 * FHIR Proxy - Permet d'accéder aux serveurs FHIR externes en contournant les restrictions CORS
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { sanitizeUrl } = require('../utils/urlSanitizer');
const logger = require('../utils/logger');

/**
 * Proxy générique pour les requêtes FHIR
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
    logger.info(`[FHIR Proxy] Relais de requête vers: ${targetUrl}`);
    
    // Exécution de la requête
    const response = await axios.get(targetUrl, {
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      }
    });
    
    // Envoi de la réponse au client
    res.status(response.status).json(response.data);
    
  } catch (error) {
    logger.error(`[FHIR Proxy] Erreur: ${error.message}`);
    
    // Gestion des erreurs spécifiques
    if (error.response) {
      // Erreur de réponse du serveur FHIR
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
 * Proxy POST pour les requêtes FHIR
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
    logger.info(`[FHIR Proxy] Relais de requête POST vers: ${targetUrl}`);
    
    // Exécution de la requête
    const response = await axios.post(targetUrl, req.body, {
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      }
    });
    
    // Envoi de la réponse au client
    res.status(response.status).json(response.data);
    
  } catch (error) {
    logger.error(`[FHIR Proxy] Erreur POST: ${error.message}`);
    
    // Gestion des erreurs spécifiques
    if (error.response) {
      // Erreur de réponse du serveur FHIR
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