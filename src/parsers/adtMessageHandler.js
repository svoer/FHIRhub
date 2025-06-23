/**
 * Handler spécialisé pour les messages HL7 ADT (Admission, Discharge, Transfer)
 * Réutilise la logique existante du convertisseur principal
 * 
 * @version 1.0.0
 * @module adtMessageHandler
 */

/**
 * Traite un message ADT en utilisant le convertisseur existant
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Bundle FHIR avec ressources Patient/Encounter/Location
 */
function process(parsedMessage, context) {
  console.log(`[ADT_HANDLER] Délégation vers convertisseur principal pour ADT^${context.eventType}`);
  
  // Déléguer vers le convertisseur existant qui gère déjà les ADT
  const mainConverter = require('../../hl7ToFhirAdvancedConverter');
  
  // Reconstituer le message HL7 original pour le convertisseur existant
  const hl7Message = reconstructHL7Message(parsedMessage);
  
  // Utiliser le convertisseur existant
  const result = mainConverter.convert(hl7Message, context.options);
  
  // Le convertisseur existant retourne déjà un bundle FHIR correct
  return result;
}

/**
 * Reconstitue un message HL7 à partir de la structure parsée
 * @param {Object} parsedMessage - Message HL7 parsé
 * @returns {string} Message HL7 reconstitué
 */
function reconstructHL7Message(parsedMessage) {
  const segments = [];
  
  parsedMessage.segments.forEach(segment => {
    // Reconstituer chaque segment
    let segmentLine = segment.type;
    
    if (segment.fields && segment.fields.length > 0) {
      // Ajouter les champs séparés par |
      segment.fields.forEach((field, index) => {
        if (index === 0) {
          segmentLine += '|'; // Premier séparateur après le type de segment
        }
        
        if (field === null || field === undefined) {
          segmentLine += '|';
        } else if (Array.isArray(field)) {
          segmentLine += field.join('^') + '|';
        } else {
          segmentLine += field + '|';
        }
      });
      
      // Enlever le dernier | superflu
      if (segmentLine.endsWith('|')) {
        segmentLine = segmentLine.slice(0, -1);
      }
    }
    
    segments.push(segmentLine);
  });
  
  return segments.join('\r');
}

module.exports = {
  process
};