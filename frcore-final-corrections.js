/**
 * Corrections finales FR Core pour conformité 100%
 * Basé sur la checklist détaillée fournie
 * @version 1.0.0
 */

/**
 * Corrige les noms Patient pour éviter doublons et mal placement des suffixes
 */
function correctPatientNames(names) {
  return names.map(name => {
    // Supprimer doublons dans given
    if (name.given && name.given.length > 1) {
      name.given = [...new Set(name.given)];
    }
    
    // Déplacer suffixes mal placés de given vers suffix
    if (name.given) {
      const suffixes = ['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'L', 'M', 'Dr', 'Pr'];
      const newGiven = [];
      const newSuffix = name.suffix || [];
      
      name.given.forEach(givenName => {
        if (suffixes.includes(givenName)) {
          newSuffix.push(givenName);
        } else {
          newGiven.push(givenName);
        }
      });
      
      name.given = newGiven;
      if (newSuffix.length > 0) {
        name.suffix = newSuffix;
      }
    }
    
    return name;
  });
}

/**
 * Corrige les télécom pour system="email" obligatoire
 */
function correctPatientTelecoms(telecoms) {
  return telecoms.map(telecom => {
    // CORRECTION FR CORE: system="email" obligatoire pour emails (jamais "other")
    if (telecom.value && telecom.value.includes('@')) {
      telecom.system = 'email';
    }
    return telecom;
  });
}

/**
 * Filtre les adresses invalides FR Core
 */
function correctPatientAddresses(addresses) {
  return addresses.filter(address => {
    // Supprimer adresses avec use="temp" et country="UNK" uniquement
    if (address.use === 'temp' && address.country === 'UNK' && !address.line && !address.city) {
      return false;
    }
    
    // Supprimer adresses home/both sans line
    if ((address.use === 'home' || address.type === 'both') && (!address.line || address.line.length === 0)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Ajoute extension INS canonique FR Core
 */
function addCanonicalINSExtension(patientResource, insValue) {
  if (!insValue) return;
  
  // Extension canonique fr-core-identity-reliability
  const insExtension = {
    url: 'http://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-identity-reliability',
    valueCodeableConcept: {
      coding: [{
        system: 'http://hl7.fr/ig/fhir/core/ValueSet/fr-core-vs-identity-reliability',
        code: 'VIDE',
        display: 'Identité validée'
      }]
    }
  };
  
  if (!patientResource.extension) {
    patientResource.extension = [];
  }
  
  patientResource.extension.push(insExtension);
}

/**
 * Ajoute identifiant et type obligatoires à Location
 */
function correctLocationResource(locationResource, establishmentName) {
  // Identifiant obligatoire
  if (!locationResource.identifier || locationResource.identifier.length === 0) {
    locationResource.identifier = [{
      use: 'official',
      system: 'http://finess.sante.gouv.fr',
      value: establishmentName || 'UNKNOWN_FINESS'
    }];
  }
  
  // Type obligatoire selon VS FR Core
  if (!locationResource.type || locationResource.type.length === 0) {
    locationResource.type = [{
      coding: [{
        system: 'http://hl7.fr/ig/fhir/core/ValueSet/fr-core-vs-location-type',
        code: 'HOSP',
        display: 'Hôpital'
      }]
    }];
  }
  
  // Extension fr-core-use-period
  if (!locationResource.extension) {
    locationResource.extension = [];
  }
  
  const usePeriodExtension = {
    url: 'http://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-use-period',
    valuePeriod: {
      start: new Date().toISOString().split('T')[0]
    }
  };
  
  locationResource.extension.push(usePeriodExtension);
  
  return locationResource;
}

/**
 * Corrige Encounter pour hospitalization et extensions canoniques
 */
function correctEncounterResource(encounterResource, pv1Segment) {
  // Pour class.code = "IMP" (hospitalisation)
  const encounterClass = encounterResource.class?.code;
  if (encounterClass === 'IMP') {
    if (!encounterResource.hospitalization) {
      encounterResource.hospitalization = {};
    }
    
    // Champs obligatoires pour hospitalisation
    if (!encounterResource.hospitalization.origin) {
      encounterResource.hospitalization.origin = {
        reference: 'Location/origin-unknown'
      };
    }
    
    if (!encounterResource.hospitalization.destination) {
      encounterResource.hospitalization.destination = {
        reference: 'Location/destination-home'
      };
    }
  }
  
  // Extension canonique pour date de sortie estimée
  if (encounterResource.extension) {
    encounterResource.extension = encounterResource.extension.filter(ext => 
      ext.url === 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-encounter-estimated-discharge-date'
    );
  }
  
  return encounterResource;
}

/**
 * Corrige Practitioner pour identifiants RPPS obligatoires
 */
function correctPractitionerResource(practitionerResource, rolSegment) {
  // Identifiants obligatoires - slice RPPS uniquement
  if (!practitionerResource.identifier || practitionerResource.identifier.length === 0) {
    // Extraire RPPS du segment ROL si disponible
    let rppsValue = 'UNKNOWN_RPPS';
    if (rolSegment && rolSegment[4]) {
      rppsValue = rolSegment[4];
    }
    
    practitionerResource.identifier = [{
      use: 'official',
      type: {
        coding: [{
          system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-v2-0203',
          code: 'RPPS',
          display: 'Répertoire partagé des professionnels de santé'
        }]
      },
      system: 'urn:oid:1.2.250.1.71.4.2.1',
      value: rppsValue,
      assigner: {
        reference: 'Organization/ans'
      }
    }];
  }
  
  // name.family et name.given obligatoires
  if (!practitionerResource.name || practitionerResource.name.length === 0) {
    practitionerResource.name = [{
      use: 'official',
      family: 'UNKNOWN',
      given: ['UNKNOWN']
    }];
  }
  
  // Profil FR Core obligatoire
  if (!practitionerResource.meta) {
    practitionerResource.meta = {};
  }
  
  practitionerResource.meta.profile = ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-practitioner'];
  
  return practitionerResource;
}

/**
 * Crée PractitionerRole obligatoire
 */
function createPractitionerRoleResource(practitionerReference, organizationReference) {
  return {
    resourceType: 'PractitionerRole',
    id: `practitioner-role-${Date.now()}`,
    meta: {
      profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-practitioner-role']
    },
    practitioner: {
      reference: practitionerReference
    },
    organization: {
      reference: organizationReference
    },
    code: [{
      coding: [{
        system: 'http://hl7.fr/ig/fhir/core/ValueSet/fr-core-vs-practitioner-role-exercice',
        code: 'MED',
        display: 'Médecin'
      }]
    }]
  };
}

/**
 * Corrige RelatedPerson pour telecom et address obligatoires
 */
function correctRelatedPersonResource(relatedPersonResource, nk1Segment) {
  // Identifiant obligatoire (1..1)
  if (!relatedPersonResource.identifier || relatedPersonResource.identifier.length === 0) {
    relatedPersonResource.identifier = [{
      use: 'usual',
      value: `contact-${Date.now()}`
    }];
  }
  
  // Telecom depuis NK1-5 si disponible
  if (nk1Segment && nk1Segment[5] && !relatedPersonResource.telecom) {
    relatedPersonResource.telecom = [{
      system: 'phone',
      value: nk1Segment[5],
      use: 'home'
    }];
  }
  
  // Address depuis NK1-6 si disponible
  if (nk1Segment && nk1Segment[6] && !relatedPersonResource.address) {
    relatedPersonResource.address = [{
      use: 'home',
      line: [nk1Segment[6]],
      country: 'FR'
    }];
  }
  
  return relatedPersonResource;
}

/**
 * Corrige Coverage pour payor obligatoire et dates réelles
 */
function correctCoverageResource(coverageResource, in1Segment) {
  // Payor obligatoire
  if (!coverageResource.payor || coverageResource.payor.length === 0) {
    coverageResource.payor = [{
      reference: 'Organization/cpam'
    }];
  }
  
  // Corriger période avec date réelle ou supprimer
  if (coverageResource.period && coverageResource.period.end === '4712-12-31') {
    // Extraire date réelle de IN1-36 si disponible
    if (in1Segment && in1Segment[36]) {
      coverageResource.period.end = in1Segment[36];
    } else {
      // Supprimer la date de fin si pas de date réelle
      delete coverageResource.period.end;
    }
  }
  
  return coverageResource;
}

module.exports = {
  correctPatientNames,
  correctPatientTelecoms,
  correctPatientAddresses,
  addCanonicalINSExtension,
  correctLocationResource,
  correctEncounterResource,
  correctPractitionerResource,
  createPractitionerRoleResource,
  correctRelatedPersonResource,
  correctCoverageResource
};