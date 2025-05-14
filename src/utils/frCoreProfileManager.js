/**
 * Gestionnaire des profils FR Core pour la compatibilité HL7 France
 * Module permettant d'ajouter les URL canoniques et extensions des profils FR Core
 * aux ressources FHIR générées lors de la conversion des messages HL7 français
 * 
 * @module frCoreProfileManager
 * @version 1.0.0
 * @updated 2025-05-14
 */

const fs = require('fs');
const path = require('path');

// Chemin vers le fichier de configuration des profils FR Core
const frCoreProfilesPath = path.join(__dirname, '../../data/fr_core_profiles.json');

// Chargement des données de profils FR Core
let frCoreProfiles = null;

try {
  const frCoreProfilesData = fs.readFileSync(frCoreProfilesPath, 'utf8');
  frCoreProfiles = JSON.parse(frCoreProfilesData);
  console.log('[FR-CORE] Profils FR Core chargés avec succès');
} catch (error) {
  console.error('[FR-CORE] Erreur lors du chargement des profils FR Core:', error.message);
  // Création d'un objet par défaut en cas d'erreur
  frCoreProfiles = {
    version: "1.0.0",
    profiles: {},
    extensions: {},
    systemUrls: {}
  };
}

/**
 * Ajoute l'URL de profil FR Core à une ressource FHIR si disponible
 * @param {Object} resource - Ressource FHIR à enrichir
 * @returns {Object} Ressource FHIR enrichie avec le profil FR Core
 */
function addFrCoreProfile(resource) {
  if (!resource || !resource.resourceType) {
    return resource;
  }

  const resourceType = resource.resourceType;
  const profileUrl = frCoreProfiles?.profiles?.[resourceType];

  if (profileUrl) {
    // Initialiser ou ajouter à la liste des meta.profile
    if (!resource.meta) {
      resource.meta = {};
    }
    
    if (!resource.meta.profile) {
      resource.meta.profile = [profileUrl];
    } else if (Array.isArray(resource.meta.profile)) {
      // Vérifier si le profile n'existe pas déjà
      if (!resource.meta.profile.includes(profileUrl)) {
        resource.meta.profile.push(profileUrl);
      }
    }
    
    console.log(`[FR-CORE] Profil FR Core ajouté à la ressource ${resourceType}: ${profileUrl}`);
  }

  return resource;
}

/**
 * Ajoute les extensions spécifiques FR Core en fonction du type de ressource
 * @param {Object} resource - Ressource FHIR à enrichir
 * @param {Object} data - Données spécifiques pour les extensions (optionnel)
 * @returns {Object} Ressource FHIR enrichie avec les extensions FR Core appropriées
 */
function addFrCoreExtensions(resource, data = {}) {
  if (!resource || !resource.resourceType) {
    return resource;
  }

  // Initialisation du tableau d'extensions si nécessaire
  if (!resource.extension) {
    resource.extension = [];
  }

  // Ajout des extensions spécifiques en fonction du type de ressource
  switch (resource.resourceType) {
    case 'Patient':
      // Gestion des INS pour les patients
      if (data.insNumber && frCoreProfiles?.extensions?.PatientINS) {
        const insExtension = {
          url: frCoreProfiles.extensions.PatientINS,
          extension: [
            {
              url: "ins",
              valueCoding: {
                system: frCoreProfiles.systemUrls["INS-NIR"],
                code: data.insNumber
              }
            }
          ]
        };
        resource.extension.push(insExtension);
        console.log('[FR-CORE] Extension INS ajoutée au Patient');
      }
      break;
      
    case 'Organization':
      // Gestion des identifiants FINESS pour les organisations
      if (data.finessNumber && frCoreProfiles?.extensions?.OrganizationIdentifier) {
        const finessExtension = {
          url: frCoreProfiles.extensions.OrganizationIdentifier,
          extension: [
            {
              url: "identifiant",
              valueIdentifier: {
                system: frCoreProfiles.systemUrls.FINESS,
                value: data.finessNumber
              }
            }
          ]
        };
        resource.extension.push(finessExtension);
        console.log('[FR-CORE] Extension FINESS ajoutée à l\'Organization');
      }
      break;
      
    case 'Practitioner':
      // Extensions pour les praticiens (RPPS, ADELI)
      if (data.rppsNumber && frCoreProfiles?.systemUrls?.RPPS) {
        // Vérifier si l'identifiant existe déjà dans la ressource
        const hasRpps = resource.identifier && resource.identifier.some(id => 
          id.system === frCoreProfiles.systemUrls.RPPS);
        
        if (!hasRpps) {
          if (!resource.identifier) {
            resource.identifier = [];
          }
          
          resource.identifier.push({
            system: frCoreProfiles.systemUrls.RPPS,
            value: data.rppsNumber
          });
          
          console.log('[FR-CORE] Identifiant RPPS ajouté au Practitioner');
        }
      }
      break;
  }

  return resource;
}

/**
 * Vérifie si un système d'identification français est valide selon FR Core
 * @param {string} system - URL du système d'identification
 * @returns {boolean} Vrai si le système est reconnu par FR Core
 */
function isValidFrenchSystem(system) {
  if (!system) return false;
  
  // Vérifier si le système est présent dans la liste des systemUrls
  return Object.values(frCoreProfiles?.systemUrls || {}).includes(system);
}

/**
 * Retourne l'URL du système correspondant à un code d'identification français
 * @param {string} codeType - Code du type d'identifiant (INS, RPPS, ADELI, FINESS, etc.)
 * @returns {string|null} URL du système ou null si non trouvé
 */
function getSystemUrl(codeType) {
  if (!codeType || !frCoreProfiles?.systemUrls) return null;
  
  return frCoreProfiles.systemUrls[codeType] || null;
}

/**
 * Retourne les informations sur les profils FR Core chargés
 * @returns {Object} Informations sur les profils (version, nombre de profils, etc.)
 */
function getFrCoreInfo() {
  if (!frCoreProfiles) {
    return { status: 'error', message: 'Profils FR Core non chargés' };
  }
  
  return {
    status: 'success',
    version: frCoreProfiles.version,
    lastUpdated: frCoreProfiles.lastUpdated,
    profileCount: Object.keys(frCoreProfiles.profiles || {}).length,
    extensionCount: Object.keys(frCoreProfiles.extensions || {}).length,
    systemUrlCount: Object.keys(frCoreProfiles.systemUrls || {}).length
  };
}

module.exports = {
  addFrCoreProfile,
  addFrCoreExtensions,
  isValidFrenchSystem,
  getSystemUrl,
  getFrCoreInfo
};