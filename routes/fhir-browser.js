/**
 * Routes dédiées au navigateur FHIR
 * Ces routes sont optimisées pour réduire les appels au serveur FHIR
 * et éviter les erreurs de limitation de taux (429)
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const authCombined = require('../middleware/authCombined');

// Durée de mise en cache des métadonnées et statistiques (en secondes)
const CACHE_DURATION = 300; // 5 minutes

// Cache pour les données FHIR
const cache = {
  metadata: {}, // Métadonnées des serveurs FHIR
  resourceCounts: {}, // Nombre de ressources par type pour chaque serveur
  timestamps: {} // Horodatages pour gérer l'expiration du cache
};

/**
 * Récupérer la configuration des serveurs FHIR
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
 * Endpoint pour obtenir la liste des serveurs FHIR
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
 * Enregistrer la configuration des serveurs FHIR
 */
function saveServersConfig(config) {
  try {
    const configPath = path.join(__dirname, '../config/fhir-servers.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    logger.error(`Erreur lors de l'enregistrement de la configuration des serveurs FHIR: ${error.message}`);
  }
}

/**
 * Créer la configuration pour une requête Axios vers un serveur FHIR
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
  
  // Ajout des informations d'authentification si nécessaire
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
 * Vérifier et mettre à jour le cache des métadonnées pour un serveur
 */
async function ensureMetadataCache(serverId) {
  const server = getServersConfig().servers.find(s => s.id === serverId);
  if (!server) {
    throw new Error(`Serveur FHIR avec l'ID ${serverId} non trouvé`);
  }
  
  const cacheKey = `metadata_${serverId}`;
  const now = Math.floor(Date.now() / 1000);
  
  // Vérifier si le cache est valide
  if (
    cache.metadata[serverId] && 
    cache.timestamps[cacheKey] && 
    now - cache.timestamps[cacheKey] < CACHE_DURATION
  ) {
    return cache.metadata[serverId];
  }
  
  // Récupérer les métadonnées
  try {
    logger.info(`Récupération des métadonnées pour le serveur ${serverId}`);
    const response = await axios.get(
      `${server.url}/metadata`, 
      createAxiosConfig(server)
    );
    
    // Vérifier que la réponse est bien un CapabilityStatement
    if (response.data && response.data.resourceType === 'CapabilityStatement') {
      // Mettre en cache les métadonnées
      cache.metadata[serverId] = response.data;
      cache.timestamps[cacheKey] = now;
      
      // Mettre à jour le statut du serveur si nécessaire
      if (server.status !== 'active') {
        server.status = 'active';
        const config = getServersConfig();
        const serverIndex = config.servers.findIndex(s => s.id === serverId);
        if (serverIndex !== -1) {
          config.servers[serverIndex].status = 'active';
          saveServersConfig(config);
        }
      }
      
      return response.data;
    } else {
      throw new Error('La réponse n\'est pas un CapabilityStatement FHIR valide');
    }
  } catch (error) {
    // En cas d'erreur, marquer le serveur comme inactif
    logger.error(`Erreur lors de la récupération des métadonnées pour le serveur ${serverId}: ${error.message}`);
    
    // Mettre à jour le statut du serveur si nécessaire
    if (server.status !== 'inactive') {
      server.status = 'inactive';
      const config = getServersConfig();
      const serverIndex = config.servers.findIndex(s => s.id === serverId);
      if (serverIndex !== -1) {
        config.servers[serverIndex].status = 'inactive';
        saveServersConfig(config);
      }
    }
    
    throw error;
  }
}

/**
 * Récupérer les types de ressources pour un serveur
 * Cette fonction utilise le cache des métadonnées pour éviter des appels inutiles
 */
async function getResourceTypes(serverId) {
  try {
    const metadata = await ensureMetadataCache(serverId);
    const resourceTypes = [];
    
    if (metadata.rest && metadata.rest.length > 0) {
      const restResources = metadata.rest[0].resource || [];
      restResources.forEach(resource => {
        if (resource.type) {
          resourceTypes.push(resource.type);
        }
      });
    }
    
    return resourceTypes.sort();
  } catch (error) {
    logger.error(`Erreur lors de la récupération des types de ressources pour le serveur ${serverId}: ${error.message}`);
    throw error;
  }
}

/**
 * Obtenir le nombre de ressources pour un type spécifique
 * Cette fonction utilise le cache pour éviter des appels répétés
 */
async function getResourceCount(serverId, resourceType) {
  const server = getServersConfig().servers.find(s => s.id === serverId);
  if (!server) {
    throw new Error(`Serveur FHIR avec l'ID ${serverId} non trouvé`);
  }
  
  const cacheKey = `count_${serverId}_${resourceType}`;
  const now = Math.floor(Date.now() / 1000);
  
  // Vérifier si le cache est valide
  if (
    cache.resourceCounts[cacheKey] !== undefined && 
    cache.timestamps[cacheKey] && 
    now - cache.timestamps[cacheKey] < CACHE_DURATION
  ) {
    return cache.resourceCounts[cacheKey];
  }
  
  // Récupérer le nombre de ressources
  try {
    const response = await axios.get(
      `${server.url}/${resourceType}?_summary=count&_count=1`,
      createAxiosConfig(server, { timeout: 12000 }) // Augmenter le timeout à 12 secondes
    );
    
    // Extraire le nombre total de ressources
    let count = 0;
    if (response.data && response.data.total !== undefined) {
      count = response.data.total;
    }
    
    // Mettre en cache le résultat
    cache.resourceCounts[cacheKey] = count;
    cache.timestamps[cacheKey] = now;
    
    return count;
  } catch (error) {
    logger.warn(`Erreur lors du comptage des ressources ${resourceType} sur le serveur ${serverId}: ${error.message}`);
    
    // En cas d'erreur, retourner 0 mais ne pas mettre en cache pour reessayer plus tard
    return 0;
  }
}

/**
 * Endpoint pour obtenir les métadonnées d'un serveur FHIR
 */
router.get('/servers/:serverId/metadata', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    try {
      const metadata = await ensureMetadataCache(serverId);
      res.json({
        success: true,
        message: 'Métadonnées récupérées avec succès',
        data: metadata
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: `Impossible de récupérer les métadonnées du serveur FHIR`,
        error: error.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des métadonnées',
      error: error.message
    });
  }
});

/**
 * Endpoint unifié pour obtenir les types de ressources et leurs statistiques pour un serveur FHIR
 * Cette approche réduit considérablement le nombre d'appels au serveur FHIR
 * Version optimisée avec traitement séquentiel et priorité à l'affichage
 */
router.get('/servers/:serverId/resource-types', authCombined, async (req, res) => {
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
    
    try {
      // Récupérer les types de ressources
      const resourceTypes = await getResourceTypes(serverId);
      
      // Filtrer uniquement les types les plus utilisés dans un contexte santé
      // cela réduit considérablement la charge et le risque de timeouts
      const priorityTypes = ['Patient', 'Observation', 'Medication', 'Condition', 
        'MedicationRequest', 'DiagnosticReport', 'Encounter', 'Procedure', 
        'AllergyIntolerance', 'Immunization', 'DocumentReference', 'Organization'];
      
      // Trier les types de ressources avec les types prioritaires en premier
      const sortedTypes = resourceTypes.sort((a, b) => {
        const aIsPriority = priorityTypes.includes(a);
        const bIsPriority = priorityTypes.includes(b);
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        return a.localeCompare(b);
      });
      
      // Préparer l'objet de réponse
      const response = {
        success: true,
        message: 'Types de ressources récupérés avec succès',
        data: {
          resourceTypes: sortedTypes.map(type => ({
            type,
            count: null, // Sera rempli par des requêtes asynchrones
            priority: priorityTypes.includes(type) // Indication si c'est un type prioritaire
          }))
        }
      };
      
      // Envoyer la réponse immédiatement
      res.json(response);
      
      // Récupérer les compteurs en arrière-plan et les mettre en cache
      // On ne bloque pas la réponse pour cela
      (async () => {
        try {
          // Traiter d'abord les types prioritaires
          logger.info(`Chargement des compteurs pour ${sortedTypes.length} types de ressources (séquentiel)`);
          
          // Traiter les ressources séquentiellement pour réduire la charge sur le serveur
          for (let i = 0; i < sortedTypes.length; i++) {
            const type = sortedTypes[i];
            try {
              // Récupérer le compteur et le mettre en cache
              await getResourceCount(serverId, type);
              
              // Pause plus longue entre les ressources pour éviter de surcharger l'API
              if (i < sortedTypes.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 400));
              }
            } catch (error) {
              logger.warn(`Échec du comptage des ressources ${type}: ${error.message}`);
            }
          }
          
          logger.info(`Chargement des compteurs terminé pour ${sortedTypes.length} types de ressources`);
        } catch (error) {
          logger.error(`Erreur lors de la récupération des compteurs: ${error.message}`);
        }
      })();
      
    } catch (error) {
      // Cette erreur est gérée après la première tentative de réponse,
      // donc elle ne peut être envoyée au client qu'en cas d'erreur vraiment précoce
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: `Impossible de récupérer les types de ressources pour le serveur ${server.name}`,
          error: error.message
        });
      }
    }
  } catch (error) {
    // Cette erreur est gérée après la première tentative de réponse
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des types de ressources',
        error: error.message
      });
    }
  }
});

/**
 * Endpoint pour obtenir le nombre de ressources d'un type spécifique
 */
router.get('/servers/:serverId/count/:resourceType', authCombined, async (req, res) => {
  try {
    const { serverId, resourceType } = req.params;
    
    try {
      const count = await getResourceCount(serverId, resourceType);
      res.json({
        success: true,
        message: `Nombre de ressources ${resourceType} récupéré avec succès`,
        data: {
          resourceType,
          count
        }
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: `Impossible de compter les ressources ${resourceType}`,
        error: error.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du comptage des ressources',
      error: error.message
    });
  }
});

/**
 * Endpoint pour effectuer une recherche de ressources
 */
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
      
      const response = await axios.get(
        searchUrl, 
        createAxiosConfig(server, { timeout: 15000 })
      );
      
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
        message: `Impossible de rechercher les ressources ${resourceType}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la recherche des ressources: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche des ressources',
      error: error.message
    });
  }
});

/**
 * Endpoint pour récupérer une ressource spécifique
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
    
    try {
      const response = await axios.get(
        `${server.url}/${resourceType}/${id}`, 
        createAxiosConfig(server)
      );
      
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
        message: `Impossible de récupérer la ressource ${resourceType}/${id}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération de la ressource: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la ressource',
      error: error.message
    });
  }
});

/**
 * Endpoint pour tester un serveur FHIR
 */
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
    
    try {
      // Tester le serveur en récupérant les métadonnées
      await ensureMetadataCache(serverId);
      
      // Si nous arrivons ici, le test est réussi
      res.json({
        success: true,
        message: `Connexion réussie au serveur ${server.name}`,
        data: {
          fhirVersion: cache.metadata[serverId]?.fhirVersion || server.version,
          software: cache.metadata[serverId]?.software?.name || 'Inconnu',
          status: 'active'
        }
      });
    } catch (error) {
      logger.error(`Erreur lors du test du serveur FHIR ${serverId}: ${error.message}`);
      
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
 * Endpoint pour effacer le cache du navigateur FHIR
 */
router.delete('/cache', authCombined, (req, res) => {
  try {
    // Réinitialiser le cache
    cache.metadata = {};
    cache.resourceCounts = {};
    cache.timestamps = {};
    
    res.json({
      success: true,
      message: 'Cache du navigateur FHIR effacé avec succès'
    });
  } catch (error) {
    logger.error(`Erreur lors de l'effacement du cache: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'effacement du cache',
      error: error.message
    });
  }
});

module.exports = router;