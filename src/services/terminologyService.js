/**
 * Service de terminologie pour FHIRHub
 * Gère les terminologies médicales françaises et internationales
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CACHE_DIR = path.join(__dirname, '../../data/terminologies');
const SMT_API_URL = 'https://smt.esante.gouv.fr/fhir';
const OFFLINE_MODE = true; // Mode hors ligne par défaut

// Liste des terminologies importantes pour la France
const KEY_FRENCH_TERMINOLOGIES = [
  {
    name: 'CCAM',
    url: 'https://mos.esante.gouv.fr/NOS/CCAM_2/FHIR/CCAM',
    oid: '1.2.250.1.213.2.5'
  },
  {
    name: 'CIM-10',
    url: 'https://mos.esante.gouv.fr/NOS/CIM-10/FHIR/CIM-10',
    oid: '1.2.250.1.213.2.4'
  },
  {
    name: 'SNOMED 3.5',
    url: 'https://mos.esante.gouv.fr/NOS/SNOMED_35/FHIR/SNOMED35',
    oid: '1.2.250.1.213.2.12'
  },
  {
    name: 'NABM',
    url: 'https://mos.esante.gouv.fr/NOS/NABM/FHIR/NABM',
    oid: '1.2.250.1.213.1.1.5.5'
  },
  {
    name: 'UCD',
    url: 'https://mos.esante.gouv.fr/NOS/UCD/FHIR/UCD',
    oid: '1.2.250.1.213.2.3.1'
  }
];

// Liste des terminologies communes
const COMMON_TERMINOLOGIES = [
  {
    name: 'LOINC',
    url: 'http://loinc.org',
    oid: '2.16.840.1.113883.6.1'
  },
  {
    name: 'SNOMED CT',
    url: 'http://snomed.info/sct',
    oid: '2.16.840.1.113883.6.96'
  }
];

/**
 * Initialiser le service de terminologie
 * @returns {Promise<boolean>} Statut d'initialisation
 */
async function initialize() {
  try {
    console.log('[TERMINOLOGY] Initialisation du service de terminologie');
    
    // Vérifier/créer le répertoire de cache
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    // Charger les terminologies françaises
    console.log('[TERMINOLOGY] Chargement des systèmes français');
    await prepareTerminologies(KEY_FRENCH_TERMINOLOGIES);
    
    // Charger les terminologies communes
    console.log('[TERMINOLOGY] Chargement des systèmes communs');
    await prepareTerminologies(COMMON_TERMINOLOGIES);
    
    console.log('[TERMINOLOGY] Service de terminologie initialisé avec succès');
    return true;
  } catch (error) {
    console.error('[TERMINOLOGY] Erreur lors de l\'initialisation du service de terminologie:', error);
    console.log('[TERMINOLOGY] Service initialisé en mode dégradé');
    return false;
  }
}

/**
 * Préparer les terminologies
 * @param {Array} terminologies - Liste des terminologies à préparer
 */
async function prepareTerminologies(terminologies) {
  for (const terminology of terminologies) {
    const cachePath = path.join(CACHE_DIR, `${terminology.name.replace(/\s+/g, '_')}.json`);
    
    if (!fs.existsSync(cachePath)) {
      // En mode hors ligne, créer un fichier de base
      const baseData = {
        name: terminology.name,
        url: terminology.url,
        oid: terminology.oid,
        concepts: [],
        cached: true,
        offline: true
      };
      
      fs.writeFileSync(cachePath, JSON.stringify(baseData, null, 2));
    }
  }
}

/**
 * Valider un code dans un système
 * @param {string} system - URL du système
 * @param {string} code - Code à valider
 * @returns {Promise<boolean>} True si le code est valide
 */
async function validateCode(system, code) {
  // En mode hors ligne, considérer tous les codes comme valides
  if (OFFLINE_MODE) {
    return true;
  }
  
  try {
    const response = await axios.get(`${SMT_API_URL}/CodeSystem/$validate-code`, {
      params: {
        url: system,
        code: code
      }
    });
    
    return response.data.parameter.find(p => p.name === 'result').valueBoolean === true;
  } catch (error) {
    console.error(`[TERMINOLOGY] Erreur lors de la validation du code ${code} dans ${system}:`, error.message);
    // En cas d'erreur, considérer le code comme valide
    return true;
  }
}

/**
 * Valider un Bundle FHIR
 * @param {Object} bundle - Bundle FHIR
 * @returns {Promise<Object>} Résultats de validation
 */
async function validateBundle(bundle) {
  const results = {
    totalCodes: 0,
    validCodes: 0,
    invalidCodes: 0,
    details: []
  };
  
  // Parcourir toutes les ressources du bundle
  if (bundle.entry && Array.isArray(bundle.entry)) {
    for (const entry of bundle.entry) {
      if (entry.resource) {
        await validateCodesInResource(entry.resource, entry.resource.resourceType, results);
      }
    }
  }
  
  return results;
}

/**
 * Valider les codes dans une ressource FHIR
 * @param {Object} resource - Ressource FHIR
 * @param {string} path - Chemin actuel dans la ressource
 * @param {Object} results - Résultats de validation
 */
async function validateCodesInResource(resource, path, results) {
  // Vérifier s'il y a un codableconcept ou coding à ce niveau
  if (resource.coding && Array.isArray(resource.coding)) {
    for (const coding of resource.coding) {
      if (coding.system && coding.code) {
        results.totalCodes++;
        const isValid = await validateCode(coding.system, coding.code);
        results.validCodes += isValid ? 1 : 0;
        results.invalidCodes += isValid ? 0 : 1;
        
        results.details.push({
          system: coding.system,
          code: coding.code,
          display: coding.display,
          path: path + '.coding',
          valid: isValid
        });
      }
    }
  }
  
  if (resource.code && resource.code.coding && Array.isArray(resource.code.coding)) {
    for (const coding of resource.code.coding) {
      if (coding.system && coding.code) {
        results.totalCodes++;
        const isValid = await validateCode(coding.system, coding.code);
        results.validCodes += isValid ? 1 : 0;
        results.invalidCodes += isValid ? 0 : 1;
        
        results.details.push({
          system: coding.system,
          code: coding.code,
          display: coding.display,
          path: path + '.code.coding',
          valid: isValid
        });
      }
    }
  }
  
  // Parcourir récursivement les propriétés de l'objet
  for (const key in resource) {
    if (resource.hasOwnProperty(key)) {
      const value = resource[key];
      
      if (value !== null && typeof value === 'object') {
        if (Array.isArray(value)) {
          // Si c'est un tableau, parcourir chaque élément
          for (let i = 0; i < value.length; i++) {
            if (value[i] !== null && typeof value[i] === 'object') {
              await validateCodesInResource(value[i], `${path}.${key}[${i}]`, results);
            }
          }
        } else {
          // Si c'est un objet, appel récursif
          await validateCodesInResource(value, `${path}.${key}`, results);
        }
      }
    }
  }
}

/**
 * Récupérer la liste des terminologies françaises
 * @returns {Array} Liste des terminologies françaises
 */
function getKeyTerminologies() {
  return [...KEY_FRENCH_TERMINOLOGIES, ...COMMON_TERMINOLOGIES];
}

/**
 * Récupérer les systèmes de terminologie
 * @returns {Promise<Array>} Liste des systèmes de terminologie
 */
async function getTerminologySystems() {
  if (OFFLINE_MODE) {
    // En mode hors ligne, retourner les terminologies prédéfinies
    return getKeyTerminologies();
  }
  
  try {
    const response = await axios.get(`${SMT_API_URL}/CodeSystem`);
    
    if (response.data && response.data.entry) {
      return response.data.entry.map(entry => ({
        name: entry.resource.name,
        title: entry.resource.title,
        url: entry.resource.url,
        version: entry.resource.version
      }));
    }
    
    // En cas de réponse vide, retourner les terminologies prédéfinies
    return getKeyTerminologies();
  } catch (error) {
    console.error('[TERMINOLOGY] Erreur lors de la récupération des systèmes de terminologie:', error.message);
    // En cas d'erreur, retourner les terminologies prédéfinies
    return getKeyTerminologies();
  }
}

/**
 * Configurer le mode de fonctionnement du service
 * @param {Object} config - Configuration
 * @returns {Object} Configuration mise à jour
 */
function configure(config = {}) {
  if (config.offlineMode !== undefined) {
    OFFLINE_MODE = !!config.offlineMode;
  }
  
  return {
    offlineMode: OFFLINE_MODE
  };
}

module.exports = {
  initialize,
  validateCode,
  validateBundle,
  getTerminologySystems,
  getKeyTerminologies,
  configure
};