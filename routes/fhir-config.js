/**
 * Routes de configuration FHIR
 * 
 * Gestion de la configuration des serveurs FHIR
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Chemin vers le fichier de configuration des serveurs
const CONFIG_FILE_PATH = path.join(__dirname, '../config/fhir-servers.json');

// Middleware pour vérifier si le fichier de configuration existe
function ensureConfigFile(req, res, next) {
  if (!fs.existsSync(CONFIG_FILE_PATH)) {
    const defaultConfig = {
      servers: [
        {
          id: "local-hapi",
          name: "Serveur HAPI FHIR Local",
          url: "http://localhost:8080/fhir",
          type: "local",
          version: "R4",
          auth: "none",
          isDefault: false,
          isLocalDefault: true,
          isActive: true
        },
        {
          id: "public-hapi",
          name: "Serveur HAPI FHIR Public",
          url: "https://hapi.fhir.org/baseR4",
          type: "public",
          version: "R4",
          auth: "none",
          isDefault: true,
          isLocalDefault: false,
          isActive: true
        }
      ]
    };
    
    try {
      fs.mkdirSync(path.dirname(CONFIG_FILE_PATH), { recursive: true });
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(defaultConfig, null, 2));
      console.log('[CONFIG] Fichier de configuration des serveurs FHIR créé');
    } catch (error) {
      console.error('[CONFIG] Erreur lors de la création du fichier de configuration:', error);
      return res.status(500).json({ error: 'Erreur lors de la création du fichier de configuration' });
    }
  }
  next();
}

// Fonction pour lire la configuration
function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      return { servers: [] };
    }
    
    const rawData = fs.readFileSync(CONFIG_FILE_PATH);
    return JSON.parse(rawData);
  } catch (error) {
    console.error('[CONFIG] Erreur lors de la lecture du fichier de configuration:', error);
    return { servers: [] };
  }
}

// Fonction pour écrire la configuration
function writeConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('[CONFIG] Erreur lors de l\'écriture du fichier de configuration:', error);
    return false;
  }
}

// Route pour récupérer tous les serveurs
router.get('/servers', ensureConfigFile, (req, res) => {
  const config = readConfig();
  res.json(config.servers);
});

// Route pour ajouter un nouveau serveur
router.post('/servers', ensureConfigFile, (req, res) => {
  const config = readConfig();
  const newServer = {
    id: uuidv4(),
    ...req.body,
    isDefault: false,
    isLocalDefault: false,
    isActive: true
  };
  
  config.servers.push(newServer);
  
  if (writeConfig(config)) {
    res.status(201).json(newServer);
  } else {
    res.status(500).json({ error: 'Impossible d\'ajouter le serveur' });
  }
});

// Route pour modifier un serveur
router.put('/servers/:id', ensureConfigFile, (req, res) => {
  const serverId = req.params.id;
  const config = readConfig();
  
  const serverIndex = config.servers.findIndex(server => server.id === serverId);
  
  if (serverIndex === -1) {
    return res.status(404).json({ error: 'Serveur non trouvé' });
  }
  
  // Préserver l'état par défaut
  const isDefault = config.servers[serverIndex].isDefault;
  const isLocalDefault = config.servers[serverIndex].isLocalDefault;
  
  config.servers[serverIndex] = {
    ...config.servers[serverIndex],
    ...req.body,
    id: serverId,
    isDefault,
    isLocalDefault
  };
  
  if (writeConfig(config)) {
    res.json(config.servers[serverIndex]);
  } else {
    res.status(500).json({ error: 'Impossible de modifier le serveur' });
  }
});

// Route pour supprimer un serveur
router.delete('/servers/:id', ensureConfigFile, (req, res) => {
  const serverId = req.params.id;
  const config = readConfig();
  
  const serverIndex = config.servers.findIndex(server => server.id === serverId);
  
  if (serverIndex === -1) {
    return res.status(404).json({ error: 'Serveur non trouvé' });
  }
  
  // Si c'est un serveur par défaut, trouver un remplaçant
  if (config.servers[serverIndex].isDefault) {
    const newDefault = config.servers.find(s => s.id !== serverId);
    if (newDefault) {
      newDefault.isDefault = true;
    }
  }
  
  // Si c'est un serveur local par défaut, trouver un remplaçant
  if (config.servers[serverIndex].isLocalDefault) {
    const newLocalDefault = config.servers.find(s => s.id !== serverId && s.type === 'local');
    if (newLocalDefault) {
      newLocalDefault.isLocalDefault = true;
    }
  }
  
  config.servers.splice(serverIndex, 1);
  
  if (writeConfig(config)) {
    res.status(204).send();
  } else {
    res.status(500).json({ error: 'Impossible de supprimer le serveur' });
  }
});

// Route pour définir un serveur comme serveur par défaut
router.post('/servers/default/:id', ensureConfigFile, (req, res) => {
  const serverId = req.params.id;
  const config = readConfig();
  
  const server = config.servers.find(s => s.id === serverId);
  
  if (!server) {
    return res.status(404).json({ error: 'Serveur non trouvé' });
  }
  
  // Réinitialiser tous les serveurs
  config.servers.forEach(s => {
    s.isDefault = false;
  });
  
  // Définir ce serveur comme serveur par défaut
  server.isDefault = true;
  
  if (writeConfig(config)) {
    res.json(server);
  } else {
    res.status(500).json({ error: 'Impossible de définir le serveur par défaut' });
  }
});

// Route pour activer/désactiver un serveur
router.post('/servers/:id/toggle', ensureConfigFile, (req, res) => {
  const serverId = req.params.id;
  const config = readConfig();
  
  const server = config.servers.find(s => s.id === serverId);
  
  if (!server) {
    return res.status(404).json({ error: 'Serveur non trouvé' });
  }
  
  // Inverser l'état actif
  server.isActive = !server.isActive;
  
  // Si on désactive un serveur par défaut, trouver un remplaçant actif
  if (!server.isActive && server.isDefault) {
    const newDefault = config.servers.find(s => s.id !== serverId && s.isActive);
    if (newDefault) {
      server.isDefault = false;
      newDefault.isDefault = true;
    }
  }
  
  if (writeConfig(config)) {
    res.json(server);
  } else {
    res.status(500).json({ error: 'Impossible de modifier l\'état du serveur' });
  }
});

module.exports = router;