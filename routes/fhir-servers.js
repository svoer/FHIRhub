/**
 * Routes pour la gestion des serveurs FHIR
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const authCombined = require('../middleware/authCombined');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { validateFhirResource } = require('../utils/fhirValidator');

// Configuration par défaut des serveurs FHIR
const SERVERS_CONFIG_FILE = path.join(__dirname, '../config/fhir-servers.json');
const DEFAULT_CONFIG = {
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
    },
    {
      id: 'public',
      name: 'Serveur HAPI FHIR Public',
      url: 'https://hapi.fhir.org/baseR4',
      version: 'R4',
      auth: 'none',
      isDefault: false,
      status: 'active'
    }
  ]
};

// Création du dossier config s'il n'existe pas
if (!fs.existsSync(path.dirname(SERVERS_CONFIG_FILE))) {
  fs.mkdirSync(path.dirname(SERVERS_CONFIG_FILE), { recursive: true });
}

// Initialisation du fichier de configuration s'il n'existe pas
if (!fs.existsSync(SERVERS_CONFIG_FILE)) {
  fs.writeFileSync(SERVERS_CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
  logger.info('Configuration FHIR par défaut créée');
}

// Fonction pour lire la configuration des serveurs
function getServersConfig() {
  try {
    const configContent = fs.readFileSync(SERVERS_CONFIG_FILE, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    logger.error(`Erreur lors de la lecture de la configuration FHIR: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}

// Fonction pour écrire la configuration des serveurs
function saveServersConfig(config) {
  try {
    fs.writeFileSync(SERVERS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error(`Erreur lors de l'enregistrement de la configuration FHIR: ${error.message}`);
    return false;
  }
}

// Middleware pour vérifier la santé du serveur avant les requêtes importantes
async function checkServerHealth(req, res, next) {
  try {
    const { serverId } = req.params;
    const config = getServersConfig();
    
    // Si aucun serverId spécifié, utiliser le serveur par défaut
    const serverToUse = serverId 
      ? config.servers.find(s => s.id === serverId)
      : config.servers.find(s => s.id === config.defaultServer);
    
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

/**
 * @swagger
 * /api/fhir/servers:
 *   get:
 *     summary: Obtenir la liste des serveurs FHIR configurés
 *     description: Retourne la liste des serveurs FHIR disponibles pour l'application
 *     tags:
 *       - FHIR
 *     responses:
 *       200:
 *         description: Liste des serveurs récupérée avec succès
 *       500:
 *         description: Erreur serveur
 */
router.get('/servers', authCombined, (req, res) => {
  try {
    const config = getServersConfig();
    
    res.json({
      success: true,
      data: {
        defaultServer: config.defaultServer,
        servers: config.servers
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des serveurs FHIR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des serveurs FHIR',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/servers/{serverId}:
 *   get:
 *     summary: Obtenir les détails d'un serveur FHIR
 *     description: Retourne les détails d'un serveur FHIR spécifique
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *     responses:
 *       200:
 *         description: Détails du serveur récupérés avec succès
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/servers/:serverId', authCombined, (req, res) => {
  try {
    const { serverId } = req.params;
    const config = getServersConfig();
    
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: server
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération du serveur FHIR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du serveur FHIR',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/servers/{serverId}/test:
 *   get:
 *     summary: Tester la connexion à un serveur FHIR
 *     description: Vérifie si un serveur FHIR est accessible et répond correctement
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR à tester
 *     responses:
 *       200:
 *         description: Test réussi, serveur disponible
 *       404:
 *         description: Serveur non trouvé
 *       503:
 *         description: Serveur inaccessible ou ne répond pas correctement
 *       500:
 *         description: Erreur serveur
 */
/**
 * @swagger
 * /api/fhir/servers/{serverId}/metadata:
 *   get:
 *     summary: Récupérer les métadonnées (CapabilityStatement) d'un serveur FHIR
 *     description: Récupère le CapabilityStatement du serveur FHIR spécifié
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *     responses:
 *       200:
 *         description: CapabilityStatement récupéré avec succès
 *       404:
 *         description: Serveur non trouvé
 *       503:
 *         description: Serveur inaccessible ou ne répond pas correctement
 *       500:
 *         description: Erreur serveur
 */
/**
 * @swagger
 * /api/fhir/servers/{serverId}/count/{resourceType}:
 *   get:
 *     summary: Compter le nombre de ressources d'un type spécifique
 *     description: Récupère le nombre total de ressources d'un type spécifique sur un serveur FHIR
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type de ressource FHIR à compter (ex. Patient, Observation)
 *     responses:
 *       200:
 *         description: Nombre de ressources récupéré avec succès
 *       404:
 *         description: Serveur non trouvé
 *       503:
 *         description: Serveur inaccessible ou ne répond pas correctement
 *       500:
 *         description: Erreur serveur
 */
/**
 * @swagger
 * /api/fhir/servers/{serverId}/search/{resourceType}:
 *   get:
 *     summary: Rechercher des ressources FHIR
 *     description: Recherche des ressources FHIR d'un type spécifique avec pagination et filtres
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type de ressource FHIR à rechercher (ex. Patient, Observation)
 *       - in: query
 *         name: _count
 *         schema:
 *           type: integer
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: _page
 *         schema:
 *           type: integer
 *         description: Numéro de page
 *     responses:
 *       200:
 *         description: Ressources récupérées avec succès
 *       404:
 *         description: Serveur non trouvé
 *       503:
 *         description: Serveur inaccessible ou ne répond pas correctement
 *       500:
 *         description: Erreur serveur
 */
/**
 * @swagger
 * /api/fhir/servers/{serverId}/resource/{resourceType}/{id}:
 *   get:
 *     summary: Récupérer une ressource FHIR par son ID
 *     description: Récupère une ressource FHIR spécifique par son type et son ID
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type de ressource FHIR (ex. Patient, Observation)
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la ressource à récupérer
 *     responses:
 *       200:
 *         description: Ressource récupérée avec succès
 *       404:
 *         description: Serveur ou ressource non trouvé(e)
 *       503:
 *         description: Serveur inaccessible ou ne répond pas correctement
 *       500:
 *         description: Erreur serveur
 */
router.get('/servers/:serverId/resource/:resourceType/:id', authCombined, async (req, res) => {
  try {
    const { serverId, resourceType, id } = req.params;
    const config = getServersConfig();
    
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Préparation de la configuration pour la requête
    const headers = {
      'Accept': 'application/fhir+json'
    };
    
    let axiosConfig = { 
      timeout: 10000,
      headers
    };
    
    // Ajout des informations d'authentification si nécessaire
    if (server.auth === 'basic' && server.username && server.password) {
      axiosConfig.auth = {
        username: server.username,
        password: server.password
      };
    } else if (server.auth === 'token' && server.token) {
      headers['Authorization'] = `Bearer ${server.token}`;
    }
    
    try {
      // Récupération de la ressource
      const response = await axios.get(`${server.url}/${resourceType}/${id}`, axiosConfig);
      
      if (response.data && response.data.resourceType) {
        res.json({
          success: true,
          message: 'Ressource récupérée avec succès',
          data: response.data
        });
      } else {
        throw new Error('La réponse n\'est pas une ressource FHIR valide');
      }
    } catch (error) {
      // Si c'est une erreur 404, c'est une ressource non trouvée
      if (error.response && error.response.status === 404) {
        return res.status(404).json({
          success: false,
          message: `Ressource ${resourceType}/${id} non trouvée`,
          error: 'Resource not found'
        });
      }
      
      logger.error(`Erreur lors de la récupération de la ressource ${resourceType}/${id} sur le serveur FHIR ${serverId}: ${error.message}`);
      res.status(503).json({
        success: false,
        message: `Impossible de récupérer la ressource ${resourceType}/${id} sur le serveur ${server.name}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération de la ressource: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la ressource sur le serveur FHIR',
      error: error.message
    });
  }
});

router.get('/servers/:serverId/search/:resourceType', authCombined, async (req, res) => {
  try {
    const { serverId, resourceType } = req.params;
    const config = getServersConfig();
    
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Préparation de la configuration pour la requête
    const headers = {
      'Accept': 'application/fhir+json'
    };
    
    let axiosConfig = { 
      timeout: 15000, // Augmentation du timeout pour les recherches
      headers
    };
    
    // Ajout des informations d'authentification si nécessaire
    if (server.auth === 'basic' && server.username && server.password) {
      axiosConfig.auth = {
        username: server.username,
        password: server.password
      };
    } else if (server.auth === 'token' && server.token) {
      headers['Authorization'] = `Bearer ${server.token}`;
    }
    
    try {
      // Récupérer les paramètres de pagination et de recherche
      const { _count = 10, _page = 1, ...searchParams } = req.query;
      
      // Construire l'URL de recherche
      let searchUrl = `${server.url}/${resourceType}?_count=${_count}`;
      
      // HAPI FHIR utilise _getpagesoffset pour la pagination
      if (_page > 1) {
        const offset = (_page - 1) * parseInt(_count);
        searchUrl += `&_getpagesoffset=${offset}`;
      }
      
      // Ajouter les autres paramètres de recherche
      Object.entries(searchParams).forEach(([key, value]) => {
        if (key !== '_getpagesoffset' && key !== '_count') {
          searchUrl += `&${key}=${value}`;
        }
      });
      
      logger.info(`Recherche FHIR: ${searchUrl}`);
      
      const response = await axios.get(searchUrl, axiosConfig);
      
      if (response.data && (response.data.resourceType === 'Bundle' || response.data.resourceType === 'OperationOutcome')) {
        res.json({
          success: true,
          message: 'Recherche effectuée avec succès',
          data: response.data
        });
      } else {
        throw new Error('La réponse n\'est pas un Bundle ou OperationOutcome FHIR valide');
      }
    } catch (error) {
      logger.error(`Erreur lors de la recherche des ressources ${resourceType} sur le serveur FHIR ${serverId}: ${error.message}`);
      res.status(503).json({
        success: false,
        message: `Impossible de rechercher les ressources ${resourceType} sur le serveur ${server.name}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la recherche des ressources: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche des ressources sur le serveur FHIR',
      error: error.message
    });
  }
});

router.get('/servers/:serverId/count/:resourceType', authCombined, async (req, res) => {
  // Démarrer une minuterie pour abondonner la requête si elle prend trop de temps
  const requestTimeout = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn(`Timeout déclenché pour le comptage des ressources ${req.params.resourceType} sur le serveur ${req.params.serverId}`);
      return res.status(503).json({
        success: false,
        message: 'La requête a pris trop de temps et a été abandonnée',
        error: 'Request timeout'
      });
    }
  }, 10000); // 10 secondes maximum côté serveur, même si axios a son propre timeout
  
  try {
    const { serverId, resourceType } = req.params;
    const config = getServersConfig();
    
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      clearTimeout(requestTimeout);
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Préparation de la configuration pour la requête
    const headers = {
      'Accept': 'application/fhir+json'
    };
    
    let axiosConfig = { 
      timeout: 8000, // Réduit à 8 secondes pour éviter de bloquer l'API trop longtemps
      headers
    };
    
    // Ajout des informations d'authentification si nécessaire
    if (server.auth === 'basic' && server.username && server.password) {
      axiosConfig.auth = {
        username: server.username,
        password: server.password
      };
    } else if (server.auth === 'token' && server.token) {
      headers['Authorization'] = `Bearer ${server.token}`;
    }
    
    try {
      // Pour les gros datasets, utiliser une limite de 1 pour juste obtenir le total
      const response = await axios.get(`${server.url}/${resourceType}?_count=1&_summary=count`, axiosConfig);
      
      // Le nombre de ressources est généralement dans l'élément total
      let count = 0;
      if (response.data && response.data.total !== undefined) {
        count = response.data.total;
      }
      
      clearTimeout(requestTimeout);
      res.json({
        success: true,
        message: `Nombre de ressources ${resourceType} récupéré avec succès`,
        data: {
          resourceType,
          count
        }
      });
    } catch (error) {
      clearTimeout(requestTimeout);
      logger.error(`Erreur lors du comptage des ressources ${resourceType} sur le serveur FHIR ${serverId}: ${error.message}`);
      
      // Renseigner un comptage de 0 plutôt qu'une erreur pour ne pas bloquer l'interface
      res.json({
        success: true,
        message: `Le comptage a échoué mais l'interface continuera de fonctionner`,
        data: {
          resourceType,
          count: 0,
          error: true
        }
      });
    }
  } catch (error) {
    clearTimeout(requestTimeout);
    logger.error(`Erreur lors du comptage des ressources: ${error.message}`);
    
    // Renseigner un comptage de 0 plutôt qu'une erreur pour ne pas bloquer l'interface
    res.json({
      success: true,
      message: `Le comptage a échoué mais l'interface continuera de fonctionner`,
      data: {
        resourceType: req.params.resourceType,
        count: 0,
        error: true
      }
    });
  }
});

router.get('/servers/:serverId/metadata', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const config = getServersConfig();
    
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Préparation de la configuration pour la requête
    const headers = {
      'Accept': 'application/fhir+json'
    };
    
    let axiosConfig = { 
      timeout: 10000,
      headers
    };
    
    // Ajout des informations d'authentification si nécessaire
    if (server.auth === 'basic' && server.username && server.password) {
      axiosConfig.auth = {
        username: server.username,
        password: server.password
      };
    } else if (server.auth === 'token' && server.token) {
      headers['Authorization'] = `Bearer ${server.token}`;
    }
    
    try {
      // Récupération des métadonnées (CapabilityStatement)
      const response = await axios.get(`${server.url}/metadata`, axiosConfig);
      
      if (response.data && response.data.resourceType === 'CapabilityStatement') {
        // Vérifier que la réponse est bien un CapabilityStatement
        res.json({
          success: true,
          message: 'Métadonnées récupérées avec succès',
          data: response.data
        });
      } else {
        throw new Error('La réponse n\'est pas un CapabilityStatement FHIR valide');
      }
    } catch (error) {
      logger.error(`Erreur lors de la récupération des métadonnées du serveur FHIR ${serverId}: ${error.message}`);
      res.status(503).json({
        success: false,
        message: `Impossible d'accéder aux métadonnées du serveur ${server.name}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des métadonnées: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des métadonnées du serveur FHIR',
      error: error.message
    });
  }
});

router.get('/servers/:serverId/test', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const config = getServersConfig();
    
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Préparation de la configuration pour la requête
    const headers = {
      'Accept': 'application/fhir+json'
    };
    
    let axiosConfig = { 
      timeout: 10000,  // Timeout plus long pour les tests manuels
      headers
    };
    
    // Ajout des informations d'authentification si nécessaire
    if (server.auth === 'basic' && server.username && server.password) {
      axiosConfig.auth = {
        username: server.username,
        password: server.password
      };
    } else if (server.auth === 'token' && server.token) {
      headers['Authorization'] = `Bearer ${server.token}`;
    }
    
    try {
      // Test de connectivité avec le point de terminaison metadata
      const response = await axios.get(`${server.url}/metadata`, axiosConfig);
      
      // Vérification que la réponse est bien un CapabilityStatement FHIR
      if (response.data && response.data.resourceType === 'CapabilityStatement') {
        // Le test est réussi
        res.json({
          success: true,
          message: `Connexion réussie au serveur ${server.name}`,
          data: {
            fhirVersion: response.data.fhirVersion || server.version,
            software: response.data.software?.name || 'Inconnu',
            status: 'active'
          }
        });
        
        // Mettre à jour le statut du serveur si nécessaire
        if (server.status !== 'active') {
          server.status = 'active';
          saveServersConfig(config);
        }
      } else {
        throw new Error('La réponse n\'est pas un CapabilityStatement FHIR valide');
      }
    } catch (error) {
      logger.error(`Erreur lors du test du serveur FHIR ${serverId}: ${error.message}`);
      
      // Mettre à jour le statut du serveur
      if (server.status === 'active') {
        server.status = 'inactive';
        saveServersConfig(config);
      }
      
      res.status(503).json({
        success: false,
        message: `Impossible de se connecter au serveur ${server.name}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors du test du serveur FHIR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test du serveur FHIR',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/servers:
 *   post:
 *     summary: Ajouter un nouveau serveur FHIR
 *     description: Ajoute un nouveau serveur FHIR à la configuration
 *     tags:
 *       - FHIR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - url
 *               - version
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nom du serveur FHIR
 *               url:
 *                 type: string
 *                 description: URL du serveur FHIR
 *               version:
 *                 type: string
 *                 enum: [DSTU2, DSTU3, R4, R5]
 *                 description: Version FHIR supportée
 *               auth:
 *                 type: string
 *                 enum: [none, basic, token]
 *                 description: Type d'authentification
 *               username:
 *                 type: string
 *                 description: Nom d'utilisateur (pour auth basic)
 *               password:
 *                 type: string
 *                 description: Mot de passe (pour auth basic)
 *               token:
 *                 type: string
 *                 description: Token d'authentification (pour auth token)
 *     responses:
 *       201:
 *         description: Serveur FHIR ajouté avec succès
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/servers', authCombined, async (req, res) => {
  try {
    const { name, url, version, auth, username, password, token } = req.body;
    
    // Validation des champs obligatoires
    if (!name || !url || !version) {
      return res.status(400).json({
        success: false,
        message: 'Les champs name, url et version sont obligatoires'
      });
    }
    
    // Validation de l'URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'URL invalide'
      });
    }
    
    // Validation de la version
    const validVersions = ['DSTU2', 'DSTU3', 'R4', 'R5'];
    if (!validVersions.includes(version)) {
      return res.status(400).json({
        success: false,
        message: 'Version FHIR invalide. Valeurs acceptées: ' + validVersions.join(', ')
      });
    }
    
    // Validation du type d'authentification
    const validAuthTypes = ['none', 'basic', 'token'];
    if (auth && !validAuthTypes.includes(auth)) {
      return res.status(400).json({
        success: false,
        message: 'Type d\'authentification invalide. Valeurs acceptées: ' + validAuthTypes.join(', ')
      });
    }
    
    // Vérification de la concordance entre le type d'auth et les credentials
    if (auth === 'basic' && (!username || !password)) {
      return res.status(400).json({
        success: false,
        message: 'Les champs username et password sont requis pour l\'authentification basic'
      });
    }
    
    if (auth === 'token' && !token) {
      return res.status(400).json({
        success: false,
        message: 'Le champ token est requis pour l\'authentification token'
      });
    }
    
    // Test de connexion au serveur
    try {
      const headers = {
        'Accept': 'application/fhir+json'
      };
      
      // Ajout des informations d'authentification si nécessaire
      let axiosConfig = { 
        timeout: 5000,
        headers
      };
      
      if (auth === 'basic') {
        axiosConfig.auth = {
          username,
          password
        };
      } else if (auth === 'token') {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      await axios.get(`${url}/metadata`, axiosConfig);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de se connecter au serveur FHIR',
        error: error.message
      });
    }
    
    // Ajout du serveur à la configuration
    const config = getServersConfig();
    const serverId = `server-${Date.now()}`;
    
    const newServer = {
      id: serverId,
      name,
      url,
      version,
      auth: auth || 'none',
      status: 'active',
      isDefault: false
    };
    
    // Ajout des credentials si nécessaire
    if (auth === 'basic') {
      newServer.username = username;
      newServer.password = password;
    } else if (auth === 'token') {
      newServer.token = token;
    }
    
    config.servers.push(newServer);
    
    if (saveServersConfig(config)) {
      res.status(201).json({
        success: true,
        message: 'Serveur FHIR ajouté avec succès',
        data: {
          serverId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'enregistrement de la configuration'
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de l'ajout d'un serveur FHIR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du serveur FHIR',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/servers/{serverId}:
 *   put:
 *     summary: Mettre à jour un serveur FHIR
 *     description: Met à jour les informations d'un serveur FHIR existant
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nom du serveur FHIR
 *               url:
 *                 type: string
 *                 description: URL du serveur FHIR
 *               version:
 *                 type: string
 *                 enum: [DSTU2, DSTU3, R4, R5]
 *                 description: Version FHIR supportée
 *               auth:
 *                 type: string
 *                 enum: [none, basic, token]
 *                 description: Type d'authentification
 *               username:
 *                 type: string
 *                 description: Nom d'utilisateur (pour auth basic)
 *               password:
 *                 type: string
 *                 description: Mot de passe (pour auth basic)
 *               token:
 *                 type: string
 *                 description: Token d'authentification (pour auth token)
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 description: Statut du serveur
 *     responses:
 *       200:
 *         description: Serveur FHIR mis à jour avec succès
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.put('/servers/:serverId', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, url, version, auth, username, password, token, status } = req.body;
    
    const config = getServersConfig();
    const serverIndex = config.servers.findIndex(s => s.id === serverId);
    
    if (serverIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    const server = config.servers[serverIndex];
    
    // Mise à jour des champs fournis
    if (name) server.name = name;
    if (url) {
      try {
        new URL(url);
        server.url = url;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'URL invalide'
        });
      }
    }
    
    if (version) {
      const validVersions = ['DSTU2', 'DSTU3', 'R4', 'R5'];
      if (!validVersions.includes(version)) {
        return res.status(400).json({
          success: false,
          message: 'Version FHIR invalide. Valeurs acceptées: ' + validVersions.join(', ')
        });
      }
      server.version = version;
    }
    
    if (auth) {
      const validAuthTypes = ['none', 'basic', 'token'];
      if (!validAuthTypes.includes(auth)) {
        return res.status(400).json({
          success: false,
          message: 'Type d\'authentification invalide. Valeurs acceptées: ' + validAuthTypes.join(', ')
        });
      }
      server.auth = auth;
      
      // Réinitialiser les credentials si le type d'auth change
      if (auth === 'none') {
        delete server.username;
        delete server.password;
        delete server.token;
      } else if (auth === 'basic') {
        delete server.token;
        if (username) server.username = username;
        if (password) server.password = password;
      } else if (auth === 'token') {
        delete server.username;
        delete server.password;
        if (token) server.token = token;
      }
    } else {
      // Si auth n'est pas fourni mais que des credentials le sont
      if (server.auth === 'basic') {
        if (username) server.username = username;
        if (password) server.password = password;
      } else if (server.auth === 'token') {
        if (token) server.token = token;
      }
    }
    
    if (status) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Statut invalide. Valeurs acceptées: active, inactive'
        });
      }
      server.status = status;
    }
    
    // Si le serveur est actif, tester la connexion
    if (server.status === 'active') {
      try {
        const headers = {
          'Accept': 'application/fhir+json'
        };
        
        let axiosConfig = { 
          timeout: 5000,
          headers
        };
        
        if (server.auth === 'basic') {
          axiosConfig.auth = {
            username: server.username,
            password: server.password
          };
        } else if (server.auth === 'token') {
          headers['Authorization'] = `Bearer ${server.token}`;
        }
        
        await axios.get(`${server.url}/metadata`, axiosConfig);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de se connecter au serveur FHIR',
          error: error.message
        });
      }
    }
    
    config.servers[serverIndex] = server;
    
    if (saveServersConfig(config)) {
      res.json({
        success: true,
        message: 'Serveur FHIR mis à jour avec succès',
        data: {
          server
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'enregistrement de la configuration'
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour d'un serveur FHIR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du serveur FHIR',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/servers/{serverId}:
 *   delete:
 *     summary: Supprimer un serveur FHIR
 *     description: Supprime un serveur FHIR de la configuration
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *     responses:
 *       200:
 *         description: Serveur FHIR supprimé avec succès
 *       400:
 *         description: Impossible de supprimer le serveur par défaut
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.delete('/servers/:serverId', authCombined, (req, res) => {
  try {
    const { serverId } = req.params;
    const config = getServersConfig();
    
    const serverIndex = config.servers.findIndex(s => s.id === serverId);
    
    if (serverIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Empêcher la suppression du serveur par défaut
    if (config.servers[serverIndex].id === config.defaultServer) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer le serveur par défaut'
      });
    }
    
    // Empêcher la suppression si c'est le dernier serveur
    if (config.servers.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer le dernier serveur FHIR'
      });
    }
    
    // Suppression du serveur
    config.servers.splice(serverIndex, 1);
    
    if (saveServersConfig(config)) {
      res.json({
        success: true,
        message: 'Serveur FHIR supprimé avec succès'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'enregistrement de la configuration'
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la suppression d'un serveur FHIR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du serveur FHIR',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/servers/default/{serverId}:
 *   put:
 *     summary: Définir un serveur FHIR comme serveur par défaut
 *     description: Définit un serveur FHIR comme serveur par défaut pour l'application
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *     responses:
 *       200:
 *         description: Serveur par défaut défini avec succès
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.put('/servers/default/:serverId', authCombined, (req, res) => {
  try {
    const { serverId } = req.params;
    const config = getServersConfig();
    
    const server = config.servers.find(s => s.id === serverId);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Vérifier que le serveur est actif
    if (server.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de définir un serveur inactif comme serveur par défaut'
      });
    }
    
    // Mettre à jour le serveur par défaut
    config.defaultServer = serverId;
    
    // Mettre à jour les flags isDefault
    config.servers.forEach(s => {
      s.isDefault = (s.id === serverId);
    });
    
    if (saveServersConfig(config)) {
      res.json({
        success: true,
        message: 'Serveur FHIR par défaut défini avec succès',
        data: {
          defaultServer: serverId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'enregistrement de la configuration'
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la définition du serveur FHIR par défaut: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la définition du serveur FHIR par défaut',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/servers/{serverId}/check:
 *   get:
 *     summary: Vérifier la connectivité d'un serveur FHIR
 *     description: Vérifie que le serveur FHIR est accessible et fonctionne correctement
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *     responses:
 *       200:
 *         description: Serveur FHIR accessible
 *       404:
 *         description: Serveur non trouvé
 *       503:
 *         description: Serveur inaccessible
 *       500:
 *         description: Erreur serveur
 */
router.get('/servers/:serverId/check', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const config = getServersConfig();
    
    const server = config.servers.find(s => s.id === serverId);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Test de connexion
    try {
      const headers = {
        'Accept': 'application/fhir+json'
      };
      
      let axiosConfig = { 
        timeout: 5000,
        headers
      };
      
      if (server.auth === 'basic') {
        axiosConfig.auth = {
          username: server.username,
          password: server.password
        };
      } else if (server.auth === 'token') {
        headers['Authorization'] = `Bearer ${server.token}`;
      }
      
      const response = await axios.get(`${server.url}/metadata`, axiosConfig);
      
      // Analyser la réponse pour extraire la version FHIR
      let detectedVersion = null;
      if (response.data && response.data.fhirVersion) {
        detectedVersion = response.data.fhirVersion;
      }
      
      res.json({
        success: true,
        message: 'Serveur FHIR accessible',
        data: {
          status: 'online',
          responseTime: response.headers['x-response-time'] || 'non disponible',
          detectedVersion
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la vérification du serveur FHIR ${serverId}: ${error.message}`);
      res.status(503).json({
        success: false,
        message: 'Serveur FHIR inaccessible',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la vérification du serveur FHIR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du serveur FHIR',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir/servers/{serverId}/local-default:
 *   post:
 *     summary: Définir un serveur FHIR local comme serveur par défaut
 *     description: Définit un serveur FHIR local (localhost) comme serveur local par défaut pour l'application
 *     tags:
 *       - FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR local
 *     responses:
 *       200:
 *         description: Serveur local par défaut défini avec succès
 *       400:
 *         description: Requête invalide ou serveur non local
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/servers/:serverId/local-default', authCombined, (req, res) => {
  try {
    const { serverId } = req.params;
    const config = getServersConfig();
    
    const server = config.servers.find(s => s.id === serverId);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Vérifier que le serveur est actif
    if (server.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de définir un serveur inactif comme serveur local par défaut'
      });
    }
    
    // Vérifier que c'est bien un serveur local
    if (!server.url.includes('localhost') && !server.url.includes('127.0.0.1')) {
      return res.status(400).json({
        success: false,
        message: 'Cette opération est réservée aux serveurs locaux'
      });
    }
    
    // Vérifier les identifiants des serveurs locaux existants et les filtrer
    const filteredServers = [];
    for (const currentServer of config.servers) {
      // Si c'est un serveur avec un URL identique, ne pas le conserver
      const isLocalDuplicate = currentServer.id !== serverId && 
                              (currentServer.url === server.url || 
                               (currentServer.url.includes('localhost') && server.url.includes('localhost')));
      
      if (!isLocalDuplicate) {
        filteredServers.push(currentServer);
      } else {
        logger.info(`Serveur local dupliqué supprimé: ${currentServer.id} (${currentServer.name})`);
      }
    }
    
    // Mettre à jour la liste des serveurs sans les doublons
    config.servers = filteredServers;
    
    // Définir comme serveur par défaut si nécessaire
    config.defaultServer = serverId;
    
    // Mettre à jour les flags isDefault
    config.servers.forEach(s => {
      s.isDefault = (s.id === serverId);
    });
    
    // Mettre à jour le nom du serveur pour indiquer qu'il est local par défaut
    if (!server.name.includes('(Local par défaut)')) {
      server.name = `${server.name} (Local par défaut)`;
    }
    
    if (saveServersConfig(config)) {
      res.json({
        success: true,
        message: 'Serveur FHIR local par défaut défini avec succès',
        data: {
          defaultServer: serverId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'enregistrement de la configuration'
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la définition du serveur FHIR local par défaut: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la définition du serveur FHIR local par défaut',
      error: error.message
    });
  }
});

module.exports = router;