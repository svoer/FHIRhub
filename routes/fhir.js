/**
 * Routes pour l'accès aux ressources FHIR
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const authCombined = require('../middleware/authCombined');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { validateFhirResource } = require('../utils/fhirValidator');

// Configuration des serveurs FHIR
const SERVERS_CONFIG_FILE = path.join(__dirname, '../config/fhir-servers.json');

// Fonction pour lire la configuration des serveurs
function getServersConfig() {
  try {
    if (fs.existsSync(SERVERS_CONFIG_FILE)) {
      const configContent = fs.readFileSync(SERVERS_CONFIG_FILE, 'utf8');
      return JSON.parse(configContent);
    } else {
      logger.warn('Fichier de configuration des serveurs FHIR non trouvé, utilisation de la configuration par défaut');
      return {
        defaultServer: 'local',
        servers: [
          {
            id: 'local',
            name: 'Serveur HAPI FHIR Local',
            url: 'http://localhost:8080/fhir',
            version: 'R4',
            auth: 'none',
            isDefault: true,
            status: 'active'
          }
        ]
      };
    }
  } catch (error) {
    logger.error(`Erreur lors de la lecture de la configuration FHIR: ${error.message}`);
    return {
      defaultServer: 'local',
      servers: [
        {
          id: 'local',
          name: 'Serveur HAPI FHIR Local',
          url: 'http://localhost:8080/fhir',
          version: 'R4',
          auth: 'none',
          isDefault: true,
          status: 'active'
        }
      ]
    };
  }
}

// Middleware pour vérifier la santé du serveur avant les requêtes importantes
async function checkServerHealth(req, res, next) {
  try {
    const config = getServersConfig();
    const serverId = req.params.serverId || req.query.serverId || config.defaultServer;
    
    // Rechercher le serveur à utiliser
    const serverToUse = config.servers.find(s => s.id === serverId);
    
    if (!serverToUse) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Attacher le serveur à utiliser à la requête
    req.fhirServer = serverToUse;
    
    // Vérifier la connexion si le serveur est actif
    if (serverToUse.status === 'active') {
      try {
        // Test simple avec un timeout court
        await axios.get(`${serverToUse.url}/metadata`, { 
          timeout: 5000,
          headers: {
            'Accept': 'application/fhir+json'
          }
        });
        next();
      } catch (error) {
        // Marquer le serveur comme indisponible mais continuer si l'utilisateur force l'utilisation
        logger.warn(`Serveur FHIR ${serverToUse.id} indisponible: ${error.message}`);
        if (req.query.force === 'true') {
          logger.info(`Utilisation forcée du serveur FHIR ${serverToUse.id} malgré son indisponibilité`);
          next();
        } else {
          return res.status(503).json({
            success: false,
            message: `Le serveur FHIR ${serverToUse.name} est actuellement indisponible`,
            serverId: serverToUse.id,
            error: error.message
          });
        }
      }
    } else {
      // Si le serveur est désactivé, retourner une erreur
      return res.status(403).json({
        success: false,
        message: `Le serveur FHIR ${serverToUse.name} est désactivé`
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la vérification de la santé du serveur: ${error.message}`);
    next(error);
  }
}

// Fonction utilitaire pour configurer les en-têtes FHIR
function setupFhirHeaders(server) {
  const headers = {
    'Accept': 'application/fhir+json',
    'Content-Type': 'application/fhir+json'
  };
  
  if (server.auth === 'basic') {
    // La configuration d'auth de base sera gérée directement dans la config axios
  } else if (server.auth === 'token') {
    headers['Authorization'] = `Bearer ${server.token}`;
  }
  
  return headers;
}

// Fonction utilitaire pour créer la configuration axios
function createAxiosConfig(server, additionalConfig = {}) {
  const config = {
    headers: setupFhirHeaders(server),
    timeout: 15000,
    ...additionalConfig
  };
  
  if (server.auth === 'basic') {
    config.auth = {
      username: server.username,
      password: server.password
    };
  }
  
  return config;
}

/**
 * @swagger
 * /api/fhir/metadata:
 *   get:
 *     summary: Récupérer les métadonnées du serveur FHIR
 *     description: Récupère les capacités et les informations du serveur FHIR (CapabilityStatement)
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: query
 *         name: serverId
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à utiliser. Si non fourni, le serveur par défaut sera utilisé.
 *     responses:
 *       200:
 *         description: Métadonnées récupérées avec succès
 *       404:
 *         description: Serveur non trouvé
 *       503:
 *         description: Serveur indisponible
 *       500:
 *         description: Erreur serveur
 */
router.get('/metadata', authCombined, checkServerHealth, async (req, res) => {
  try {
    const server = req.fhirServer;
    
    try {
      const response = await axios.get(`${server.url}/metadata`, createAxiosConfig(server));
      
      // Retourner directement la réponse FHIR sans enveloppe
      res.set('Content-Type', 'application/fhir+json');
      res.status(200).json(response.data);
    } catch (error) {
      logger.error(`Erreur lors de la récupération des métadonnées: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: 'Erreur lors de la récupération des métadonnées',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la gestion de la requête /metadata: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/resources:
 *   get:
 *     summary: Lister les types de ressources disponibles
 *     description: Récupère la liste des types de ressources disponibles sur le serveur FHIR
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: query
 *         name: serverId
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à utiliser. Si non fourni, le serveur par défaut sera utilisé.
 *     responses:
 *       200:
 *         description: Liste des types de ressources récupérée avec succès
 *       404:
 *         description: Serveur non trouvé
 *       503:
 *         description: Serveur indisponible
 *       500:
 *         description: Erreur serveur
 */
router.get('/resources', authCombined, checkServerHealth, async (req, res) => {
  try {
    const server = req.fhirServer;
    
    try {
      // Récupérer les métadonnées pour extraire les types de ressources
      const response = await axios.get(`${server.url}/metadata`, createAxiosConfig(server));
      
      // Extraire les types de ressources à partir des métadonnées
      const resourceTypes = [];
      
      if (response.data && response.data.rest && response.data.rest.length > 0) {
        const rest = response.data.rest[0];
        
        if (rest.resource && rest.resource.length > 0) {
          rest.resource.forEach(resource => {
            if (resource.type) {
              resourceTypes.push({
                type: resource.type,
                profile: resource.profile || null,
                conditionalCreate: resource.conditionalCreate || false,
                conditionalUpdate: resource.conditionalUpdate || false,
                conditionalDelete: resource.conditionalDelete || 'not-supported',
                searchInclude: resource.searchInclude || [],
                searchRevInclude: resource.searchRevInclude || [],
                searchParam: resource.searchParam || []
              });
            }
          });
        }
      }
      
      resourceTypes.sort((a, b) => a.type.localeCompare(b.type));
      
      res.json({
        success: true,
        data: {
          resourceTypes,
          count: resourceTypes.length
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des types de ressources: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: 'Erreur lors de la récupération des types de ressources',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la gestion de la requête /resources: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/search/{resourceType}:
 *   get:
 *     summary: Rechercher des ressources FHIR
 *     description: Recherche des ressources FHIR du type spécifié avec les critères fournis
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type de ressource FHIR (Patient, Practitioner, etc.)
 *       - in: query
 *         name: serverId
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à utiliser. Si non fourni, le serveur par défaut sera utilisé.
 *       - in: query
 *         name: _count
 *         schema:
 *           type: integer
 *         description: Nombre maximum de résultats à retourner
 *       - in: query
 *         name: _sort
 *         schema:
 *           type: string
 *         description: Champ sur lequel trier les résultats
 *     responses:
 *       200:
 *         description: Recherche effectuée avec succès
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Type de ressource non trouvé
 *       503:
 *         description: Serveur indisponible
 *       500:
 *         description: Erreur serveur
 */
router.get('/search/:resourceType', authCombined, checkServerHealth, async (req, res) => {
  try {
    const { resourceType } = req.params;
    const server = req.fhirServer;
    
    // Valider le type de ressource
    if (!resourceType) {
      return res.status(400).json({
        success: false,
        message: 'Type de ressource requis'
      });
    }
    
    // Extraire les paramètres de recherche des query params
    const queryParams = { ...req.query };
    
    // Supprimer les paramètres spécifiques à notre API
    delete queryParams.serverId;
    delete queryParams.force;
    
    // Construire l'URL de recherche
    let searchUrl = `${server.url}/${resourceType}`;
    
    // Ajouter les paramètres de recherche
    if (Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, value);
      }
      
      searchUrl += `?${params.toString()}`;
    }
    
    try {
      const response = await axios.get(searchUrl, createAxiosConfig(server));
      
      // Retourner directement la réponse FHIR sans enveloppe
      res.set('Content-Type', 'application/fhir+json');
      res.status(200).json(response.data);
    } catch (error) {
      logger.error(`Erreur lors de la recherche ${resourceType}: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: `Erreur lors de la recherche de ressources ${resourceType}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la gestion de la requête /search: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/resource/{resourceType}/{id}:
 *   get:
 *     summary: Récupérer une ressource FHIR spécifique
 *     description: Récupère une ressource FHIR du type spécifié avec l'ID fourni
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type de ressource FHIR (Patient, Practitioner, etc.)
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la ressource
 *       - in: query
 *         name: serverId
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à utiliser. Si non fourni, le serveur par défaut sera utilisé.
 *     responses:
 *       200:
 *         description: Ressource récupérée avec succès
 *       404:
 *         description: Ressource non trouvée
 *       503:
 *         description: Serveur indisponible
 *       500:
 *         description: Erreur serveur
 */
router.get('/resource/:resourceType/:id', authCombined, checkServerHealth, async (req, res) => {
  try {
    const { resourceType, id } = req.params;
    const server = req.fhirServer;
    
    // Valider les paramètres obligatoires
    if (!resourceType || !id) {
      return res.status(400).json({
        success: false,
        message: 'Type de ressource et ID requis'
      });
    }
    
    try {
      const response = await axios.get(`${server.url}/${resourceType}/${id}`, createAxiosConfig(server));
      
      // Retourner directement la réponse FHIR sans enveloppe
      res.set('Content-Type', 'application/fhir+json');
      res.status(200).json(response.data);
    } catch (error) {
      logger.error(`Erreur lors de la récupération de la ressource ${resourceType}/${id}: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: `Erreur lors de la récupération de la ressource ${resourceType}/${id}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la gestion de la requête /resource: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/resource/{resourceType}:
 *   post:
 *     summary: Créer une nouvelle ressource FHIR
 *     description: Crée une nouvelle ressource FHIR du type spécifié
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type de ressource FHIR (Patient, Practitioner, etc.)
 *       - in: query
 *         name: serverId
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à utiliser. Si non fourni, le serveur par défaut sera utilisé.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Ressource créée avec succès
 *       400:
 *         description: Requête invalide
 *       503:
 *         description: Serveur indisponible
 *       500:
 *         description: Erreur serveur
 */
router.post('/resource/:resourceType', authCombined, checkServerHealth, async (req, res) => {
  try {
    const { resourceType } = req.params;
    const server = req.fhirServer;
    const resourceData = req.body;
    
    // Valider le type de ressource
    if (!resourceType) {
      return res.status(400).json({
        success: false,
        message: 'Type de ressource requis'
      });
    }
    
    // Valider la ressource
    if (!resourceData) {
      return res.status(400).json({
        success: false,
        message: 'Données de ressource requises'
      });
    }
    
    // Validation du resourceType
    if (resourceData.resourceType !== resourceType) {
      return res.status(400).json({
        success: false,
        message: `Le resourceType dans les données (${resourceData.resourceType}) ne correspond pas au type de ressource dans l'URL (${resourceType})`
      });
    }
    
    // Validation FHIR basique
    const validationResult = validateFhirResource(resourceData);
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        message: 'Ressource FHIR invalide',
        errors: validationResult.errors
      });
    }
    
    try {
      const response = await axios.post(`${server.url}/${resourceType}`, resourceData, createAxiosConfig(server));
      
      // Retourner directement la réponse FHIR sans enveloppe
      res.set('Content-Type', 'application/fhir+json');
      res.status(201).json(response.data);
    } catch (error) {
      logger.error(`Erreur lors de la création de la ressource ${resourceType}: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: `Erreur lors de la création de la ressource ${resourceType}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la gestion de la requête POST /resource: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/resource/{resourceType}/{id}:
 *   put:
 *     summary: Mettre à jour une ressource FHIR
 *     description: Met à jour une ressource FHIR existante du type spécifié avec l'ID fourni
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type de ressource FHIR (Patient, Practitioner, etc.)
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la ressource
 *       - in: query
 *         name: serverId
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à utiliser. Si non fourni, le serveur par défaut sera utilisé.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Ressource mise à jour avec succès
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Ressource non trouvée
 *       503:
 *         description: Serveur indisponible
 *       500:
 *         description: Erreur serveur
 */
router.put('/resource/:resourceType/:id', authCombined, checkServerHealth, async (req, res) => {
  try {
    const { resourceType, id } = req.params;
    const server = req.fhirServer;
    const resourceData = req.body;
    
    // Valider les paramètres obligatoires
    if (!resourceType || !id) {
      return res.status(400).json({
        success: false,
        message: 'Type de ressource et ID requis'
      });
    }
    
    // Valider la ressource
    if (!resourceData) {
      return res.status(400).json({
        success: false,
        message: 'Données de ressource requises'
      });
    }
    
    // Validation du resourceType et de l'id
    if (resourceData.resourceType !== resourceType) {
      return res.status(400).json({
        success: false,
        message: `Le resourceType dans les données (${resourceData.resourceType}) ne correspond pas au type de ressource dans l'URL (${resourceType})`
      });
    }
    
    if (resourceData.id && resourceData.id !== id) {
      return res.status(400).json({
        success: false,
        message: `L'ID dans les données (${resourceData.id}) ne correspond pas à l'ID dans l'URL (${id})`
      });
    }
    
    // S'assurer que l'ID est présent dans les données
    resourceData.id = id;
    
    // Validation FHIR basique
    const validationResult = validateFhirResource(resourceData);
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        message: 'Ressource FHIR invalide',
        errors: validationResult.errors
      });
    }
    
    try {
      const response = await axios.put(`${server.url}/${resourceType}/${id}`, resourceData, createAxiosConfig(server));
      
      // Retourner directement la réponse FHIR sans enveloppe
      res.set('Content-Type', 'application/fhir+json');
      res.status(200).json(response.data);
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour de la ressource ${resourceType}/${id}: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: `Erreur lors de la mise à jour de la ressource ${resourceType}/${id}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la gestion de la requête PUT /resource: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/resource/{resourceType}/{id}:
 *   delete:
 *     summary: Supprimer une ressource FHIR
 *     description: Supprime une ressource FHIR du type spécifié avec l'ID fourni
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type de ressource FHIR (Patient, Practitioner, etc.)
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la ressource
 *       - in: query
 *         name: serverId
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à utiliser. Si non fourni, le serveur par défaut sera utilisé.
 *     responses:
 *       204:
 *         description: Ressource supprimée avec succès
 *       404:
 *         description: Ressource non trouvée
 *       503:
 *         description: Serveur indisponible
 *       500:
 *         description: Erreur serveur
 */
router.delete('/resource/:resourceType/:id', authCombined, checkServerHealth, async (req, res) => {
  try {
    const { resourceType, id } = req.params;
    const server = req.fhirServer;
    
    // Valider les paramètres obligatoires
    if (!resourceType || !id) {
      return res.status(400).json({
        success: false,
        message: 'Type de ressource et ID requis'
      });
    }
    
    try {
      await axios.delete(`${server.url}/${resourceType}/${id}`, createAxiosConfig(server));
      
      // Retourner un statut 204 No Content pour la suppression réussie
      res.status(204).end();
    } catch (error) {
      logger.error(`Erreur lors de la suppression de la ressource ${resourceType}/${id}: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: `Erreur lors de la suppression de la ressource ${resourceType}/${id}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la gestion de la requête DELETE /resource: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/transaction:
 *   post:
 *     summary: Exécuter une transaction FHIR
 *     description: Exécute un Bundle de type transaction ou batch sur le serveur FHIR
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: query
 *         name: serverId
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à utiliser. Si non fourni, le serveur par défaut sera utilisé.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Transaction exécutée avec succès
 *       400:
 *         description: Requête invalide
 *       503:
 *         description: Serveur indisponible
 *       500:
 *         description: Erreur serveur
 */
router.post('/transaction', authCombined, checkServerHealth, async (req, res) => {
  try {
    const server = req.fhirServer;
    const bundleData = req.body;
    
    // Valider le bundle
    if (!bundleData) {
      return res.status(400).json({
        success: false,
        message: 'Bundle requis'
      });
    }
    
    // Vérifier que c'est bien un Bundle
    if (bundleData.resourceType !== 'Bundle') {
      return res.status(400).json({
        success: false,
        message: 'La ressource doit être un Bundle'
      });
    }
    
    // Vérifier que le type est transaction ou batch
    if (bundleData.type !== 'transaction' && bundleData.type !== 'batch') {
      return res.status(400).json({
        success: false,
        message: 'Le Bundle doit être de type transaction ou batch'
      });
    }
    
    try {
      const response = await axios.post(`${server.url}`, bundleData, createAxiosConfig(server));
      
      // Retourner directement la réponse FHIR sans enveloppe
      res.set('Content-Type', 'application/fhir+json');
      res.status(200).json(response.data);
    } catch (error) {
      logger.error(`Erreur lors de l'exécution de la transaction: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: 'Erreur lors de l\'exécution de la transaction',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la gestion de la requête /transaction: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/store-bundle:
 *   post:
 *     summary: Stocker un Bundle de ressources FHIR
 *     description: Stocke un Bundle de ressources FHIR sur le serveur en le transformant en transaction
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: query
 *         name: serverId
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à utiliser. Si non fourni, le serveur par défaut sera utilisé.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Bundle stocké avec succès
 *       400:
 *         description: Requête invalide
 *       503:
 *         description: Serveur indisponible
 *       500:
 *         description: Erreur serveur
 */
router.post('/store-bundle', authCombined, checkServerHealth, async (req, res) => {
  try {
    const server = req.fhirServer;
    const bundleData = req.body;
    
    // Valider le bundle
    if (!bundleData) {
      return res.status(400).json({
        success: false,
        message: 'Bundle requis'
      });
    }
    
    // Vérifier que c'est bien un Bundle
    if (bundleData.resourceType !== 'Bundle') {
      return res.status(400).json({
        success: false,
        message: 'La ressource doit être un Bundle'
      });
    }
    
    // Transformer le Bundle en transaction si ce n'est pas déjà fait
    const transactionBundle = { ...bundleData };
    
    // Si pas déjà une transaction, convertir
    if (transactionBundle.type !== 'transaction') {
      transactionBundle.type = 'transaction';
      
      // Si le Bundle a des entrées, ajouter un request à chaque entrée
      if (transactionBundle.entry && Array.isArray(transactionBundle.entry)) {
        transactionBundle.entry = transactionBundle.entry.map(entry => {
          if (!entry.request) {
            const resource = entry.resource;
            if (resource) {
              // Déterminer la méthode en fonction de la présence d'un ID
              const method = resource.id ? 'PUT' : 'POST';
              const url = resource.id 
                ? `${resource.resourceType}/${resource.id}` 
                : resource.resourceType;
              
              entry.request = {
                method,
                url
              };
            }
          }
          return entry;
        });
      }
    }
    
    try {
      const response = await axios.post(`${server.url}`, transactionBundle, createAxiosConfig(server));
      
      // Retourner directement la réponse FHIR sans enveloppe
      res.set('Content-Type', 'application/fhir+json');
      res.status(200).json(response.data);
    } catch (error) {
      logger.error(`Erreur lors du stockage du Bundle: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: 'Erreur lors du stockage du Bundle',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la gestion de la requête /store-bundle: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

module.exports = router;