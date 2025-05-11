/**
 * Module de parsing HL7 optimisé pour le projet FHIRHub
 * Cette implémentation utilise une approche plus directe pour extraire
 * les données de messages HL7 v2.5
 *
 * @version 1.1.1
 * @updated 2025-04-29
 * @module hl7Parser
 */

/**
 * Parse un message HL7 et extrait tous les segments et champs
 * @param {string} hl7Message - Message HL7 au format texte
 * @returns {Object} Structure contenant tous les segments et leurs champs
 */
function parseHL7Message(hl7Message) {
  if (!hl7Message) {
    throw new Error('Message HL7 vide ou non défini');
  }
  
  // Normaliser les délimiteurs de segment (\n ou \r)
  const normalizedMessage = hl7Message.replace(/\n/g, '\r');
  const segments = normalizedMessage.split('\r').filter(Boolean);
  
  if (segments.length === 0) {
    throw new Error('Aucun segment trouvé dans le message HL7');
  }
  
  // Vérifier que le premier segment est MSH
  if (!segments[0].startsWith('MSH')) {
    throw new Error('Le message HL7 doit commencer par un segment MSH');
  }
  
  // Extraire le séparateur de champ (généralement |)
  const fieldSeparator = segments[0].charAt(3);
  
  // Extraire les autres délimiteurs (^~\\&) du segment MSH
  const mshComponents = segments[0].split(fieldSeparator);
  const componentSeparator = mshComponents[1].charAt(0) || '^';
  const repetitionSeparator = mshComponents[1].charAt(1) || '~';
  const escapeCharacter = mshComponents[1].charAt(2) || '\\';
  const subcomponentSeparator = mshComponents[1].charAt(3) || '&';
  
  const segmentData = {};
  
  // Parcourir tous les segments
  segments.forEach(segment => {
    const fields = segment.split(fieldSeparator);
    const segmentName = fields[0];
    
    if (!segmentData[segmentName]) {
      segmentData[segmentName] = [];
    }
    
    // Traiter les champs de ce segment
    const segmentFields = fields.map((field, index) => {
      // Pour MSH, traiter le séparateur de champ
      if (segmentName === 'MSH' && index === 1) {
        return fields[1]; // Préserver les délimiteurs
      }
      
      // Traiter les répétitions
      if (field.includes(repetitionSeparator)) {
        return field.split(repetitionSeparator).map(rep => 
          parseComponent(rep, componentSeparator, subcomponentSeparator));
      }
      
      return parseComponent(field, componentSeparator, subcomponentSeparator);
    });
    
    segmentData[segmentName].push(segmentFields);
  });
  
  return {
    delimiters: {
      fieldSeparator,
      componentSeparator,
      repetitionSeparator,
      escapeCharacter,
      subcomponentSeparator
    },
    segments: segmentData
  };
}

/**
 * Parse un composant HL7
 * @param {string} component - Composant à analyser
 * @param {string} componentSeparator - Séparateur de composant (^)
 * @param {string} subcomponentSeparator - Séparateur de sous-composant (&)
 * @returns {Array|string} Composant parsé
 */
function parseComponent(component, componentSeparator, subcomponentSeparator) {
  if (!component.includes(componentSeparator)) {
    return component; // Simple valeur
  }
  
  return component.split(componentSeparator).map(comp => {
    if (comp.includes(subcomponentSeparator)) {
      return comp.split(subcomponentSeparator);
    }
    return comp;
  });
}

/**
 * Récupère un segment spécifique du message parsé
 * @param {Object} parsedMessage - Message parsé
 * @param {string} segmentName - Nom du segment à récupérer (ex: PID)
 * @param {number} index - Index du segment (si plusieurs occurrences)
 * @returns {Array|null} Segment trouvé ou null
 */
function getSegment(parsedMessage, segmentName, index = 0) {
  if (!parsedMessage || !parsedMessage.segments || !parsedMessage.segments[segmentName]) {
    return null;
  }
  
  if (parsedMessage.segments[segmentName].length <= index) {
    return null;
  }
  
  return parsedMessage.segments[segmentName][index];
}

/**
 * Récupère la valeur d'un champ spécifique
 * @param {Array} segment - Segment parsé
 * @param {number} fieldIndex - Index du champ à récupérer (1-based comme dans HL7)
 * @returns {*} Valeur du champ
 */
function getFieldValue(segment, fieldIndex) {
  if (!segment || segment.length <= fieldIndex) {
    return null;
  }
  
  return segment[fieldIndex];
}

/**
 * Récupère la valeur d'un composant spécifique d'un champ
 * @param {*} field - Champ parsé
 * @param {number} componentIndex - Index du composant (0-based)
 * @returns {*} Valeur du composant
 */
function getComponentValue(field, componentIndex) {
  if (!field || !Array.isArray(field) || field.length <= componentIndex) {
    return field; // Retourne le champ complet si le composant n'existe pas
  }
  
  return field[componentIndex];
}

/**
 * Récupère une valeur simple à partir d'un chemin complet
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {string} segmentName - Nom du segment
 * @param {number} segmentIndex - Index du segment
 * @param {number} fieldIndex - Index du champ (1-based)
 * @param {number} componentIndex - Index du composant (0-based)
 * @param {number} subcomponentIndex - Index du sous-composant (0-based)
 * @returns {string} Valeur extraite ou chaîne vide
 */
function getValue(parsedMessage, segmentName, segmentIndex, fieldIndex, componentIndex = 0, subcomponentIndex = -1) {
  const segment = getSegment(parsedMessage, segmentName, segmentIndex);
  if (!segment) return '';
  
  const field = getFieldValue(segment, fieldIndex);
  if (!field) return '';
  
  const component = getComponentValue(field, componentIndex);
  if (!component) return '';
  
  if (subcomponentIndex >= 0 && Array.isArray(component) && component.length > subcomponentIndex) {
    return component[subcomponentIndex] || '';
  }
  
  return typeof component === 'string' ? component : '';
}

module.exports = {
  parseHL7Message,
  getSegment,
  getFieldValue,
  getComponentValue,
  getValue
};