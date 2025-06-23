/**
 * Gestionnaire modulaire des types de messages HL7
 * Architecture extensible pour ADT, SIU, ORM et autres types de messages
 * 
 * @version 2.0.0
 * @module hl7MessageTypeHandler
 */

const uuid = require('uuid');

/**
 * Types de messages HL7 supportés et leurs handlers
 */
const MESSAGE_TYPES = {
  ADT: {
    name: 'Admission, Discharge, Transfer',
    events: ['A01', 'A02', 'A03', 'A04', 'A05', 'A08', 'A11', 'A13', 'A28', 'A31', 'A40'],
    segments: ['MSH', 'EVN', 'PID', 'PD1', 'ROL', 'NK1', 'PV1', 'PV2', 'ROL', 'DB1', 'OBX', 'AL1', 'DG1', 'DRG', 'PR1', 'GT1', 'IN1', 'IN2', 'IN3', 'ACC', 'UB1', 'UB2'],
    fhirResources: ['Patient', 'Encounter', 'Location', 'EpisodeOfCare', 'Organization']
  },
  SIU: {
    name: 'Scheduling Information Unsolicited',
    events: ['S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S26'],
    segments: ['MSH', 'SCH', 'TQ1', 'NTE', 'PID', 'PD1', 'PV1', 'PV2', 'OBX', 'DG1', 'RGS', 'AIS', 'AIG', 'AIL', 'AIP'],
    fhirResources: ['Appointment', 'Schedule', 'Slot', 'Patient', 'Practitioner', 'Location']
  },
  ORM: {
    name: 'Order Message',
    events: ['O01', 'O02', 'O03'],
    segments: ['MSH', 'NTE', 'PID', 'PD1', 'NTE', 'PV1', 'PV2', 'IN1', 'IN2', 'IN3', 'GT1', 'AL1', 'ORC', 'OBR', 'NTE', 'OBX', 'NTE', 'CTI', 'BLG'],
    fhirResources: ['ServiceRequest', 'DiagnosticOrder', 'ProcedureRequest', 'Patient', 'Practitioner']
  }
};

/**
 * Détecte le type de message HL7 à partir du segment MSH
 * @param {Object} mshSegment - Segment MSH parsé
 * @returns {Object} Type de message et événement détectés
 */
function detectMessageType(mshSegment) {
  if (!mshSegment || !mshSegment.fields || !mshSegment.fields[8]) {
    throw new Error('Segment MSH invalide ou champ message type manquant');
  }

  const messageTypeField = mshSegment.fields[8];
  let messageType, eventType, structure;

  // Format: MessageType^EventType^Structure (ex: ADT^A01^ADT_A01)
  if (typeof messageTypeField === 'string') {
    const parts = messageTypeField.split('^');
    messageType = parts[0];
    eventType = parts[1];
    structure = parts[2];
  } else if (Array.isArray(messageTypeField)) {
    messageType = messageTypeField[0];
    eventType = messageTypeField[1];
    structure = messageTypeField[2];
  } else {
    throw new Error('Format de type de message HL7 non reconnu');
  }

  console.log(`[MESSAGE_TYPE_HANDLER] Type détecté: ${messageType}^${eventType}^${structure}`);

  // Vérifier si le type de message est supporté
  if (!MESSAGE_TYPES[messageType]) {
    console.warn(`[MESSAGE_TYPE_HANDLER] Type de message non supporté: ${messageType}`);
    return {
      messageType,
      eventType,
      structure,
      supported: false,
      config: null
    };
  }

  const config = MESSAGE_TYPES[messageType];
  const supported = config.events.includes(eventType);

  if (!supported) {
    console.warn(`[MESSAGE_TYPE_HANDLER] Événement non supporté pour ${messageType}: ${eventType}`);
  }

  return {
    messageType,
    eventType,
    structure,
    supported,
    config
  };
}

/**
 * Route le message vers le handler approprié selon son type
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} options - Options de conversion
 * @returns {Object} Bundle FHIR généré
 */
function routeMessage(parsedMessage, options = {}) {
  const mshSegment = parsedMessage.segments.find(seg => seg.type === 'MSH');
  if (!mshSegment) {
    throw new Error('Segment MSH manquant dans le message HL7');
  }

  const typeInfo = detectMessageType(mshSegment);
  
  console.log(`[MESSAGE_TYPE_HANDLER] Routage vers handler: ${typeInfo.messageType}`);

  // Créer le contexte de conversion
  const conversionContext = {
    messageType: typeInfo.messageType,
    eventType: typeInfo.eventType,
    structure: typeInfo.structure,
    timestamp: new Date().toISOString(),
    options,
    bundle: createFhirBundle(typeInfo, mshSegment)
  };

  // Router vers le handler approprié
  switch (typeInfo.messageType) {
    case 'ADT':
      return handleADTMessage(parsedMessage, conversionContext);
    case 'SIU':
      return handleSIUMessage(parsedMessage, conversionContext);
    case 'ORM':
      return handleORMMessage(parsedMessage, conversionContext);
    default:
      throw new Error(`Handler non implémenté pour le type de message: ${typeInfo.messageType}`);
  }
}

/**
 * Crée un bundle FHIR de base avec les métadonnées du message et MessageHeader
 * @param {Object} typeInfo - Informations sur le type de message
 * @param {Object} mshSegment - Segment MSH
 * @returns {Object} Bundle FHIR initialisé
 */
function createFhirBundle(typeInfo, mshSegment) {
  const bundleId = uuid.v4();
  const messageHeaderId = uuid.v4();
  
  // Extraire timestamp depuis MSH-7 (Date/Time of Message)
  const mshTimestamp = extractTimestampFromMSH(mshSegment.fields[6]);
  const timestamp = mshTimestamp || new Date().toISOString();

  const bundle = {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      lastUpdated: timestamp,
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-bundle']
    },
    identifier: {
      system: 'urn:ietf:rfc:3986',
      value: `urn:uuid:${bundleId}`
    },
    type: 'message',
    timestamp,
    entry: []
  };

  // Créer MessageHeader obligatoire pour Bundle de type 'message'
  const messageHeader = createMessageHeader(mshSegment, typeInfo, messageHeaderId, timestamp);
  bundle.entry.push({
    fullUrl: `urn:uuid:${messageHeaderId}`,
    resource: messageHeader
  });

  return bundle;
}

/**
 * Crée une ressource MessageHeader conforme FRCore depuis MSH
 * @param {Object} mshSegment - Segment MSH
 * @param {Object} typeInfo - Informations sur le type de message
 * @param {string} messageHeaderId - ID de la ressource
 * @param {string} timestamp - Timestamp du message
 * @returns {Object} Ressource MessageHeader FHIR
 */
function createMessageHeader(mshSegment, typeInfo, messageHeaderId, timestamp) {
  return {
    resourceType: 'MessageHeader',
    id: messageHeaderId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-message-header']
    },
    eventCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v2-0003',
      code: `${typeInfo.messageType}_${typeInfo.eventType}`,
      display: `${typeInfo.messageType}^${typeInfo.eventType}`
    },
    source: {
      name: mshSegment.fields[2] || 'Système émetteur', // MSH-3: Sending Application
      endpoint: `urn:system:${mshSegment.fields[3] || 'unknown'}` // MSH-4: Sending Facility
    },
    destination: [{
      name: mshSegment.fields[4] || 'Système récepteur', // MSH-5: Receiving Application
      endpoint: `urn:system:${mshSegment.fields[5] || 'unknown'}` // MSH-6: Receiving Facility
    }],
    timestamp,
    // Référence vers focus principal (Patient, Appointment, etc.) sera ajoutée par les handlers
    focus: []
  };
}

/**
 * Extrait et formate un timestamp depuis un champ MSH-7
 * @param {string} mshTimestamp - Timestamp HL7 (format YYYYMMDDHHMMSS)
 * @returns {string|null} Timestamp ISO 8601 ou null
 */
function extractTimestampFromMSH(mshTimestamp) {
  if (!mshTimestamp) return null;
  
  const dateStr = mshTimestamp.toString();
  if (dateStr.length >= 14) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(8, 10);
    const minute = dateStr.substring(10, 12);
    const second = dateStr.substring(12, 14);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  } else if (dateStr.length >= 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}T00:00:00Z`;
  }
  
  return null;
}

/**
 * Handler pour les messages ADT (Admission, Discharge, Transfer)
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Bundle FHIR
 */
function handleADTMessage(parsedMessage, context) {
  console.log(`[ADT_HANDLER] Traitement message ADT^${context.eventType}`);
  
  const adtHandler = require('./adtMessageHandler');
  return adtHandler.process(parsedMessage, context);
}

/**
 * Handler pour les messages SIU (Scheduling Information Unsolicited)
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Bundle FHIR
 */
function handleSIUMessage(parsedMessage, context) {
  console.log(`[SIU_HANDLER] Traitement message SIU^${context.eventType}`);
  
  const siuHandler = require('./siuMessageHandler');
  return siuHandler.process(parsedMessage, context);
}

/**
 * Handler pour les messages ORM (Order Message)
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Bundle FHIR
 */
function handleORMMessage(parsedMessage, context) {
  console.log(`[ORM_HANDLER] Traitement message ORM^${context.eventType}`);
  
  const ormHandler = require('./ormMessageHandler');
  return ormHandler.process(parsedMessage, context);
}

/**
 * Retourne les types de messages supportés
 * @returns {Object} Configuration des types de messages
 */
function getSupportedMessageTypes() {
  return MESSAGE_TYPES;
}

/**
 * Valide si un type de message et événement sont supportés
 * @param {string} messageType - Type de message (ADT, SIU, ORM)
 * @param {string} eventType - Type d'événement (A01, S12, O01, etc.)
 * @returns {boolean} True si supporté
 */
function isMessageSupported(messageType, eventType) {
  const config = MESSAGE_TYPES[messageType];
  return config && config.events.includes(eventType);
}

module.exports = {
  detectMessageType,
  routeMessage,
  handleADTMessage,
  handleSIUMessage,
  handleORMMessage,
  getSupportedMessageTypes,
  isMessageSupported,
  MESSAGE_TYPES
};