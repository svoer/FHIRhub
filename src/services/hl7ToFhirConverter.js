/**
 * Module principal de conversion HL7 vers FHIR
 * Implémente la logique complète de conversion des messages HL7 v2.5 vers FHIR R4
 * 
 * @module hl7ToFhirConverter
 * @author FHIRHub Team
 */

const { v4: uuidv4 } = require('uuid');
const { 
  processPIDSegment,
  processNK1Segment,
  processPV1Segment,
  processZSegment,
  processInsuranceSegment,
  ConversionContext 
} = require('./segmentProcessors');
const { cleanBundle } = require('../utils/fhirCleaner');

/**
 * Extraire les noms du patient à partir d'un message HL7
 * Cette fonction gère les prénoms composés français
 * @param {string} hl7Message - Message HL7 complet
 * @returns {Array} Tableau d'objets nom au format FHIR
 */
function extractPatientNames(hl7Message) {
  console.log("[HL7_TO_FHIR] Extraction des noms du patient");
  
  // Rechercher le segment PID dans le message HL7
  const pidLines = hl7Message.split(/\r|\n|\r\n/).filter(line => line.startsWith('PID|'));
  
  if (pidLines.length === 0) {
    console.warn("[HL7_TO_FHIR] Segment PID non trouvé dans le message");
    return [];
  }
  
  const pidSegment = pidLines[0];
  const pidFields = pidSegment.split('|');
  
  // Le champ PID-5 contient le nom légal du patient
  if (!pidFields[5]) {
    console.warn("[HL7_TO_FHIR] Champ PID-5 non trouvé dans le segment PID");
    return [];
  }
  
  const nameField = pidFields[5];
  console.log(`[HL7_TO_FHIR] Champ PID-5 brut: "${nameField}"`);
  
  // Gérer le cas où plusieurs noms sont séparés par ~
  const nameFields = nameField.split('~');
  
  const names = [];
  
  // Traiter chaque nom séparément
  nameFields.forEach(field => {
    // Décomposer le champ en ses composants
    // Format typique: SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L
    const nameParts = field.split('^');
    
    // Le dernier caractère est souvent un code de type de nom ('L' pour légal)
    const nameType = nameParts[8] || 'L'; // Par défaut, considérer comme nom légal
    
    // Déterminer l'utilisation du nom en FHIR
    let use = 'official';
    if (nameType === 'D') use = 'maiden'; // Nom de jeune fille
    else if (nameType === 'C') use = 'usual'; // Nom d'usage
    
    // Traiter le nom officiel (avec prénoms composés)
    if (nameParts.length >= 3 && nameParts[2] && nameParts[2].trim() !== '') {
      const familyName = nameParts[0];
      // S'il y a des prénoms composés dans la 3ème partie, les utiliser
      const compositeGivenNames = nameParts[2].split(' ').filter(name => name.trim() !== '');
      
      if (familyName && compositeGivenNames.length > 0) {
        const officialName = {
          family: familyName,
          given: compositeGivenNames,
          use: use
        };
        names.push(officialName);
        console.log(`[HL7_TO_FHIR] Nom avec prénoms composés créé (${compositeGivenNames.length} prénom(s)):`, officialName);
      }
    }
    // Traiter le nom simple (juste prénom+nom)
    else if (nameParts.length >= 2 && nameParts[1] && nameParts[1].trim() !== '') {
      const familyName = nameParts[0];
      const givenName = nameParts[1];
      
      if (familyName) {
        const simpleName = {
          family: familyName,
          given: [givenName],
          use: use
        };
        names.push(simpleName);
        console.log('[HL7_TO_FHIR] Nom simple créé:', simpleName);
      }
    }
    // Traiter le cas où il n'y a que le nom de famille
    else if (nameParts[0] && nameParts[0].trim() !== '') {
      const familyName = nameParts[0];
      
      const familyOnlyName = {
        family: familyName,
        use: use
      };
      names.push(familyOnlyName);
      console.log('[HL7_TO_FHIR] Nom de famille uniquement créé:', familyOnlyName);
    }
  });
  
  return names;
}

/**
 * Vérifier si un segment est de type Z (segment personnalisé)
 * @param {string} segmentType - Type de segment
 * @returns {boolean} True si c'est un segment Z
 */
function isZSegment(segmentType) {
  return segmentType && segmentType.startsWith('Z');
}

/**
 * Vérifier si un segment est lié à l'assurance
 * @param {string} segmentType - Type de segment
 * @returns {boolean} True si c'est un segment d'assurance
 */
function isInsuranceSegment(segmentType) {
  return segmentType === 'IN1' || segmentType === 'IN2';
}

/**
 * Convertir un message HL7 en ressources FHIR
 * @param {string} hl7Message - Message HL7 complet
 * @returns {Object} Bundle FHIR contenant les ressources converties
 */
function convertHL7ToFHIR(hl7Message) {
  try {
    console.log("[HL7_TO_FHIR] Début de la conversion HL7 vers FHIR");
    
    if (!hl7Message) {
      console.error("[HL7_TO_FHIR] Message HL7 vide ou non défini");
      return {
        success: false,
        message: "Le message HL7 est vide ou non défini",
        fhirData: null
      };
    }
    
    // Créer un contexte de conversion
    const context = new ConversionContext();
    
    // Parser le message HL7
    let hl7Segments;
    try {
      // Diviser le message en segments en utilisant le retour à la ligne
      hl7Segments = hl7Message.split(/\r|\n|\r\n/).filter(line => line.trim() !== '');
      
      // Parser chaque segment individuellement
      console.log(`[HL7_TO_FHIR] Message HL7 divisé en ${hl7Segments.length} segments`);
    } catch (parseError) {
      console.error("[HL7_TO_FHIR] Erreur lors du parsing du message HL7:", parseError);
      return {
        success: false,
        message: `Erreur lors du parsing du message HL7: ${parseError.message}`,
        fhirData: null
      };
    }
    
    // Structure pour stocker les segments parsés
    const segments = [];
    
    // Parser chaque segment et le traiter
    for (let i = 0; i < hl7Segments.length; i++) {
      const segmentText = hl7Segments[i].trim();
      
      // Ignorer les segments vides
      if (!segmentText) continue;
      
      // Extraire le type de segment (les 3 premiers caractères)
      const segmentType = segmentText.substring(0, 3);
      
      console.log(`[HL7_TO_FHIR] Traitement du segment ${segmentType}`);
      
      // Parser le segment en tableau de champs
      const fields = segmentText.split('|');
      
      // Traiter le segment en fonction de son type
      switch (segmentType) {
        case 'PID':
          processPIDSegment(fields, context);
          break;
        
        case 'NK1':
          processNK1Segment(fields, context);
          break;
        
        case 'PV1':
          processPV1Segment(fields, context);
          break;
        
        default:
          // Traiter les segments Z (segments personnalisés)
          if (isZSegment(segmentType)) {
            processZSegment(segmentType, fields, context);
          }
          // Traiter les segments d'assurance
          else if (isInsuranceSegment(segmentType)) {
            processInsuranceSegment(fields, segmentType, context);
          }
          // Autres segments non traités spécifiquement
          else {
            console.log(`[HL7_TO_FHIR] Segment ${segmentType} non traité spécifiquement`);
          }
          break;
      }
    }
    
    // Obtenir le bundle FHIR
    const fhirBundle = context.getFhirBundle();
    
    // Extraire et traiter les noms français directement
    console.log("[HL7_TO_FHIR] Traitement des noms français");
    
    // Extraction des noms directement depuis le message HL7
    const patientNames = extractPatientNames(hl7Message);
    
    // Appliquer les noms à la ressource Patient
    const patientResource = context.getResourceByType('Patient');
    if (patientResource && patientNames.length > 0) {
      patientResource.name = patientNames;
    }
    
    // Construire le résultat
    const enhancedResult = {
      success: true,
      message: "Conversion réussie",
      fhirData: fhirBundle
    };
    
    // Nettoyage final du bundle
    enhancedResult.fhirData = cleanBundle(enhancedResult.fhirData);
    
    console.log("[HL7_TO_FHIR] Conversion terminée avec succès");
    
    return enhancedResult;
  } catch (error) {
    console.error("[HL7_TO_FHIR] Erreur lors de la conversion:", error);
    return {
      success: false,
      message: `Erreur lors de la conversion: ${error.message}`,
      fhirData: null
    };
  }
}

module.exports = convertHL7ToFHIR;