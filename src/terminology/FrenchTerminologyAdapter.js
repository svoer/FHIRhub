/**
 * Adaptateur de terminologie française pour FHIR R4
 * Utilise le gestionnaire de terminologie pour fournir des informations normalisées
 * selon les spécifications ANS (Agence du Numérique en Santé)
 * @module FrenchTerminologyAdapter
 */

const terminologyManager = require('./FrenchTerminologyManager');

/**
 * Enumération des systèmes de terminologie français disponibles
 * @type {Object}
 */
const FRENCH_SYSTEMS = {
  get PAYS() { return terminologyManager.getSystem('PAYS'); },
  get GENDER() { return terminologyManager.getSystem('GENDER'); },
  get ENCOUNTER_TYPE() { return terminologyManager.getSystem('ENCOUNTER_TYPE'); },
  get PROFESSION() { return terminologyManager.getSystem('PROFESSION'); },
  get ROLE_SOCIAL() { return terminologyManager.getSystem('ROLE_SOCIAL'); },
  get SPECIALITE() { return terminologyManager.getSystem('SPECIALITE'); },
  get MODE_PRISE_EN_CHARGE() { return terminologyManager.getSystem('MODE_PRISE_EN_CHARGE'); },
  get TYPE_COUVERTURE() { return terminologyManager.getSystem('TYPE_COUVERTURE'); }
};

/**
 * Enumération des OIDs français disponibles
 * @type {Object}
 */
const FRENCH_OIDS = {
  get INS() { return terminologyManager.getOID('INS'); },
  get INS_C() { return terminologyManager.getOID('INS_C'); },
  get ADELI() { return terminologyManager.getOID('ADELI'); },
  get RPPS() { return terminologyManager.getOID('RPPS'); },
  get STRUCTURE() { return terminologyManager.getOID('STRUCTURE'); },
  get SIRET() { return terminologyManager.getOID('SIRET'); },
  get FINESS() { return terminologyManager.getOID('FINESS'); },
  get IPP() { return terminologyManager.getOID('IPP'); },
  get VN() { return terminologyManager.getOID('VN'); }
};

/**
 * Enumération des extensions françaises disponibles
 * @type {Object}
 */
const FRENCH_EXTENSIONS = {
  get NATIONALITY() { return terminologyManager.getExtension('NATIONALITY'); },
  get PRACTITIONER_PROFESSION() { return terminologyManager.getExtension('PRACTITIONER_PROFESSION'); },
  get HEALTHEVENT_TYPE() { return terminologyManager.getExtension('HEALTHEVENT_TYPE'); },
  get HEALTHEVENT_IDENTIFIER() { return terminologyManager.getExtension('HEALTHEVENT_IDENTIFIER'); },
  get MODE_PRISE_EN_CHARGE() { return terminologyManager.getExtension('MODE_PRISE_EN_CHARGE'); },
  get INS_STATUS() { return terminologyManager.getExtension('INS_STATUS'); }
};

/**
 * Récupère les informations sur un type de mouvement selon la terminologie ANS
 * @param {string} movementType - Type de mouvement (ADMIT, TRANSFER, etc.)
 * @returns {object} Objet contenant code et libellé
 */
function getMovementTypeInfo(movementType) {
  return terminologyManager.getMovementType(movementType);
}

/**
 * Récupère les informations sur une profession selon la terminologie ANS
 * @param {string} professionCode - Code de profession (SM, SF, etc.)
 * @returns {object} Objet contenant code et libellé
 */
function getProfessionInfo(professionCode) {
  return terminologyManager.getProfession(professionCode);
}

/**
 * Récupère les informations sur un identifiant français
 * @param {string} idType - Type d'identifiant (INS, INS-C, etc.)
 * @returns {object} Objet contenant système, code et libellé
 */
function getIdentifierInfo(idType) {
  return terminologyManager.getIdentifier(idType);
}

/**
 * Extrait un nom français à partir d'un champ HL7
 * @param {string} nameField - Champ de nom HL7
 * @returns {object[]} Tableau d'objets de noms FHIR
 */
function extractFrenchNames(nameField) {
  if (!nameField) return [];
  
  console.log("[FRENCH_NAME_EXTRACTOR] Tentative d'extraction des noms français");
  
  const names = [];
  let familyName, givenNames;
  
  // Format standard: SECLET^MARYSE BERTHE ALICE
  if (typeof nameField === 'string' && nameField.includes('^')) {
    const parts = nameField.split('^');
    familyName = parts[0].trim();
    givenNames = parts[1] ? parts[1].trim() : '';
  } 
  // Format virgule: SECLET, MARYSE BERTHE ALICE
  else if (typeof nameField === 'string' && nameField.includes(',')) {
    console.log("[FRENCH_NAME_EXTRACTOR] Nom extrait:", nameField);
    const parts = nameField.split(',');
    familyName = parts[0].trim();
    givenNames = parts[1] ? parts[1].trim() : '';
  }
  // Format simple
  else if (typeof nameField === 'string') {
    familyName = nameField.trim();
    givenNames = '';
  }
  
  // Si nous avons un nom de famille, créer une entrée
  if (familyName) {
    const nameObj = {
      use: 'official',
      family: familyName
    };
    
    // Traiter les prénoms composés
    if (givenNames) {
      if (givenNames.includes(' ')) {
        console.log("[FRENCH_NAME_EXTRACTOR] Prénom composé détecté:", givenNames);
        const prenoms = givenNames.split(' ').filter(p => p.trim());
        console.log("[FRENCH_NAME_EXTRACTOR] Prénoms extraits:", prenoms.join(', '));
        nameObj.given = prenoms;
      } else {
        nameObj.given = [givenNames];
      }
    }
    
    names.push(nameObj);
    
    // Cas spécial : nom de naissance/nom d'usage
    if (nameField.includes(',')) {
      console.log("[FRENCH_NAME_EXTRACTOR] Nom extrait:", familyName + ", " + givenNames);
      names.push({
        use: 'maiden',
        family: familyName
      });
    }
  }
  
  console.log("[FRENCH_NAME_EXTRACTOR] Total de noms extraits:", names.length);
  return names;
}

/**
 * Récupère le bon type de couverture en fonction des métadonnées
 * @param {string} planId - Identifiant du plan d'assurance
 * @returns {object} Objet contenant code et libellé
 */
function determineCoverageType(planId) {
  // Utiliser une stratégie de recherche adaptée
  if (typeof planId === 'string') {
    // Si c'est une couverture complémentaire (mutuelle)
    if (planId.toUpperCase().includes('MUTUEL') || planId.toUpperCase().includes('COMPLEMENT')) {
      return terminologyManager.getCoverageType('AMC');
    }
    // Si c'est une prise en charge à 100%
    else if (planId.toUpperCase().includes('ALD') || planId.toUpperCase().includes('100%')) {
      return terminologyManager.getCoverageType('ALD');
    }
    // Si c'est lié à un accident du travail
    else if (planId.toUpperCase().includes('AT') || planId.toUpperCase().includes('MP')) {
      return terminologyManager.getCoverageType('ATMP');
    }
  }
  
  // Par défaut : Assurance Maladie Obligatoire
  return terminologyManager.getCoverageType('AMO');
}

/**
 * Récupère le mapping de classe d'encounter
 * @param {string} patientClass - Classe de patient (I, O, E, etc.)
 * @returns {object} Mapping pour la classe d'encounter
 */
function getEncounterClassMapping(patientClass) {
  return terminologyManager.getEncounterClass(patientClass);
}

/**
 * Recharge les mappings depuis le fichier spécifié
 * @param {string} filePath - Chemin du fichier de mappings
 * @returns {boolean} - Réussite du rechargement
 */
function reloadMappings(filePath) {
  return terminologyManager.reloadMappings(filePath);
}

/**
 * Obtient la version des mappings utilisés
 * @returns {string} - Version des mappings
 */
function getVersion() {
  return terminologyManager.getVersion();
}

module.exports = {
  FRENCH_SYSTEMS,
  FRENCH_OIDS,
  FRENCH_EXTENSIONS,
  getMovementTypeInfo,
  getProfessionInfo,
  getIdentifierInfo,
  extractFrenchNames,
  determineCoverageType,
  getEncounterClassMapping,
  reloadMappings,
  getVersion
};