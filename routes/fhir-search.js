/**
 * Routes pour la recherche intelligente de patients via FHIR
 * Ce module gère les recherches avancées en utilisant les capacités de recherche FHIR
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { authCombined } = require('../middleware/auth');

// Fichier de configuration des serveurs FHIR
const FHIR_SERVERS_CONFIG_FILE = path.join(__dirname, '../config/fhir-servers.json');

/**
 * Lire la configuration des serveurs FHIR
 */
function getServersConfig() {
  try {
    const configContent = fs.readFileSync(FHIR_SERVERS_CONFIG_FILE, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    logger.error(`Erreur lors de la lecture de la configuration FHIR: ${error.message}`);
    return { servers: [], defaultServer: null };
  }
}

/**
 * Récupérer les détails d'un serveur FHIR
 */
function getServerDetails(serverId) {
  const config = getServersConfig();
  
  if (!serverId) {
    serverId = config.defaultServer;
  }
  
  return config.servers.find(s => s.id === serverId);
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
 * @swagger
 * /api/fhir-search/{serverId}/patients:
 *   get:
 *     summary: Recherche avancée de patients
 *     description: Effectue une recherche avancée de patients avec des critères multiples
 *     tags:
 *       - Recherche FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Nom ou partie du nom du patient
 *       - in: query
 *         name: given
 *         schema:
 *           type: string
 *         description: Prénom ou partie du prénom du patient
 *       - in: query
 *         name: family
 *         schema:
 *           type: string
 *         description: Nom de famille ou partie du nom de famille du patient
 *       - in: query
 *         name: identifier
 *         schema:
 *           type: string
 *         description: Identifiant du patient (INS, IPP, etc.)
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *           enum: [male, female, other, unknown]
 *         description: Genre du patient
 *       - in: query
 *         name: birthdate
 *         schema:
 *           type: string
 *         description: Date de naissance (format YYYY-MM-DD ou intervalle YYYY-MM-DD,YYYY-MM-DD)
 *       - in: query
 *         name: address-city
 *         schema:
 *           type: string
 *         description: Ville de résidence
 *       - in: query
 *         name: address-postalcode
 *         schema:
 *           type: string
 *         description: Code postal
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *         description: Numéro de téléphone
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Adresse email
 *       - in: query
 *         name: _count
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre de résultats par page
 *       - in: query
 *         name: _page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page
 *     responses:
 *       200:
 *         description: Résultats de la recherche
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const {
      name,
      given,
      family,
      identifier,
      gender,
      birthdate,
      'address-city': addressCity,
      'address-postalcode': addressPostalCode,
      phone,
      email,
      _count = 20,
      _page = 1
    } = req.query;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Construction de l'URL de recherche
      const offset = (_page - 1) * parseInt(_count);
      let searchUrl = `${server.url}/Patient?_count=${_count}&_getpagesoffset=${offset}`;
      
      // Ajout des critères de recherche
      if (name) searchUrl += `&name=${encodeURIComponent(name)}`;
      if (given) searchUrl += `&given=${encodeURIComponent(given)}`;
      if (family) searchUrl += `&family=${encodeURIComponent(family)}`;
      if (identifier) searchUrl += `&identifier=${encodeURIComponent(identifier)}`;
      if (gender) searchUrl += `&gender=${encodeURIComponent(gender)}`;
      if (birthdate) searchUrl += `&birthdate=${encodeURIComponent(birthdate)}`;
      if (addressCity) searchUrl += `&address-city=${encodeURIComponent(addressCity)}`;
      if (addressPostalCode) searchUrl += `&address-postalcode=${encodeURIComponent(addressPostalCode)}`;
      if (phone) searchUrl += `&telecom=phone|${encodeURIComponent(phone)}`;
      if (email) searchUrl += `&telecom=email|${encodeURIComponent(email)}`;
      
      logger.info(`Recherche avancée de patients: ${searchUrl}`);
      
      // Récupération des patients
      const response = await axios.get(searchUrl, createAxiosConfig(server));
      
      if (response.data && response.data.resourceType === 'Bundle') {
        // Extraction des informations des patients
        const patients = response.data.entry ? response.data.entry.map(entry => ({
          id: entry.resource.id,
          resourceType: entry.resource.resourceType,
          name: entry.resource.name?.map(n => {
            const parts = [];
            if (n.prefix) parts.push(n.prefix.join(' '));
            if (n.given) parts.push(n.given.join(' '));
            if (n.family) parts.push(n.family);
            return parts.join(' ');
          }),
          gender: entry.resource.gender,
          birthDate: entry.resource.birthDate,
          identifier: entry.resource.identifier,
          telecom: entry.resource.telecom,
          address: entry.resource.address,
          active: entry.resource.active
        })) : [];
        
        res.json({
          success: true,
          message: 'Recherche de patients effectuée avec succès',
          data: {
            patients,
            total: response.data.total || patients.length,
            page: _page,
            count: _count,
            searchParameters: {
              name, given, family, identifier, gender, birthdate,
              addressCity, addressPostalCode, phone, email
            }
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Réponse FHIR invalide'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche de patients',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la recherche de patients: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de patients',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir-search/{serverId}/patients/by-condition:
 *   get:
 *     summary: Recherche de patients par condition médicale
 *     description: Recherche les patients atteints d'une condition médicale spécifique
 *     tags:
 *       - Recherche FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Code de la condition (SNOMED CT, ICD-10, etc.)
 *       - in: query
 *         name: system
 *         schema:
 *           type: string
 *         description: Système de codage (par exemple http://snomed.info/sct)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Statut de la condition (active, resolved, etc.)
 *       - in: query
 *         name: _count
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre de résultats par page
 *       - in: query
 *         name: _page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page
 *     responses:
 *       200:
 *         description: Résultats de la recherche
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/by-condition', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { code, system, status, _count = 20, _page = 1 } = req.query;
    
    // Vérification des paramètres requis
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre code est requis'
      });
    }
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Étape 1: Rechercher les conditions correspondant aux critères
      let conditionSearchUrl = `${server.url}/Condition?code=${encodeURIComponent(code)}&_count=100`;
      
      if (system) {
        conditionSearchUrl += `&code:system=${encodeURIComponent(system)}`;
      }
      
      if (status) {
        conditionSearchUrl += `&clinical-status=${encodeURIComponent(status)}`;
      }
      
      logger.info(`Recherche de conditions: ${conditionSearchUrl}`);
      
      const conditionsResponse = await axios.get(conditionSearchUrl, createAxiosConfig(server));
      
      if (conditionsResponse.data && conditionsResponse.data.resourceType === 'Bundle') {
        // Extraire les identifiants des patients
        const patientIds = new Set();
        
        if (conditionsResponse.data.entry) {
          conditionsResponse.data.entry.forEach(entry => {
            if (entry.resource && entry.resource.subject && entry.resource.subject.reference) {
              const patientReference = entry.resource.subject.reference;
              const patientId = patientReference.replace('Patient/', '');
              patientIds.add(patientId);
            }
          });
        }
        
        // Si aucun patient n'est trouvé, retourner un tableau vide
        if (patientIds.size === 0) {
          return res.json({
            success: true,
            message: 'Aucun patient trouvé avec cette condition',
            data: {
              patients: [],
              total: 0,
              page: _page,
              count: _count
            }
          });
        }
        
        // Étape 2: Récupérer les détails des patients
        const patientIdsArray = Array.from(patientIds);
        const offset = (_page - 1) * parseInt(_count);
        const pagePatientIds = patientIdsArray.slice(offset, offset + parseInt(_count));
        
        // Récupérer les détails des patients par lots pour éviter des URLs trop longues
        const patientDetailsPromises = [];
        const batchSize = 10;
        
        for (let i = 0; i < pagePatientIds.length; i += batchSize) {
          const batch = pagePatientIds.slice(i, i + batchSize);
          const patientSearchUrl = `${server.url}/Patient?_id=${batch.join(',')}&_count=${batchSize}`;
          
          patientDetailsPromises.push(
            axios.get(patientSearchUrl, createAxiosConfig(server))
          );
        }
        
        const patientResponses = await Promise.all(patientDetailsPromises);
        
        // Fusionner les résultats
        const patients = [];
        
        patientResponses.forEach(response => {
          if (response.data && response.data.resourceType === 'Bundle' && response.data.entry) {
            response.data.entry.forEach(entry => {
              const patient = entry.resource;
              patients.push({
                id: patient.id,
                resourceType: patient.resourceType,
                name: patient.name?.map(n => {
                  const parts = [];
                  if (n.prefix) parts.push(n.prefix.join(' '));
                  if (n.given) parts.push(n.given.join(' '));
                  if (n.family) parts.push(n.family);
                  return parts.join(' ');
                }),
                gender: patient.gender,
                birthDate: patient.birthDate,
                identifier: patient.identifier,
                telecom: patient.telecom,
                address: patient.address,
                active: patient.active
              });
            });
          }
        });
        
        res.json({
          success: true,
          message: 'Recherche de patients par condition effectuée avec succès',
          data: {
            patients,
            total: patientIdsArray.length,
            page: _page,
            count: _count
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Réponse FHIR invalide'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche de patients par condition',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la recherche de patients par condition: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de patients par condition',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir-search/{serverId}/patients/by-observation:
 *   get:
 *     summary: Recherche de patients par observation/résultat de laboratoire
 *     description: Recherche les patients ayant une observation ou un résultat de laboratoire spécifique
 *     tags:
 *       - Recherche FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Code de l'observation (LOINC, SNOMED CT, etc.)
 *       - in: query
 *         name: system
 *         schema:
 *           type: string
 *         description: Système de codage (par exemple http://loinc.org)
 *       - in: query
 *         name: value-quantity-gt
 *         schema:
 *           type: string
 *         description: Valeur minimale (supérieure à)
 *       - in: query
 *         name: value-quantity-lt
 *         schema:
 *           type: string
 *         description: Valeur maximale (inférieure à)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         description: Date de l'observation (format YYYY-MM-DD ou intervalle)
 *       - in: query
 *         name: _count
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre de résultats par page
 *       - in: query
 *         name: _page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page
 *     responses:
 *       200:
 *         description: Résultats de la recherche
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/by-observation', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const {
      code,
      system,
      'value-quantity-gt': valueQuantityGt,
      'value-quantity-lt': valueQuantityLt,
      date,
      _count = 20,
      _page = 1
    } = req.query;
    
    // Vérification des paramètres requis
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre code est requis'
      });
    }
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Étape 1: Rechercher les observations correspondant aux critères
      let observationSearchUrl = `${server.url}/Observation?code=${encodeURIComponent(code)}&_count=100`;
      
      if (system) {
        observationSearchUrl += `&code:system=${encodeURIComponent(system)}`;
      }
      
      if (valueQuantityGt) {
        observationSearchUrl += `&value-quantity=gt${encodeURIComponent(valueQuantityGt)}`;
      }
      
      if (valueQuantityLt) {
        observationSearchUrl += `&value-quantity=lt${encodeURIComponent(valueQuantityLt)}`;
      }
      
      if (date) {
        observationSearchUrl += `&date=${encodeURIComponent(date)}`;
      }
      
      logger.info(`Recherche d'observations: ${observationSearchUrl}`);
      
      const observationsResponse = await axios.get(observationSearchUrl, createAxiosConfig(server));
      
      if (observationsResponse.data && observationsResponse.data.resourceType === 'Bundle') {
        // Extraire les identifiants des patients
        const patientIds = new Set();
        
        if (observationsResponse.data.entry) {
          observationsResponse.data.entry.forEach(entry => {
            if (entry.resource && entry.resource.subject && entry.resource.subject.reference) {
              const patientReference = entry.resource.subject.reference;
              const patientId = patientReference.replace('Patient/', '');
              patientIds.add(patientId);
            }
          });
        }
        
        // Si aucun patient n'est trouvé, retourner un tableau vide
        if (patientIds.size === 0) {
          return res.json({
            success: true,
            message: 'Aucun patient trouvé avec cette observation',
            data: {
              patients: [],
              total: 0,
              page: _page,
              count: _count
            }
          });
        }
        
        // Étape 2: Récupérer les détails des patients
        const patientIdsArray = Array.from(patientIds);
        const offset = (_page - 1) * parseInt(_count);
        const pagePatientIds = patientIdsArray.slice(offset, offset + parseInt(_count));
        
        // Récupérer les détails des patients par lots pour éviter des URLs trop longues
        const patientDetailsPromises = [];
        const batchSize = 10;
        
        for (let i = 0; i < pagePatientIds.length; i += batchSize) {
          const batch = pagePatientIds.slice(i, i + batchSize);
          const patientSearchUrl = `${server.url}/Patient?_id=${batch.join(',')}&_count=${batchSize}`;
          
          patientDetailsPromises.push(
            axios.get(patientSearchUrl, createAxiosConfig(server))
          );
        }
        
        const patientResponses = await Promise.all(patientDetailsPromises);
        
        // Fusionner les résultats
        const patients = [];
        
        patientResponses.forEach(response => {
          if (response.data && response.data.resourceType === 'Bundle' && response.data.entry) {
            response.data.entry.forEach(entry => {
              const patient = entry.resource;
              patients.push({
                id: patient.id,
                resourceType: patient.resourceType,
                name: patient.name?.map(n => {
                  const parts = [];
                  if (n.prefix) parts.push(n.prefix.join(' '));
                  if (n.given) parts.push(n.given.join(' '));
                  if (n.family) parts.push(n.family);
                  return parts.join(' ');
                }),
                gender: patient.gender,
                birthDate: patient.birthDate,
                identifier: patient.identifier,
                telecom: patient.telecom,
                address: patient.address,
                active: patient.active
              });
            });
          }
        });
        
        res.json({
          success: true,
          message: 'Recherche de patients par observation effectuée avec succès',
          data: {
            patients,
            total: patientIdsArray.length,
            page: _page,
            count: _count
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Réponse FHIR invalide'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche de patients par observation',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la recherche de patients par observation: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de patients par observation',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir-search/{serverId}/patients/recent:
 *   get:
 *     summary: Patients récemment vus
 *     description: Récupère la liste des patients récemment vus (basé sur les consultations récentes)
 *     tags:
 *       - Recherche FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: 14
 *         description: Période en jours (par défaut 14 jours)
 *       - in: query
 *         name: _count
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre de résultats par page
 *       - in: query
 *         name: _page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page
 *     responses:
 *       200:
 *         description: Résultats de la recherche
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/recent', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { period = 14, _count = 20, _page = 1 } = req.query;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Calculer la date de début de la période
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - parseInt(period));
      
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Rechercher les consultations récentes
      const encounterSearchUrl = `${server.url}/Encounter?date=ge${startDateStr}&_count=100&_sort=-date`;
      
      logger.info(`Recherche de consultations récentes: ${encounterSearchUrl}`);
      
      const encountersResponse = await axios.get(encounterSearchUrl, createAxiosConfig(server));
      
      if (encountersResponse.data && encountersResponse.data.resourceType === 'Bundle') {
        // Extraire les identifiants des patients
        const patientIds = new Set();
        
        if (encountersResponse.data.entry) {
          encountersResponse.data.entry.forEach(entry => {
            if (entry.resource && entry.resource.subject && entry.resource.subject.reference) {
              const patientReference = entry.resource.subject.reference;
              const patientId = patientReference.replace('Patient/', '');
              patientIds.add(patientId);
            }
          });
        }
        
        // Si aucun patient n'est trouvé, retourner un tableau vide
        if (patientIds.size === 0) {
          return res.json({
            success: true,
            message: 'Aucun patient récemment vu trouvé',
            data: {
              patients: [],
              total: 0,
              page: _page,
              count: _count
            }
          });
        }
        
        // Récupérer les détails des patients
        const patientIdsArray = Array.from(patientIds);
        const offset = (_page - 1) * parseInt(_count);
        const pagePatientIds = patientIdsArray.slice(offset, offset + parseInt(_count));
        
        // Récupérer les détails des patients par lots pour éviter des URLs trop longues
        const patientDetailsPromises = [];
        const batchSize = 10;
        
        for (let i = 0; i < pagePatientIds.length; i += batchSize) {
          const batch = pagePatientIds.slice(i, i + batchSize);
          const patientSearchUrl = `${server.url}/Patient?_id=${batch.join(',')}&_count=${batchSize}`;
          
          patientDetailsPromises.push(
            axios.get(patientSearchUrl, createAxiosConfig(server))
          );
        }
        
        const patientResponses = await Promise.all(patientDetailsPromises);
        
        // Fusionner les résultats
        const patients = [];
        
        patientResponses.forEach(response => {
          if (response.data && response.data.resourceType === 'Bundle' && response.data.entry) {
            response.data.entry.forEach(entry => {
              const patient = entry.resource;
              patients.push({
                id: patient.id,
                resourceType: patient.resourceType,
                name: patient.name?.map(n => {
                  const parts = [];
                  if (n.prefix) parts.push(n.prefix.join(' '));
                  if (n.given) parts.push(n.given.join(' '));
                  if (n.family) parts.push(n.family);
                  return parts.join(' ');
                }),
                gender: patient.gender,
                birthDate: patient.birthDate,
                identifier: patient.identifier,
                telecom: patient.telecom,
                address: patient.address,
                active: patient.active
              });
            });
          }
        });
        
        res.json({
          success: true,
          message: 'Recherche de patients récents effectuée avec succès',
          data: {
            patients,
            total: patientIdsArray.length,
            page: _page,
            count: _count,
            period
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Réponse FHIR invalide'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche de patients récents',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la recherche de patients récents: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de patients récents',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir-search/{serverId}/meta-search:
 *   get:
 *     summary: Recherche dans plusieurs types de ressources
 *     description: Effectue une recherche dans plusieurs types de ressources FHIR
 *     tags:
 *       - Recherche FHIR
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: query
 *         name: term
 *         required: true
 *         schema:
 *           type: string
 *         description: Terme de recherche
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *         description: Types de ressources à inclure (séparés par des virgules)
 *       - in: query
 *         name: _count
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre de résultats par page
 *     responses:
 *       200:
 *         description: Résultats de la recherche
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/meta-search', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { term, types = 'Patient,Condition,Observation,MedicationRequest', _count = 20 } = req.query;
    
    // Vérification des paramètres requis
    if (!term) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre term est requis'
      });
    }
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Diviser les types de ressources
      const resourceTypes = types.split(',').map(t => t.trim());
      
      // Effectuer une recherche pour chaque type de ressource
      const searchPromises = resourceTypes.map(type => {
        // Construire l'URL de recherche en fonction du type de ressource
        let searchUrl;
        
        if (type === 'Patient') {
          searchUrl = `${server.url}/${type}?name=${encodeURIComponent(term)}&_count=${_count}`;
        } else if (type === 'Condition') {
          searchUrl = `${server.url}/${type}?_content=${encodeURIComponent(term)}&_count=${_count}`;
        } else if (type === 'Observation') {
          searchUrl = `${server.url}/${type}?_content=${encodeURIComponent(term)}&_count=${_count}`;
        } else if (type === 'MedicationRequest') {
          searchUrl = `${server.url}/${type}?_content=${encodeURIComponent(term)}&_count=${_count}`;
        } else {
          searchUrl = `${server.url}/${type}?_content=${encodeURIComponent(term)}&_count=${_count}`;
        }
        
        logger.info(`Recherche de ${type}: ${searchUrl}`);
        
        return axios.get(searchUrl, createAxiosConfig(server))
          .then(response => ({
            type,
            data: response.data
          }))
          .catch(error => {
            logger.warn(`Erreur lors de la recherche de ${type}: ${error.message}`);
            return {
              type,
              error: error.message
            };
          });
      });
      
      const searchResults = await Promise.all(searchPromises);
      
      // Traiter les résultats
      const results = {};
      let totalResults = 0;
      
      searchResults.forEach(result => {
        if (result.data && result.data.resourceType === 'Bundle') {
          const resources = result.data.entry ? result.data.entry.map(entry => entry.resource) : [];
          results[result.type] = {
            count: resources.length,
            total: result.data.total || resources.length,
            resources
          };
          totalResults += resources.length;
        } else {
          results[result.type] = {
            count: 0,
            total: 0,
            resources: [],
            error: result.error
          };
        }
      });
      
      res.json({
        success: true,
        message: 'Recherche multi-ressources effectuée avec succès',
        data: {
          term,
          types: resourceTypes,
          totalResults,
          results
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche multi-ressources',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la recherche multi-ressources: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche multi-ressources',
      error: error.message
    });
  }
});

module.exports = router;