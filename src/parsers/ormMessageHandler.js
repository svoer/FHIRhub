/**
 * Handler spécialisé pour les messages HL7 ORM (Order Message)
 * Conversion vers ressources FHIR FRCore : ServiceRequest, DiagnosticOrder, ProcedureRequest
 * 
 * @version 1.0.0
 * @module ormMessageHandler
 */

const uuid = require('uuid');

/**
 * Mapping des événements ORM vers actions FHIR
 */
const ORM_EVENT_MAPPING = {
  'O01': { action: 'create', status: 'active', description: 'Order - General Order Message' },
  'O02': { action: 'update', status: 'active', description: 'Order - General Order Response Message' },
  'O03': { action: 'create', status: 'active', description: 'Diet Order' }
};

/**
 * Mapping des priorités HL7 vers FHIR
 */
const PRIORITY_MAPPING = {
  'S': 'urgent',     // Stat
  'A': 'asap',       // ASAP
  'R': 'routine',    // Routine
  'P': 'urgent',     // Preop
  'T': 'urgent'      // Timing critical
};

/**
 * Traite un message ORM et génère les ressources FHIR correspondantes
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Bundle FHIR avec ressources ServiceRequest/DiagnosticOrder
 */
function process(parsedMessage, context) {
  console.log(`[ORM_HANDLER] Début traitement ORM^${context.eventType}`);
  
  const eventMapping = ORM_EVENT_MAPPING[context.eventType];
  if (!eventMapping) {
    throw new Error(`Événement ORM non supporté: ${context.eventType}`);
  }

  // Extraire les segments nécessaires
  const segments = extractORMSegments(parsedMessage);
  
  // Générer les ressources FHIR
  const resources = [];
  
  // Créer la ressource Patient si présente
  if (segments.PID) {
    const patient = createPatientFromPID(segments.PID, context);
    resources.push(patient);
    context.patientReference = `Patient/${patient.id}`;
  }

  // Créer la ressource Practitioner depuis ORC si présent
  if (segments.ORC && segments.ORC.length > 0) {
    segments.ORC.forEach(orc => {
      if (orc.fields[12]) { // ORC-12: Ordering Provider
        const practitioner = createPractitionerFromORC(orc, context);
        resources.push(practitioner);
        context.practitionerReference = `Practitioner/${practitioner.id}`;
      }
    });
  }

  // Créer les ressources ServiceRequest depuis OBR
  if (segments.OBR && segments.OBR.length > 0) {
    segments.OBR.forEach((obr, index) => {
      const relatedORC = segments.ORC[index] || segments.ORC[0]; // Associer ORC correspondant
      const serviceRequest = createServiceRequestFromOBR(obr, relatedORC, eventMapping, context, segments);
      resources.push(serviceRequest);
    });
  }

  // Créer les ressources Observation depuis OBX si présentes
  if (segments.OBX && segments.OBX.length > 0) {
    segments.OBX.forEach(obx => {
      const observation = createObservationFromOBX(obx, context);
      resources.push(observation);
    });
  }

  // Créer la ressource Organization si présente
  if (segments.MSH) {
    const organization = createOrganizationFromMSH(segments.MSH, context);
    resources.push(organization);
    context.organizationReference = `Organization/${organization.id}`;
  }

  // Ajouter toutes les ressources au bundle
  resources.forEach(resource => {
    addResourceToBundle(context.bundle, resource);
  });

  // Ajouter les focus au MessageHeader
  updateMessageHeaderFocus(context.bundle, resources);

  console.log(`[ORM_HANDLER] ${resources.length} ressources FHIR générées pour ORM^${context.eventType}`);
  return context.bundle;
}

/**
 * Extrait les segments pertinents d'un message ORM
 * @param {Object} parsedMessage - Message HL7 parsé
 * @returns {Object} Segments organisés par type
 */
function extractORMSegments(parsedMessage) {
  const segments = {
    MSH: null,
    NTE: [],
    PID: null,
    PD1: null,
    PV1: null,
    PV2: null,
    IN1: [],
    IN2: [],
    IN3: [],
    GT1: [],
    AL1: [],
    ORC: [],
    OBR: [],
    OBX: [],
    CTI: [],
    BLG: []
  };

  parsedMessage.segments.forEach(segment => {
    switch (segment.type) {
      case 'MSH':
      case 'PID':
      case 'PD1':
      case 'PV1':
      case 'PV2':
        segments[segment.type] = segment;
        break;
      case 'NTE':
      case 'IN1':
      case 'IN2':
      case 'IN3':
      case 'GT1':
      case 'AL1':
      case 'ORC':
      case 'OBR':
      case 'OBX':
      case 'CTI':
      case 'BLG':
        segments[segment.type].push(segment);
        break;
    }
  });

  return segments;
}

/**
 * Crée une ressource Patient FHIR FRCore à partir d'un segment PID
 * @param {Object} pidSegment - Segment PID
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Patient FHIR
 */
function createPatientFromPID(pidSegment, context) {
  const patientId = `patient-${uuid.v4()}`;
  
  const patient = {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient']
    },
    identifier: extractPatientIdentifiers(pidSegment),
    name: extractPatientNames(pidSegment),
    gender: extractGender(pidSegment.fields[8]),
    birthDate: extractBirthDate(pidSegment.fields[7]),
    telecom: extractTelecom(pidSegment),
    address: extractAddress(pidSegment)
  };

  console.log(`[ORM_HANDLER] Patient créé: ${patientId}`);
  return patient;
}

/**
 * Crée une ressource Practitioner à partir d'un segment ORC
 * @param {Object} orcSegment - Segment ORC
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Practitioner FHIR
 */
function createPractitionerFromORC(orcSegment, context) {
  const practitionerId = `practitioner-${uuid.v4()}`;
  
  // ORC-12: Ordering Provider
  const orderingProvider = orcSegment.fields[12];
  let practitionerName = { family: 'Praticien', given: ['Inconnu'] };
  
  if (orderingProvider) {
    if (Array.isArray(orderingProvider)) {
      practitionerName = {
        family: orderingProvider[1] || 'Praticien',
        given: [orderingProvider[2] || 'Prénom']
      };
    } else if (typeof orderingProvider === 'string') {
      const parts = orderingProvider.split('^');
      practitionerName = {
        family: parts[1] || 'Praticien',
        given: [parts[2] || 'Prénom']
      };
    }
  }
  
  const practitioner = {
    resourceType: 'Practitioner',
    id: practitionerId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-practitioner']
    },
    identifier: [
      {
        use: 'official',
        system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-practitioner-rpps',
        value: orderingProvider[0] || practitionerId
      }
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: practitionerName.family,
        given: practitionerName.given
      }
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
              code: 'MD',
              display: 'Médecin'
            }
          ]
        }
      }
    ]
  };

  console.log(`[ORM_HANDLER] Practitioner créé: ${practitionerId}`);
  return practitioner;
}

/**
 * Crée une ressource ServiceRequest à partir d'un segment OBR
 * @param {Object} obrSegment - Segment OBR
 * @param {Object} orcSegment - Segment ORC associé
 * @param {Object} eventMapping - Mapping de l'événement ORM
 * @param {Object} context - Contexte de conversion
 * @param {Object} segments - Tous les segments du message
 * @returns {Object} Ressource ServiceRequest FHIR
 */
function createServiceRequestFromOBR(obrSegment, orcSegment, eventMapping, context, segments) {
  const serviceRequestId = `servicerequest-${uuid.v4()}`;
  
  const serviceRequest = {
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-service-request']
    },
    identifier: [
      {
        use: 'official',
        system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-service-request-identifier',
        value: obrSegment.fields[3] || serviceRequestId // OBR-3: Filler Order Number
      }
    ],
    status: mapOrderStatus(orcSegment?.fields[5]) || eventMapping.status, // ORC-5: Order Status
    intent: 'order',
    category: [
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '108252007',
            display: 'Laboratory procedure'
          }
        ]
      }
    ],
    priority: mapPriority(obrSegment.fields[5]), // OBR-5: Priority
    code: extractServiceCode(obrSegment.fields[4]), // OBR-4: Universal Service Identifier
    subject: {
      reference: context.patientReference || 'Patient/unknown'
    },
    encounter: context.encounterReference ? { reference: context.encounterReference } : undefined,
    occurrenceDateTime: extractDateTime(obrSegment.fields[6]) || extractDateTime(obrSegment.fields[7]), // OBR-6: Requested Date/Time ou OBR-7: Observation Date/Time
    requester: context.practitionerReference ? { reference: context.practitionerReference } : undefined,
    performer: context.organizationReference ? [{ reference: context.organizationReference }] : undefined,
    reasonCode: extractReasonCode(segments.OBX),
    bodySite: extractBodySite(obrSegment.fields[15]), // OBR-15: Specimen Source
    note: extractNotes(segments.NTE, obrSegment.fields[31]) // OBR-31: Reason for Study + NTE segments
  };

  // Ajouter les informations de facturation si présentes
  if (segments.BLG && segments.BLG.length > 0) {
    serviceRequest.extension = serviceRequest.extension || [];
    serviceRequest.extension.push({
      url: 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-service-request-billing',
      valueString: segments.BLG[0].fields[1] || 'Facturation standard'
    });
  }

  console.log(`[ORM_HANDLER] ServiceRequest créé: ${serviceRequestId}`);
  return serviceRequest;
}

/**
 * Crée une ressource Observation à partir d'un segment OBX
 * @param {Object} obxSegment - Segment OBX
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Observation FHIR
 */
function createObservationFromOBX(obxSegment, context) {
  const observationId = `observation-${uuid.v4()}`;
  
  const observation = {
    resourceType: 'Observation',
    id: observationId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-observation']
    },
    identifier: [
      {
        use: 'official',
        system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-observation-identifier',
        value: observationId
      }
    ],
    status: mapObservationStatus(obxSegment.fields[11]) || 'final', // OBX-11: Observation Result Status
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }
        ]
      }
    ],
    code: extractObservationCode(obxSegment.fields[3]), // OBX-3: Observation Identifier
    subject: {
      reference: context.patientReference || 'Patient/unknown'
    },
    effectiveDateTime: extractDateTime(obxSegment.fields[14]), // OBX-14: Date/Time of the Observation
    valueString: obxSegment.fields[5] || 'Valeur non spécifiée', // OBX-5: Observation Value
    dataAbsentReason: obxSegment.fields[5] ? undefined : {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason',
          code: 'unknown',
          display: 'Unknown'
        }
      ]
    }
  };

  console.log(`[ORM_HANDLER] Observation créée: ${observationId}`);
  return observation;
}

/**
 * Crée une ressource Organization à partir du segment MSH
 * @param {Object} mshSegment - Segment MSH
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Organization FHIR
 */
function createOrganizationFromMSH(mshSegment, context) {
  const organizationId = `organization-${uuid.v4()}`;
  
  const organization = {
    resourceType: 'Organization',
    id: organizationId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-organization']
    },
    identifier: [
      {
        use: 'official',
        system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-organization-finess',
        value: mshSegment.fields[4] || organizationId // MSH-4: Receiving Facility
      }
    ],
    active: true,
    name: mshSegment.fields[4] || 'Organisation émettrice', // MSH-4: Receiving Facility
    type: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
            code: 'prov',
            display: 'Healthcare Provider'
          }
        ]
      }
    ]
  };

  console.log(`[ORM_HANDLER] Organization créée: ${organizationId}`);
  return organization;
}

/**
 * Fonctions utilitaires pour l'extraction de données
 */

function extractPatientIdentifiers(pidSegment) {
  const identifiers = [];
  
  if (pidSegment.fields[2]) { // PID-2: Patient ID (External ID)
    identifiers.push({
      use: 'usual',
      system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-patient-identifier',
      value: pidSegment.fields[2]
    });
  }
  
  if (pidSegment.fields[3]) { // PID-3: Patient Identifier List
    identifiers.push({
      use: 'official',
      system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-patient-ins',
      value: pidSegment.fields[3]
    });
  }
  
  return identifiers;
}

function extractPatientNames(pidSegment) {
  const names = [];
  
  if (pidSegment.fields[5]) { // PID-5: Patient Name
    const nameField = pidSegment.fields[5];
    if (Array.isArray(nameField)) {
      names.push({
        use: 'official',
        family: nameField[0],
        given: nameField[1] ? nameField[1].split(' ') : []
      });
    } else {
      const parts = nameField.split('^');
      names.push({
        use: 'official',
        family: parts[0],
        given: parts[1] ? parts[1].split(' ') : []
      });
    }
  }
  
  return names;
}

function extractGender(genderField) {
  if (!genderField) return 'unknown';
  
  const genderMap = {
    'M': 'male',
    'F': 'female',
    'O': 'other',
    'U': 'unknown'
  };
  
  return genderMap[genderField.toUpperCase()] || 'unknown';
}

function extractBirthDate(birthDateField) {
  if (!birthDateField) return null;
  
  const dateStr = birthDateField.toString();
  if (dateStr.length >= 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

function extractTelecom(pidSegment) {
  const telecom = [];
  
  if (pidSegment.fields[13]) { // PID-13: Phone Number - Home
    telecom.push({
      system: 'phone',
      value: pidSegment.fields[13],
      use: 'home'
    });
  }
  
  if (pidSegment.fields[14]) { // PID-14: Phone Number - Business
    telecom.push({
      system: 'phone',
      value: pidSegment.fields[14],
      use: 'work'
    });
  }
  
  return telecom;
}

function extractAddress(pidSegment) {
  const addresses = [];
  
  if (pidSegment.fields[11]) { // PID-11: Patient Address
    const addressField = pidSegment.fields[11];
    addresses.push({
      use: 'home',
      type: 'both',
      line: [addressField.toString()]
    });
  }
  
  return addresses;
}

function mapOrderStatus(orcStatus) {
  const statusMap = {
    'NW': 'active',      // New order
    'OK': 'active',      // Order accepted & OK
    'UA': 'on-hold',     // Unable to accept order
    'CA': 'cancelled',   // Order canceled
    'DC': 'completed',   // Order discontinued
    'CM': 'completed',   // Order completed
    'HD': 'on-hold',     // Order held
    'RP': 'active',      // Order replace
    'ER': 'entered-in-error' // Error in order
  };
  
  return statusMap[orcStatus] || 'active';
}

function mapPriority(priorityField) {
  if (!priorityField) return 'routine';
  
  return PRIORITY_MAPPING[priorityField.toUpperCase()] || 'routine';
}

function extractServiceCode(serviceIdentifier) {
  if (!serviceIdentifier) {
    return {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
          code: 'LAB',
          display: 'Laboratory'
        }
      ]
    };
  }
  
  let code, display, system = 'http://terminology.hl7.org/CodeSystem/v2-0074';
  
  if (Array.isArray(serviceIdentifier)) {
    code = serviceIdentifier[0];
    display = serviceIdentifier[1];
    system = serviceIdentifier[2] || system;
  } else {
    const parts = serviceIdentifier.split('^');
    code = parts[0];
    display = parts[1];
    system = parts[2] || system;
  }
  
  return {
    coding: [
      {
        system,
        code: code || 'LAB',
        display: display || 'Service médical'
      }
    ]
  };
}

function extractObservationCode(observationIdentifier) {
  if (!observationIdentifier) {
    return {
      coding: [
        {
          system: 'http://loinc.org',
          code: '33747-0',
          display: 'General observation'
        }
      ]
    };
  }
  
  let code, display, system = 'http://loinc.org';
  
  if (Array.isArray(observationIdentifier)) {
    code = observationIdentifier[0];
    display = observationIdentifier[1];
    system = observationIdentifier[2] || system;
  } else {
    const parts = observationIdentifier.split('^');
    code = parts[0];
    display = parts[1];
    system = parts[2] || system;
  }
  
  return {
    coding: [
      {
        system,
        code: code || '33747-0',
        display: display || 'Observation générale'
      }
    ]
  };
}

function mapObservationStatus(statusField) {
  const statusMap = {
    'F': 'final',
    'P': 'preliminary',
    'C': 'corrected',
    'D': 'cancelled',
    'I': 'registered',
    'N': 'final',
    'O': 'unknown',
    'R': 'preliminary',
    'S': 'preliminary',
    'X': 'cancelled'
  };
  
  return statusMap[statusField] || 'final';
}

function extractReasonCode(obxSegments) {
  const reasonCodes = [];
  
  if (obxSegments && obxSegments.length > 0) {
    obxSegments.forEach(obx => {
      if (obx.fields[3]) { // OBX-3: Observation Identifier
        reasonCodes.push({
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: obx.fields[3],
              display: obx.fields[5] || 'Observation'
            }
          ]
        });
      }
    });
  }
  
  return reasonCodes;
}

function extractBodySite(specimenSource) {
  if (!specimenSource) return [];
  
  return [
    {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '123037004',
          display: specimenSource
        }
      ]
    }
  ];
}

function extractDateTime(dateTimeField) {
  if (!dateTimeField) return null;
  
  const dateStr = dateTimeField.toString();
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

function extractNotes(nteSegments, reasonForStudy) {
  const notes = [];
  
  if (reasonForStudy) {
    notes.push({
      text: reasonForStudy
    });
  }
  
  if (nteSegments && nteSegments.length > 0) {
    nteSegments.forEach(nte => {
      if (nte.fields[3]) { // NTE-3: Comment
        notes.push({
          text: nte.fields[3]
        });
      }
    });
  }
  
  return notes;
}

function addResourceToBundle(bundle, resource) {
  bundle.entry.push({
    fullUrl: `urn:uuid:${resource.id}`,
    resource: resource
  });
}

/**
 * Met à jour les focus du MessageHeader avec les ressources principales
 * @param {Object} bundle - Bundle FHIR
 * @param {Array} resources - Ressources créées
 */
function updateMessageHeaderFocus(bundle, resources) {
  const messageHeader = bundle.entry.find(entry => 
    entry.resource.resourceType === 'MessageHeader'
  );
  
  if (messageHeader) {
    // Ajouter Patient et ServiceRequest comme focus principaux pour ORM
    resources.forEach(resource => {
      if (resource.resourceType === 'Patient' || resource.resourceType === 'ServiceRequest') {
        messageHeader.resource.focus.push({
          reference: `urn:uuid:${resource.id}`
        });
      }
    });
  }
}

module.exports = {
  process,
  ORM_EVENT_MAPPING
};