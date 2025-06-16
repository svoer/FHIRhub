/**
 * Module d'API pour la validation des terminologies via le SMT
 * Permet de valider les codes médicaux français par rapport au Serveur Multi-Terminologies
 */

const express = require('express');
const router = express.Router();
const frenchTerminologyService = require('../french_terminology_service');
const frenchTerminologyAdapter = require('../french_terminology_adapter');

/**
 * GET /api/terminology/validate
 * Valider un code dans un système donné
 * 
 * Paramètres de requête:
 * - system: URL du système de codage (obligatoire)
 * - code: Code à valider (obligatoire)
 * 
 * Exemple: GET /api/terminology/validate?system=https://mos.esante.gouv.fr/NOS/CCAM_2/FHIR/CCAM&code=AHQP003
 */
router.get('/validate', async (req, res) => {
  const { system, code } = req.query;
  
  if (!system || !code) {
    return res.status(400).json({
      status: 'error',
      message: 'Les paramètres system et code sont requis'
    });
  }
  
  try {
    const isValid = await frenchTerminologyService.validateCode(system, code);
    
    res.json({
      status: 'ok',
      data: {
        system,
        code,
        valid: isValid
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la validation du code: ${error.message}`
    });
  }
});

/**
 * POST /api/terminology/validate-bundle
 * Valider tous les codes trouvés dans un bundle FHIR
 * 
 * Corps de la requête: Bundle FHIR contenant des ressources avec des codes
 * 
 * Exemple de réponse:
 * {
 *   "success": true,
 *   "result": {
 *     "totalCodes": 15,
 *     "validCodes": 12,
 *     "invalidCodes": 3,
 *     "details": [
 *       { "system": "...", "code": "...", "valid": true, "path": "Observation.code" },
 *       { "system": "...", "code": "...", "valid": false, "path": "Condition.code" }
 *     ]
 *   }
 * }
 */
router.post('/validate-bundle', express.json({ limit: '5mb' }), async (req, res) => {
  if (!req.body || !req.body.resourceType) {
    return res.status(400).json({
      status: 'error',
      message: 'Le corps de la requête doit contenir un bundle FHIR valide'
    });
  }

  try {
    const bundle = req.body;
    const results = {
      totalCodes: 0,
      validCodes: 0,
      invalidCodes: 0,
      details: []
    };

    // Traiter chaque ressource dans le bundle
    if (bundle.resourceType === 'Bundle' && Array.isArray(bundle.entry)) {
      for (const entry of bundle.entry) {
        if (entry.resource) {
          await validateCodesInResource(entry.resource, '', results);
        }
      }
    } else {
      // Si ce n'est pas un bundle, traiter comme une ressource unique
      await validateCodesInResource(bundle, '', results);
    }

    res.json({
      status: 'ok',
      result: results
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la validation du bundle: ${error.message}`
    });
  }
});

/**
 * Valider les codes dans une ressource FHIR
 * @param {Object} resource - Ressource FHIR à valider
 * @param {string} path - Chemin actuel dans la ressource
 * @param {Object} results - Résultats de validation
 */
async function validateCodesInResource(resource, path, results) {
  if (!resource || typeof resource !== 'object') return;
  
  const currentPath = path ? `${path}.` : '';
  
  // Vérifier si l'objet a un système et un code (codeable concept ou coding)
  if (resource.system && resource.code) {
    results.totalCodes++;
    try {
      const isValid = await frenchTerminologyService.validateCode(resource.system, resource.code);
      if (isValid) {
        results.validCodes++;
      } else {
        results.invalidCodes++;
      }
      
      results.details.push({
        system: resource.system,
        code: resource.code,
        valid: isValid,
        path: currentPath + 'code'
      });
    } catch (error) {
      results.invalidCodes++;
      results.details.push({
        system: resource.system,
        code: resource.code,
        valid: false,
        error: error.message,
        path: currentPath + 'code'
      });
    }
  }
  
  // Pour les CodeableConcept, vérifier chaque coding
  if (resource.coding && Array.isArray(resource.coding)) {
    for (let i = 0; i < resource.coding.length; i++) {
      const coding = resource.coding[i];
      if (coding && coding.system && coding.code) {
        results.totalCodes++;
        try {
          const isValid = await frenchTerminologyService.validateCode(coding.system, coding.code);
          if (isValid) {
            results.validCodes++;
          } else {
            results.invalidCodes++;
          }
          
          results.details.push({
            system: coding.system,
            code: coding.code,
            valid: isValid,
            path: `${currentPath}coding[${i}]`
          });
        } catch (error) {
          results.invalidCodes++;
          results.details.push({
            system: coding.system,
            code: coding.code,
            valid: false,
            error: error.message,
            path: `${currentPath}coding[${i}]`
          });
        }
      }
    }
  }
  
  // Parcourir récursivement les propriétés de l'objet
  for (const [key, value] of Object.entries(resource)) {
    // Ignorer les propriétés déjà traitées
    if (key === 'coding') continue;
    
    if (Array.isArray(value)) {
      // Pour les tableaux, valider chaque élément
      for (let i = 0; i < value.length; i++) {
        if (value[i] && typeof value[i] === 'object') {
          await validateCodesInResource(value[i], `${currentPath}${key}[${i}]`, results);
        }
      }
    } else if (value && typeof value === 'object') {
      // Pour les objets, validation récursive
      await validateCodesInResource(value, `${currentPath}${key}`, results);
    }
  }
}

/**
 * GET /api/terminology/configure
 * Obtenir l'état de configuration du serveur de terminologies
 */
router.get('/configure', (req, res) => {
  try {
    const config = frenchTerminologyService.getConfiguration();
    
    res.json({
      status: 'ok',
      data: config
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la récupération de la configuration: ${error.message}`
    });
  }
});

/**
 * POST /api/terminology/configure
 * Configurer l'authentification pour le service de terminologie
 * 
 * Corps de la requête:
 * {
 *   "authEnabled": true,
 *   "clientId": "client_id",
 *   "clientSecret": "client_secret"
 * }
 */
router.post('/configure', express.json(), (req, res) => {
  try {
    const result = frenchTerminologyService.configureAuth(req.body);
    
    res.json({
      status: 'ok',
      message: 'Configuration mise à jour',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la configuration: ${error.message}`
    });
  }
});

/**
 * GET /api/terminology/preload
 * Précharger les terminologies françaises principales
 */
router.get('/preload', async (req, res) => {
  try {
    const result = await frenchTerminologyService.preloadKeyTerminologies();
    
    res.json({
      status: 'ok',
      message: `Préchargement terminé: ${result.success} succès, ${result.failed} échecs`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors du préchargement des terminologies: ${error.message}`
    });
  }
});

/**
 * GET /api/terminology/oid/:oid
 * Récupérer les informations d'un système de terminologie à partir de son OID
 * 
 * Paramètres de chemin:
 * - oid: OID à rechercher (avec ou sans préfixe urn:oid:)
 * 
 * Exemple: GET /api/terminology/oid/1.2.250.1.213.2.5
 * Exemple: GET /api/terminology/oid/urn:oid:1.2.250.1.213.2.5
 */
router.get('/oid/:oid', (req, res) => {
  try {
    const { oid } = req.params;
    
    if (!oid) {
      return res.status(400).json({
        status: 'error',
        message: 'L\'OID est requis'
      });
    }
    
    // Rechercher le système par OID
    const systemInfo = frenchTerminologyAdapter.getCodeSystemByOid(oid);
    
    if (!systemInfo) {
      return res.status(404).json({
        status: 'error',
        message: `Aucun système trouvé pour l'OID: ${oid}`
      });
    }
    
    res.json({
      status: 'ok',
      data: systemInfo
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la recherche du système: ${error.message}`
    });
  }
});

/**
 * GET /api/terminology/systems
 * Récupérer la liste de tous les systèmes de terminologie français
 */
router.get('/systems', (req, res) => {
  try {
    // Récupérer les systèmes de codes et d'identifiants
    const codeSystems = frenchTerminologyAdapter.getCodeSystemMappings();
    const identifierSystems = frenchTerminologyAdapter.getIdentifierMappings();
    
    // Construire la liste complète
    const systems = {
      code_systems: codeSystems,
      identifier_systems: identifierSystems
    };
    
    res.json({
      status: 'ok',
      data: systems
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la récupération des systèmes: ${error.message}`
    });
  }
});

module.exports = router;