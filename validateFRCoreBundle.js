/**
 * Validateur automatique de conformité FR Core pour les Bundles FHIR
 * Basé sur les spécifications officielles HL7 France
 */

const fs = require('fs');
const path = require('path');

// Configuration de validation FR Core
const frCoreChecklist = {
  "Patient": {
    "identifier": {
      "PI": {
        "system": "urn:oid:1.2.250.1.71.4.2.7",
        "use": "usual",
        "type.code": "PI"
      },
      "NIR": {
        "use": "official",
        "type.code": "NH",
        "meta.profile": "https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient-ins"
      }
    },
    "extension.identityReliability": {
      "url": "https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-identity-reliability"
    },
    "telecom": {
      "system": ["phone", "email"]
    },
    "address": {
      "minFields": ["line", "city", "postalCode", "country"],
      "noEmptyPostal": true
    }
  },
  "Encounter": {
    "identifier": {
      "VN": {
        "system": "urn:oid:1.2.250.1.71.4.2.7",
        "type.code": "VN"
      }
    },
    "serviceProvider": {
      "mustReferenceOrganization": true
    },
    "extension": {
      "estimatedDischargeDate": {
        "url": "https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-estimated-discharge-date"
      }
    },
    "hospitalization": {
      "origin.codeableConcept": "TRE_R213",
      "destination.codeableConcept": "TRE_R213"
    }
  },
  "Practitioner": {
    "id": {
      "pattern": "^[A-Za-z0-9\\-\\.]{1,64}$"
    },
    "identifier": {
      "idNatPs": {
        "type.code": ["IDNPS", "RPPS"],
        "system": "urn:oid:1.2.250.1.71.4.2.1"
      },
      "rpps": {
        "system": "https://rpps.esante.gouv.fr",
        "length": 11
      }
    },
    "name": {
      "mustSeparate": ["family", "given", "suffix"]
    }
  },
  "PractitionerRole": {
    "required": true,
    "code": {
      "system": "http://interopsante.org/fhir/CodeSystem/tre-r94"
    }
  },
  "RelatedPerson": {
    "identifier.required": true,
    "telecom.required": true,
    "address.required": true,
    "meta.profile": "https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-related-person",
    "relationship": {
      "system": "https://hl7.fr/ig/fhir/core/ValueSet/fr-core-vs-patient-contact-role",
      "code": "other"
    }
  },
  "Coverage": {
    "identifier.memberid": {
      "slice": "memberid",
      "0..1": true
    },
    "period.end": "IN1-36",
    "payor.required": true,
    "meta.profile": "https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-coverage"
  }
};

class FRCoreValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validationResults = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    };
  }

  validateBundle(bundle) {
    console.log('[FR-CORE-VALIDATOR] Début de la validation du Bundle FHIR...');
    
    if (!bundle || !bundle.entry) {
      this.addError('Bundle invalide ou vide');
      return this.getResults();
    }

    bundle.entry.forEach((entry, index) => {
      if (entry.resource) {
        this.validateResource(entry.resource, index);
      }
    });

    return this.getResults();
  }

  validateResource(resource, index) {
    const resourceType = resource.resourceType;
    console.log(`[FR-CORE-VALIDATOR] Validation ${resourceType} #${index}...`);

    switch (resourceType) {
      case 'Patient':
        this.validatePatient(resource, index);
        break;
      case 'Encounter':
        this.validateEncounter(resource, index);
        break;
      case 'Practitioner':
        this.validatePractitioner(resource, index);
        break;
      case 'PractitionerRole':
        this.validatePractitionerRole(resource, index);
        break;
      case 'RelatedPerson':
        this.validateRelatedPerson(resource, index);
        break;
      case 'Coverage':
        this.validateCoverage(resource, index);
        break;
      default:
        this.validationResults.total++;
        this.validationResults.passed++;
        break;
    }
  }

  validatePatient(patient, index) {
    this.validationResults.total++;
    let passed = true;

    // Validation des identifiants
    if (patient.identifier) {
      patient.identifier.forEach(id => {
        if (id.type && id.type.coding) {
          const typeCode = id.type.coding[0].code;
          
          // Validation PI (identifiant interne)
          if (typeCode === 'PI') {
            if (id.system !== 'urn:oid:1.2.250.1.71.4.2.7') {
              this.addError(`Patient #${index}: Identifiant PI doit utiliser system "urn:oid:1.2.250.1.71.4.2.7"`);
              passed = false;
            }
            if (id.use !== 'usual') {
              this.addWarning(`Patient #${index}: Identifiant PI devrait avoir use "usual"`);
            }
          }
          
          // Validation NIR
          if (typeCode === 'NH') {
            if (id.use !== 'official') {
              this.addError(`Patient #${index}: Identifiant NIR doit avoir use "official"`);
              passed = false;
            }
            // Vérification du profil INS dans meta
            if (!patient.meta || !patient.meta.profile || 
                !patient.meta.profile.includes('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient-ins')) {
              this.addError(`Patient #${index}: NIR nécessite le profil fr-core-patient-ins dans meta.profile`);
              passed = false;
            }
          }
        }
      });
    }

    // Validation de l'extension fiabilité d'identité
    if (patient.extension) {
      const reliabilityExt = patient.extension.find(ext => 
        ext.url === 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-identity-reliability'
      );
      if (!reliabilityExt) {
        this.addWarning(`Patient #${index}: Extension fr-core-identity-reliability recommandée`);
      }
    }

    // Validation telecom
    if (patient.telecom) {
      patient.telecom.forEach(tel => {
        if (tel.system && !['phone', 'email', 'fax', 'pager', 'url', 'sms'].includes(tel.system)) {
          this.addError(`Patient #${index}: telecom.system "${tel.system}" invalide, utiliser "phone" ou "email"`);
          passed = false;
        }
      });
    }

    // Validation adresse
    if (patient.address) {
      patient.address.forEach(addr => {
        if (!addr.line || !addr.city || !addr.postalCode || !addr.country) {
          this.addError(`Patient #${index}: Adresse incomplète, requis: line, city, postalCode, country`);
          passed = false;
        }
        if (addr.postalCode === '') {
          this.addError(`Patient #${index}: postalCode ne peut pas être vide`);
          passed = false;
        }
      });
    }

    if (passed) {
      this.validationResults.passed++;
    } else {
      this.validationResults.failed++;
    }
  }

  validateEncounter(encounter, index) {
    this.validationResults.total++;
    let passed = true;

    // Validation des identifiants VN
    if (encounter.identifier) {
      const vnIdentifier = encounter.identifier.find(id => 
        id.type && id.type.coding && id.type.coding[0].code === 'VN'
      );
      if (vnIdentifier) {
        if (vnIdentifier.system !== 'urn:oid:1.2.250.1.71.4.2.7') {
          this.addError(`Encounter #${index}: Identifiant VN doit utiliser system "urn:oid:1.2.250.1.71.4.2.7"`);
          passed = false;
        }
      }
    }

    // Validation serviceProvider
    if (encounter.serviceProvider && !encounter.serviceProvider.reference) {
      this.addError(`Encounter #${index}: serviceProvider doit référencer une Organization existante`);
      passed = false;
    }

    // Validation hospitalization
    if (encounter.hospitalization) {
      if (encounter.hospitalization.origin && !encounter.hospitalization.origin.coding) {
        this.addError(`Encounter #${index}: hospitalization.origin doit être un CodeableConcept (TRE_R213)`);
        passed = false;
      }
      if (encounter.hospitalization.destination && !encounter.hospitalization.destination.coding) {
        this.addError(`Encounter #${index}: hospitalization.destination doit être un CodeableConcept (TRE_R213)`);
        passed = false;
      }
    }

    if (passed) {
      this.validationResults.passed++;
    } else {
      this.validationResults.failed++;
    }
  }

  validatePractitioner(practitioner, index) {
    this.validationResults.total++;
    let passed = true;

    // Validation de l'ID
    if (practitioner.id && !/^[A-Za-z0-9\-\.]{1,64}$/.test(practitioner.id)) {
      this.addError(`Practitioner #${index}: ID invalide, doit correspondre à [A-Za-z0-9\\-\\.]{1,64}`);
      passed = false;
    }

    // Validation des identifiants
    if (practitioner.identifier) {
      let hasIdNatPs = false;
      let hasRpps = false;

      practitioner.identifier.forEach(id => {
        if (id.type && id.type.coding) {
          const typeCode = id.type.coding[0].code;
          
          // Validation IDNPS/RPPS
          if (['IDNPS', 'RPPS'].includes(typeCode)) {
            hasIdNatPs = true;
            if (id.system !== 'urn:oid:1.2.250.1.71.4.2.1') {
              this.addError(`Practitioner #${index}: Identifiant ${typeCode} doit utiliser system "urn:oid:1.2.250.1.71.4.2.1"`);
              passed = false;
            }
          }

          // Validation RPPS spécifique
          if (typeCode === 'RPPS') {
            hasRpps = true;
            if (id.value && id.value.length !== 11) {
              this.addError(`Practitioner #${index}: RPPS doit contenir 11 chiffres`);
              passed = false;
            }
          }
        }
      });

      if (!hasIdNatPs) {
        this.addError(`Practitioner #${index}: Identifiant IDNPS ou RPPS requis`);
        passed = false;
      }
    }

    // Validation du nom
    if (practitioner.name && practitioner.name[0]) {
      const name = practitioner.name[0];
      if (!name.family || !name.given) {
        this.addError(`Practitioner #${index}: name.family et name.given doivent être séparés`);
        passed = false;
      }
    }

    if (passed) {
      this.validationResults.passed++;
    } else {
      this.validationResults.failed++;
    }
  }

  validatePractitionerRole(practitionerRole, index) {
    this.validationResults.total++;
    let passed = true;

    // Validation du code professionnel
    if (practitionerRole.code) {
      const hasValidCode = practitionerRole.code.some(code => 
        code.coding && code.coding.some(coding => 
          coding.system === 'http://interopsante.org/fhir/CodeSystem/tre-r94'
        )
      );
      if (!hasValidCode) {
        this.addError(`PractitionerRole #${index}: code doit utiliser le système TRE-R94`);
        passed = false;
      }
    }

    if (passed) {
      this.validationResults.passed++;
    } else {
      this.validationResults.failed++;
    }
  }

  validateRelatedPerson(relatedPerson, index) {
    this.validationResults.total++;
    let passed = true;

    // Validation du profil
    if (!relatedPerson.meta || !relatedPerson.meta.profile || 
        !relatedPerson.meta.profile.includes('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-related-person')) {
      this.addError(`RelatedPerson #${index}: Profil fr-core-related-person requis dans meta.profile`);
      passed = false;
    }

    // Validation des champs requis
    if (!relatedPerson.identifier || relatedPerson.identifier.length === 0) {
      this.addError(`RelatedPerson #${index}: identifier requis`);
      passed = false;
    }

    if (!relatedPerson.telecom || relatedPerson.telecom.length === 0) {
      this.addError(`RelatedPerson #${index}: telecom requis`);
      passed = false;
    }

    if (!relatedPerson.address || relatedPerson.address.length === 0) {
      this.addError(`RelatedPerson #${index}: address requis`);
      passed = false;
    }

    // Validation de la relation
    if (relatedPerson.relationship) {
      const hasValidRelation = relatedPerson.relationship.some(rel => 
        rel.coding && rel.coding.some(coding => 
          coding.system === 'https://hl7.fr/ig/fhir/core/ValueSet/fr-core-vs-patient-contact-role'
        )
      );
      if (!hasValidRelation) {
        this.addWarning(`RelatedPerson #${index}: Relation devrait utiliser le ValueSet fr-core-vs-patient-contact-role`);
      }
    }

    if (passed) {
      this.validationResults.passed++;
    } else {
      this.validationResults.failed++;
    }
  }

  validateCoverage(coverage, index) {
    this.validationResults.total++;
    let passed = true;

    // Validation du profil
    if (!coverage.meta || !coverage.meta.profile || 
        !coverage.meta.profile.includes('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-coverage')) {
      this.addError(`Coverage #${index}: Profil fr-core-coverage requis dans meta.profile`);
      passed = false;
    }

    // Validation du payor
    if (!coverage.payor || coverage.payor.length === 0) {
      this.addError(`Coverage #${index}: payor requis`);
      passed = false;
    }

    // Validation de l'identifiant memberid
    if (coverage.identifier) {
      const memberIdExists = coverage.identifier.some(id => 
        id.type && id.type.coding && id.type.coding[0].code === 'memberid'
      );
      if (!memberIdExists) {
        this.addWarning(`Coverage #${index}: Identifiant memberid recommandé (slice 0..1)`);
      }
    }

    if (passed) {
      this.validationResults.passed++;
    } else {
      this.validationResults.failed++;
    }
  }

  addError(message) {
    this.errors.push(message);
    console.log(`❌ ERREUR: ${message}`);
  }

  addWarning(message) {
    this.warnings.push(message);
    this.validationResults.warnings++;
    console.log(`⚠️  AVERTISSEMENT: ${message}`);
  }

  getResults() {
    console.log('\n[FR-CORE-VALIDATOR] Résultats de la validation:');
    console.log(`✅ Validations réussies: ${this.validationResults.passed}/${this.validationResults.total}`);
    console.log(`❌ Validations échouées: ${this.validationResults.failed}/${this.validationResults.total}`);
    console.log(`⚠️  Avertissements: ${this.validationResults.warnings}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERREURS DÉTECTÉES:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  AVERTISSEMENTS:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    const isValid = this.validationResults.failed === 0;
    console.log(`\n🎯 CONFORMITÉ FR CORE: ${isValid ? '✅ CONFORME' : '❌ NON CONFORME'}`);
    
    return {
      valid: isValid,
      results: this.validationResults,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}

// Fonction principale pour validation via CLI
function validateFromFile(filePath) {
  try {
    const bundleContent = fs.readFileSync(filePath, 'utf8');
    const bundle = JSON.parse(bundleContent);
    
    const validator = new FRCoreValidator();
    const results = validator.validateBundle(bundle);
    
    // Code de sortie pour CI/CD
    process.exit(results.valid ? 0 : 1);
  } catch (error) {
    console.error(`❌ Erreur lors de la validation du fichier ${filePath}:`, error.message);
    process.exit(1);
  }
}

// Export pour utilisation en module
module.exports = { FRCoreValidator, validateFromFile };

// Utilisation CLI si exécuté directement
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: node validateFRCoreBundle.js <bundle.json>');
    process.exit(1);
  }
  validateFromFile(filePath);
}