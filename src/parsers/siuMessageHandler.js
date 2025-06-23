/**
 * Handler spécialisé pour les messages HL7 SIU (Scheduling Information Unsolicited)
 * Conversion vers ressources FHIR FRCore : Appointment, Schedule, Slot
 * 
 * @version 1.0.0
 * @module siuMessageHandler
 */

const uuid = require('uuid');

/**
 * Mapping des événements SIU vers actions FHIR
 */
const SIU_EVENT_MAPPING = {
  'S12': { action: 'create', status: 'booked', description: 'Nouvelle planification' },
  'S13': { action: 'cancel', status: 'cancelled', description: 'Demande de suppression' },
  'S14': { action: 'update', status: 'booked', description: 'Modification rendez-vous' },
  'S15': { action: 'confirm', status: 'booked', description: 'Confirmation' },
  'S16': { action: 'cancel', status: 'cancelled', description: 'Annulation' },
  'S17': { action: 'delete', status: 'entered-in-error', description: 'Suppression' },
  'S26': { action: 'notify', status: 'proposed', description: 'Notification planning' }
};

/**
 * Traite un message SIU et génère les ressources FHIR correspondantes
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Bundle FHIR avec ressources Appointment/Schedule/Slot
 */
function process(parsedMessage, context) {
  console.log(`[SIU_HANDLER] Début traitement SIU^${context.eventType}`);
  
  const eventMapping = SIU_EVENT_MAPPING[context.eventType];
  if (!eventMapping) {
    throw new Error(`Événement SIU non supporté: ${context.eventType}`);
  }

  // Extraire les segments nécessaires
  const segments = extractSIUSegments(parsedMessage);
  
  // Générer les ressources FHIR selon le type d'événement
  const resources = [];
  
  // Créer la ressource Patient si présente
  if (segments.PID) {
    const patient = createPatientFromPID(segments.PID, context);
    resources.push(patient);
    context.patientReference = `Patient/${patient.id}`;
  }

  // Créer la ressource Appointment principale
  if (segments.SCH) {
    const appointment = createAppointmentFromSCH(segments.SCH, eventMapping, context, segments);
    resources.push(appointment);
  }

  // Créer les ressources Schedule si nécessaire
  if (segments.AIS && segments.AIS.length > 0) {
    segments.AIS.forEach(ais => {
      const schedule = createScheduleFromAIS(ais, context);
      resources.push(schedule);
    });
  }

  // Créer les ressources Location depuis AIL
  if (segments.AIL && segments.AIL.length > 0) {
    segments.AIL.forEach(ail => {
      const location = createLocationFromAIL(ail, context);
      resources.push(location);
    });
  }

  // Créer les ressources Practitioner depuis AIP
  if (segments.AIP && segments.AIP.length > 0) {
    segments.AIP.forEach(aip => {
      const practitioner = createPractitionerFromAIP(aip, context);
      resources.push(practitioner);
    });
  }

  // Ajouter toutes les ressources au bundle
  resources.forEach(resource => {
    addResourceToBundle(context.bundle, resource);
  });

  console.log(`[SIU_HANDLER] ${resources.length} ressources FHIR générées pour SIU^${context.eventType}`);
  return context.bundle;
}

/**
 * Extrait les segments pertinents d'un message SIU
 * @param {Object} parsedMessage - Message HL7 parsé
 * @returns {Object} Segments organisés par type
 */
function extractSIUSegments(parsedMessage) {
  const segments = {
    MSH: null,
    SCH: null,
    TQ1: [],
    NTE: [],
    PID: null,
    PD1: null,
    PV1: null,
    PV2: null,
    OBX: [],
    DG1: [],
    RGS: [],
    AIS: [],
    AIG: [],
    AIL: [],
    AIP: []
  };

  parsedMessage.segments.forEach(segment => {
    switch (segment.type) {
      case 'MSH':
      case 'SCH':
      case 'PID':
      case 'PD1':
      case 'PV1':
      case 'PV2':
        segments[segment.type] = segment;
        break;
      case 'TQ1':
      case 'NTE':
      case 'OBX':
      case 'DG1':
      case 'RGS':
      case 'AIS':
      case 'AIG':
      case 'AIL':
      case 'AIP':
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

  console.log(`[SIU_HANDLER] Patient créé: ${patientId}`);
  return patient;
}

/**
 * Crée une ressource Appointment FHIR à partir d'un segment SCH
 * @param {Object} schSegment - Segment SCH
 * @param {Object} eventMapping - Mapping de l'événement SIU
 * @param {Object} context - Contexte de conversion
 * @param {Object} segments - Tous les segments du message
 * @returns {Object} Ressource Appointment FHIR
 */
function createAppointmentFromSCH(schSegment, eventMapping, context, segments) {
  const appointmentId = `appointment-${uuid.v4()}`;
  
  const appointment = {
    resourceType: 'Appointment',
    id: appointmentId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-appointment']
    },
    identifier: [
      {
        system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-appointment-identifier',
        value: schSegment.fields[1] || appointmentId // SCH-1: Placer Appointment ID
      }
    ],
    status: eventMapping.status,
    serviceCategory: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/service-category',
            code: 'gp',
            display: 'General Practice'
          }
        ]
      }
    ],
    serviceType: extractServiceType(schSegment.fields[7]), // SCH-7: Appointment Type
    specialty: extractSpecialty(schSegment),
    appointmentType: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
          code: schSegment.fields[25] || 'ROUTINE',
          display: 'Routine'
        }
      ]
    },
    reasonCode: extractReasonCode(segments.DG1),
    description: schSegment.fields[2] || eventMapping.description, // SCH-2: Filler Appointment ID
    start: extractDateTime(schSegment.fields[11]), // SCH-11: Appointment Timing Quantity
    end: extractDateTime(schSegment.fields[12]),   // SCH-12: Placed Order Date/Time
    minutesDuration: extractDuration(schSegment.fields[9]), // SCH-9: Appointment Duration
    slot: extractSlotReferences(segments.AIS),
    participant: []
  };

  // Ajouter le patient s'il existe
  if (context.patientReference) {
    appointment.participant.push({
      actor: { reference: context.patientReference },
      required: 'required',
      status: 'accepted'
    });
  }

  // Ajouter les praticiens
  if (segments.AIP && segments.AIP.length > 0) {
    segments.AIP.forEach(aip => {
      appointment.participant.push({
        actor: { reference: `Practitioner/practitioner-${uuid.v4()}` },
        required: 'required',
        status: 'accepted'
      });
    });
  }

  // Ajouter les locations
  if (segments.AIL && segments.AIL.length > 0) {
    segments.AIL.forEach(ail => {
      appointment.participant.push({
        actor: { reference: `Location/location-${uuid.v4()}` },
        required: 'required',
        status: 'accepted'
      });
    });
  }

  console.log(`[SIU_HANDLER] Appointment créé: ${appointmentId} (${eventMapping.status})`);
  return appointment;
}

/**
 * Crée une ressource Schedule à partir d'un segment AIS
 * @param {Object} aisSegment - Segment AIS
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Schedule FHIR
 */
function createScheduleFromAIS(aisSegment, context) {
  const scheduleId = `schedule-${uuid.v4()}`;
  
  const schedule = {
    resourceType: 'Schedule',
    id: scheduleId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-schedule']
    },
    identifier: [
      {
        system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-schedule-identifier',
        value: aisSegment.fields[1] || scheduleId // AIS-1: Set ID
      }
    ],
    active: true,
    serviceCategory: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/service-category',
            code: aisSegment.fields[3] || 'gp', // AIS-3: Universal Service Identifier
            display: 'Service Category'
          }
        ]
      }
    ],
    serviceType: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/service-type',
            code: aisSegment.fields[4] || '124',
            display: 'General Practice'
          }
        ]
      }
    ],
    actor: [
      { reference: context.patientReference || 'Patient/unknown' }
    ],
    planningHorizon: {
      start: extractDateTime(aisSegment.fields[11]), // AIS-11: Start Date/Time
      end: extractDateTime(aisSegment.fields[12])     // AIS-12: Start Date/Time Offset
    },
    comment: aisSegment.fields[2] || 'Schedule généré depuis SIU' // AIS-2: Segment Action Code
  };

  console.log(`[SIU_HANDLER] Schedule créé: ${scheduleId}`);
  return schedule;
}

/**
 * Crée une ressource Location à partir d'un segment AIL
 * @param {Object} ailSegment - Segment AIL
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Location FHIR
 */
function createLocationFromAIL(ailSegment, context) {
  const locationId = `location-${uuid.v4()}`;
  
  const location = {
    resourceType: 'Location',
    id: locationId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-location']
    },
    identifier: [
      {
        system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-location-identifier',
        value: ailSegment.fields[3] || locationId // AIL-3: Location Resource ID
      }
    ],
    status: 'active',
    name: ailSegment.fields[5] || 'Location inconnue', // AIL-5: Location Description
    alias: [ailSegment.fields[4] || 'Alias location'], // AIL-4: Location Group
    description: ailSegment.fields[2] || 'Location générée depuis SIU AIL', // AIL-2: Segment Action Code
    type: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
            code: 'HOSP',
            display: 'Hospital'
          }
        ]
      }
    ],
    physicalType: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
          code: 'ro',
          display: 'Room'
        }
      ]
    }
  };

  console.log(`[SIU_HANDLER] Location créée: ${locationId}`);
  return location;
}

/**
 * Crée une ressource Practitioner à partir d'un segment AIP
 * @param {Object} aipSegment - Segment AIP
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Practitioner FHIR
 */
function createPractitionerFromAIP(aipSegment, context) {
  const practitionerId = `practitioner-${uuid.v4()}`;
  
  const practitioner = {
    resourceType: 'Practitioner',
    id: practitionerId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-practitioner']
    },
    identifier: [
      {
        system: 'https://hl7.fr/ig/fhir/core/NamingSystem/fr-core-practitioner-identifier',
        value: aipSegment.fields[3] || practitionerId // AIP-3: Personnel Resource ID
      }
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: aipSegment.fields[5] || 'Praticien', // AIP-5: Personnel Name
        given: [aipSegment.fields[4] || 'Prénom']    // AIP-4: Resource Group
      }
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
              code: aipSegment.fields[6] || 'MD',
              display: 'Médecin'
            }
          ]
        }
      }
    ]
  };

  console.log(`[SIU_HANDLER] Practitioner créé: ${practitionerId}`);
  return practitioner;
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
  
  // Format HL7: YYYYMMDD ou YYYYMMDDHHMMSS
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

function extractServiceType(serviceTypeField) {
  return [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/service-type',
          code: serviceTypeField || '124',
          display: 'General Practice'
        }
      ]
    }
  ];
}

function extractSpecialty(schSegment) {
  return [
    {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '394814009',
          display: 'General practice'
        }
      ]
    }
  ];
}

function extractReasonCode(dg1Segments) {
  const reasonCodes = [];
  
  if (dg1Segments && dg1Segments.length > 0) {
    dg1Segments.forEach(dg1 => {
      if (dg1.fields[3]) { // DG1-3: Diagnosis Code
        reasonCodes.push({
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10',
              code: dg1.fields[3],
              display: dg1.fields[4] || 'Diagnostic'
            }
          ]
        });
      }
    });
  }
  
  return reasonCodes;
}

function extractDateTime(dateTimeField) {
  if (!dateTimeField) return null;
  
  // Format HL7: YYYYMMDDHHMMSS
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

function extractDuration(durationField) {
  if (!durationField) return null;
  
  // Convertir en minutes si c'est un nombre
  const duration = parseInt(durationField);
  return isNaN(duration) ? null : duration;
}

function extractSlotReferences(aisSegments) {
  const slots = [];
  
  if (aisSegments && aisSegments.length > 0) {
    aisSegments.forEach((ais, index) => {
      slots.push({ reference: `Slot/slot-${uuid.v4()}` });
    });
  }
  
  return slots;
}

function addResourceToBundle(bundle, resource) {
  bundle.entry.push({
    fullUrl: `urn:uuid:${resource.id}`,
    resource: resource
  });
}

module.exports = {
  process,
  SIU_EVENT_MAPPING
};