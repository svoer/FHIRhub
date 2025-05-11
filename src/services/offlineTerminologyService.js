/**
 * Service de terminologies françaises en mode hors ligne
 * Fournit les fonctionnalités équivalentes au Serveur Multi-Terminologies (SMT)
 * mais sans nécessiter de connexion internet ou d'authentification
 * 
 * Ce service utilise des fichiers JSON préchargés avec les informations essentielles
 * des terminologies standardisées françaises nécessaires à l'interopérabilité
 * des systèmes de santé en France.
 * 
 * Terminologies principales supportées :
 * - TRE-R316-AutreCategorieEtablissement (OID: 1.2.250.1.213.1.6.1.239)
 * - TRE-R51-DESCGroupe2Diplome (OID: 1.2.250.1.213.1.6.1.49)
 * - TRE-G02-TypeProduit (OID: 1.2.250.1.71.1.2.2)
 * - TRE-R217-ProtectionJuridique (OID: 1.2.250.1.213.1.1.4.327)
 * - TRE-R302-ContexteCodeComplementaire (OID: 1.2.250.1.213.3.3.70)
 * - TRE-R239-PublicPrisEnCharge (OID: 1.2.250.1.213.3.3.29)
 * - TRE-A01-CadreExercice (OID: 1.2.250.1.213.1.1.4.9)
 * - TRE-R303-HL7v3AdministrativeGender (OID: 1.2.250.1.213.1.1.5.1)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  terminologySystemsFile: path.join(__dirname, 'french_terminology', 'ans_terminology_systems.json'),
  commonCodesFile: path.join(__dirname, 'french_terminology', 'ans_common_codes.json'),
  oidsFile: path.join(__dirname, 'french_terminology', 'ans_oids.json')
};

// Données en cache
let terminologySystems = null;
let commonCodes = null;
let oidData = null;

/**
 * Initialiser le service de terminologie
 * @returns {boolean} True si l'initialisation a réussi
 */
function initialize() {
  console.log('[TERMINOLOGY] Initialisation du service de terminologie française (mode hors ligne)');
  
  try {
    // Charger les systèmes de terminologie
    if (fs.existsSync(CONFIG.terminologySystemsFile)) {
      const data = fs.readFileSync(CONFIG.terminologySystemsFile, 'utf8');
      terminologySystems = JSON.parse(data);
      console.log(`[TERMINOLOGY] ${Object.keys(terminologySystems).length} systèmes de terminologie chargés`);
    } else {
      console.warn(`[TERMINOLOGY] Fichier des systèmes de terminologie non trouvé: ${CONFIG.terminologySystemsFile}`);
    }
    
    // Charger les codes communs
    if (fs.existsSync(CONFIG.commonCodesFile)) {
      const data = fs.readFileSync(CONFIG.commonCodesFile, 'utf8');
      commonCodes = JSON.parse(data);
      console.log(`[TERMINOLOGY] ${Object.keys(commonCodes).length} ensembles de codes communs chargés`);
    } else {
      console.warn(`[TERMINOLOGY] Fichier des codes communs non trouvé: ${CONFIG.commonCodesFile}`);
    }
    
    // Charger les données d'OID
    if (fs.existsSync(CONFIG.oidsFile)) {
      const data = fs.readFileSync(CONFIG.oidsFile, 'utf8');
      oidData = JSON.parse(data);
      console.log(`[TERMINOLOGY] Données d'OID chargées`);
    } else {
      console.warn(`[TERMINOLOGY] Fichier des OID non trouvé: ${CONFIG.oidsFile}`);
    }
    
    return terminologySystems !== null || commonCodes !== null || oidData !== null;
  } catch (error) {
    console.error(`[TERMINOLOGY] Erreur lors de l'initialisation: ${error.message}`);
    return false;
  }
}

/**
 * Obtenir un système de terminologie par son ID
 * @param {string} id - Identifiant du système (ex: TRE-R316-AutreCategorieEtablissement)
 * @returns {Object|null} Système de terminologie ou null si non trouvé
 */
function getCodeSystem(id) {
  if (!terminologySystems) {
    return null;
  }
  
  return terminologySystems[id] || null;
}

/**
 * Obtenir un système de terminologie par son OID
 * @param {string} oid - OID du système (ex: 1.2.250.1.213.1.6.1.239)
 * @returns {Object|null} Système de terminologie ou null si non trouvé
 */
function getCodeSystemByOid(oid) {
  if (!oidData || !oidData.terminology_systems) {
    return null;
  }
  
  for (const [id, system] of Object.entries(oidData.terminology_systems)) {
    if (system.oid === oid || system.uri === `urn:oid:${oid}`) {
      return {
        id: id,
        ...system
      };
    }
  }
  
  return null;
}

/**
 * Obtenir un système d'identifiant par son type
 * @param {string} type - Type d'identifiant (ex: INS-NIR, RPPS)
 * @returns {Object|null} Système d'identifiant ou null si non trouvé
 */
function getIdentifierSystem(type) {
  if (!oidData || !oidData.identifier_systems) {
    return null;
  }
  
  // Recherche exacte
  if (oidData.identifier_systems[type]) {
    return oidData.identifier_systems[type];
  }
  
  // Recherche partielle (insensible à la casse)
  const lowerType = type.toLowerCase();
  for (const [key, system] of Object.entries(oidData.identifier_systems)) {
    if (key.toLowerCase().includes(lowerType)) {
      return system;
    }
  }
  
  return null;
}

/**
 * Valider un code dans un système de terminologie
 * @param {string} system - URI ou OID du système
 * @param {string} code - Code à valider
 * @returns {boolean} True si le code est valide
 */
function validateCode(system, code) {
  if (!system || !code) {
    return true; // Considérer comme valide par défaut
  }
  
  // Extraire l'identifiant du système à partir de l'URI
  let systemId = null;
  
  // Si c'est une URI FHIR
  if (system.includes('esante.gouv.fr') && system.includes('FHIR')) {
    systemId = system.split('/').pop();
  }
  // Si c'est un OID
  else if (system.startsWith('urn:oid:')) {
    const oid = system.substring(8);
    const systemInfo = getCodeSystemByOid(oid);
    if (systemInfo) {
      systemId = systemInfo.id;
    }
  }
  
  // Si nous n'avons pas pu extraire l'identifiant du système ou si nous n'avons pas
  // les codes communs pour ce système, considérer comme valide
  if (!systemId || !commonCodes || !commonCodes[systemId]) {
    return true;
  }
  
  // Vérifier si le code existe dans le système
  return !!commonCodes[systemId][code];
}

/**
 * Obtenir les informations sur un code dans un système
 * @param {string} system - URI ou OID du système
 * @param {string} code - Code à rechercher
 * @returns {Object|null} Informations sur le code ou null si non trouvé
 */
function getCodeInfo(system, code) {
  if (!system || !code) {
    return null;
  }
  
  // Extraire l'identifiant du système
  let systemId = null;
  
  // Si c'est une URI FHIR
  if (system.includes('esante.gouv.fr') && system.includes('FHIR')) {
    systemId = system.split('/').pop();
  }
  // Si c'est un OID
  else if (system.startsWith('urn:oid:')) {
    const oid = system.substring(8);
    const systemInfo = getCodeSystemByOid(oid);
    if (systemInfo) {
      systemId = systemInfo.id;
    }
  }
  
  // Si nous n'avons pas pu extraire l'identifiant du système ou si nous n'avons pas
  // les codes communs pour ce système, retourner null
  if (!systemId || !commonCodes || !commonCodes[systemId]) {
    return null;
  }
  
  // Récupérer les informations sur le code
  const codeInfo = commonCodes[systemId][code];
  if (!codeInfo) {
    return null;
  }
  
  return {
    system: system,
    code: code,
    display: codeInfo.display || code,
    definition: codeInfo.definition || codeInfo.display || code
  };
}

/**
 * Obtenir la liste des terminologies importantes
 * @returns {Array} Liste des terminologies importantes
 */
function getKeyTerminologies() {
  if (!terminologySystems) {
    return [];
  }
  
  return Object.keys(terminologySystems).map(id => ({
    id: id,
    ...terminologySystems[id]
  }));
}

/**
 * Obtenir les informations sur une extension FHIR française
 * @param {string} uri - URI de l'extension
 * @returns {Object|null} Informations sur l'extension ou null si non trouvée
 */
function getExtensionInfo(uri) {
  if (!oidData || !oidData.extension_systems) {
    return null;
  }
  
  for (const [id, extension] of Object.entries(oidData.extension_systems)) {
    if (extension.uri === uri) {
      return {
        id: id,
        ...extension
      };
    }
  }
  
  return null;
}

// Initialiser automatiquement le service
initialize();

// Exporter les fonctions publiques
module.exports = {
  initialize,
  getCodeSystem,
  getCodeSystemByOid,
  getIdentifierSystem,
  validateCode,
  getCodeInfo,
  getKeyTerminologies,
  getExtensionInfo
};