/**
 * Service de conversion HL7 vers FHIR
 * Convertit des messages HL7 v2.5 au format FHIR R4
 * Compatible avec les terminologies et systèmes français de santé
 */

const { v4: uuidv4 } = require('uuid');
const { extractFrenchNames } = require('../utils/nameExtractor');
const { processMSH, processPID, processPV1, processNK1, processOBR, processOBX, processSPM } = require('./segmentProcessors');
const conversionLogService = require('./conversionLogService');
const terminologyService = require('./terminologyService');

/**
 * Convertir un message HL7 en FHIR
 * @param {string} hl7Content - Message HL7 à convertir
 * @param {Object} options - Options de conversion
 * @param {Object} apiKeyInfo - Informations sur la clé API
 * @returns {Promise<Object>} Résultat de la conversion
 */
async function convertHL7ToFHIR(hl7Content, options = {}, apiKeyInfo = {}) {
  const startTime = Date.now();
  
  try {
    console.log(`[CONVERT] Début de conversion HL7 vers FHIR. Taille: ${hl7Content.length} caractères`);
    
    // Parser le message HL7
    const segments = parseHL7Message(hl7Content);
    
    if (!segments.length) {
      throw new Error('Le message HL7 est vide ou mal formaté');
    }
    
    // Créer un bundle FHIR
    const bundle = createFHIRBundle();
    
    // Extraire les segments par type
    const segmentsByType = groupSegmentsByType(segments);
    
    // Préparer les options avancées
    const processingOptions = {
      resources: []
    };
    
    // Extraire les noms français si l'option est activée
    if (options.french) {
      processingOptions.names = extractFrenchNames(hl7Content);
    }
    
    // Traiter chaque type de segment
    await processAllSegments(segmentsByType, bundle, processingOptions);
    
    // Valider les terminologies si l'option est activée
    if (options.validate) {
      await validateTerminologies(bundle.entry.map(e => e.resource));
    }
    
    // Calculer le temps de traitement
    const processingTime = Date.now() - startTime;
    
    // Journaliser la conversion
    try {
      await conversionLogService.logConversion({
        apiKeyId: apiKeyInfo.id || null,
        applicationId: apiKeyInfo.application_id || 1,
        sourceType: 'direct',
        hl7Content: hl7Content,
        fhirContent: JSON.stringify(bundle),
        status: 'success',
        processingTime: processingTime,
        errorMessage: null
      });
    } catch (logError) {
      console.error('[CONVERSION-LOG] Erreur lors de la journalisation de la conversion:', logError);
    }
    
    // Retourner le résultat
    return {
      success: true,
      message: 'Conversion réussie',
      processingTime,
      resourceCount: bundle.entry.length,
      data: bundle
    };
  } catch (error) {
    console.error('[CONVERT] Erreur lors de la conversion:', error);
    
    // Journaliser l'erreur
    try {
      await conversionLogService.logConversion({
        apiKeyId: apiKeyInfo.id || null,
        applicationId: apiKeyInfo.application_id || 1,
        sourceType: 'direct',
        hl7Content: hl7Content,
        fhirContent: null,
        status: 'error',
        processingTime: Date.now() - startTime,
        errorMessage: error.message
      });
    } catch (logError) {
      console.error('[CONVERSION-LOG] Erreur lors de la journalisation de l\'erreur:', logError);
    }
    
    return {
      success: false,
      error: 'Erreur de conversion',
      message: error.message
    };
  }
}

/**
 * Parser un message HL7
 * @param {string} message - Message HL7 à parser
 * @returns {Array} Segments du message
 */
function parseHL7Message(message) {
  if (!message) return [];
  
  // Normaliser les fins de ligne
  const normalizedMessage = message.replace(/\r\n|\n\r|\r|\n/g, '\r');
  
  // Découper le message en segments
  const segments = normalizedMessage.split('\r').filter(s => s.trim().length > 0);
  
  // Parser chaque segment
  return segments.map(parseSegment);
}

/**
 * Parser un segment HL7
 * @param {string} segment - Segment HL7 à parser
 * @returns {Object} Segment parsé
 */
function parseSegment(segment) {
  if (!segment) return null;
  
  // Extraire le type de segment (3 premiers caractères)
  const segmentType = segment.substring(0, 3);
  
  // Découper les champs
  const fields = segment.split('|');
  
  return {
    type: segmentType,
    fields: fields
  };
}

/**
 * Regrouper les segments par type
 * @param {Array} segments - Segments à regrouper
 * @returns {Object} Segments regroupés par type
 */
function groupSegmentsByType(segments) {
  const result = {};
  
  segments.forEach(segment => {
    if (!segment) return;
    
    if (!result[segment.type]) {
      result[segment.type] = [];
    }
    
    result[segment.type].push(segment.fields);
  });
  
  return result;
}

/**
 * Créer un bundle FHIR
 * @returns {Object} Bundle FHIR
 */
function createFHIRBundle() {
  return {
    resourceType: 'Bundle',
    id: `bundle-${uuidv4()}`,
    type: 'transaction',
    entry: []
  };
}

/**
 * Ajouter une ressource au bundle
 * @param {Object} bundle - Bundle FHIR
 * @param {Object} resource - Ressource FHIR
 */
function addResourceToBundle(bundle, resource) {
  if (!resource) return;
  
  bundle.entry.push({
    fullUrl: `urn:uuid:${resource.id}`,
    resource: resource,
    request: {
      method: 'POST',
      url: resource.resourceType
    }
  });
}

/**
 * Traiter tous les segments du message
 * @param {Object} segmentsByType - Segments regroupés par type
 * @param {Object} bundle - Bundle FHIR
 * @param {Object} options - Options de traitement
 */
async function processAllSegments(segmentsByType, bundle, options) {
  // Traiter d'abord l'en-tête MSH
  if (segmentsByType.MSH) {
    const mshResource = processMSH(segmentsByType.MSH[0]);
    addResourceToBundle(bundle, mshResource);
    options.resources.push(mshResource);
  }
  
  // Traiter les segments PID (Patient)
  if (segmentsByType.PID) {
    for (const pidFields of segmentsByType.PID) {
      const pidResource = processPID(pidFields, options);
      addResourceToBundle(bundle, pidResource);
      options.resources.push(pidResource);
    }
  }
  
  // Traiter les segments PV1 (Visite patient)
  if (segmentsByType.PV1) {
    for (const pv1Fields of segmentsByType.PV1) {
      const pv1Resource = processPV1(pv1Fields, options);
      addResourceToBundle(bundle, pv1Resource);
      options.resources.push(pv1Resource);
    }
  }
  
  // Traiter les segments NK1 (Proches)
  if (segmentsByType.NK1) {
    for (const nk1Fields of segmentsByType.NK1) {
      const nk1Resource = processNK1(nk1Fields, options);
      addResourceToBundle(bundle, nk1Resource);
      options.resources.push(nk1Resource);
    }
  }
  
  // Traiter les segments OBR (Demande d'observation)
  if (segmentsByType.OBR) {
    for (const obrFields of segmentsByType.OBR) {
      const obrResource = processOBR(obrFields, options);
      addResourceToBundle(bundle, obrResource);
      options.resources.push(obrResource);
    }
  }
  
  // Traiter les segments OBX (Observation)
  if (segmentsByType.OBX) {
    for (const obxFields of segmentsByType.OBX) {
      const obxResource = processOBX(obxFields, options);
      addResourceToBundle(bundle, obxResource);
      options.resources.push(obxResource);
    }
  }
  
  // Traiter les segments SPM (Échantillon)
  if (segmentsByType.SPM) {
    for (const spmFields of segmentsByType.SPM) {
      const spmResource = processSPM(spmFields, options);
      addResourceToBundle(bundle, spmResource);
      options.resources.push(spmResource);
    }
  }
}

/**
 * Valider les terminologies utilisées dans les ressources
 * @param {Array} resources - Ressources FHIR à valider
 */
async function validateTerminologies(resources) {
  console.log('[CONVERT] Validation FHIR non implémentée');
  // TODO: Implémenter la validation des terminologies
  // Cette fonction pourrait appeler le service de terminologie pour valider
  // les codes utilisés dans les ressources FHIR
}

/**
 * Convertir des ressources FHIR en message HL7
 * @param {Object} fhirResources - Ressources FHIR à convertir
 * @param {Object} options - Options de conversion
 * @returns {Promise<Object>} Résultat de la conversion
 */
async function convertFHIRToHL7(fhirResources, options = {}) {
  const startTime = Date.now();
  
  try {
    console.log(`[CONVERT] Début de conversion FHIR vers HL7`);
    
    // Pour le moment, implémentation simple qui retourne un message d'information
    // TODO: Implémenter la conversion réelle de FHIR vers HL7
    
    // Simuler un temps de traitement réaliste
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Retourner un résultat factice pour les tests
    return {
      success: true,
      message: 'Conversion FHIR vers HL7 simulée (non implémentée)',
      hl7Message: 'MSH|^~\\&|FHIRHUB|CONVERSION_ENGINE|RECEIVING_APP|RECEIVING_FACILITY|' + 
                 new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14) + 
                 '||ADT^A01|' + Math.floor(Math.random() * 1000000) + '|P|2.5\r' +
                 'PID|1||' + Math.floor(Math.random() * 1000000) + '^^^GENERATED^MR||CONVERTED^PATIENT^^^||' + 
                 '19700101|U|||123 CONVERSION ST^^ANYTOWN^STATE^12345^USA',
      processingTime: Date.now() - startTime,
      messageType: 'ADT'
    };
  } catch (error) {
    console.error('[CONVERT] Erreur lors de la conversion FHIR vers HL7:', error);
    throw new Error(`Erreur de conversion FHIR vers HL7: ${error.message}`);
  }
}

module.exports = {
  convertHL7ToFHIR,
  convertFHIRToHL7
};