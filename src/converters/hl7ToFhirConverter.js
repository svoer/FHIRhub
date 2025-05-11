/**
 * Convertisseur HL7 v2.5 vers FHIR R4
 * 
 * Ce module implémente la logique de conversion des messages HL7 v2.5 vers FHIR R4
 * Il est optimisé pour les systèmes de santé français et prend en charge les spécificités locales.
 */

const { v4: uuidv4 } = require('uuid');
const hl7 = require('hl7');
const frenchNameExtractor = require('../utils/frenchNameExtractor');
const apiResultEnricher = require('../utils/apiResultEnricher');
const segmentProcessors = require('../services/segmentProcessors');

/**
 * Convertir un message HL7 v2.5 en ressources FHIR R4
 * @param {string} hl7Content - Contenu du message HL7 à convertir
 * @param {Object} options - Options de conversion
 * @returns {Object} Résultat de la conversion avec les données FHIR
 */
async function convert(hl7Content, options = {}) {
  try {
    // Vérifier que le contenu est présent
    if (!hl7Content || typeof hl7Content !== 'string' || hl7Content.trim().length === 0) {
      throw new Error('Contenu HL7 manquant ou invalide');
    }
    
    // Nettoyer le contenu HL7 pour s'assurer qu'il a un format valide
    const cleanContent = prepareHl7Content(hl7Content);
    
    // Parser le message HL7
    const hl7Message = parseHl7Message(cleanContent);
    
    if (!hl7Message) {
      throw new Error('Impossible de parser le message HL7');
    }
    
    // Extraire les informations de base du message
    const messageInfo = extractMessageInfo(hl7Message);
    
    // Créer le bundle FHIR
    const fhirBundle = createFhirBundle(hl7Message, messageInfo, options);
    
    // Enrichir le résultat avec des données complémentaires si nécessaire
    const result = {
      success: true,
      message: 'Conversion réussie',
      fhir: fhirBundle,
      messageInfo
    };
    
    return result;
  } catch (error) {
    console.error('Erreur lors de la conversion HL7 vers FHIR:', error);
    return {
      success: false,
      message: `Erreur lors de la conversion: ${error.message}`,
      error: error.stack,
      fhir: null
    };
  }
}

/**
 * Préparer le contenu HL7 pour le parsing
 * @param {string} content - Contenu brut du message HL7
 * @returns {string} Contenu HL7 nettoyé
 */
function prepareHl7Content(content) {
  // Normaliser les fins de ligne
  let cleanContent = content.replace(/\r\n|\n\r|\r|\n/g, '\r');
  
  // S'assurer que le message commence par MSH
  if (!cleanContent.startsWith('MSH')) {
    const mshIndex = cleanContent.indexOf('MSH');
    if (mshIndex > 0) {
      cleanContent = cleanContent.substring(mshIndex);
    }
  }
  
  return cleanContent;
}

/**
 * Parser un message HL7
 * @param {string} content - Contenu du message HL7 préparé
 * @returns {Object} Message HL7 parsé
 */
function parseHl7Message(content) {
  try {
    // Division en segments
    const segments = content.split('\r').filter(Boolean);
    
    // Parser chaque segment
    const parsedSegments = segments.map(segment => {
      const segmentType = segment.substring(0, 3);
      const fields = segment.split('|');
      return { type: segmentType, fields };
    });
    
    // Construire un objet représentant le message complet
    const message = {
      segments: parsedSegments,
      raw: content,
      getSegmentsByType: (type) => parsedSegments.filter(seg => seg.type === type)
    };
    
    return message;
  } catch (error) {
    console.error('Erreur lors du parsing du message HL7:', error);
    return null;
  }
}

/**
 * Extraire les informations de base du message HL7
 * @param {Object} message - Message HL7 parsé
 * @returns {Object} Informations de base du message
 */
function extractMessageInfo(message) {
  const mshSegment = message.getSegmentsByType('MSH')[0];
  
  if (!mshSegment || !mshSegment.fields || mshSegment.fields.length < 10) {
    return {
      messageType: 'Unknown',
      messageControlId: uuidv4().substring(0, 8),
      sendingApplication: 'Unknown',
      receivingApplication: 'FHIRHub',
      timestamp: new Date().toISOString()
    };
  }
  
  // Extraction des champs standard selon la spécification HL7 v2.5
  const messageType = mshSegment.fields[9] || 'Unknown';
  const messageControlId = mshSegment.fields[10] || uuidv4().substring(0, 8);
  const sendingApplication = mshSegment.fields[3] || 'Unknown';
  const receivingApplication = mshSegment.fields[5] || 'FHIRHub';
  const timestampRaw = mshSegment.fields[7] || '';
  
  // Formater le timestamp en ISO
  let timestamp = new Date().toISOString();
  if (timestampRaw) {
    try {
      // Format HL7: YYYYMMDDHHMMSS
      const year = timestampRaw.substring(0, 4);
      const month = timestampRaw.substring(4, 6);
      const day = timestampRaw.substring(6, 8);
      const hour = timestampRaw.substring(8, 10) || '00';
      const minute = timestampRaw.substring(10, 12) || '00';
      const second = timestampRaw.substring(12, 14) || '00';
      
      timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    } catch (e) {
      console.warn('Erreur lors du parsing du timestamp HL7:', e);
    }
  }
  
  return {
    messageType,
    messageControlId,
    sendingApplication,
    receivingApplication,
    timestamp
  };
}

/**
 * Créer un bundle FHIR à partir d'un message HL7
 * @param {Object} message - Message HL7 parsé
 * @param {Object} messageInfo - Informations de base du message
 * @param {Object} options - Options de conversion
 * @returns {Object} Bundle FHIR
 */
function createFhirBundle(message, messageInfo, options) {
  // Créer un identifiant unique pour le bundle
  const bundleId = `bundle-${uuidv4()}`;
  
  // Initialiser le bundle
  const bundle = {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'transaction',
    timestamp: messageInfo.timestamp,
    entry: []
  };
  
  // Traiter les segments PID pour créer des ressources Patient
  const pidSegments = message.getSegmentsByType('PID');
  if (pidSegments.length > 0) {
    pidSegments.forEach((pidSegment, index) => {
      const patientResource = segmentProcessors.processPidSegment(pidSegment, index);
      if (patientResource) {
        bundle.entry.push({
          fullUrl: `urn:uuid:${patientResource.id}`,
          resource: patientResource,
          request: {
            method: 'POST',
            url: 'Patient'
          }
        });
      }
    });
  }
  
  // Extraire les noms français via notre module spécialisé
  const frenchNames = frenchNameExtractor.extractNames(message.raw);
  
  // Appliquer les noms français extraits aux patients
  if (frenchNames.length > 0) {
    bundle.entry.forEach(entry => {
      if (entry.resource && entry.resource.resourceType === 'Patient') {
        // Remplacer les noms par les versions françaises correctement extraites
        entry.resource.name = frenchNames;
      }
    });
  }
  
  // Traiter les autres segments selon les besoins (OBX, OBR, PV1, etc.)
  // Cette partie serait implémentée en fonction des besoins spécifiques
  
  return bundle;
}

module.exports = {
  convert
};