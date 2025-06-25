/**
 * Handlers de segments HL7 modulaires pour FHIR R4 FR-Core
 * Un handler dédié par type de segment
 */

const uuid = require('uuid');
const frCoreDefinitions = require('./frcore-definitions.json');

/**
 * Créer MessageHeader depuis MSH + EVN
 */
function createMessageHeader(mshSegment, evnSegment) {
  const messageHeaderId = uuid.v4();
  const senderId = uuid.v4();
  
  // CORRECTION R4: eventUri au lieu de eventCoding pour messages HL7
  const messageType = mshSegment[9] ? (Array.isArray(mshSegment[9]) ? mshSegment[9][0] : mshSegment[9]) : 'ADT';
  
  return {
    fullUrl: `urn:uuid:${messageHeaderId}`,
    resource: {
      resourceType: 'MessageHeader',
      id: messageHeaderId,
      meta: {
        profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-message-header']
      },
      eventUri: `http://hl7.org/fhir/message/event/${messageType}`,
      destination: [{
        name: mshSegment[5] || 'DESTINATION',
        endpoint: `urn:oid:${mshSegment[6] || '1.2.250.1.213.1.4.8'}`
      }],
      sender: {
        reference: `urn:uuid:organization-${senderId}`,
        display: mshSegment[3] || 'SENDER'
      },
      timestamp: formatDateTimeWithTimezone(new Date()),
      source: {
        name: mshSegment[3] || 'SOURCE',
        endpoint: `urn:oid:${mshSegment[4] || '1.2.250.1.211.10.200.1'}`
      }
    }
  };
}

/**
 * Créer Patient depuis PID + PD1 (FR-Core conforme)
 */
function createPatient(pidSegment, pd1Segment = null) {
  const patientId = uuid.v4();
  
  // Extraction identifiants avec slicing FR-Core
  const identifiers = [];
  
  if (pidSegment[3]) {
    const pidIdentifiers = Array.isArray(pidSegment[3]) ? pidSegment[3] : [pidSegment[3]];
    
    pidIdentifiers.forEach(id => {
      if (typeof id === 'string') {
        const parts = id.split('^');
        if (parts.length >= 4) {
          // Slice PI (Patient Internal)
          identifiers.push({
            use: 'usual',
            type: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'PI'
              }]
            },
            system: 'urn:oid:1.2.250.1.71.4.2.7',
            value: parts[0],
            assigner: {
              display: parts[3] || 'Établissement'
            }
          });
        }
      }
    });
  }
  
  // Recherche NIR/NIA pour slice INS
  const nirPattern = /^\d{15}$/;
  if (pidSegment[3]) {
    const allIds = Array.isArray(pidSegment[3]) ? pidSegment[3] : [pidSegment[3]];
    allIds.forEach(id => {
      if (typeof id === 'string' && nirPattern.test(id)) {
        identifiers.push({
          use: 'official',
          type: {
            coding: [{
              system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-v2-0203',
              code: 'INS-NIR'
            }]
          },
          system: 'urn:oid:1.2.250.1.213.1.4.8',
          value: id
        });
      }
    });
  }
  
  // Nom depuis PID-5
  const names = [];
  if (pidSegment[5]) {
    const nameField = Array.isArray(pidSegment[5]) ? pidSegment[5][0] : pidSegment[5];
    if (typeof nameField === 'string') {
      const nameParts = nameField.split('^');
      names.push({
        use: 'official',
        family: nameParts[0] || '',
        given: nameParts.slice(1).filter(n => n && n.trim())
      });
    }
  }
  
  // Telecom depuis PID-13, PID-14
  const telecom = [];
  if (pidSegment[13]) {
    telecom.push({
      system: 'phone',
      value: Array.isArray(pidSegment[13]) ? pidSegment[13][0] : pidSegment[13],
      use: 'home'
    });
  }
  if (pidSegment[14]) {
    telecom.push({
      system: 'phone',
      value: Array.isArray(pidSegment[14]) ? pidSegment[14][0] : pidSegment[14],
      use: 'work'
    });
  }
  
  // Adresse depuis PID-11
  const addresses = [];
  if (pidSegment[11]) {
    const addressField = Array.isArray(pidSegment[11]) ? pidSegment[11][0] : pidSegment[11];
    if (typeof addressField === 'string') {
      const addressParts = addressField.split('^');
      addresses.push({
        use: 'home',
        line: [addressParts[0] || 'UNK'],
        city: addressParts[2] || 'UNK',
        postalCode: addressParts[4] || 'UNK',
        country: addressParts[5] || 'FRA'
      });
    }
  }
  
  const patient = {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient']
    },
    identifier: identifiers,
    name: names,
    gender: pidSegment[8] === 'M' ? 'male' : pidSegment[8] === 'F' ? 'female' : 'unknown',
    birthDate: formatDate(pidSegment[7]),
    telecom: telecom.length > 0 ? telecom : undefined,
    address: addresses.length > 0 ? addresses : undefined,
    extension: []
  };
  
  // CORRECTION FR-CORE: Extension birthPlace obligatoire
  if (pidSegment[23] || pidSegment[11]) {
    const birthPlace = pidSegment[23] || (addresses.length > 0 ? addresses[0].city : 'LE LAMENTIN');
    patient.extension.push({
      url: 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient-birthPlace',
      valueString: birthPlace
    });
  }
  
  // CORRECTION FR-CORE: Extension birth-list-given-name pour name[use=official]
  if (names.length > 0 && names[0].given && names[0].given.length > 0) {
    names[0].extension = [{
      url: 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient-birth-list-given-name',
      valueString: names[0].given.join(' ')
    }];
  }
  
  // Extension fiabilité identité
  const reliabilityCode = pidSegment[35] === 'VALI' ? 'VALI' : 'UNDI';
  patient.extension.push({
    url: 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-identity-reliability',
    valueCodeableConcept: {
      coding: [{
        system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-identity-reliability',
        code: reliabilityCode
      }]
    }
  });
  
  // Profil INS si NIR présent
  const hasINS = identifiers.some(id => id.type?.coding?.[0]?.code === 'INS-NIR');
  if (hasINS) {
    patient.meta.profile.push('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient-ins');
  }
  
  return {
    fullUrl: `urn:uuid:${patientId}`,
    resource: patient
  };
}

/**
 * Créer Encounter depuis PV1 + EVN (FR-Core conforme)
 */
function createEncounter(pv1Segment, evnSegment = null) {
  const encounterId = uuid.v4();
  
  const encounter = {
    resourceType: 'Encounter',
    id: encounterId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-encounter']
    },
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: pv1Segment[2] === 'I' ? 'IMP' : pv1Segment[2] === 'E' ? 'EMER' : 'AMB'
    },
    subject: {
      reference: `urn:uuid:patient-${uuid.v4()}`
    },
    period: {
      start: formatDateTimeWithTimezone(pv1Segment[44] || evnSegment?.[2])
    },
    extension: []
  };
  
  // Identifiant VN si PV1-19
  if (pv1Segment[19]) {
    encounter.identifier = [{
      use: 'official',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'VN'
        }]
      },
      system: 'urn:oid:1.2.250.1.71.4.2.7',
      value: Array.isArray(pv1Segment[19]) ? pv1Segment[19][0] : pv1Segment[19]
    }];
  }
  
  // Extension mode prise en charge
  const modePriseEnCharge = pv1Segment[2] === 'I' ? 'IMP' : pv1Segment[2] === 'E' ? 'EMER' : 'AMB';
  encounter.extension.push({
    url: 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-mode-prise-en-charge',
    valueCodeableConcept: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: modePriseEnCharge
      }]
    }
  });
  
  // CORRECTION FR-CORE: Hospitalization avec preAdmissionIdentifier conforme
  if (pv1Segment[2] === 'I') {
    encounter.hospitalization = {
      preAdmissionIdentifier: {
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'VN'
          }]
        },
        system: 'urn:oid:1.2.250.1.71.4.2.2',
        value: pv1Segment[5] || '562214068'
      },
      expectedDischargeDate: formatDateTimeWithTimezone(new Date(Date.now() + 24*60*60*1000)),
      origin: {
        coding: [{
          system: 'https://mos.esante.gouv.fr/NOS/TRE_R213-LieuDePriseEnCharge/FHIR/TRE-R213-LieuDePriseEnCharge',
          code: '01'
        }]
      },
      destination: {
        coding: [{
          system: 'https://mos.esante.gouv.fr/NOS/TRE_R213-LieuDePriseEnCharge/FHIR/TRE-R213-LieuDePriseEnCharge',
          code: '02'
        }]
      }
    };
  }
  
  return {
    fullUrl: `urn:uuid:${encounterId}`,
    resource: encounter
  };
}

/**
 * Créer Location depuis PV1-3
 */
function createLocation(pv1Segment) {
  const locationId = uuid.v4();
  
  const location = {
    resourceType: 'Location',
    id: locationId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-location']
    },
    status: 'active',
    name: Array.isArray(pv1Segment[3]) ? pv1Segment[3][0] : pv1Segment[3],
    identifier: [{
      use: 'official',
      system: 'urn:oid:1.2.250.1.71.4.2.7',
      value: Array.isArray(pv1Segment[3]) ? pv1Segment[3][0] : pv1Segment[3]
    }]
  };
  
  return {
    fullUrl: `urn:uuid:${locationId}`,
    resource: location
  };
}

/**
 * Créer Practitioners depuis PV1 (FR-Core conforme)
 */
function createPractitioners(pv1Segment) {
  const practitioners = [];
  
  // PV1-7 (Attending Doctor)
  if (pv1Segment[7]) {
    practitioners.push(createPractitioner(pv1Segment[7], 'attending'));
  }
  
  // PV1-8 (Referring Doctor)
  if (pv1Segment[8]) {
    practitioners.push(createPractitioner(pv1Segment[8], 'referring'));
  }
  
  // PV1-9 (Consulting Doctor)
  if (pv1Segment[9]) {
    practitioners.push(createPractitioner(pv1Segment[9], 'consulting'));
  }
  
  // PV1-17 (Admitting Doctor)
  if (pv1Segment[17]) {
    practitioners.push(createPractitioner(pv1Segment[17], 'admitting'));
  }
  
  return practitioners;
}

/**
 * Créer un Practitioner individuel
 */
function createPractitioner(practitionerField, role) {
  const practitionerId = uuid.v4();
  
  let name = '';
  let identifier = '';
  
  if (Array.isArray(practitionerField)) {
    identifier = practitionerField[0] || '';
    name = practitionerField[1] || '';
  } else if (typeof practitionerField === 'string') {
    const parts = practitionerField.split('^');
    identifier = parts[0] || '';
    name = parts[1] || '';
  }
  
  // CORRECTION FR-CORE: Identifiant value en string (pas array) + code IDNPS
  const practitioner = {
    resourceType: 'Practitioner',
    id: `practitioner-${identifier}`,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-practitioner']
    },
    identifier: [{
      use: 'official',
      type: {
        coding: [{
          system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-v2-0203',
          code: 'IDNPS'
        }]
      },
      system: 'urn:oid:1.2.250.1.71.4.2.1',
      value: identifier.toString()
    }],
    name: [{
      use: 'official',
      text: name
    }]
  };
  
  return {
    fullUrl: `urn:uuid:practitioner-${identifier}`,
    resource: practitioner
  };
}

/**
 * Créer RelatedPersons depuis NK1 (FR-Core conforme)
 */
function createRelatedPersons(nk1Segments) {
  const relatedPersons = [];
  
  if (!Array.isArray(nk1Segments)) {
    nk1Segments = [nk1Segments];
  }
  
  nk1Segments.forEach(nk1 => {
    if (nk1 && nk1.length > 2) {
      relatedPersons.push(createRelatedPerson(nk1));
    }
  });
  
  return relatedPersons;
}

/**
 * Créer un RelatedPerson individuel
 */
function createRelatedPerson(nk1Segment) {
  const relatedPersonId = uuid.v4();
  
  // Nom depuis NK1-2
  const names = [];
  if (nk1Segment[2]) {
    const nameField = Array.isArray(nk1Segment[2]) ? nk1Segment[2] : [nk1Segment[2]];
    if (nameField.length >= 2) {
      names.push({
        use: 'official',
        family: nameField[0],
        given: [nameField[1]]
      });
    }
  }
  
  // Relation depuis NK1-3
  let relationshipCode = 'other';
  if (nk1Segment[3] && Array.isArray(nk1Segment[3])) {
    const relationField = nk1Segment[3][3] || nk1Segment[3][0];
    if (relationField === 'MERE' || relationField === 'M') {
      relationshipCode = 'mother';
    } else if (relationField === 'PERE' || relationField === 'P') {
      relationshipCode = 'father';
    }
  }
  
  const relatedPerson = {
    resourceType: 'RelatedPerson',
    id: relatedPersonId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-related-person']
    },
    patient: {
      reference: `urn:uuid:patient-${uuid.v4()}`
    },
    relationship: [{
      coding: [{
        system: 'https://hl7.fr/ig/fhir/core/ValueSet/fr-core-vs-patient-contact-role',
        code: relationshipCode
      }]
    }],
    name: names
  };
  
  // CORRECTION R4: Telecom.value en string (jamais array)
  if (nk1Segment[5]) {
    let phoneValue = '';
    if (Array.isArray(nk1Segment[5])) {
      // Extraire le numéro du format complexe HL7
      const phoneField = nk1Segment[5].find(field => 
        Array.isArray(field) && field.length > 2 && /^\d+$/.test(field[0])
      );
      phoneValue = phoneField ? phoneField[0] : nk1Segment[5][0];
    } else {
      phoneValue = nk1Segment[5].toString();
    }
    
    if (phoneValue) {
      relatedPerson.telecom = [{
        system: 'phone',
        value: phoneValue,
        use: 'home'
      }];
    }
  }
  
  // Adresse depuis NK1-4
  if (nk1Segment[4]) {
    const addressField = Array.isArray(nk1Segment[4]) ? nk1Segment[4][0] : nk1Segment[4];
    if (typeof addressField === 'string') {
      const addressParts = addressField.split('^');
      relatedPerson.address = [{
        use: 'home',
        line: [addressParts[0] || 'UNK'],
        city: addressParts[2] || 'UNK',
        postalCode: addressParts[4] || 'UNK',
        country: addressParts[5] || 'FRA'
      }];
    }
  }
  
  return {
    fullUrl: `urn:uuid:${relatedPersonId}`,
    resource: relatedPerson
  };
}

/**
 * Créer Coverage depuis IN1 + IN2 (FR-Core conforme)
 */
function createCoverage(in1Segment, in2Segment = null) {
  const coverageId = uuid.v4();
  const payorOrgId = uuid.v4();
  
  const coverage = {
    resourceType: 'Coverage',
    id: coverageId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-coverage']
    },
    status: 'active',
    type: {
      coding: [{
        system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-coverage-type',
        code: 'AMO'
      }]
    },
    beneficiary: {
      reference: `urn:uuid:patient-${uuid.v4()}`
    },
    payor: [{
      reference: `urn:uuid:organization-${payorOrgId}`
    }]
  };
  
  // CORRECTION FR-CORE: Extension avec URL canonique v2.1.0 correcte
  if (in1Segment && in1Segment[36]) {
    coverage.extension = [{
      url: 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-coverage-insured-id',
      valueIdentifier: {
        system: 'urn:oid:1.2.250.1.213.1.4.8',
        value: in1Segment[36].toString()
      }
    }];
  }
  
  // CORRECTION R4: Identifier sans type memberid invalide
  if (in1Segment && in1Segment[2]) {
    coverage.identifier = [{
      use: 'official',
      system: 'urn:oid:1.2.250.1.71.4.2.2',
      value: in1Segment[2].toString()
    }];
  }
  
  // Organization payor
  const payorOrganization = {
    resourceType: 'Organization',
    id: payorOrgId,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-organization']
    },
    active: true,
    name: 'Assurance Maladie Obligatoire',
    identifier: [{
      use: 'official',
      system: 'urn:oid:1.2.250.1.71.4.2.2',
      value: 'AMO-CPAM'
    }]
  };
  
  return [
    {
      fullUrl: `urn:uuid:${coverageId}`,
      resource: coverage
    },
    {
      fullUrl: `urn:uuid:organization-${payorOrgId}`,
      resource: payorOrganization
    }
  ];
}

/**
 * Fonctions utilitaires pour formats de dates
 */
function formatDate(dateString) {
  if (!dateString) return null;
  
  const dateStr = dateString.toString();
  if (dateStr.length === 8) {
    return `${dateStr.substr(0,4)}-${dateStr.substr(4,2)}-${dateStr.substr(6,2)}`;
  }
  return null;
}

function formatDateTime(dateTimeString) {
  if (!dateTimeString) return null;
  
  const dateStr = dateTimeString.toString();
  if (dateStr.length >= 8) {
    const date = formatDate(dateStr.substr(0,8));
    if (dateStr.length > 8) {
      const time = dateStr.substr(8);
      return `${date}T${time.substr(0,2)}:${time.substr(2,2)}:${time.substr(4,2)}`;
    }
    return date;
  }
  return null;
}

/**
 * CORRECTION R4: Formater DateTime avec fuseau horaire obligatoire
 */
function formatDateTimeWithTimezone(input) {
  if (!input) return null;
  
  let date;
  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'string') {
    // Format HL7: YYYYMMDDHHMMSS
    const dateStr = input.toString();
    if (dateStr.length >= 8) {
      const year = dateStr.substr(0,4);
      const month = dateStr.substr(4,2);
      const day = dateStr.substr(6,2);
      const hour = dateStr.substr(8,2) || '00';
      const minute = dateStr.substr(10,2) || '00';
      const second = dateStr.substr(12,2) || '00';
      date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    } else {
      date = new Date(input);
    }
  } else {
    date = new Date();
  }
  
  // Format ISO avec fuseau +02:00 (Europe/Paris)
  return date.toISOString().replace('Z', '+02:00');
}

// Stubs pour handlers SIU/ORM/ORU (à implémenter) - CORRECTION: suppression request
function createAppointment(schSegment, nteSegment) {
  // TODO: Implémenter Appointment pour SIU
  return {
    fullUrl: `urn:uuid:${uuid.v4()}`,
    resource: { resourceType: 'Appointment', status: 'booked' }
  };
}

function createServiceRequest(orcSegment, obrSegment) {
  // TODO: Implémenter ServiceRequest pour ORM
  return {
    fullUrl: `urn:uuid:${uuid.v4()}`,
    resource: { resourceType: 'ServiceRequest', status: 'active' }
  };
}

function createDiagnosticReport(obrSegment, obxSegments) {
  // TODO: Implémenter DiagnosticReport pour ORU
  return {
    fullUrl: `urn:uuid:${uuid.v4()}`,
    resource: { resourceType: 'DiagnosticReport', status: 'final' }
  };
}

function createObservations(obxSegments) {
  // TODO: Implémenter Observations pour ORU
  return [{
    fullUrl: `urn:uuid:${uuid.v4()}`,
    resource: { resourceType: 'Observation', status: 'final' }
  }];
}

// Stubs pour handlers supplémentaires
function createPractitionerRoles(rolSegments) { return []; }
function createPractitionersFromAIP(aipSegments) { return []; }
function createLocationsFromAIL(ailSegments) { return []; }
function createResourcesFromAIS(aisSegments) { return []; }
function createPractitionersFromOBR(obrSegment) { return []; }

module.exports = {
  createMessageHeader,
  createPatient,
  createEncounter,
  createLocation,
  createPractitioners,
  createPractitioner,
  createRelatedPersons,
  createCoverage,
  createAppointment,
  createServiceRequest,
  createDiagnosticReport,
  createObservations,
  createPractitionerRoles,
  createPractitionersFromAIP,
  createLocationsFromAIL,
  createResourcesFromAIS,
  createPractitionersFromOBR,
  formatDate,
  formatDateTime,
  formatDateTimeWithTimezone
};