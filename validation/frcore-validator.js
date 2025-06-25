/**
 * Validateur FR-Core pour Bundles FHIR
 * Validation automatique contre profils français
 */

const frCoreDefinitions = require('../handlers/frcore-definitions.json');

/**
 * Valider un Bundle FHIR contre les profils FR-Core
 * @param {Object} bundle - Bundle FHIR à valider
 * @returns {Object} - Résultat de validation
 */
function validateFRCoreBundle(bundle) {
  const validationResult = {
    valid: true,
    errors: [],
    warnings: [],
    summary: {
      totalResources: 0,
      validatedResources: 0,
      profileConformance: {},
      sliceConformance: {},
      extensionConformance: {}
    }
  };
  
  try {
    if (!bundle || bundle.resourceType !== 'Bundle') {
      validationResult.valid = false;
      validationResult.errors.push('Resource is not a valid Bundle');
      return validationResult;
    }
    
    console.log('[FR-CORE-VALIDATOR] Validation Bundle FHIR contre profils FR-Core...');
    
    // Valider MessageHeader en première position
    if (bundle.entry && bundle.entry.length > 0) {
      const firstEntry = bundle.entry[0];
      if (firstEntry.resource?.resourceType !== 'MessageHeader') {
        validationResult.warnings.push('MessageHeader should be first resource in Bundle');
      } else {
        validateMessageHeader(firstEntry.resource, validationResult);
      }
    }
    
    // Valider chaque ressource du Bundle
    if (bundle.entry) {
      validationResult.summary.totalResources = bundle.entry.length;
      
      bundle.entry.forEach((entry, index) => {
        if (entry.resource) {
          console.log(`[FR-CORE-VALIDATOR] Validation ${entry.resource.resourceType} #${index}...`);
          validateResource(entry.resource, validationResult);
          validationResult.summary.validatedResources++;
        }
      });
    }
    
    // Rapport final
    console.log(`[FR-CORE-VALIDATOR] Validation terminée: ${validationResult.errors.length} erreurs, ${validationResult.warnings.length} avertissements`);
    
    if (validationResult.errors.length > 0) {
      validationResult.valid = false;
    }
    
    return validationResult;
    
  } catch (error) {
    validationResult.valid = false;
    validationResult.errors.push(`Erreur validation: ${error.message}`);
    return validationResult;
  }
}

/**
 * Valider MessageHeader
 */
function validateMessageHeader(messageHeader, result) {
  // Profil FR-Core
  if (!messageHeader.meta?.profile?.includes(frCoreDefinitions.profiles.MessageHeader.canonical)) {
    result.warnings.push('MessageHeader: Profil fr-core-message-header manquant');
  }
  
  // Champs obligatoires
  if (!messageHeader.eventCoding) {
    result.errors.push('MessageHeader: eventCoding obligatoire');
  }
  
  if (!messageHeader.destination || messageHeader.destination.length === 0) {
    result.errors.push('MessageHeader: destination obligatoire');
  }
  
  if (!messageHeader.source) {
    result.errors.push('MessageHeader: source obligatoire');
  }
}

/**
 * Valider une ressource individuelle
 */
function validateResource(resource, result) {
  const resourceType = resource.resourceType;
  
  switch (resourceType) {
    case 'Patient':
      validatePatient(resource, result);
      break;
    case 'Encounter':
      validateEncounter(resource, result);
      break;
    case 'Practitioner':
      validatePractitioner(resource, result);
      break;
    case 'RelatedPerson':
      validateRelatedPerson(resource, result);
      break;
    case 'Coverage':
      validateCoverage(resource, result);
      break;
    case 'Location':
      validateLocation(resource, result);
      break;
    case 'Organization':
      validateOrganization(resource, result);
      break;
    default:
      console.log(`[FR-CORE-VALIDATOR] Type ${resourceType} non validé spécifiquement`);
  }
}

/**
 * Valider Patient FR-Core
 */
function validatePatient(patient, result) {
  // Profil FR-Core obligatoire
  if (!patient.meta?.profile?.includes(frCoreDefinitions.profiles.Patient.canonical)) {
    result.errors.push('Patient: Profil fr-core-patient manquant');
  }
  
  // Vérifier slices identifiants
  if (patient.identifier) {
    let hasPI = false;
    let hasINS = false;
    
    patient.identifier.forEach(id => {
      const typeCode = id.type?.coding?.[0]?.code;
      
      if (typeCode === 'PI') {
        hasPI = true;
        if (id.system !== frCoreDefinitions.profiles.Patient.slices.identifier.PI.system) {
          result.errors.push(`Patient: Identifiant PI system incorrect (attendu: ${frCoreDefinitions.profiles.Patient.slices.identifier.PI.system})`);
        }
      }
      
      if (typeCode === 'INS-NIR') {
        hasINS = true;
        if (id.system !== frCoreDefinitions.profiles.Patient.slices.identifier['INS-NIR'].system) {
          result.errors.push(`Patient: Identifiant INS-NIR system incorrect (attendu: ${frCoreDefinitions.profiles.Patient.slices.identifier['INS-NIR'].system})`);
        }
        
        // Vérifier profil INS
        if (!patient.meta?.profile?.includes(frCoreDefinitions.profiles.PatientINS.canonical)) {
          result.warnings.push('Patient: Profil fr-core-patient-ins manquant pour patient avec INS');
        }
      }
    });
    
    if (!hasPI) {
      result.warnings.push('Patient: Identifiant PI recommandé');
    }
  }
  
  // Extension fiabilité obligatoire
  const reliabilityExt = patient.extension?.find(ext => 
    ext.url === frCoreDefinitions.extensions.identityReliability.url
  );
  
  if (!reliabilityExt) {
    result.errors.push('Patient: Extension fr-core-identity-reliability obligatoire');
  } else {
    const code = reliabilityExt.valueCodeableConcept?.coding?.[0]?.code;
    if (!['VALI', 'UNDI'].includes(code)) {
      result.errors.push('Patient: Extension fiabilité doit être VALI ou UNDI');
    }
  }
}

/**
 * Valider Encounter FR-Core
 */
function validateEncounter(encounter, result) {
  // Profil FR-Core obligatoire
  if (!encounter.meta?.profile?.includes(frCoreDefinitions.profiles.Encounter.canonical)) {
    result.errors.push('Encounter: Profil fr-core-encounter manquant');
  }
  
  // Identifiant VN si présent
  if (encounter.identifier) {
    encounter.identifier.forEach(id => {
      if (id.type?.coding?.[0]?.code === 'VN') {
        if (id.system !== frCoreDefinitions.profiles.Encounter.slices.identifier.VN.system) {
          result.errors.push(`Encounter: Identifiant VN system incorrect (attendu: ${frCoreDefinitions.profiles.Encounter.slices.identifier.VN.system})`);
        }
      }
    });
  }
  
  // Extension mode prise en charge
  const modePriseEnCharge = encounter.extension?.find(ext => 
    ext.url === frCoreDefinitions.extensions.modePriseEnCharge.url
  );
  
  if (!modePriseEnCharge) {
    result.warnings.push('Encounter: Extension fr-core-mode-prise-en-charge recommandée');
  }
  
  // Hospitalization pour classe IMP
  if (encounter.class?.code === 'IMP' && !encounter.hospitalization) {
    result.warnings.push('Encounter: Bloc hospitalization recommandé pour classe IMP');
  }
}

/**
 * Valider Practitioner FR-Core
 */
function validatePractitioner(practitioner, result) {
  // Profil FR-Core obligatoire
  if (!practitioner.meta?.profile?.includes(frCoreDefinitions.profiles.Practitioner.canonical)) {
    result.errors.push('Practitioner: Profil fr-core-practitioner manquant');
  }
  
  // Identifiant RPPS/ADELI
  if (practitioner.identifier) {
    let hasRPPS = false;
    
    practitioner.identifier.forEach(id => {
      const typeCode = id.type?.coding?.[0]?.code;
      
      if (typeCode === 'RPPS') {
        hasRPPS = true;
        if (id.system !== frCoreDefinitions.profiles.Practitioner.slices.identifier.RPPS.system) {
          result.errors.push(`Practitioner: Identifiant RPPS system incorrect (attendu: ${frCoreDefinitions.profiles.Practitioner.slices.identifier.RPPS.system})`);
        }
      }
    });
    
    if (!hasRPPS) {
      result.warnings.push('Practitioner: Identifiant RPPS recommandé');
    }
  }
}

/**
 * Valider RelatedPerson FR-Core
 */
function validateRelatedPerson(relatedPerson, result) {
  // Profil FR-Core obligatoire
  if (!relatedPerson.meta?.profile?.includes(frCoreDefinitions.profiles.RelatedPerson.canonical)) {
    result.errors.push('RelatedPerson: Profil fr-core-related-person manquant');
  }
  
  // Relationship obligatoire
  if (!relatedPerson.relationship || relatedPerson.relationship.length === 0) {
    result.errors.push('RelatedPerson: relationship obligatoire');
  } else {
    const relationshipCode = relatedPerson.relationship[0].coding?.[0]?.code;
    if (!Object.keys(frCoreDefinitions.valueSets.patientContactRole.codes).includes(relationshipCode)) {
      result.warnings.push(`RelatedPerson: Code relationship ${relationshipCode} non reconnu dans ValueSet FR-Core`);
    }
  }
  
  // Adresse obligatoire
  if (!relatedPerson.address || relatedPerson.address.length === 0) {
    result.warnings.push('RelatedPerson: address recommandé');
  }
}

/**
 * Valider Coverage FR-Core
 */
function validateCoverage(coverage, result) {
  // Profil FR-Core obligatoire
  if (!coverage.meta?.profile?.includes(frCoreDefinitions.profiles.Coverage.canonical)) {
    result.errors.push('Coverage: Profil fr-core-coverage manquant');
  }
  
  // Payor obligatoire
  if (!coverage.payor || coverage.payor.length === 0) {
    result.errors.push('Coverage: payor obligatoire');
  }
  
  // Type coverage
  if (coverage.type) {
    const typeCode = coverage.type.coding?.[0]?.code;
    if (!Object.keys(frCoreDefinitions.valueSets.coverageType.codes).includes(typeCode)) {
      result.warnings.push(`Coverage: Type ${typeCode} non reconnu dans ValueSet FR-Core`);
    }
  }
  
  // Extension insured-id
  const insuredIdExt = coverage.extension?.find(ext => 
    ext.url === frCoreDefinitions.extensions.coverageInsuredId.url
  );
  
  if (insuredIdExt) {
    const system = insuredIdExt.valueIdentifier?.system;
    if (system !== frCoreDefinitions.oids.insNir) {
      result.warnings.push(`Coverage: Extension insured-id system incorrect (attendu: ${frCoreDefinitions.oids.insNir})`);
    }
  }
}

/**
 * Valider Location FR-Core
 */
function validateLocation(location, result) {
  // Profil FR-Core obligatoire
  if (!location.meta?.profile?.includes(frCoreDefinitions.profiles.Location.canonical)) {
    result.errors.push('Location: Profil fr-core-location manquant');
  }
  
  // Status obligatoire
  if (!location.status) {
    result.errors.push('Location: status obligatoire');
  }
}

/**
 * Valider Organization FR-Core
 */
function validateOrganization(organization, result) {
  // Profil FR-Core obligatoire
  if (!organization.meta?.profile?.includes(frCoreDefinitions.profiles.Organization.canonical)) {
    result.errors.push('Organization: Profil fr-core-organization manquant');
  }
  
  // Active obligatoire
  if (organization.active === undefined) {
    result.warnings.push('Organization: active recommandé');
  }
}

/**
 * Résoudre URL FR-Core
 */
function resolveFRCoreUrl(resourceType, element) {
  const profile = frCoreDefinitions.profiles[resourceType];
  if (!profile) {
    return null;
  }
  
  if (element === 'profile') {
    return profile.canonical;
  }
  
  if (element.startsWith('identifier:')) {
    const sliceName = element.split(':')[1];
    return profile.slices?.identifier?.[sliceName];
  }
  
  return null;
}

module.exports = {
  validateFRCoreBundle,
  resolveFRCoreUrl
};