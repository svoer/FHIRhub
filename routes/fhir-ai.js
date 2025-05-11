/**
 * Routes pour l'intégration d'IA avec FHIR
 * Ce module gère les requêtes en langage naturel et leur conversion en requêtes FHIR
 * Utilise le fournisseur d'IA configuré comme actif (Mistral, Ollama, DeepSeek, etc.)
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { authCombined } = require('../middleware/auth');
const fhirService = require('../utils/fhirService');
const aiService = require('../utils/aiService');
const aiProviderService = require('../utils/aiProviderService');

// Fichier de configuration des serveurs FHIR
const FHIR_SERVERS_CONFIG_FILE = path.join(__dirname, '../config/fhir-servers.json');

// Toutes les fonctions ont été déplacées vers les modules utilitaires
// fhirService.js et services d'IA unifié

// Les templates de prompts ont été déplacés vers le service d'IA unifié

/**
 * @swagger
 * /api/fhir-ai/status:
 *   get:
 *     summary: Statut du service d'IA actif
 *     description: Vérifie si un fournisseur d'IA est configuré et disponible
 *     tags:
 *       - FHIR AI
 *     responses:
 *       200:
 *         description: Statut du service d'IA
 *       500:
 *         description: Erreur serveur
 */
router.get('/status', authCombined, async (req, res) => {
  try {
    // Récupérer le fournisseur d'IA actif
    const aiProvider = await aiProviderService.getActiveAIProvider();
    const isAvailable = aiProvider && aiService.isAvailable();
    
    res.json({
      success: true,
      data: {
        available: isAvailable,
        provider: aiProvider ? aiProvider.provider_name : 'Non configuré',
        message: isAvailable 
          ? `Service d'IA (${aiProvider.provider_name}) disponible et configuré`
          : `Aucun service d'IA actif configuré. Veuillez configurer un fournisseur d'IA dans les paramètres.`
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la vérification du statut du service d'IA: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la vérification du statut du service d'IA`,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir-ai/models:
 *   get:
 *     summary: Liste des modèles disponibles pour le fournisseur d'IA actif
 *     description: Récupère la liste des modèles disponibles pour le fournisseur d'IA actuellement configuré
 *     tags:
 *       - FHIR AI
 *     responses:
 *       200:
 *         description: Liste des modèles disponibles
 *       500:
 *         description: Erreur serveur
 */
router.get('/models', authCombined, async (req, res) => {
  try {
    // Récupérer le fournisseur d'IA actif
    const aiProvider = await aiProviderService.getActiveAIProvider();
    const isAvailable = aiProvider && aiService.isAvailable();
    
    if (!isAvailable) {
      return res.status(503).json({
        success: false,
        message: 'Aucun fournisseur d\'IA actif configuré. Veuillez configurer un fournisseur d\'IA dans les paramètres.'
      });
    }
    
    try {
      // Récupérer les modèles via le service d'IA unifié
      const models = await aiService.listModels();
      
      res.json({
        success: true,
        data: {
          provider: aiProvider.provider_name,
          models: models || [],
          recommended: aiProvider.default_model || models?.[0] || 'Non disponible'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des modèles Mistral',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération des modèles Mistral: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des modèles Mistral',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir-ai/{serverId}/natural-query:
 *   post:
 *     summary: Requête FHIR en langage naturel
 *     description: Convertit une question en langage naturel en requête FHIR et l'exécute
 *     tags:
 *       - FHIR AI
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
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 description: Question en langage naturel
 *               model:
 *                 type: string
 *                 default: mistral-large-latest
 *                 description: Modèle Mistral à utiliser
 *               summarize:
 *                 type: boolean
 *                 default: false
 *                 description: Indique si les résultats doivent être résumés
 *     responses:
 *       200:
 *         description: Résultats de la requête FHIR
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Serveur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/:serverId/natural-query', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { question, model = 'mistral-large-latest', summarize = false } = req.body;
    
    // Vérification des paramètres requis
    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre question est requis'
      });
    }
    
    // Vérification de la disponibilité d'un fournisseur d'IA
    const aiProvider = await aiProviderService.getActiveAIProvider();
    const isAvailable = aiProvider && aiService.isAvailable();
    
    if (!isAvailable) {
      return res.status(503).json({
        success: false,
        message: 'Aucun fournisseur d\'IA actif configuré. Veuillez configurer un fournisseur d\'IA dans les paramètres.'
      });
    }
    
    // Récupération des détails du serveur
    const server = fhirService.getServerDetails(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Serveur FHIR non trouvé'
      });
    }
    
    try {
      // Étape 1: Conversion de la question en requête FHIR
      logger.info(`Conversion de la question en requête FHIR: ${question}`);
      
      // Utilisation du service IA unifié pour convertir la question en requête FHIR
      const sanitizedQuery = await aiService.convertNaturalLanguageToFhirQuery(question, {
        temperature: 0.2,
        // Le model est défini par le fournisseur d'IA actif
        aiProvider
      });
      
      logger.info(`Requête FHIR générée: ${sanitizedQuery}`);
      
      // Étape 2: Exécution de la requête FHIR
      logger.info(`Exécution de la requête FHIR: ${sanitizedQuery}`);
      
      // Construction de l'URL complète
      const requestUrl = `${server.url}${sanitizedQuery.startsWith('/') ? sanitizedQuery : '/' + sanitizedQuery}`;
      
      // Exécution de la requête
      const axiosConfig = fhirService.createAxiosConfig(server);
      const fhirResponse = await axios.get(requestUrl, axiosConfig);
      
      // Étape 3: Post-traitement des résultats
      let responseData = {
        question,
        fhirQuery: sanitizedQuery,
        server: {
          id: server.id,
          name: server.name,
          url: server.url
        },
        results: fhirResponse.data,
        summary: null
      };
      
      // Étape 4: Génération d'un résumé des résultats si demandé
      if (summarize && fhirResponse.data) {
        logger.info('Génération d\'un résumé des résultats');
        
        // Utilisation du service IA unifié pour générer un résumé
        responseData.summary = await aiService.generateMedicalSummary(fhirResponse.data, {
          temperature: 0.3,
          maxTokens: 1000,
          aiProvider
        });
      }
      
      // Retour des résultats
      res.json({
        success: true,
        message: 'Requête en langage naturel exécutée avec succès',
        data: responseData
      });
    } catch (error) {
      logger.error(`Erreur lors de l'exécution de la requête en langage naturel: ${error.message}`);
      
      // Erreur spécifique si c'est une erreur de l'API Mistral
      if (error.name === 'MistralAPIError') {
        return res.status(500).json({
          success: false,
          message: 'Erreur de l\'API Mistral',
          error: error.message,
          type: 'mistral_api_error'
        });
      }
      
      // Erreur spécifique si c'est une erreur de l'API FHIR
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          message: 'Erreur lors de l\'exécution de la requête FHIR',
          error: error.response.data,
          type: 'fhir_api_error'
        });
      }
      
      // Erreur générique
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'exécution de la requête en langage naturel',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de l'exécution de la requête en langage naturel: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'exécution de la requête en langage naturel',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir-ai/{serverId}/summarize-patient:
 *   post:
 *     summary: Résumé du dossier d'un patient
 *     description: Génère un résumé du dossier d'un patient à partir des données FHIR
 *     tags:
 *       - FHIR AI
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
 *             required:
 *               - patientId
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: ID du patient
 *               model:
 *                 type: string
 *                 default: mistral-large-latest
 *                 description: Modèle Mistral à utiliser
 *               options:
 *                 type: object
 *                 properties:
 *                   includeConditions:
 *                     type: boolean
 *                     default: true
 *                     description: Inclure les conditions médicales dans le résumé
 *                   includeObservations:
 *                     type: boolean
 *                     default: true
 *                     description: Inclure les observations dans le résumé
 *                   includeMedications:
 *                     type: boolean
 *                     default: true
 *                     description: Inclure les médicaments dans le résumé
 *                   includeEncounters:
 *                     type: boolean
 *                     default: true
 *                     description: Inclure les consultations dans le résumé
 *     responses:
 *       200:
 *         description: Résumé du dossier patient
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/:serverId/summarize-patient', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { 
      patientId, 
      model = 'mistral-large-latest',
      options = {
        includeConditions: true,
        includeObservations: true,
        includeMedications: true,
        includeEncounters: true
      }
    } = req.body;
    
    // Vérification des paramètres requis
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre patientId est requis'
      });
    }
    
    // Vérification de la disponibilité d'un fournisseur d'IA
    if (!(await aiService.isAvailable())) {
      return res.status(503).json({
        success: false,
        message: 'Aucun fournisseur d\'IA n\'est configuré ou actif. Veuillez configurer un fournisseur d\'IA dans les paramètres.'
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
      // Étape 1: Récupération des données du patient
      logger.info(`Récupération des données du patient ${patientId} sur le serveur ${serverId}`);
      
      // Préparation des promesses pour récupérer les données en parallèle
      const promises = [
        // Toujours récupérer les données de base du patient
        axios.get(`${server.url}/Patient/${patientId}`, createAxiosConfig(server))
      ];
      
      // Ajout des promesses en fonction des options
      if (options.includeConditions) {
        promises.push(
          axios.get(`${server.url}/Condition?patient=${patientId}&_count=50&_sort=-date`, createAxiosConfig(server))
            .catch(error => {
              logger.warn(`Erreur lors de la récupération des conditions: ${error.message}`);
              return { data: { resourceType: 'Bundle', entry: [] } };
            })
        );
      }
      
      if (options.includeObservations) {
        promises.push(
          axios.get(`${server.url}/Observation?patient=${patientId}&_count=50&_sort=-date`, createAxiosConfig(server))
            .catch(error => {
              logger.warn(`Erreur lors de la récupération des observations: ${error.message}`);
              return { data: { resourceType: 'Bundle', entry: [] } };
            })
        );
      }
      
      if (options.includeMedications) {
        promises.push(
          axios.get(`${server.url}/MedicationRequest?patient=${patientId}&_count=50&_sort=-date`, createAxiosConfig(server))
            .catch(error => {
              logger.warn(`Erreur lors de la récupération des médicaments: ${error.message}`);
              return { data: { resourceType: 'Bundle', entry: [] } };
            })
        );
      }
      
      if (options.includeEncounters) {
        promises.push(
          axios.get(`${server.url}/Encounter?patient=${patientId}&_count=50&_sort=-date`, createAxiosConfig(server))
            .catch(error => {
              logger.warn(`Erreur lors de la récupération des consultations: ${error.message}`);
              return { data: { resourceType: 'Bundle', entry: [] } };
            })
        );
      }
      
      // Exécution des promesses en parallèle
      const responses = await Promise.all(promises);
      
      // Création du bundle FHIR avec toutes les données récupérées
      const patientData = responses[0].data;
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp: new Date().toISOString(),
        entry: [
          {
            resource: patientData
          }
        ]
      };
      
      // Ajout des autres ressources au bundle
      for (let i = 1; i < responses.length; i++) {
        if (responses[i].data && responses[i].data.resourceType === 'Bundle' && responses[i].data.entry) {
          responses[i].data.entry.forEach(entry => {
            bundle.entry.push({
              resource: entry.resource
            });
          });
        }
      }
      
      // Étape 2: Génération du résumé
      logger.info('Génération du résumé du dossier patient');
      
      // Préparation du prompt avec les données FHIR
      const fhirDataStr = JSON.stringify(bundle, null, 2);
      const summaryPrompt = createSummaryPrompt(fhirDataStr);
      
      // Appel à l'API Mistral pour le résumé
      const summaryResponse = await aiService.generateResponse({
        prompt: summaryPrompt,
        maxTokens: 2000,
        temperature: 0.3
      });
      
      const summary = summaryResponse.trim();
      
      // Retour des résultats
      res.json({
        success: true,
        message: 'Résumé du dossier patient généré avec succès',
        data: {
          patient: {
            id: patientData.id,
            resourceType: patientData.resourceType,
            name: patientData.name?.map(n => {
              const parts = [];
              if (n.prefix) parts.push(n.prefix.join(' '));
              if (n.given) parts.push(n.given.join(' '));
              if (n.family) parts.push(n.family);
              return parts.join(' ');
            }),
            gender: patientData.gender,
            birthDate: patientData.birthDate
          },
          summary,
          dataSources: {
            conditions: options.includeConditions,
            observations: options.includeObservations,
            medications: options.includeMedications,
            encounters: options.includeEncounters
          },
          bundleSize: bundle.entry.length
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la génération du résumé du dossier patient: ${error.message}`);
      
      // Erreur spécifique si c'est une erreur de l'API Mistral
      if (error.name === 'MistralAPIError') {
        return res.status(500).json({
          success: false,
          message: 'Erreur de l\'API Mistral',
          error: error.message,
          type: 'mistral_api_error'
        });
      }
      
      // Erreur spécifique si c'est une erreur de l'API FHIR
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          message: 'Erreur lors de la récupération des données FHIR',
          error: error.response.data,
          type: 'fhir_api_error'
        });
      }
      
      // Erreur générique
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du résumé du dossier patient',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la génération du résumé du dossier patient: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du résumé du dossier patient',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir-ai/{serverId}/analyze-observation:
 *   post:
 *     summary: Analyse d'une observation médicale
 *     description: Analyse et interprète une observation médicale à partir de son ID
 *     tags:
 *       - FHIR AI
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
 *             required:
 *               - observationId
 *             properties:
 *               observationId:
 *                 type: string
 *                 description: ID de l'observation
 *               model:
 *                 type: string
 *                 default: mistral-large-latest
 *                 description: Modèle Mistral à utiliser
 *     responses:
 *       200:
 *         description: Analyse de l'observation
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Serveur ou observation non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/:serverId/analyze-observation', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { observationId, model = 'mistral-large-latest' } = req.body;
    
    // Vérification des paramètres requis
    if (!observationId) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre observationId est requis'
      });
    }
    
    // Vérification de la disponibilité d'un fournisseur d'IA
    if (!(await aiService.isAvailable())) {
      return res.status(503).json({
        success: false,
        message: 'Aucun fournisseur d\'IA n\'est configuré ou actif. Veuillez configurer un fournisseur d\'IA dans les paramètres.'
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
      // Récupération de l'observation
      logger.info(`Récupération de l'observation ${observationId} sur le serveur ${serverId}`);
      
      const observationResponse = await axios.get(
        `${server.url}/Observation/${observationId}`,
        createAxiosConfig(server)
      );
      
      if (!observationResponse.data || observationResponse.data.resourceType !== 'Observation') {
        return res.status(400).json({
          success: false,
          message: 'Ressource récupérée invalide: ce n\'est pas une Observation'
        });
      }
      
      const observation = observationResponse.data;
      
      // Récupération des informations du patient associé
      let patient = null;
      
      if (observation.subject && observation.subject.reference) {
        const patientReference = observation.subject.reference;
        const patientId = patientReference.replace('Patient/', '');
        
        try {
          const patientResponse = await axios.get(
            `${server.url}/Patient/${patientId}`,
            createAxiosConfig(server)
          );
          
          if (patientResponse.data && patientResponse.data.resourceType === 'Patient') {
            patient = patientResponse.data;
          }
        } catch (error) {
          logger.warn(`Erreur lors de la récupération du patient: ${error.message}`);
        }
      }
      
      // Préparation du prompt pour l'analyse de l'observation
      const analysisPrompt = `
Tu es un expert médical spécialisé dans l'interprétation des résultats d'analyses médicales.
Voici une observation médicale au format FHIR que tu dois interpréter:

\`\`\`json
${JSON.stringify(observation, null, 2)}
\`\`\`

${patient ? `Informations sur le patient:
\`\`\`json
${JSON.stringify({
  id: patient.id,
  gender: patient.gender,
  birthDate: patient.birthDate,
  name: patient.name
}, null, 2)}
\`\`\`
` : ''}

Fais une analyse complète et professionnelle de cette observation:
1. Type d'analyse et code médical
2. Valeur et unité de mesure
3. Interprétation clinique (normal, anormal, critique)
4. Signification médicale et pertinence clinique
5. Plage de référence et écart par rapport à la normale
6. Recommandations ou points d'attention pour le médecin

Ton analyse:
`;
      
      // Appel à l'API Mistral pour l'analyse
      const analysisResponse = await aiService.generateResponse({
        prompt: analysisPrompt,
        maxTokens: 1000,
        temperature: 0.3
      });
      
      const analysis = analysisResponse.trim();
      
      // Retour des résultats
      res.json({
        success: true,
        message: 'Analyse de l\'observation générée avec succès',
        data: {
          observation: {
            id: observation.id,
            resourceType: observation.resourceType,
            status: observation.status,
            code: observation.code,
            subject: observation.subject,
            effectiveDateTime: observation.effectiveDateTime,
            valueQuantity: observation.valueQuantity,
            valueCodeableConcept: observation.valueCodeableConcept,
            valueString: observation.valueString,
            interpretation: observation.interpretation,
            referenceRange: observation.referenceRange
          },
          patient: patient ? {
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
            birthDate: patient.birthDate
          } : null,
          analysis
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de l'analyse de l'observation: ${error.message}`);
      
      // Erreur spécifique si c'est une erreur de l'API Mistral
      if (error.name === 'MistralAPIError') {
        return res.status(500).json({
          success: false,
          message: 'Erreur de l\'API Mistral',
          error: error.message,
          type: 'mistral_api_error'
        });
      }
      
      // Erreur spécifique si c'est une erreur de l'API FHIR
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          message: 'Erreur lors de la récupération des données FHIR',
          error: error.response.data,
          type: 'fhir_api_error'
        });
      }
      
      // Erreur générique
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'analyse de l\'observation',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de l'analyse de l'observation: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse de l\'observation',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/fhir-ai/{serverId}/analyze-trends:
 *   post:
 *     summary: Analyse des tendances pour un patient
 *     description: Analyse l'évolution des observations pour un patient sur une période donnée
 *     tags:
 *       - FHIR AI
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
 *             required:
 *               - patientId
 *               - code
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: ID du patient
 *               code:
 *                 type: string
 *                 description: Code de l'observation (LOINC, SNOMED CT, etc.)
 *               period:
 *                 type: string
 *                 default: 12
 *                 description: Période en mois
 *               model:
 *                 type: string
 *                 default: mistral-large-latest
 *                 description: Modèle Mistral à utiliser
 *     responses:
 *       200:
 *         description: Analyse des tendances
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Serveur ou patient non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/:serverId/analyze-trends', authCombined, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { patientId, code, period = 12, model = 'mistral-large-latest' } = req.body;
    
    // Vérification des paramètres requis
    if (!patientId || !code) {
      return res.status(400).json({
        success: false,
        message: 'Les paramètres patientId et code sont requis'
      });
    }
    
    // Vérification de la disponibilité d'un fournisseur d'IA
    if (!(await aiService.isAvailable())) {
      return res.status(503).json({
        success: false,
        message: 'Aucun fournisseur d\'IA n\'est configuré ou actif. Veuillez configurer un fournisseur d\'IA dans les paramètres.'
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
      // Calcul de la date de début de la période
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(today.getMonth() - parseInt(period));
      
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Récupération des observations
      logger.info(`Récupération des observations pour le patient ${patientId} avec le code ${code} depuis ${startDateStr}`);
      
      const observationsResponse = await axios.get(
        `${server.url}/Observation?patient=${patientId}&code=${encodeURIComponent(code)}&date=ge${startDateStr}&_sort=date&_count=100`,
        createAxiosConfig(server)
      );
      
      if (!observationsResponse.data || observationsResponse.data.resourceType !== 'Bundle') {
        return res.status(400).json({
          success: false,
          message: 'Réponse FHIR invalide pour les observations'
        });
      }
      
      const observations = observationsResponse.data.entry 
        ? observationsResponse.data.entry.map(entry => entry.resource) 
        : [];
      
      // Récupération des informations du patient
      const patientResponse = await axios.get(
        `${server.url}/Patient/${patientId}`,
        createAxiosConfig(server)
      );
      
      if (!patientResponse.data || patientResponse.data.resourceType !== 'Patient') {
        return res.status(400).json({
          success: false,
          message: 'Réponse FHIR invalide pour le patient'
        });
      }
      
      const patient = patientResponse.data;
      
      // Si aucune observation n'est trouvée, retourner un message approprié
      if (observations.length === 0) {
        return res.json({
          success: true,
          message: 'Aucune observation trouvée pour la période et le code spécifiés',
          data: {
            patient: {
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
              birthDate: patient.birthDate
            },
            code,
            period,
            observations: [],
            analysis: 'Aucune donnée disponible pour cette période'
          }
        });
      }
      
      // Préparation du prompt pour l'analyse des tendances
      const trendsPrompt = `
Tu es un expert médical spécialisé dans l'analyse des tendances d'observations médicales au cours du temps.
Voici une série d'observations médicales au format FHIR pour un même patient sur une période de ${period} mois:

\`\`\`json
${JSON.stringify(observations, null, 2)}
\`\`\`

Informations sur le patient:
\`\`\`json
${JSON.stringify({
  id: patient.id,
  gender: patient.gender,
  birthDate: patient.birthDate,
  name: patient.name
}, null, 2)}
\`\`\`

Fais une analyse approfondie de l'évolution de ces valeurs dans le temps:
1. Type d'analyse et signification clinique
2. Tendance générale (stable, en hausse, en baisse, fluctuante)
3. Identification des valeurs anormales et de leur contexte temporel
4. Corrélation avec des périodes ou événements spécifiques
5. Interprétation médicale de ces tendances
6. Recommandations cliniques basées sur cette évolution

Ton analyse:
`;
      
      // Appel au service d'IA pour l'analyse
      const trendsResponse = await aiService.generateResponse({
        prompt: trendsPrompt,
        maxTokens: 1200,
        temperature: 0.3
      });
      
      const analysis = trendsResponse.trim();
      
      // Préparation des données pour le graphique
      const chartData = observations.map(obs => {
        let value = null;
        let unit = '';
        
        if (obs.valueQuantity) {
          value = obs.valueQuantity.value;
          unit = obs.valueQuantity.unit || '';
        } else if (obs.valueInteger) {
          value = obs.valueInteger;
        } else if (obs.valueString) {
          value = obs.valueString;
        } else if (obs.valueCodeableConcept) {
          value = obs.valueCodeableConcept.text || obs.valueCodeableConcept.coding?.[0]?.display;
        }
        
        return {
          date: obs.effectiveDateTime || obs.issued,
          value,
          unit,
          status: obs.status,
          interpretation: obs.interpretation
        };
      }).sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Retour des résultats
      res.json({
        success: true,
        message: 'Analyse des tendances générée avec succès',
        data: {
          patient: {
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
            birthDate: patient.birthDate
          },
          code,
          period,
          observations: chartData,
          analysis
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de l'analyse des tendances: ${error.message}`);
      
      // Erreur spécifique si c'est une erreur de l'API Mistral
      if (error.name === 'MistralAPIError') {
        return res.status(500).json({
          success: false,
          message: 'Erreur de l\'API Mistral',
          error: error.message,
          type: 'mistral_api_error'
        });
      }
      
      // Erreur spécifique si c'est une erreur de l'API FHIR
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          message: 'Erreur lors de la récupération des données FHIR',
          error: error.response.data,
          type: 'fhir_api_error'
        });
      }
      
      // Erreur générique
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'analyse des tendances',
        error: error.message
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de l'analyse des tendances: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse des tendances',
      error: error.message
    });
  }
});

module.exports = router;