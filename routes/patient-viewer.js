/**
 * Routes pour la visualisation des dossiers patients (DPI Viewer)
 * Ce module gère l'accès et l'affichage des données des patients depuis un serveur FHIR
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
 * /api/patient-viewer/{serverId}/patients:
 *   get:
 *     summary: Liste des patients
 *     description: Récupère la liste des patients disponibles sur un serveur FHIR
 *     tags:
 *       - Visualisation Patient
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
 *         description: Recherche par nom
 *       - in: query
 *         name: _count
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre de résultats par page
 *       - in: query
 *         name: _offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Index de départ des résultats
 *     responses:
 *       200:
 *         description: Liste des patients
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, _count = 20, _offset = 0, gender, birthdate } = req.query;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    // Construction de l'URL de recherche
    let searchUrl = `${server.url}/Patient?_count=${_count}&_getpagesoffset=${_offset}`;
    
    // Ajout des critères de recherche
    if (name) {
      searchUrl += `&name=${encodeURIComponent(name)}`;
    }
    
    if (gender) {
      searchUrl += `&gender=${encodeURIComponent(gender)}`;
    }
    
    if (birthdate) {
      searchUrl += `&birthdate=${encodeURIComponent(birthdate)}`;
    }
    
    try {
      // Récupération des patients
      const response = await axios.get(searchUrl, createAxiosConfig(server));
      
      if (response.data && response.data.resourceType === 'Bundle') {
        // Extraction des informations des patients
        const patients = response.data.entry ? response.data.entry.map(entry => {
          const patient = entry.resource;
          return {
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
            active: patient.active
          };
        }) : [];
        
        res.json({
          success: true,
          message: 'Patients récupérés avec succès',
          data: {
            patients,
            total: response.data.total || (response.data.entry ? response.data.entry.length : 0),
            offset: _offset,
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
        message: 'Erreur lors de la récupération des patients',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des patients: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des patients',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}:
 *   get:
 *     summary: Récupérer les détails d'un patient
 *     description: Récupère les détails complets d'un patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *     responses:
 *       200:
 *         description: Détails du patient
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/:patientId', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Récupération du patient
      const response = await axios.get(`${server.url}/Patient/${patientId}`, createAxiosConfig(server));
      
      if (response.data && response.data.resourceType === 'Patient') {
        res.json({
          success: true,
          message: 'Patient récupéré avec succès',
          data: response.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Réponse FHIR invalide'
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        res.status(404).json({
          success: false,
          message: 'Patient non trouvé'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération du patient',
          error: error.response ? error.response.data : error.message
        });
      }
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération du patient: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du patient',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/conditions:
 *   get:
 *     summary: Conditions médicales d'un patient
 *     description: Récupère la liste des conditions médicales (pathologies, diagnostics) d'un patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *     responses:
 *       200:
 *         description: Liste des conditions médicales
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/:patientId/conditions', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Récupération des conditions
      const response = await axios.get(
        `${server.url}/Condition?patient=${patientId}&_count=100`,
        createAxiosConfig(server)
      );
      
      if (response.data && response.data.resourceType === 'Bundle') {
        // Extraction des informations des conditions
        const conditions = response.data.entry ? response.data.entry.map(entry => {
          const condition = entry.resource;
          return {
            id: condition.id,
            resourceType: condition.resourceType,
            clinicalStatus: condition.clinicalStatus,
            verificationStatus: condition.verificationStatus,
            code: condition.code,
            subject: condition.subject,
            onsetDateTime: condition.onsetDateTime,
            recordedDate: condition.recordedDate,
            note: condition.note
          };
        }) : [];
        
        res.json({
          success: true,
          message: 'Conditions récupérées avec succès',
          data: conditions
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
        message: 'Erreur lors de la récupération des conditions',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des conditions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des conditions',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/observations:
 *   get:
 *     summary: Observations et résultats de laboratoire d'un patient
 *     description: Récupère la liste des observations et résultats de laboratoire d'un patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Code LOINC ou SNOMED pour filtrer les observations
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         description: Date ou période des observations
 *     responses:
 *       200:
 *         description: Liste des observations
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/:patientId/observations', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    const { code, date } = req.query;
    
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
      let searchUrl = `${server.url}/Observation?patient=${patientId}&_count=100&_sort=-date`;
      
      // Ajout des critères de recherche
      if (code) {
        searchUrl += `&code=${encodeURIComponent(code)}`;
      }
      
      if (date) {
        searchUrl += `&date=${encodeURIComponent(date)}`;
      }
      
      // Récupération des observations
      const response = await axios.get(
        searchUrl,
        createAxiosConfig(server)
      );
      
      if (response.data && response.data.resourceType === 'Bundle') {
        // Extraction des informations des observations
        const observations = response.data.entry ? response.data.entry.map(entry => {
          const observation = entry.resource;
          return {
            id: observation.id,
            resourceType: observation.resourceType,
            status: observation.status,
            code: observation.code,
            subject: observation.subject,
            effectiveDateTime: observation.effectiveDateTime,
            issued: observation.issued,
            valueQuantity: observation.valueQuantity,
            valueString: observation.valueString,
            valueCodeableConcept: observation.valueCodeableConcept,
            interpretation: observation.interpretation,
            referenceRange: observation.referenceRange,
            category: observation.category
          };
        }) : [];
        
        res.json({
          success: true,
          message: 'Observations récupérées avec succès',
          data: observations
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
        message: 'Erreur lors de la récupération des observations',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des observations: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des observations',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/medications:
 *   get:
 *     summary: Traitements médicamenteux d'un patient
 *     description: Récupère la liste des médicaments et prescriptions d'un patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Statut des prescriptions (active, completed, etc.)
 *     responses:
 *       200:
 *         description: Liste des médicaments et prescriptions
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/related-persons:
 *   get:
 *     summary: Personnes liées au patient
 *     description: Récupère la liste des personnes liées au patient (famille, contacts, etc.)
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *     responses:
 *       200:
 *         description: Liste des personnes liées
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/practitioners:
 *   get:
 *     summary: Praticiens liés au patient
 *     description: Récupère la liste des praticiens associés au dossier du patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *     responses:
 *       200:
 *         description: Liste des praticiens
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/organizations:
 *   get:
 *     summary: Organisations liées au patient
 *     description: Récupère la liste des organisations liées au dossier du patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *     responses:
 *       200:
 *         description: Liste des organisations
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/coverage:
 *   get:
 *     summary: Couvertures d'assurance du patient
 *     description: Récupère la liste des couvertures d'assurance du patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *     responses:
 *       200:
 *         description: Liste des couvertures
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */

// Route pour récupérer les personnes liées au patient
router.get('/:serverId/patients/:patientId/related-persons', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Récupération des personnes liées au patient
      const response = await axios.get(
        `${server.url}/RelatedPerson?patient=${patientId}&_count=50`,
        createAxiosConfig(server, { timeout: 20000 })
      );
      
      if (response.data && response.data.resourceType === 'Bundle') {
        // Extraction des informations des personnes liées
        const relatedPersons = response.data.entry ? response.data.entry.map(entry => entry.resource) : [];
        
        res.json({
          success: true,
          message: 'Personnes liées récupérées avec succès',
          data: relatedPersons
        });
      } else {
        res.status(200).json({
          success: true,
          message: 'Aucune personne liée trouvée',
          data: []
        });
      }
    } catch (error) {
      logger.error(`Erreur lors de la récupération des personnes liées: ${error.message}`);
      
      // Répondre avec un tableau vide au lieu d'une erreur pour éviter de bloquer le chargement du patient
      res.json({
        success: true,
        message: 'Aucune personne liée trouvée',
        data: []
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des personnes liées: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des personnes liées',
      error: error.message
    });
  }
});

// Route pour récupérer les praticiens associés au patient
router.get('/:serverId/patients/:patientId/practitioners', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Tout d'abord, on récupère les PractitionerRole liés au patient via les Encounters
      const encountersResponse = await axios.get(
        `${server.url}/Encounter?patient=${patientId}&_include=Encounter:practitioner&_count=50`,
        createAxiosConfig(server, { timeout: 20000 })
      );
      
      // Liste pour stocker les identifiants uniques des praticiens
      const practitionerIds = new Set();
      let practitioners = [];
      
      if (encountersResponse.data && encountersResponse.data.resourceType === 'Bundle' && encountersResponse.data.entry) {
        // Extraire les ressources Practitioner incluses dans la réponse
        practitioners = encountersResponse.data.entry
          .filter(entry => entry.resource.resourceType === 'Practitioner')
          .map(entry => entry.resource);
        
        // Enregistrer les IDs des praticiens déjà récupérés
        practitioners.forEach(p => practitionerIds.add(p.id));
      }
      
      // Ensuite, on cherche les praticiens directement via PractitionerRole
      const practitionerRoleResponse = await axios.get(
        `${server.url}/PractitionerRole?patient=${patientId}&_include=PractitionerRole:practitioner&_count=50`,
        createAxiosConfig(server, { timeout: 20000 })
      );
      
      if (practitionerRoleResponse.data && practitionerRoleResponse.data.resourceType === 'Bundle' && practitionerRoleResponse.data.entry) {
        // Ajouter les nouveaux praticiens non déjà présents dans la liste
        const newPractitioners = practitionerRoleResponse.data.entry
          .filter(entry => entry.resource.resourceType === 'Practitioner' && !practitionerIds.has(entry.resource.id))
          .map(entry => entry.resource);
        
        practitioners = [...practitioners, ...newPractitioners];
      }
      
      res.json({
        success: true,
        message: 'Praticiens récupérés avec succès',
        data: practitioners
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des praticiens: ${error.message}`);
      
      // Répondre avec un tableau vide au lieu d'une erreur pour éviter de bloquer le chargement du patient
      res.json({
        success: true,
        message: 'Aucun praticien trouvé',
        data: []
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des praticiens: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des praticiens',
      error: error.message
    });
  }
});

// Route pour récupérer les organisations associées au patient
router.get('/:serverId/patients/:patientId/organizations', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Recherche des organisations via le patient (organization du patient)
      const patientOrgResponse = await axios.get(
        `${server.url}/Patient/${patientId}?_include=Patient:organization&_count=50`,
        createAxiosConfig(server, { timeout: 20000 })
      );
      
      // Liste pour stocker les identifiants uniques des organisations
      const organizationIds = new Set();
      let organizations = [];
      
      if (patientOrgResponse.data && patientOrgResponse.data.resourceType === 'Bundle' && patientOrgResponse.data.entry) {
        // Extraire les ressources Organization incluses dans la réponse
        const patientOrgs = patientOrgResponse.data.entry
          .filter(entry => entry.resource.resourceType === 'Organization')
          .map(entry => entry.resource);
        
        organizations = [...patientOrgs];
        
        // Enregistrer les IDs des organisations déjà récupérées
        organizations.forEach(org => organizationIds.add(org.id));
      }
      
      // Recherche via la requête _has spécifique
      const orgsResponse = await axios.get(
        `${server.url}/Organization?_has:Patient:organization:_id=${patientId}&_count=50`,
        createAxiosConfig(server, { timeout: 20000 })
      );
      
      if (orgsResponse.data && orgsResponse.data.resourceType === 'Bundle' && orgsResponse.data.entry) {
        // Ajouter les nouvelles organisations non déjà présentes dans la liste
        const newOrgs = orgsResponse.data.entry
          .filter(entry => !organizationIds.has(entry.resource.id))
          .map(entry => entry.resource);
        
        organizations = [...organizations, ...newOrgs];
      }
      
      res.json({
        success: true,
        message: 'Organisations récupérées avec succès',
        data: organizations
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des organisations: ${error.message}`);
      
      // Répondre avec un tableau vide au lieu d'une erreur pour éviter de bloquer le chargement du patient
      res.json({
        success: true,
        message: 'Aucune organisation trouvée',
        data: []
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des organisations: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des organisations',
      error: error.message
    });
  }
});

// Route pour récupérer les couvertures d'assurance du patient
router.get('/:serverId/patients/:patientId/coverage', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Récupération des couvertures d'assurance
      const response = await axios.get(
        `${server.url}/Coverage?beneficiary=Patient/${patientId}&_count=50`,
        createAxiosConfig(server, { timeout: 20000 })
      );
      
      if (response.data && response.data.resourceType === 'Bundle') {
        // Extraction des informations des couvertures
        const coverages = response.data.entry ? response.data.entry.map(entry => entry.resource) : [];
        
        res.json({
          success: true,
          message: 'Couvertures récupérées avec succès',
          data: coverages
        });
      } else {
        res.status(200).json({
          success: true,
          message: 'Aucune couverture trouvée',
          data: []
        });
      }
    } catch (error) {
      logger.error(`Erreur lors de la récupération des couvertures: ${error.message}`);
      
      // Répondre avec un tableau vide au lieu d'une erreur pour éviter de bloquer le chargement du patient
      res.json({
        success: true,
        message: 'Aucune couverture trouvée',
        data: []
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des couvertures: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des couvertures',
      error: error.message
    });
  }
});
router.get('/:serverId/patients/:patientId/medications', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    const { status } = req.query;
    
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
      let searchUrl = `${server.url}/MedicationRequest?patient=${patientId}&_count=100&_sort=-date`;
      
      // Ajout des critères de recherche
      if (status) {
        searchUrl += `&status=${encodeURIComponent(status)}`;
      }
      
      // Récupération des prescriptions
      const response = await axios.get(
        searchUrl,
        createAxiosConfig(server)
      );
      
      if (response.data && response.data.resourceType === 'Bundle') {
        // Extraction des informations des prescriptions
        const medications = response.data.entry ? response.data.entry.map(entry => {
          const medication = entry.resource;
          return {
            id: medication.id,
            resourceType: medication.resourceType,
            status: medication.status,
            intent: medication.intent,
            medicationCodeableConcept: medication.medicationCodeableConcept,
            medicationReference: medication.medicationReference,
            subject: medication.subject,
            authoredOn: medication.authoredOn,
            requester: medication.requester,
            dosageInstruction: medication.dosageInstruction,
            dispenseRequest: medication.dispenseRequest,
            note: medication.note
          };
        }) : [];
        
        res.json({
          success: true,
          message: 'Prescriptions médicamenteuses récupérées avec succès',
          data: medications
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
        message: 'Erreur lors de la récupération des prescriptions médicamenteuses',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des prescriptions médicamenteuses: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des prescriptions médicamenteuses',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/encounters:
 *   get:
 *     summary: Consultations et séjours d'un patient
 *     description: Récupère la liste des consultations et séjours hospitaliers d'un patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         description: Date ou période des consultations
 *     responses:
 *       200:
 *         description: Liste des consultations et séjours
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/:patientId/encounters', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    const { date } = req.query;
    
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
      let searchUrl = `${server.url}/Encounter?patient=${patientId}&_count=100&_sort=-date`;
      
      // Ajout des critères de recherche
      if (date) {
        searchUrl += `&date=${encodeURIComponent(date)}`;
      }
      
      // Récupération des consultations
      const response = await axios.get(
        searchUrl,
        createAxiosConfig(server)
      );
      
      if (response.data && response.data.resourceType === 'Bundle') {
        // Extraction des informations des consultations
        const encounters = response.data.entry ? response.data.entry.map(entry => {
          const encounter = entry.resource;
          return {
            id: encounter.id,
            resourceType: encounter.resourceType,
            status: encounter.status,
            class: encounter.class,
            type: encounter.type,
            subject: encounter.subject,
            participant: encounter.participant,
            period: encounter.period,
            location: encounter.location,
            hospitalization: encounter.hospitalization,
            reasonCode: encounter.reasonCode,
            diagnosis: encounter.diagnosis
          };
        }) : [];
        
        res.json({
          success: true,
          message: 'Consultations récupérées avec succès',
          data: encounters
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
        message: 'Erreur lors de la récupération des consultations',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des consultations: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des consultations',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/documents:
 *   get:
 *     summary: Documents médicaux d'un patient
 *     description: Récupère la liste des documents médicaux d'un patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *     responses:
 *       200:
 *         description: Liste des documents médicaux
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/:patientId/documents', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Récupération des documents
      const response = await axios.get(
        `${server.url}/DocumentReference?patient=${patientId}&_count=100&_sort=-date`,
        createAxiosConfig(server)
      );
      
      if (response.data && response.data.resourceType === 'Bundle') {
        // Extraction des informations des documents
        const documents = response.data.entry ? response.data.entry.map(entry => {
          const document = entry.resource;
          return {
            id: document.id,
            resourceType: document.resourceType,
            status: document.status,
            type: document.type,
            subject: document.subject,
            date: document.date,
            author: document.author,
            description: document.description,
            content: document.content,
            context: document.context,
            securityLabel: document.securityLabel
          };
        }) : [];
        
        res.json({
          success: true,
          message: 'Documents récupérés avec succès',
          data: documents
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
        message: 'Erreur lors de la récupération des documents',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des documents: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des documents',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/summary:
 *   get:
 *     summary: Résumé du dossier patient
 *     description: Récupère un résumé du dossier patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *     responses:
 *       200:
 *         description: Résumé du dossier patient
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/:patientId/summary', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Récupération du patient et de ses données associées en parallèle
      const [patientRes, conditionsRes, observationsRes, medicationsRes, encountersRes] = await Promise.all([
        axios.get(`${server.url}/Patient/${patientId}`, createAxiosConfig(server)),
        axios.get(`${server.url}/Condition?patient=${patientId}&_count=20&_sort=-date`, createAxiosConfig(server)),
        axios.get(`${server.url}/Observation?patient=${patientId}&_count=20&_sort=-date`, createAxiosConfig(server)),
        axios.get(`${server.url}/MedicationRequest?patient=${patientId}&_count=20&_sort=-date`, createAxiosConfig(server)),
        axios.get(`${server.url}/Encounter?patient=${patientId}&_count=20&_sort=-date`, createAxiosConfig(server))
      ]);
      
      // Vérification des réponses
      if (
        patientRes.data && patientRes.data.resourceType === 'Patient' &&
        conditionsRes.data && conditionsRes.data.resourceType === 'Bundle' &&
        observationsRes.data && observationsRes.data.resourceType === 'Bundle' &&
        medicationsRes.data && medicationsRes.data.resourceType === 'Bundle' &&
        encountersRes.data && encountersRes.data.resourceType === 'Bundle'
      ) {
        // Création du résumé patient
        const summary = {
          patient: {
            id: patientRes.data.id,
            name: patientRes.data.name?.map(n => {
              const parts = [];
              if (n.prefix) parts.push(n.prefix.join(' '));
              if (n.given) parts.push(n.given.join(' '));
              if (n.family) parts.push(n.family);
              return parts.join(' ');
            }),
            gender: patientRes.data.gender,
            birthDate: patientRes.data.birthDate,
            active: patientRes.data.active
          },
          conditions: (conditionsRes.data.entry || []).map(entry => ({
            id: entry.resource.id,
            code: entry.resource.code,
            clinicalStatus: entry.resource.clinicalStatus,
            onsetDateTime: entry.resource.onsetDateTime,
            recordedDate: entry.resource.recordedDate
          })),
          observations: (observationsRes.data.entry || []).map(entry => ({
            id: entry.resource.id,
            code: entry.resource.code,
            effectiveDateTime: entry.resource.effectiveDateTime,
            valueQuantity: entry.resource.valueQuantity,
            valueString: entry.resource.valueString,
            valueCodeableConcept: entry.resource.valueCodeableConcept
          })),
          medications: (medicationsRes.data.entry || []).map(entry => ({
            id: entry.resource.id,
            status: entry.resource.status,
            medicationCodeableConcept: entry.resource.medicationCodeableConcept,
            medicationReference: entry.resource.medicationReference,
            authoredOn: entry.resource.authoredOn,
            dosageInstruction: entry.resource.dosageInstruction
          })),
          encounters: (encountersRes.data.entry || []).map(entry => ({
            id: entry.resource.id,
            status: entry.resource.status,
            class: entry.resource.class,
            type: entry.resource.type,
            period: entry.resource.period
          }))
        };
        
        res.json({
          success: true,
          message: 'Résumé patient généré avec succès',
          data: summary
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
        message: 'Erreur lors de la génération du résumé patient',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la génération du résumé patient: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du résumé patient',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/patient-viewer/{serverId}/patients/{patientId}/bundle:
 *   get:
 *     summary: Bundle FHIR complet du patient
 *     description: Récupère un bundle FHIR complet contenant toutes les ressources liées au patient
 *     tags:
 *       - Visualisation Patient
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du serveur FHIR
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du patient
 *     responses:
 *       200:
 *         description: Bundle FHIR du patient
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:serverId/patients/:patientId/bundle', authCombined, async (req, res) => {
  try {
    const { serverId, patientId } = req.params;
    
    // Récupération des détails du serveur
    const server = getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Récupération de toutes les ressources liées au patient
      const [
        patientRes, 
        conditionsRes, 
        observationsRes, 
        medicationsRes, 
        encountersRes,
        documentsRes,
        allergyRes,
        proceduresRes
      ] = await Promise.all([
        axios.get(`${server.url}/Patient/${patientId}`, createAxiosConfig(server)),
        axios.get(`${server.url}/Condition?patient=${patientId}&_count=100`, createAxiosConfig(server)),
        axios.get(`${server.url}/Observation?patient=${patientId}&_count=100`, createAxiosConfig(server)),
        axios.get(`${server.url}/MedicationRequest?patient=${patientId}&_count=100`, createAxiosConfig(server)),
        axios.get(`${server.url}/Encounter?patient=${patientId}&_count=100`, createAxiosConfig(server)),
        axios.get(`${server.url}/DocumentReference?patient=${patientId}&_count=100`, createAxiosConfig(server)),
        axios.get(`${server.url}/AllergyIntolerance?patient=${patientId}&_count=100`, createAxiosConfig(server)),
        axios.get(`${server.url}/Procedure?patient=${patientId}&_count=100`, createAxiosConfig(server))
      ]);
      
      // Création du bundle FHIR
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp: new Date().toISOString(),
        entry: [
          {
            resource: patientRes.data,
            request: {
              method: 'GET',
              url: `Patient/${patientId}`
            }
          }
        ]
      };
      
      // Ajout des autres ressources au bundle
      [
        conditionsRes.data, 
        observationsRes.data, 
        medicationsRes.data, 
        encountersRes.data,
        documentsRes.data,
        allergyRes.data,
        proceduresRes.data
      ].forEach(resource => {
        if (resource && resource.resourceType === 'Bundle' && resource.entry) {
          resource.entry.forEach(entry => {
            bundle.entry.push({
              resource: entry.resource,
              request: {
                method: 'GET',
                url: `${entry.resource.resourceType}/${entry.resource.id}`
              }
            });
          });
        }
      });
      
      // Retour du bundle
      res.json({
        success: true,
        message: 'Bundle FHIR généré avec succès',
        data: bundle
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du bundle FHIR',
        error: error.response ? error.response.data : error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la génération du bundle FHIR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du bundle FHIR',
      error: error.message
    });
  }
});

module.exports = router;