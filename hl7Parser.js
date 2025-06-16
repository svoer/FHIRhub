/**
 * Module de parsing HL7 optimisé pour le projet FHIRHub
 * Cette implémentation utilise une approche plus directe pour extraire
 * les données de messages HL7 v2.5, avec un support amélioré pour les
 * messages HL7 français et les segments Z
 *
 * @version 1.1.2
 * @updated 2025-05-14
 * @module hl7Parser
 */

/**
 * Parse un message HL7 et extrait tous les segments et champs
 * Amélioration du support des segments Z et spécificités françaises
 * @param {string} hl7Message - Message HL7 au format texte
 * @returns {Object} Structure contenant tous les segments et leurs champs
 */
function parseHL7Message(hl7Message) {
  if (!hl7Message) {
    throw new Error('Message HL7 vide ou non défini');
  }
  
  // Nettoyage et normalisation du message
  // - Gestion des retours à la ligne multiples (Windows, Unix, Mac)
  // - Suppression des caractères non imprimables
  const cleanedMessage = hl7Message
    .replace(/\r\n|\n\r/g, '\r')  // Normaliser CR+LF ou LF+CR en CR
    .replace(/\n/g, '\r')         // Normaliser LF en CR
    .replace(/\r+/g, '\r')        // Supprimer les CR multiples consécutifs
    .replace(/[^\x20-\x7E\r]/g, ''); // Conserver uniquement ASCII imprimable et CR
  
  const segments = cleanedMessage.split('\r').filter(segment => segment.trim().length > 0);
  
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
  
  // Ajouter une vérification du codage (MSH-18)
  const charsetField = mshComponents[17]; // MSH-18 (index 0-based + 17)
  const characterEncoding = charsetField ? charsetField.split(componentSeparator)[0] : '8859/1';
  console.log(`[HL7-PARSER] Encodage détecté: ${characterEncoding || '(par défaut)'}`);
  
  const segmentData = {};
  
  // Parcourir tous les segments
  segments.forEach(segment => {
    const fields = segment.split(fieldSeparator);
    const segmentName = fields[0];
    
    // Vérifier si c'est un segment Z (spécifique français)
    const isZSegment = segmentName.startsWith('Z');
    if (isZSegment) {
      console.log(`[HL7-PARSER] Segment Z français détecté: ${segmentName}`);
    }
    
    if (!segmentData[segmentName]) {
      segmentData[segmentName] = [];
    }
    
    // Traiter les champs de ce segment
    const segmentFields = fields.map((field, index) => {
      // Pour MSH, traiter le séparateur de champ
      if (segmentName === 'MSH' && index === 1) {
        return fields[1]; // Préserver les délimiteurs
      }
      
      // Vérifier les champs vides pour éviter les erreurs
      if (!field || field.trim() === '') {
        return '';
      }
      
      try {
        // Traiter les répétitions
        if (field.includes(repetitionSeparator)) {
          return field.split(repetitionSeparator).map(rep => {
            try {
              return parseComponent(rep, componentSeparator, subcomponentSeparator);
            } catch (error) {
              console.warn(`[HL7-PARSER] Erreur dans le segment ${segmentName}, champ ${index}: ${error.message}`);
              return rep; // Conserver la valeur brute en cas d'erreur
            }
          });
        }
        
        return parseComponent(field, componentSeparator, subcomponentSeparator);
      } catch (error) {
        console.warn(`[HL7-PARSER] Erreur dans le segment ${segmentName}, champ ${index}: ${error.message}`);
        return field; // Conserver la valeur brute en cas d'erreur
      }
    });
    
    // Ajout de détection spécifique pour les formats français
    if ((segmentName === 'EVN' || segmentName === 'PV1' || segmentName === 'ZBE') && 
        segmentFields.some(field => typeof field === 'string' && /^\d{12,14}$/.test(field))) {
      console.log(`[HL7-PARSER] Format de date français détecté dans ${segmentName}`);
    }
    
    segmentData[segmentName].push(segmentFields);
  });
  
  // Vérification pour les messages français
  if (segmentData['MSH'] && segmentData['MSH'][0][11] && 
      Array.isArray(segmentData['MSH'][0][11]) && 
      segmentData['MSH'][0][11][1] === 'FRA') {
    console.log('[HL7-PARSER] Message HL7 français confirmé (MSH-12)');
    
    // Vérification des segments Z typiques français
    const expectedZSegments = ['ZBE', 'ZFP', 'ZFV', 'ZMO', 'ZFD', 'ZMP', 'ZMD'];
    const foundZSegments = Object.keys(segmentData).filter(seg => seg.startsWith('Z'));
    console.log(`[HL7-PARSER] Segments Z français trouvés: ${foundZSegments.join(', ') || 'aucun'}`);
  }
  
  return {
    delimiters: {
      fieldSeparator,
      componentSeparator,
      repetitionSeparator,
      escapeCharacter,
      subcomponentSeparator
    },
    segments: segmentData,
    isFrencHL7: segmentData['MSH'] && segmentData['MSH'][0][11] && 
                Array.isArray(segmentData['MSH'][0][11]) && 
                segmentData['MSH'][0][11][1] === 'FRA'
  };
}

/**
 * Parse un composant HL7 avec gestion améliorée des composants spécifiques français
 * @param {string} component - Composant à analyser
 * @param {string} componentSeparator - Séparateur de composant (^)
 * @param {string} subcomponentSeparator - Séparateur de sous-composant (&)
 * @returns {Array|string} Composant parsé
 */
function parseComponent(component, componentSeparator, subcomponentSeparator) {
  // Retourner directement si c'est une valeur simple ou vide
  if (!component || typeof component !== 'string') {
    return component;
  }
  
  if (!component.includes(componentSeparator)) {
    // Détection de formats de date français
    if (/^\d{12,14}$/.test(component)) {
      // Format YYYYMMDDHHmmss - ne pas transformer mais signaler lors du traitement
      return component;
    }
    
    // Détection d'OIDs français
    if (/^[12]\.\d+\.\d+(\.\d+)*$/.test(component)) {
      // Traitement spécial pour les OIDs (urn:oid:...)
      return component;
    }
    
    return component.trim(); // Simple valeur, élimine les espaces inutiles
  }
  
  // Amélioration: gestion des composants vides entre séparateurs (e.g., "^^^^^")
  const components = component.split(componentSeparator);
  return components.map((comp, index) => {
    // Retourner une chaîne vide si le composant est vide (pas juste des espaces)
    if (!comp || comp.trim() === '') {
      return '';
    }
    
    // Traiter les sous-composants
    if (comp.includes(subcomponentSeparator)) {
      const subcomponents = comp.split(subcomponentSeparator);
      // Nettoyer les sous-composants vides
      return subcomponents.map(sc => sc ? sc.trim() : '');
    }
    return comp.trim();
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