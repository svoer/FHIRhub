/**
 * Adaptateur pour les terminologies françaises FHIR
 * Compatible avec les spécifications de l'ANS (Agence du Numérique en Santé)
 * 
 * @version 1.1.2
 * @updated 2025-05-14
 * @module french_terminology_adapter
 */

const fs = require('fs');
const path = require('path');

// Chargement du fichier de mappages
let FRENCH_TERMINOLOGY_MAPPINGS = {};
try {
  const mappingsPath = path.join(__dirname, 'data', 'french_terminology_mappings.json');
  if (fs.existsSync(mappingsPath)) {
    const mappingsContent = fs.readFileSync(mappingsPath, 'utf8');
    FRENCH_TERMINOLOGY_MAPPINGS = JSON.parse(mappingsContent);
    console.log('[TERMINOLOGY] Mappings français chargés avec succès (version ' + FRENCH_TERMINOLOGY_MAPPINGS.version + ')');
  } else {
    console.warn('[TERMINOLOGY] Fichier de mappings français non trouvé: ' + mappingsPath);
    console.warn('[TERMINOLOGY] Les terminologies par défaut seront utilisées');
  }
} catch (error) {
  console.error('[TERMINOLOGY] Erreur lors du chargement des mappings français:', error.message);
}

// Mapping des URL de systèmes FHIR français
const FRENCH_SYSTEMS = {
  // Nomenclatures standard
  PAYS: "https://mos.esante.gouv.fr/NOS/TRE_R20-Pays/FHIR/TRE-R20-Pays",
  GENDER: "https://mos.esante.gouv.fr/NOS/TRE_R303-HL7v3AdministrativeGender/FHIR/TRE-R303-HL7v3AdministrativeGender",
  ENCOUNTER_TYPE: "https://mos.esante.gouv.fr/NOS/TRE_R305-TypeRencontre/FHIR/TRE-R305-TypeRencontre",
  PROFESSION: "https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante",
  ROLE_SOCIAL: "https://mos.esante.gouv.fr/NOS/TRE_R94-ProfessionSocial/FHIR/TRE-R94-ProfessionSocial",
  SPECIALITE: "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale",
  MODE_PRISE_EN_CHARGE: "https://mos.esante.gouv.fr/NOS/TRE_R213-ModePriseEnCharge/FHIR/TRE-R213-ModePriseEnCharge",
  TYPE_COUVERTURE: "https://mos.esante.gouv.fr/NOS/TRE_R28-TypeCouverture/FHIR/TRE-R28-TypeCouverture",
  
  // OIDs français
  OID_INS: "urn:oid:1.2.250.1.213.1.4.8", // INS-NIR
  OID_INS_C: "urn:oid:1.2.250.1.213.1.4.2", // INS-C
  OID_ADELI: "urn:oid:1.2.250.1.71.4.2.1", // Numéro ADELI
  OID_RPPS: "urn:oid:1.2.250.1.71.4.2.1", // Numéro RPPS
  OID_STRUCTURE: "urn:oid:1.2.250.1.71.4.2.2", // Identifiant structure
  OID_SIRET: "urn:oid:1.2.250.1.71.4.2.2", // Numéro SIRET
  OID_FINESS: "urn:oid:1.2.250.1.71.4.2.2" // Numéro FINESS
};

// Extension URLs françaises
const FRENCH_EXTENSIONS = {
  NATIONALITY: "https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/practitioner-nationality",
  PRACTITIONER_PROFESSION: "https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/practitionerRole-profession",
  HEALTHEVENT_TYPE: "https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/healthevent-type",
  HEALTHEVENT_IDENTIFIER: "https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/healthevent-identifier",
  INS_STATUS: "https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INS-Status"
};

/**
 * Récupère les informations sur un type de mouvement selon la terminologie ANS
 * @param {string} movementType - Type de mouvement (ADMIT, TRANSFER, etc.)
 * @returns {object} Objet contenant code et libellé
 */
function getMovementTypeInfo(movementType) {
  const typeMap = {
    'ADMIT': { code: 'ADMIT', display: 'Admission' },
    'INSERT': { code: 'INSERT', display: 'Entrée' },
    'DISCHARGE': { code: 'DISCHARGE', display: 'Sortie' },
    'TRANSFER': { code: 'TRANSFER', display: 'Transfert' },
    'VISIT': { code: 'VISIT', display: 'Visite' },
    'APPOINTMENT': { code: 'APPOINTMENT', display: 'Rendez-vous' }
  };
  
  return typeMap[movementType] || { code: movementType, display: movementType };
}

/**
 * Récupère les informations sur une profession selon la terminologie ANS
 * @param {string} professionCode - Code de profession (SM, SF, etc.)
 * @returns {object} Objet contenant code et libellé
 */
function getProfessionInfo(professionCode) {
  const professionMap = {
    'ODRP': { code: 'ODRP', display: 'Médecin' },
    'INFI': { code: 'INFI', display: 'Infirmier' },
    'SM': { code: 'SM', display: 'Sage-Femme' },
    'SF': { code: 'SF', display: 'Sage-Femme' },
    'PHARM': { code: 'PHARM', display: 'Pharmacien' },
    'KINE': { code: 'KINE', display: 'Masseur-Kinésithérapeute' },
    'CHIR': { code: 'CHIR', display: 'Chirurgien-Dentiste' }
  };
  
  return professionMap[professionCode] || { code: professionCode, display: professionCode };
}

/**
 * Récupère les informations sur un identifiant français
 * @param {string} idType - Type d'identifiant (INS, INS-C, etc.)
 * @returns {object} Objet contenant système, code et libellé
 */
function getIdentifierInfo(idType) {
  const idMap = {
    'INS': { 
      system: FRENCH_SYSTEMS.OID_INS,
      typeCode: 'NI',
      display: 'National unique identifier'
    },
    'INS-C': { 
      system: FRENCH_SYSTEMS.OID_INS_C,
      typeCode: 'NI',
      display: 'National unique identifier'
    },
    'ADELI': { 
      system: FRENCH_SYSTEMS.OID_ADELI,
      typeCode: 'ADELI',
      display: 'Numéro ADELI'
    },
    'RPPS': { 
      system: FRENCH_SYSTEMS.OID_RPPS,
      typeCode: 'RPPS',
      display: 'Numéro RPPS'
    },
    'FINESS': { 
      system: FRENCH_SYSTEMS.OID_FINESS,
      typeCode: 'FINESS',
      display: 'Numéro FINESS'
    },
    'SIRET': { 
      system: FRENCH_SYSTEMS.OID_SIRET,
      typeCode: 'SIRET',
      display: 'Numéro SIRET'
    },
    'PI': { 
      system: 'urn:system:unknown',
      typeCode: 'PI',
      display: 'Identifiant patient'
    }
  };
  
  return idMap[idType] || { 
    system: 'urn:system:unknown',
    typeCode: idType,
    display: idType
  };
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

module.exports = {
  FRENCH_SYSTEMS,
  FRENCH_EXTENSIONS,
  getMovementTypeInfo,
  getProfessionInfo,
  getIdentifierInfo,
  extractFrenchNames
};