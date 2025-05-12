/**
 * Service d'interaction avec les serveurs FHIR
 * Fournit des fonctions utilitaires pour interagir avec les serveurs FHIR configurés
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Fichier de configuration des serveurs FHIR
const FHIR_SERVERS_CONFIG_FILE = path.join(__dirname, '../config/fhir-servers.json');

// Configuration par défaut des serveurs FHIR
const DEFAULT_CONFIG = {
  defaultServer: 'hapi-public',
  servers: [
    {
      id: 'hapi-public',
      name: 'Serveur HAPI FHIR Public',
      url: 'https://hapi.fhir.org/baseR4',
      version: 'R4',
      auth: 'none',
      isDefault: true,
      status: 'active'
    },
    {
      id: 'local',
      name: 'Serveur HAPI FHIR Local',
      url: 'http://localhost:8080/fhir',
      version: 'R4',
      auth: 'none',
      isDefault: false,
      status: 'inactive'
    }
  ]
};

// Créer le répertoire config s'il n'existe pas
if (!fs.existsSync(path.dirname(FHIR_SERVERS_CONFIG_FILE))) {
  fs.mkdirSync(path.dirname(FHIR_SERVERS_CONFIG_FILE), { recursive: true });
}

// Initialiser le fichier de configuration s'il n'existe pas
if (!fs.existsSync(FHIR_SERVERS_CONFIG_FILE)) {
  fs.writeFileSync(FHIR_SERVERS_CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
  logger.info('Configuration FHIR par défaut créée');
}

/**
 * Lire la configuration des serveurs FHIR
 */
function getServersConfig() {
  try {
    const configContent = fs.readFileSync(FHIR_SERVERS_CONFIG_FILE, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    logger.error(`Erreur lors de la lecture de la configuration FHIR: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Enregistrer la configuration des serveurs FHIR
 */
function saveServersConfig(config) {
  try {
    fs.writeFileSync(FHIR_SERVERS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error(`Erreur lors de l'enregistrement de la configuration FHIR: ${error.message}`);
    return false;
  }
}

/**
 * Récupérer les détails d'un serveur FHIR par ID ou URL
 */
function getServerDetails(serverId) {
  const config = getServersConfig();
  
  if (!serverId) {
    serverId = config.defaultServer;
  }
  
  // Chercher d'abord par ID
  let server = config.servers.find(s => s.id === serverId);
  
  // Si non trouvé et si c'est une URL, chercher par URL ou créer un serveur temporaire
  if (!server && typeof serverId === 'string' && (serverId.startsWith('http://') || serverId.startsWith('https://'))) {
    // Chercher par URL
    server = config.servers.find(s => s.url === serverId);
    
    // Si toujours pas trouvé, créer un serveur temporaire
    if (!server) {
      console.log(`[FHIR] Création d'un serveur temporaire pour l'URL: ${serverId}`);
      server = {
        id: `temp-${Math.random().toString(36).substr(2, 9)}`,
        name: "Serveur temporaire",
        url: serverId,
        version: "R4",
        auth: "none",
        isDefault: false,
        status: 'active'
      };
    }
  }
  
  return server;
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
 * Tester la connexion à un serveur FHIR
 */
async function testServerConnection(serverId) {
  const server = getServerDetails(serverId);
  if (!server) {
    throw new Error('Serveur FHIR non trouvé');
  }
  
  const axiosConfig = createAxiosConfig(server, { timeout: 15000 });
  const response = await axios.get(`${server.url}/metadata`, axiosConfig);
  
  if (response.data && response.data.resourceType === 'CapabilityStatement') {
    // Mise à jour du statut du serveur
    const config = getServersConfig();
    const serverIndex = config.servers.findIndex(s => s.id === serverId);
    if (serverIndex !== -1) {
      config.servers[serverIndex].status = 'active';
      saveServersConfig(config);
    }
    
    return response.data;
  } else {
    throw new Error('La réponse du serveur FHIR n\'est pas un CapabilityStatement valide');
  }
}

/**
 * Rechercher des ressources FHIR
 */
async function searchResources(serverId, resourceType, searchParams = {}, options = {}) {
  console.log(`[FHIR] Recherche de ressources ${resourceType} sur le serveur ${serverId}`);
  const server = getServerDetails(serverId);
  if (!server) {
    console.error(`[FHIR] Serveur FHIR non trouvé: ${serverId}`);
    throw new Error('Serveur FHIR non trouvé');
  }
  console.log(`[FHIR] Détails du serveur identifié: ${server.name} (${server.url})`);
  
  // Construction de l'URL de recherche
  let url = `${server.url}/${resourceType}`;
  const queryParams = [];
  
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null) {
      queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  
  if (queryParams.length > 0) {
    url += `?${queryParams.join('&')}`;
  }
  
  const axiosConfig = createAxiosConfig(server, options);
  const response = await axios.get(url, axiosConfig);
  
  return response.data;
}

/**
 * Récupérer une ressource FHIR par son ID
 */
async function getResource(serverId, resourceType, id, options = {}) {
  console.log(`[FHIR] Récupération de la ressource ${resourceType}/${id} sur le serveur ${serverId}`);
  const server = getServerDetails(serverId);
  if (!server) {
    console.error(`[FHIR] Serveur FHIR non trouvé: ${serverId}`);
    throw new Error('Serveur FHIR non trouvé');
  }
  console.log(`[FHIR] Détails du serveur identifié: ${server.name} (${server.url})`);
  
  const url = `${server.url}/${resourceType}/${id}`;
  const axiosConfig = createAxiosConfig(server, options);
  const response = await axios.get(url, axiosConfig);
  
  return response.data;
}

/**
 * Créer une ressource FHIR
 */
async function createResource(serverId, resource, options = {}) {
  const server = getServerDetails(serverId);
  if (!server) {
    throw new Error('Serveur FHIR non trouvé');
  }
  
  if (!resource.resourceType) {
    throw new Error('La ressource FHIR doit avoir un type de ressource (resourceType)');
  }
  
  const url = `${server.url}/${resource.resourceType}`;
  const axiosConfig = createAxiosConfig(server, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/fhir+json'
    }
  });
  
  const response = await axios.post(url, resource, axiosConfig);
  
  return response.data;
}

/**
 * Mettre à jour une ressource FHIR
 */
async function updateResource(serverId, resource, options = {}) {
  const server = getServerDetails(serverId);
  if (!server) {
    throw new Error('Serveur FHIR non trouvé');
  }
  
  if (!resource.resourceType) {
    throw new Error('La ressource FHIR doit avoir un type de ressource (resourceType)');
  }
  
  if (!resource.id) {
    throw new Error('La ressource FHIR doit avoir un ID pour la mise à jour');
  }
  
  const url = `${server.url}/${resource.resourceType}/${resource.id}`;
  const axiosConfig = createAxiosConfig(server, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/fhir+json'
    }
  });
  
  const response = await axios.put(url, resource, axiosConfig);
  
  return response.data;
}

/**
 * Supprimer une ressource FHIR
 */
async function deleteResource(serverId, resourceType, id, options = {}) {
  const server = getServerDetails(serverId);
  if (!server) {
    throw new Error('Serveur FHIR non trouvé');
  }
  
  const url = `${server.url}/${resourceType}/${id}`;
  const axiosConfig = createAxiosConfig(server, options);
  
  await axios.delete(url, axiosConfig);
  
  return true;
}

/**
 * Exécuter une opération ($operation) sur une ressource FHIR
 */
async function executeOperation(serverId, resourceType, id, operation, parameters = {}, options = {}) {
  const server = getServerDetails(serverId);
  if (!server) {
    throw new Error('Serveur FHIR non trouvé');
  }
  
  let url;
  if (id) {
    url = `${server.url}/${resourceType}/${id}/$${operation}`;
  } else if (resourceType) {
    url = `${server.url}/${resourceType}/$${operation}`;
  } else {
    url = `${server.url}/$${operation}`;
  }
  
  const axiosConfig = createAxiosConfig(server, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/fhir+json'
    }
  });
  
  const response = await axios.post(url, parameters, axiosConfig);
  
  return response.data;
}

/**
 * Récupérer une ressource liée via une référence FHIR
 */
async function resolveReference(serverId, reference, options = {}) {
  const server = getServerDetails(serverId);
  if (!server) {
    throw new Error('Serveur FHIR non trouvé');
  }
  
  // Analyse de la référence
  let refUrl;
  if (reference.startsWith('http')) {
    // Référence absolue
    refUrl = reference;
  } else if (reference.includes('/')) {
    // Référence relative
    const [resourceType, id] = reference.split('/');
    refUrl = `${server.url}/${resourceType}/${id}`;
  } else {
    throw new Error(`Format de référence FHIR non reconnu: ${reference}`);
  }
  
  const axiosConfig = createAxiosConfig(server, options);
  const response = await axios.get(refUrl, axiosConfig);
  
  return response.data;
}

/**
 * Rechercher des patients par différents critères
 */
async function searchPatients(serverId, searchParams = {}, options = {}) {
  return await searchResources(serverId, 'Patient', searchParams, options);
}

/**
 * Récupérer les observations d'un patient
 */
async function getPatientObservations(serverId, patientId, searchParams = {}, options = {}) {
  // Utiliser _count=1000 par défaut pour récupérer plus de résultats
  const defaultParams = { _count: 1000 };
  return await searchResources(serverId, 'Observation', {
    patient: patientId,
    ...defaultParams,
    ...searchParams
  }, options);
}

/**
 * Récupérer les conditions médicales d'un patient
 */
async function getPatientConditions(serverId, patientId, searchParams = {}, options = {}) {
  // Utiliser _count=1000 par défaut pour récupérer plus de résultats
  const defaultParams = { _count: 1000 };
  return await searchResources(serverId, 'Condition', {
    patient: patientId,
    ...defaultParams,
    ...searchParams
  }, options);
}

/**
 * Récupérer les prescriptions médicamenteuses d'un patient
 */
async function getPatientMedications(serverId, patientId, searchParams = {}, options = {}) {
  // Utiliser _count=1000 par défaut pour récupérer plus de résultats
  const defaultParams = { _count: 1000 };
  return await searchResources(serverId, 'MedicationRequest', {
    patient: patientId,
    ...defaultParams,
    ...searchParams
  }, options);
}

/**
 * Récupérer les consultations d'un patient
 */
async function getPatientEncounters(serverId, patientId, searchParams = {}, options = {}) {
  // Utiliser _count=1000 par défaut pour récupérer plus de résultats
  const defaultParams = { _count: 1000 };
  return await searchResources(serverId, 'Encounter', {
    patient: patientId,
    ...defaultParams,
    ...searchParams
  }, options);
}

/**
 * Récupérer un résumé complet des données d'un patient
 */
async function getPatientSummary(serverId, patientId, options = {}) {
  const server = getServerDetails(serverId);
  if (!server) {
    throw new Error('Serveur FHIR non trouvé');
  }
  
  // Récupération du patient et de ses données associées en parallèle
  const [patientRes, conditionsRes, observationsRes, medicationsRes, encountersRes] = await Promise.all([
    getResource(serverId, 'Patient', patientId, options),
    getPatientConditions(serverId, patientId, { _count: 20, _sort: '-date' }, options)
      .catch(error => {
        logger.warn(`Erreur lors de la récupération des conditions: ${error.message}`);
        return { resourceType: 'Bundle', entry: [] };
      }),
    getPatientObservations(serverId, patientId, { _count: 20, _sort: '-date' }, options)
      .catch(error => {
        logger.warn(`Erreur lors de la récupération des observations: ${error.message}`);
        return { resourceType: 'Bundle', entry: [] };
      }),
    getPatientMedications(serverId, patientId, { _count: 20, _sort: '-date' }, options)
      .catch(error => {
        logger.warn(`Erreur lors de la récupération des médicaments: ${error.message}`);
        return { resourceType: 'Bundle', entry: [] };
      }),
    getPatientEncounters(serverId, patientId, { _count: 20, _sort: '-date' }, options)
      .catch(error => {
        logger.warn(`Erreur lors de la récupération des consultations: ${error.message}`);
        return { resourceType: 'Bundle', entry: [] };
      })
  ]);
  
  // Création du résumé patient
  return {
    patient: patientRes,
    conditions: conditionsRes.entry ? conditionsRes.entry.map(entry => entry.resource) : [],
    observations: observationsRes.entry ? observationsRes.entry.map(entry => entry.resource) : [],
    medications: medicationsRes.entry ? medicationsRes.entry.map(entry => entry.resource) : [],
    encounters: encountersRes.entry ? encountersRes.entry.map(entry => entry.resource) : []
  };
}

/**
 * Créer un bundle FHIR contenant un patient et ses ressources associées
 */
async function createPatientBundle(serverId, patientId, options = {}) {
  const summary = await getPatientSummary(serverId, patientId, options);
  
  // Création du bundle FHIR
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      {
        resource: summary.patient,
        request: {
          method: 'GET',
          url: `Patient/${patientId}`
        }
      }
    ]
  };
  
  // Ajout des autres ressources au bundle
  Object.entries(summary).forEach(([key, resources]) => {
    if (key !== 'patient' && Array.isArray(resources)) {
      resources.forEach(resource => {
        bundle.entry.push({
          resource,
          request: {
            method: 'GET',
            url: `${resource.resourceType}/${resource.id}`
          }
        });
      });
    }
  });
  
  return bundle;
}

/**
 * Récupérer l'URL du serveur FHIR actif
 */
function getFhirServerUrl() {
  const config = getServersConfig();
  const defaultServerId = config.defaultServer;
  const server = getServerDetails(defaultServerId);
  
  if (!server) {
    console.warn(`[FHIR] Serveur par défaut non trouvé, utilisation du serveur local`);
    return 'http://localhost:8080/fhir';
  }
  
  return server.url;
}

/**
 * Pousser un bundle FHIR vers le serveur FHIR
 */
async function pushBundle(bundle, serverId = null) {
  // Si aucun serverId n'est spécifié, utiliser le serveur par défaut
  if (!serverId) {
    const config = getServersConfig();
    serverId = config.defaultServer;
  }
  
  const server = getServerDetails(serverId);
  if (!server) {
    throw new Error('Serveur FHIR non trouvé');
  }
  
  if (!bundle || bundle.resourceType !== 'Bundle') {
    throw new Error('Bundle FHIR invalide');
  }
  
  const url = server.url;
  const axiosConfig = createAxiosConfig(server, {
    headers: {
      'Content-Type': 'application/fhir+json'
    }
  });
  
  logger.info(`[FHIR] Envoi d'un bundle FHIR contenant ${bundle.entry?.length || 0} ressources vers ${server.name} (${url})`);
  const response = await axios.post(url, bundle, axiosConfig);
  logger.info(`[FHIR] Bundle envoyé avec succès, status: ${response.status}`);
  
  return response.data;
}

module.exports = {
  getServersConfig,
  saveServersConfig,
  getServerDetails,
  createAxiosConfig,
  testServerConnection,
  searchResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  executeOperation,
  resolveReference,
  searchPatients,
  getPatientObservations,
  getPatientConditions,
  getPatientMedications,
  getPatientEncounters,
  getPatientSummary,
  createPatientBundle,
  getFhirServerUrl,
  pushBundle
};