/**
 * Message Handlers Modulaires pour HL7 v2 → FHIR R4 FR-Core
 * Architecture industrielle avec handlers dédiés par type de flux
 */

const uuid = require('uuid');
const segmentHandlers = require('./segmentHandlers');
const frCoreDefinitions = require('./frcore-definitions.json');

/**
 * Dispatch principal par type de message MSH-9
 * @param {Object} segments - Segments HL7 parsés
 * @returns {Object} - Bundle FHIR conforme FR-Core
 */
function convertHL7ToFHIR(segments) {
  const messageType = extractMessageType(segments.MSH);
  const bundleId = uuid.v4();
  
  console.log(`[HANDLER] Conversion ${messageType} démarrée`);
  
  // Bundle de base conforme FHIR R4
  const bundle = {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle']
    },
    type: 'message',
    timestamp: new Date().toISOString(),
    entry: []
  };
  
  try {
    // MessageHeader obligatoire en première position
    const messageHeader = segmentHandlers.createMessageHeader(segments.MSH, segments.EVN);
    bundle.entry.push(messageHeader);
    
    // Dispatch selon type de message
    switch (messageType) {
      case 'ADT^A01':
      case 'ADT^A02':
      case 'ADT^A03':
      case 'ADT^A04':
      case 'ADT^A08':
        return handleADT(bundle, segments, messageType);
        
      case 'SIU^S12':
      case 'SIU^S13':
      case 'SIU^S14':
      case 'SIU^S15':
        return handleSIU(bundle, segments, messageType);
        
      case 'ORM^O01':
        return handleORM(bundle, segments, messageType);
        
      case 'ORU^R01':
        return handleORU(bundle, segments, messageType);
        
      default:
        console.warn(`[HANDLER] Type de message non supporté: ${messageType}`);
        return handleGeneric(bundle, segments, messageType);
    }
  } catch (error) {
    console.error(`[HANDLER] Erreur conversion ${messageType}:`, error);
    // Ajouter OperationOutcome sans interrompre
    bundle.entry.push(createOperationOutcome(error, messageType));
    return bundle;
  }
}

/**
 * Handler ADT (Admission/Discharge/Transfer)
 */
function handleADT(bundle, segments, messageType) {
  console.log(`[ADT-HANDLER] Traitement message ${messageType}`);
  
  // Patient obligatoire
  if (segments.PID) {
    const patient = segmentHandlers.createPatient(segments.PID, segments.PD1);
    bundle.entry.push(patient);
  }
  
  // Encounter si PV1 présent
  if (segments.PV1) {
    const encounter = segmentHandlers.createEncounter(segments.PV1, segments.EVN);
    bundle.entry.push(encounter);
  }
  
  // Location si PV1-3 présent
  if (segments.PV1 && segments.PV1[3]) {
    const location = segmentHandlers.createLocation(segments.PV1);
    bundle.entry.push(location);
  }
  
  // Practitioners si PV1-7, PV1-8, PV1-9, PV1-17 présents
  if (segments.PV1) {
    const practitioners = segmentHandlers.createPractitioners(segments.PV1);
    bundle.entry.push(...practitioners);
  }
  
  // ROL segments pour PractitionerRole
  if (segments.ROL) {
    const roles = segmentHandlers.createPractitionerRoles(segments.ROL);
    bundle.entry.push(...roles);
  }
  
  // RelatedPerson si NK1 présents
  if (segments.NK1) {
    const relatedPersons = segmentHandlers.createRelatedPersons(segments.NK1);
    bundle.entry.push(...relatedPersons);
  }
  
  // Coverage si IN1 présent
  if (segments.IN1) {
    const coverage = segmentHandlers.createCoverage(segments.IN1, segments.IN2);
    bundle.entry.push(...coverage); // Peut inclure Organization payor
  }
  
  console.log(`[ADT-HANDLER] ${bundle.entry.length} ressources créées`);
  return bundle;
}

/**
 * Handler SIU (Scheduling Information Unsolicited)
 */
function handleSIU(bundle, segments, messageType) {
  console.log(`[SIU-HANDLER] Traitement message ${messageType}`);
  
  // Patient obligatoire
  if (segments.PID) {
    const patient = segmentHandlers.createPatient(segments.PID, segments.PD1);
    bundle.entry.push(patient);
  }
  
  // Appointment principal depuis SCH
  if (segments.SCH) {
    const appointment = segmentHandlers.createAppointment(segments.SCH, segments.NTE);
    bundle.entry.push(appointment);
  }
  
  // Practitioner depuis AIP
  if (segments.AIP) {
    const practitioners = segmentHandlers.createPractitionersFromAIP(segments.AIP);
    bundle.entry.push(...practitioners);
  }
  
  // Location depuis AIL
  if (segments.AIL) {
    const locations = segmentHandlers.createLocationsFromAIL(segments.AIL);
    bundle.entry.push(...locations);
  }
  
  // Resources depuis AIS
  if (segments.AIS) {
    const resources = segmentHandlers.createResourcesFromAIS(segments.AIS);
    bundle.entry.push(...resources);
  }
  
  console.log(`[SIU-HANDLER] ${bundle.entry.length} ressources créées`);
  return bundle;
}

/**
 * Handler ORM (Order Message)
 */
function handleORM(bundle, segments, messageType) {
  console.log(`[ORM-HANDLER] Traitement message ${messageType}`);
  
  // Patient obligatoire
  if (segments.PID) {
    const patient = segmentHandlers.createPatient(segments.PID, segments.PD1);
    bundle.entry.push(patient);
  }
  
  // ServiceRequest depuis ORC/OBR
  if (segments.ORC && segments.OBR) {
    const serviceRequest = segmentHandlers.createServiceRequest(segments.ORC, segments.OBR);
    bundle.entry.push(serviceRequest);
  }
  
  // Practitioner depuis OBR-16
  if (segments.OBR) {
    const practitioners = segmentHandlers.createPractitionersFromOBR(segments.OBR);
    bundle.entry.push(...practitioners);
  }
  
  // DiagnosticReport si nécessaire
  if (segments.OBR && segments.OBX) {
    const diagnosticReport = segmentHandlers.createDiagnosticReport(segments.OBR, segments.OBX);
    bundle.entry.push(diagnosticReport);
  }
  
  console.log(`[ORM-HANDLER] ${bundle.entry.length} ressources créées`);
  return bundle;
}

/**
 * Handler ORU (Observation Result Unsolicited)
 */
function handleORU(bundle, segments, messageType) {
  console.log(`[ORU-HANDLER] Traitement message ${messageType}`);
  
  // Patient obligatoire
  if (segments.PID) {
    const patient = segmentHandlers.createPatient(segments.PID, segments.PD1);
    bundle.entry.push(patient);
  }
  
  // DiagnosticReport depuis OBR
  if (segments.OBR) {
    const diagnosticReport = segmentHandlers.createDiagnosticReport(segments.OBR, segments.OBX);
    bundle.entry.push(diagnosticReport);
  }
  
  // Observations depuis OBX
  if (segments.OBX) {
    const observations = segmentHandlers.createObservations(segments.OBX);
    bundle.entry.push(...observations);
  }
  
  // Practitioner depuis OBR-16
  if (segments.OBR) {
    const practitioners = segmentHandlers.createPractitionersFromOBR(segments.OBR);
    bundle.entry.push(...practitioners);
  }
  
  console.log(`[ORU-HANDLER] ${bundle.entry.length} ressources créées`);
  return bundle;
}

/**
 * Handler générique pour messages non supportés
 */
function handleGeneric(bundle, segments, messageType) {
  console.log(`[GENERIC-HANDLER] Traitement générique ${messageType}`);
  
  // Essayer de créer Patient si PID présent
  if (segments.PID) {
    const patient = segmentHandlers.createPatient(segments.PID, segments.PD1);
    bundle.entry.push(patient);
  }
  
  return bundle;
}

/**
 * Extraction du type de message depuis MSH-9
 */
function extractMessageType(mshSegment) {
  if (!mshSegment || !mshSegment[9]) {
    return 'UNKNOWN';
  }
  
  const messageTypeField = mshSegment[9];
  if (Array.isArray(messageTypeField)) {
    return `${messageTypeField[0]}^${messageTypeField[1]}`;
  }
  
  return messageTypeField.toString();
}

/**
 * Créer OperationOutcome pour erreurs
 */
function createOperationOutcome(error, messageType) {
  return {
    fullUrl: `urn:uuid:${uuid.v4()}`,
    resource: {
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'processing',
        details: {
          text: `Erreur conversion ${messageType}: ${error.message}`
        }
      }]
    },
    request: {
      method: 'POST',
      url: 'OperationOutcome'
    }
  };
}

module.exports = {
  convertHL7ToFHIR,
  handleADT,
  handleSIU,
  handleORM,
  handleORU
};