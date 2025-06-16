/**
 * Convertisseur HL7 vers FHIR simplifié
 * Version allégée pour FHIRHub après nettoyage
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Convertit un message HL7 en Bundle FHIR
 * @param {string} hl7Message - Message HL7 brut
 * @param {object} options - Options de conversion
 * @returns {object} Bundle FHIR R4
 */
function convertHL7ToFHIR(hl7Message, options = {}) {
  console.log("[CONVERTER] Conversion HL7 vers FHIR démarrée");
  
  if (!hl7Message || typeof hl7Message !== 'string') {
    throw new Error('Message HL7 invalide');
  }

  // Analyser le message HL7
  const segments = hl7Message.split('\n').filter(line => line.trim());
  const mshSegment = segments.find(seg => seg.startsWith('MSH'));
  const pidSegment = segments.find(seg => seg.startsWith('PID'));
  const pv1Segment = segments.find(seg => seg.startsWith('PV1'));

  if (!mshSegment) {
    throw new Error('Segment MSH manquant dans le message HL7');
  }

  // Créer le Bundle FHIR
  const bundle = {
    resourceType: "Bundle",
    id: uuidv4(),
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: ["http://hl7.org/fhir/StructureDefinition/Bundle"]
    },
    identifier: {
      system: "urn:ietf:rfc:3986",
      value: `urn:uuid:${uuidv4()}`
    },
    type: "transaction",
    timestamp: new Date().toISOString(),
    entry: []
  };

  let resourceCount = 0;

  // Créer MessageHeader à partir de MSH
  if (mshSegment) {
    const messageHeader = createMessageHeader(mshSegment);
    bundle.entry.push({
      fullUrl: `urn:uuid:${messageHeader.id}`,
      resource: messageHeader,
      request: {
        method: "POST",
        url: "MessageHeader"
      }
    });
    resourceCount++;
  }

  // Créer Patient à partir de PID
  if (pidSegment) {
    const patient = createPatient(pidSegment);
    bundle.entry.push({
      fullUrl: `urn:uuid:${patient.id}`,
      resource: patient,
      request: {
        method: "POST",
        url: "Patient"
      }
    });
    resourceCount++;
  }

  // Créer Encounter à partir de PV1
  if (pv1Segment && pidSegment) {
    const encounter = createEncounter(pv1Segment, pidSegment);
    bundle.entry.push({
      fullUrl: `urn:uuid:${encounter.id}`,
      resource: encounter,
      request: {
        method: "POST",
        url: "Encounter"
      }
    });
    resourceCount++;
  }

  console.log(`[CONVERTER] Conversion terminée: ${resourceCount} ressources créées`);
  
  return {
    fhirBundle: bundle,
    resourceCount: resourceCount,
    conversionTime: new Date().toISOString()
  };
}

/**
 * Créer MessageHeader à partir du segment MSH
 */
function createMessageHeader(mshSegment) {
  const fields = mshSegment.split('|');
  
  return {
    resourceType: "MessageHeader",
    id: uuidv4(),
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/MessageHeader"]
    },
    eventCoding: {
      system: "http://terminology.hl7.org/CodeSystem/v2-0003",
      code: fields[8] ? fields[8].split('^')[0] : "ADT",
      display: "Admission/Discharge/Transfer"
    },
    source: {
      name: fields[3] || "FHIRHub",
      endpoint: "http://localhost:5000"
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Créer Patient à partir du segment PID
 */
function createPatient(pidSegment) {
  const fields = pidSegment.split('|');
  const nameField = fields[5] || '';
  const nameParts = nameField.split('^');
  
  return {
    resourceType: "Patient",
    id: uuidv4(),
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/Patient"]
    },
    identifier: [{
      system: "urn:oid:1.2.250.1.213.1.4.8",
      value: fields[3] ? fields[3].split('^')[0] : `PAT-${Date.now()}`
    }],
    name: [{
      use: "official",
      family: nameParts[0] || "Inconnu",
      given: nameParts[1] ? [nameParts[1]] : ["Prénom"]
    }],
    gender: parseGender(fields[8]),
    birthDate: parseDate(fields[7]),
    active: true
  };
}

/**
 * Créer Encounter à partir du segment PV1
 */
function createEncounter(pv1Segment, pidSegment) {
  const pv1Fields = pv1Segment.split('|');
  const pidFields = pidSegment.split('|');
  
  return {
    resourceType: "Encounter",
    id: uuidv4(),
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/Encounter"]
    },
    status: "in-progress",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: pv1Fields[2] === "I" ? "IMP" : "AMB",
      display: pv1Fields[2] === "I" ? "Inpatient" : "Ambulatory"
    },
    subject: {
      reference: `Patient/${uuidv4()}`,
      display: pidFields[5] ? pidFields[5].split('^')[0] : "Patient"
    },
    period: {
      start: new Date().toISOString()
    }
  };
}

/**
 * Parser le genre HL7 vers FHIR
 */
function parseGender(hl7Gender) {
  switch (hl7Gender) {
    case 'M': return 'male';
    case 'F': return 'female';
    case 'O': return 'other';
    default: return 'unknown';
  }
}

/**
 * Parser une date HL7 vers format FHIR
 */
function parseDate(hl7Date) {
  if (!hl7Date || hl7Date.length < 8) return null;
  
  const year = hl7Date.substring(0, 4);
  const month = hl7Date.substring(4, 6);
  const day = hl7Date.substring(6, 8);
  
  return `${year}-${month}-${day}`;
}

module.exports = {
  convertHL7ToFHIR
};