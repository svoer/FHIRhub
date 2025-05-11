/**
 * Processors pour les segments HL7
 * Convertit les segments HL7 en ressources FHIR
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Traiter un segment MSH (Message Header)
 * @param {Array} segment - Champs du segment MSH
 * @returns {Object} Ressource FHIR MessageHeader
 */
function processMSH(segment) {
  const messageId = uuidv4();
  
  // Créer une ressource MessageHeader FHIR
  return {
    resourceType: 'MessageHeader',
    id: messageId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/MessageHeader']
    },
    eventCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/message-events',
      code: 'observation-provide',
      display: 'Observation Provide'
    },
    source: {
      name: segment[4] || 'Unknown',
      software: 'FHIRHub',
      version: '1.0.0',
      endpoint: segment[3] || 'Unknown'
    },
    sender: {
      reference: 'Organization/' + uuidv4(),
      display: segment[4] || 'Unknown'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Traiter un segment PID (Patient Identification)
 * @param {Array} segment - Champs du segment PID
 * @param {Object} options - Options de traitement
 * @returns {Object} Ressource FHIR Patient
 */
function processPID(segment, options = {}) {
  const patientId = uuidv4();
  
  // Extraire les identifiants du patient
  const identifiers = [];
  
  // Vérifier si le champ PID-3 (identifiants du patient) existe
  if (segment[3]) {
    // S'il s'agit d'une chaîne, la convertir en tableau d'un seul élément
    const patientIds = Array.isArray(segment[3]) ? segment[3] : [segment[3]];
    
    // Traiter chaque identifiant
    patientIds.forEach(id => {
      if (id && typeof id === 'string') {
        const idParts = id.split('^');
        
        identifiers.push({
          system: idParts[3] ? `urn:oid:${idParts[3]}` : 'http://fhirhub.example/identifier/pid',
          value: idParts[0] || id
        });
      }
    });
  }
  
  // Si aucun identifiant n'a été trouvé, ajouter un identifiant par défaut
  if (identifiers.length === 0) {
    identifiers.push({
      system: 'http://fhirhub.example/identifier/pid',
      value: segment[1] || `unknown-${patientId.substring(0, 8)}`
    });
  }
  
  // Créer un nom formaté pour le patient
  let familyName = '';
  let givenNames = [];
  
  // Extraire le nom du patient à partir du champ PID-5
  if (segment[5]) {
    const nameParts = segment[5].split('^');
    
    familyName = nameParts[0] || '';
    
    // Collecter tous les prénoms
    for (let i = 1; i < 3; i++) {
      if (nameParts[i]) {
        givenNames.push(nameParts[i]);
      }
    }
  }
  
  // Si des noms français sont fournis, les utiliser
  if (options.names && options.names.length > 0) {
    // Chercher le nom officiel
    const officialName = options.names.find(name => name.type === 'official');
    
    if (officialName) {
      familyName = officialName.family || familyName;
      givenNames = officialName.given || givenNames;
    }
  }
  
  // Créer la ressource Patient FHIR
  const patient = {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
    },
    identifier: identifiers,
    active: true,
    name: [{
      use: 'official',
      family: familyName,
      given: givenNames
    }],
    gender: mapGender(segment[8]),
    birthDate: formatDate(segment[7])
  };
  
  // Ajouter l'adresse si disponible (PID-11)
  if (segment[11]) {
    const addressParts = segment[11].split('^');
    
    patient.address = [{
      use: 'home',
      line: [addressParts[0] || ''],
      city: addressParts[3] || '',
      state: addressParts[4] || '',
      postalCode: addressParts[5] || '',
      country: addressParts[6] || ''
    }];
  }
  
  // Ajouter le téléphone si disponible (PID-13)
  if (segment[13]) {
    patient.telecom = [{
      system: 'phone',
      value: segment[13],
      use: 'home'
    }];
  }
  
  // Ajouter l'email si disponible (PID-13, format XXX^NET^Internet^email@example.com)
  if (segment[13] && segment[13].includes('Internet')) {
    const emailParts = segment[13].split('^');
    
    if (emailParts.length >= 4 && emailParts[3] && emailParts[3].includes('@')) {
      // Ajouter seulement si telecom existe déjà
      if (!patient.telecom) {
        patient.telecom = [];
      }
      
      patient.telecom.push({
        system: 'email',
        value: emailParts[3],
        use: 'home'
      });
    }
  }
  
  return patient;
}

/**
 * Traiter un segment PV1 (Patient Visit)
 * @param {Array} segment - Champs du segment PV1
 * @param {Object} options - Options de traitement
 * @returns {Object} Ressource FHIR Encounter
 */
function processPV1(segment, options = {}) {
  const encounterId = uuidv4();
  
  // Trouver la ressource Patient associée
  let patientReference = '';
  
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    
    if (patient) {
      patientReference = `Patient/${patient.id}`;
    }
  }
  
  // Déterminer le statut de la rencontre
  let status = 'finished';
  
  if (segment[2]) {
    switch (segment[2]) {
      case 'P':
      case 'I':
        status = 'in-progress';
        break;
      case 'R':
        status = 'planned';
        break;
      case 'C':
        status = 'cancelled';
        break;
      default:
        status = 'finished';
    }
  }
  
  // Créer la ressource Encounter FHIR
  const encounter = {
    resourceType: 'Encounter',
    id: encounterId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Encounter']
    },
    status: status,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: mapEncounterClass(segment[2]),
      display: mapEncounterClassDisplay(segment[2])
    },
    subject: {
      reference: patientReference
    },
    period: {
      start: formatDateTime(segment[44])
    }
  };
  
  // Ajouter la date de fin si disponible
  if (segment[45]) {
    encounter.period.end = formatDateTime(segment[45]);
  }
  
  // Ajouter le praticien responsable si disponible
  if (segment[7]) {
    const practitionerParts = segment[7].split('^');
    
    encounter.participant = [{
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
          code: 'ATND',
          display: 'Attender'
        }]
      }],
      individual: {
        reference: `Practitioner/${uuidv4()}`,
        display: practitionerParts.join(' ').trim() || 'Unknown'
      }
    }];
  }
  
  // Ajouter le service hospitalier si disponible
  if (segment[10]) {
    encounter.serviceType = {
      coding: [{
        system: 'http://fhirhub.example/service-type',
        code: segment[10],
        display: segment[10]
      }]
    };
  }
  
  return encounter;
}

/**
 * Traiter un segment NK1 (Next of Kin)
 * @param {Array} segment - Champs du segment NK1
 * @param {Object} options - Options de traitement
 * @returns {Object} Ressource FHIR RelatedPerson
 */
function processNK1(segment, options = {}) {
  const relatedPersonId = uuidv4();
  
  // Trouver la ressource Patient associée
  let patientReference = '';
  
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    
    if (patient) {
      patientReference = `Patient/${patient.id}`;
    }
  }
  
  // Extraire le nom
  let familyName = '';
  let givenNames = [];
  
  if (segment[2]) {
    const nameParts = segment[2].split('^');
    
    familyName = nameParts[0] || '';
    
    for (let i = 1; i < 3; i++) {
      if (nameParts[i]) {
        givenNames.push(nameParts[i]);
      }
    }
  }
  
  // Créer la ressource RelatedPerson FHIR
  const relatedPerson = {
    resourceType: 'RelatedPerson',
    id: relatedPersonId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/RelatedPerson']
    },
    active: true,
    patient: {
      reference: patientReference
    },
    relationship: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
        code: mapRelationshipType(segment[3]),
        display: segment[3] || 'Unknown'
      }]
    }],
    name: [{
      use: 'official',
      family: familyName,
      given: givenNames
    }]
  };
  
  // Ajouter le téléphone si disponible
  if (segment[5]) {
    relatedPerson.telecom = [{
      system: 'phone',
      value: segment[5],
      use: 'home'
    }];
  }
  
  // Ajouter l'adresse si disponible
  if (segment[4]) {
    const addressParts = segment[4].split('^');
    
    relatedPerson.address = [{
      use: 'home',
      line: [addressParts[0] || ''],
      city: addressParts[3] || '',
      state: addressParts[4] || '',
      postalCode: addressParts[5] || '',
      country: addressParts[6] || ''
    }];
  }
  
  return relatedPerson;
}

/**
 * Traiter un segment OBR (Observation Request)
 * @param {Array} segment - Champs du segment OBR
 * @param {Object} options - Options de traitement
 * @returns {Object} Ressource FHIR ServiceRequest
 */
function processOBR(segment, options = {}) {
  const serviceRequestId = uuidv4();
  
  // Trouver la ressource Patient associée
  let patientReference = '';
  let encounterReference = '';
  
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    const encounter = options.resources.find(r => r.resourceType === 'Encounter');
    
    if (patient) {
      patientReference = `Patient/${patient.id}`;
    }
    
    if (encounter) {
      encounterReference = `Encounter/${encounter.id}`;
    }
  }
  
  // Déterminer le statut de la demande
  let status = 'completed';
  
  if (segment[25]) {
    switch (segment[25]) {
      case 'P':
        status = 'active';
        break;
      case 'I':
        status = 'in-progress';
        break;
      case 'C':
        status = 'completed';
        break;
      case 'X':
        status = 'cancelled';
        break;
      default:
        status = 'completed';
    }
  }
  
  // Créer la ressource ServiceRequest FHIR
  const serviceRequest = {
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/ServiceRequest']
    },
    status: status,
    intent: 'order',
    subject: {
      reference: patientReference
    },
    authoredOn: formatDateTime(segment[6])
  };
  
  // Ajouter la référence à l'Encounter si disponible
  if (encounterReference) {
    serviceRequest.encounter = {
      reference: encounterReference
    };
  }
  
  // Ajouter l'identifiant de la demande
  if (segment[3]) {
    serviceRequest.identifier = [{
      system: 'http://fhirhub.example/identifier/obr',
      value: segment[3]
    }];
  }
  
  // Ajouter le code du service demandé
  if (segment[4]) {
    const codeParts = segment[4].split('^');
    
    serviceRequest.code = {
      coding: [{
        system: codeParts[2] ? `urn:oid:${codeParts[2]}` : 'http://fhirhub.example/code/obr',
        code: codeParts[0] || segment[4],
        display: codeParts[1] || codeParts[0] || segment[4]
      }]
    };
  }
  
  // Ajouter le praticien demandeur
  if (segment[16]) {
    const requesterParts = segment[16].split('^');
    
    serviceRequest.requester = {
      reference: `Practitioner/${uuidv4()}`,
      display: requesterParts.join(' ').trim() || 'Unknown'
    };
  }
  
  return serviceRequest;
}

/**
 * Traiter un segment OBX (Observation)
 * @param {Array} segment - Champs du segment OBX
 * @param {Object} options - Options de traitement
 * @returns {Object} Ressource FHIR Observation
 */
function processOBX(segment, options = {}) {
  const observationId = uuidv4();
  
  // Trouver les ressources associées
  let patientReference = '';
  let encounterReference = '';
  let serviceRequestReference = '';
  
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    const encounter = options.resources.find(r => r.resourceType === 'Encounter');
    const serviceRequest = options.resources.find(r => r.resourceType === 'ServiceRequest');
    
    if (patient) {
      patientReference = `Patient/${patient.id}`;
    }
    
    if (encounter) {
      encounterReference = `Encounter/${encounter.id}`;
    }
    
    if (serviceRequest) {
      serviceRequestReference = `ServiceRequest/${serviceRequest.id}`;
    }
  }
  
  // Déterminer le statut de l'observation
  let status = 'final';
  
  if (segment[11]) {
    switch (segment[11]) {
      case 'P':
        status = 'preliminary';
        break;
      case 'I':
        status = 'registered';
        break;
      case 'C':
        status = 'corrected';
        break;
      case 'F':
        status = 'final';
        break;
      case 'X':
        status = 'cancelled';
        break;
      default:
        status = 'final';
    }
  }
  
  // Créer la ressource Observation FHIR
  const observation = {
    resourceType: 'Observation',
    id: observationId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Observation']
    },
    status: status,
    subject: {
      reference: patientReference
    },
    effectiveDateTime: formatDateTime(segment[14])
  };
  
  // Ajouter la référence à l'Encounter si disponible
  if (encounterReference) {
    observation.encounter = {
      reference: encounterReference
    };
  }
  
  // Ajouter la référence à la demande de service
  if (serviceRequestReference) {
    observation.basedOn = [{
      reference: serviceRequestReference
    }];
  }
  
  // Ajouter le code de l'observation
  if (segment[3]) {
    const codeParts = segment[3].split('^');
    
    observation.code = {
      coding: [{
        system: codeParts[2] ? `urn:oid:${codeParts[2]}` : 'http://fhirhub.example/code/obx',
        code: codeParts[0] || segment[3],
        display: codeParts[1] || codeParts[0] || segment[3]
      }]
    };
  }
  
  // Ajouter la valeur de l'observation selon son type
  if (segment[2] && segment[5]) {
    switch (segment[2]) {
      case 'NM': // Numérique
        observation.valueQuantity = {
          value: parseFloat(segment[5]),
          unit: segment[6] || '',
          system: 'http://unitsofmeasure.org',
          code: segment[6] || ''
        };
        break;
      
      case 'ST': // Chaîne de caractères
      case 'TX': // Texte
        observation.valueString = segment[5];
        break;
      
      case 'CE': // Code
        const valueParts = segment[5].split('^');
        
        observation.valueCodeableConcept = {
          coding: [{
            system: valueParts[2] ? `urn:oid:${valueParts[2]}` : 'http://fhirhub.example/value/obx',
            code: valueParts[0] || segment[5],
            display: valueParts[1] || valueParts[0] || segment[5]
          }]
        };
        break;
      
      case 'DT': // Date
        observation.valueDateTime = formatDate(segment[5]);
        break;
      
      case 'TM': // Heure
        observation.valueTime = segment[5];
        break;
      
      default:
        observation.valueString = segment[5];
    }
  }
  
  // Ajouter des commentaires si disponibles
  if (segment[8]) {
    observation.note = [{
      text: segment[8]
    }];
  }
  
  return observation;
}

/**
 * Traiter un segment SPM (Specimen)
 * @param {Array} segment - Champs du segment SPM
 * @param {Object} options - Options de traitement
 * @returns {Object} Ressource FHIR Specimen
 */
function processSPM(segment, options = {}) {
  const specimenId = uuidv4();
  
  // Trouver la ressource Patient associée
  let patientReference = '';
  
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    
    if (patient) {
      patientReference = `Patient/${patient.id}`;
    }
  }
  
  // Créer la ressource Specimen FHIR
  const specimen = {
    resourceType: 'Specimen',
    id: specimenId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Specimen']
    },
    status: 'available',
    subject: {
      reference: patientReference
    }
  };
  
  // Ajouter l'identifiant de l'échantillon
  if (segment[2]) {
    specimen.identifier = [{
      system: 'http://fhirhub.example/identifier/specimen',
      value: segment[2]
    }];
  }
  
  // Ajouter le type d'échantillon
  if (segment[4]) {
    const typeParts = segment[4].split('^');
    
    specimen.type = {
      coding: [{
        system: typeParts[2] ? `urn:oid:${typeParts[2]}` : 'http://fhirhub.example/type/specimen',
        code: typeParts[0] || segment[4],
        display: typeParts[1] || typeParts[0] || segment[4]
      }]
    };
  }
  
  // Ajouter la date de collecte
  if (segment[17]) {
    specimen.collection = {
      collectedDateTime: formatDateTime(segment[17])
    };
    
    // Ajouter le collecteur si disponible
    if (segment[15]) {
      const collectorParts = segment[15].split('^');
      
      specimen.collection.collector = {
        reference: `Practitioner/${uuidv4()}`,
        display: collectorParts.join(' ').trim() || 'Unknown'
      };
    }
  }
  
  // Ajouter des notes si disponibles
  if (segment[13]) {
    specimen.note = [{
      text: segment[13]
    }];
  }
  
  return specimen;
}

/**
 * Formater une date HL7 en date FHIR
 * @param {string} hl7Date - Date au format HL7 (YYYYMMDD)
 * @returns {string|undefined} Date au format FHIR (YYYY-MM-DD)
 */
function formatDate(hl7Date) {
  if (!hl7Date) return undefined;
  
  // Motif de date HL7 : YYYYMMDD
  if (hl7Date.length === 8) {
    const year = hl7Date.substring(0, 4);
    const month = hl7Date.substring(4, 6);
    const day = hl7Date.substring(6, 8);
    
    return `${year}-${month}-${day}`;
  }
  
  return undefined;
}

/**
 * Formater une date/heure HL7 en date/heure FHIR
 * @param {string} hl7DateTime - Date/heure au format HL7 (YYYYMMDDHHMMSS)
 * @returns {string|undefined} Date/heure au format FHIR (YYYY-MM-DDThh:mm:ss+zz:zz)
 */
function formatDateTime(hl7DateTime) {
  if (!hl7DateTime) return undefined;
  
  // Motif de date/heure HL7 : YYYYMMDDHHMMSS
  if (hl7DateTime.length >= 8) {
    const year = hl7DateTime.substring(0, 4);
    const month = hl7DateTime.substring(4, 6);
    const day = hl7DateTime.substring(6, 8);
    
    let formattedDate = `${year}-${month}-${day}`;
    
    // Ajouter l'heure si disponible
    if (hl7DateTime.length >= 14) {
      const hour = hl7DateTime.substring(8, 10);
      const minute = hl7DateTime.substring(10, 12);
      const second = hl7DateTime.substring(12, 14);
      
      formattedDate += `T${hour}:${minute}:${second}`;
    } else {
      formattedDate += 'T00:00:00';
    }
    
    // Ajouter le fuseau horaire par défaut
    formattedDate += '+00:00';
    
    return formattedDate;
  }
  
  return undefined;
}

/**
 * Mapper le genre HL7 en genre FHIR
 * @param {string} hl7Gender - Genre au format HL7
 * @returns {string} Genre au format FHIR
 */
function mapGender(hl7Gender) {
  if (!hl7Gender) return 'unknown';
  
  switch (hl7Gender.toUpperCase()) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'A':
      return 'other';
    case 'N':
      return 'unknown';
    case 'U':
      return 'unknown';
    default:
      return 'unknown';
  }
}

/**
 * Mapper la classe de rencontre HL7 en classe FHIR
 * @param {string} hl7Class - Classe au format HL7
 * @returns {string} Classe au format FHIR
 */
function mapEncounterClass(hl7Class) {
  if (!hl7Class) return 'AMB';
  
  switch (hl7Class) {
    case 'I':
      return 'IMP';
    case 'O':
      return 'AMB';
    case 'E':
      return 'EMER';
    case 'P':
      return 'AMB';
    default:
      return 'AMB';
  }
}

/**
 * Mapper l'affichage de la classe de rencontre FHIR
 * @param {string} hl7Class - Classe au format HL7
 * @returns {string} Affichage de la classe FHIR
 */
function mapEncounterClassDisplay(hl7Class) {
  if (!hl7Class) return 'Ambulatory';
  
  switch (hl7Class) {
    case 'I':
      return 'Inpatient';
    case 'O':
      return 'Ambulatory';
    case 'E':
      return 'Emergency';
    case 'P':
      return 'Ambulatory';
    default:
      return 'Ambulatory';
  }
}

/**
 * Mapper le type de relation HL7 en code FHIR
 * @param {string} hl7Relationship - Relation au format HL7
 * @returns {string} Code de relation FHIR
 */
function mapRelationshipType(hl7Relationship) {
  if (!hl7Relationship) return 'FAMMEMB';
  
  switch (hl7Relationship) {
    case 'MTH':
      return 'MTH';
    case 'FTH':
      return 'FTH';
    case 'SPS':
      return 'SPS';
    case 'CHD':
      return 'CHILD';
    default:
      return 'FAMMEMB';
  }
}

module.exports = {
  processMSH,
  processPID,
  processPV1,
  processNK1,
  processOBR,
  processOBX,
  processSPM
};