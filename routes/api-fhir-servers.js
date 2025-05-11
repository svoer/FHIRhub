/**
 * Routes d'API pour la gestion des serveurs FHIR
 * Cette version est utilisée directement par les interfaces
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

/**
 * Récupérer la configuration des serveurs FHIR
 */
function getServersConfig() {
  try {
    if (fs.existsSync(SERVERS_CONFIG_FILE)) {
      const configData = fs.readFileSync(SERVERS_CONFIG_FILE, 'utf8');
      return JSON.parse(configData);
    } else {
      // Si le fichier n'existe pas, créer la configuration par défaut
      logger.info("Création de la configuration par défaut des serveurs FHIR");
      fs.writeFileSync(SERVERS_CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    logger.error(`Erreur lors de la lecture de la configuration des serveurs FHIR: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Enregistrer la configuration des serveurs FHIR
 */
function saveServersConfig(config) {
  try {
    const directoryPath = path.dirname(SERVERS_CONFIG_FILE);
    
    // Vérifier si le répertoire existe, sinon le créer
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
    
    fs.writeFileSync(SERVERS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error(`Erreur lors de la sauvegarde de la configuration des serveurs FHIR: ${error.message}`);
    return false;
  }
}

/**
 * GET /api/fhir-servers
 * Récupérer tous les serveurs FHIR configurés
 */
router.get('/', authCombined, (req, res) => {
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
 * POST /api/fhir-servers
 * Ajouter un nouveau serveur FHIR
 */
router.post('/', authCombined, (req, res) => {
  try {
    const { name, url, version, auth } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: 'Le nom et l\'URL du serveur sont requis'
      });
    }
    
    // Charger la configuration actuelle
    const config = getServersConfig();
    
    // Générer un ID unique pour le serveur
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Vérifier si un serveur avec cet ID existe déjà
    const existingServer = config.servers.find(s => s.id === id);
    if (existingServer) {
      return res.status(400).json({
        success: false,
        message: `Un serveur avec le nom '${name}' existe déjà`
      });
    }
    
    // Ajouter le nouveau serveur
    const newServer = {
      id,
      name,
      url,
      version: version || 'R4',
      auth: auth || 'none',
      status: 'inactive',
      isDefault: false
    };
    
    config.servers.push(newServer);
    
    // Enregistrer la configuration mise à jour
    if (saveServersConfig(config)) {
      res.status(201).json({
        success: true,
        message: 'Serveur FHIR ajouté avec succès',
        data: newServer
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
 * PUT /api/fhir-servers/:serverId
 * Mettre à jour un serveur FHIR existant
 */
router.put('/:serverId', authCombined, (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, url, version, auth } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: 'Le nom et l\'URL du serveur sont requis'
      });
    }
    
    // Charger la configuration actuelle
    const config = getServersConfig();
    
    // Trouver le serveur à mettre à jour
    const serverIndex = config.servers.findIndex(s => s.id === serverId);
    if (serverIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Mettre à jour le serveur
    const updatedServer = {
      ...config.servers[serverIndex],
      name,
      url,
      version: version || config.servers[serverIndex].version,
      auth: auth || config.servers[serverIndex].auth
    };
    
    config.servers[serverIndex] = updatedServer;
    
    // Enregistrer la configuration mise à jour
    if (saveServersConfig(config)) {
      res.json({
        success: true,
        message: 'Serveur FHIR mis à jour avec succès',
        data: updatedServer
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
 * DELETE /api/fhir-servers/:serverId
 * Supprimer un serveur FHIR
 */
router.delete('/:serverId', authCombined, (req, res) => {
  try {
    const { serverId } = req.params;
    
    // Charger la configuration actuelle
    const config = getServersConfig();
    
    // Trouver le serveur à supprimer
    const serverIndex = config.servers.findIndex(s => s.id === serverId);
    if (serverIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Vérifier si le serveur est le serveur par défaut
    if (config.servers[serverIndex].isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer le serveur par défaut'
      });
    }
    
    // Supprimer le serveur
    config.servers.splice(serverIndex, 1);
    
    // Enregistrer la configuration mise à jour
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
 * GET /api/fhir-servers/:serverId/test
 * Tester la connexion à un serveur FHIR
 */
router.get('/:serverId/test', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    // Charger la configuration actuelle
    const config = getServersConfig();
    
    // Trouver le serveur à tester
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Tester la connexion au serveur
    try {
      const response = await axios.get(`${server.url}/metadata`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/fhir+json'
        }
      });
      
      // Vérifier que la réponse est un CapabilityStatement FHIR
      if (response.data && response.data.resourceType === 'CapabilityStatement') {
        // Mettre à jour le statut du serveur
        server.status = 'active';
        
        // Enregistrer la configuration mise à jour
        saveServersConfig(config);
        
        res.json({
          success: true,
          message: 'Connexion au serveur FHIR réussie',
          data: {
            fhirVersion: response.data.fhirVersion || server.version,
            software: response.data.software?.name || 'Inconnu',
            status: 'active'
          }
        });
      } else {
        server.status = 'inactive';
        saveServersConfig(config);
        
        res.status(503).json({
          success: false,
          message: 'Le serveur ne répond pas avec un CapabilityStatement FHIR valide'
        });
      }
    } catch (error) {
      // Mettre à jour le statut du serveur
      server.status = 'inactive';
      saveServersConfig(config);
      
      logger.error(`Erreur lors du test du serveur FHIR ${serverId}: ${error.message}`);
      res.status(503).json({
        success: false,
        message: `Impossible de se connecter au serveur FHIR ${server.name}`,
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors du test d'un serveur FHIR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test du serveur FHIR',
      error: error.message
    });
  }
});

/**
 * POST /api/fhir-servers/:serverId/local-default
 * Définir un serveur comme serveur par défaut local uniquement
 */
router.post('/:serverId/local-default', authCombined, (req, res) => {
  try {
    const { serverId } = req.params;
    
    // Charger la configuration actuelle
    const config = getServersConfig();
    
    // Trouver le serveur à définir comme par défaut
    const serverIndex = config.servers.findIndex(s => s.id === serverId);
    if (serverIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Mettre à jour le statut par défaut local de tous les serveurs
    config.servers.forEach((server, index) => {
      if (index === serverIndex) {
        server.isLocalDefault = true;
      } else {
        delete server.isLocalDefault;
      }
    });
    
    // Enregistrer la configuration mise à jour
    if (saveServersConfig(config)) {
      res.json({
        success: true,
        message: 'Serveur défini comme serveur par défaut local'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'enregistrement de la configuration'
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la définition du serveur par défaut local: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la définition du serveur par défaut local',
      error: error.message
    });
  }
});

/**
 * PUT /api/fhir-servers/default/:serverId
 * Définir un serveur comme serveur par défaut global
 */
router.put('/default/:serverId', authCombined, (req, res) => {
  try {
    const { serverId } = req.params;
    
    // Charger la configuration actuelle
    const config = getServersConfig();
    
    // Trouver le serveur à définir comme par défaut
    const serverIndex = config.servers.findIndex(s => s.id === serverId);
    if (serverIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Mettre à jour le serveur par défaut global
    config.defaultServer = serverId;
    
    // Mettre à jour le statut par défaut de tous les serveurs
    config.servers.forEach((server, index) => {
      if (index === serverIndex) {
        server.isDefault = true;
      } else {
        server.isDefault = false;
      }
    });
    
    // Enregistrer la configuration mise à jour
    if (saveServersConfig(config)) {
      res.json({
        success: true,
        message: 'Serveur défini comme serveur par défaut global'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'enregistrement de la configuration'
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la définition du serveur par défaut global: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la définition du serveur par défaut global',
      error: error.message
    });
  }
});

module.exports = router;