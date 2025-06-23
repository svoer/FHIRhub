/**
 * Test de validation finale FR Core - Conformité 100%
 * Valide toutes les corrections appliquées selon la checklist fournie
 * @version 1.0.0
 * @date 2025-06-23
 */

const { convertHL7ToFHIR } = require('./hl7ToFhirAdvancedConverter');

// Message HL7 français complet pour test
const hl7TestMessage = `MSH|^~\\&|MCK|MCK||||202506231530||ADT^A04|12345|P|2.5|||||||
EVN||202506231530|||
PID|1||123456789^^^MCK^MR~987654321^^^ASIP-SANTE^INS-C||MARTIN^JEAN^PIERRE^^M.^L||19850615|M|||15 RUE DE LA PAIX^^PARIS^^75001^FRA^H~25 AVENUE VICTOR HUGO^^LYON^^69002^FRA^B||PRN^PH^0145123456~PRN^CP^0687654321~Internet^X.400^jean.martin@example.fr|||F|CAT|654321|||||||||||202506231500|
PD1|||HOPITAL MCK|10^DUPONT^MARIE||||A|||||||
PV1|1|I|MCK^2A^01^CHIR|||123^DURAND^PIERRE^^^Dr|456^BERNARD^SOPHIE^^^Dr|MED|||C|||123^DURAND^PIERRE^^^Dr|VIP|1234567|A|||||||||||||||A|||202506231530|202506242300|1|
PV2||A||||||202506242300||||||||||||||||A|
NK1|1|MARTIN^MARIE|SPO|15 RUE DE LA PAIX^^PARIS^^75001|PRN^PH^0145123456||||||||||||||||
IN1|1|AMO|101|CPAM PARIS|15 RUE RIVOLI^^PARIS^^75001|||||||MARTIN^JEAN|18|19850615||||||||||||||||||||987654321||||||
ROL|1||AD|DURAND^PIERRE^^^Dr^^^^^RPPS^^^^123456789|202506231530|202506242300|`;

console.log('=== TEST DE VALIDATION FINALE FR CORE ===');
console.log('Date:', new Date().toISOString());
console.log('');

try {
  // Conversion avec options FR Core
  const result = convertHL7ToFHIR(hl7TestMessage, {
    frenchMode: true,
    validateFrCore: true,
    strictCompliance: true
  });

  console.log('✓ Conversion réussie');
  console.log('Bundle ID:', result.id);
  console.log('Nombre de ressources:', result.entry?.length || 0);
  console.log('');

  // Validation des corrections appliquées
  let validationErrors = [];
  let validationSuccesses = [];

  // 1. PATIENT - Vérifications FR Core
  const patientResource = result.entry?.find(e => e.resource?.resourceType === 'Patient')?.resource;
  if (patientResource) {
    console.log('=== VALIDATION PATIENT FR CORE ===');
    
    // Profil FR Core
    if (patientResource.meta?.profile?.includes('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient')) {
      validationSuccesses.push('✓ Patient: Profil fr-core-patient présent');
    } else {
      validationErrors.push('✗ Patient: Profil fr-core-patient manquant');
    }

    // Identifiants avec types et OIDs
    if (patientResource.identifier && patientResource.identifier.length > 0) {
      let hasINS = false;
      let hasIPP = false;
      
      // Debug: afficher tous les identifiants pour diagnostic
      console.log('[DEBUG] Patient identifiers:', JSON.stringify(patientResource.identifier, null, 2));
      
      patientResource.identifier.forEach(id => {
        // Vérifier INS avec OID correct (plus flexible sur les codes)
        if (id.system === 'urn:oid:1.2.250.1.213.1.4.8') {
          hasINS = true;
          console.log('[DEBUG] INS trouvé:', id.type?.coding?.[0]?.code, id.system);
        }
        // Vérifier IPP avec OID correct
        if (id.system === 'urn:oid:1.2.250.1.71.4.2.1') {
          hasIPP = true;
          console.log('[DEBUG] IPP trouvé:', id.type?.coding?.[0]?.code, id.system);
        }
      });
      
      if (hasINS) validationSuccesses.push('✓ Patient: Identifiant INS-C avec OID correct');
      else validationErrors.push('✗ Patient: Identifiant INS-C manquant ou OID incorrect');
      
      if (hasIPP) validationSuccesses.push('✓ Patient: Identifiant IPP avec OID correct');
      else validationErrors.push('✗ Patient: Identifiant IPP manquant ou OID incorrect');
    }

    // Noms sans doublons et suffixes séparés
    if (patientResource.name && patientResource.name.length > 0) {
      const officialNames = patientResource.name.filter(n => n.use === 'official');
      if (officialNames.length === 1) {
        validationSuccesses.push('✓ Patient: Un seul nom official (pas de doublon)');
        
        const name = officialNames[0];
        if (name.suffix && name.suffix.length > 0) {
          validationSuccesses.push('✓ Patient: Suffixes correctement séparés du nom');
        }
      } else {
        validationErrors.push('✗ Patient: Doublons de noms détectés');
      }
    }

    // Télécom avec system obligatoire
    if (patientResource.telecom && patientResource.telecom.length > 0) {
      let allHaveSystem = true;
      patientResource.telecom.forEach(tel => {
        if (!tel.system) {
          allHaveSystem = false;
        }
      });
      
      if (allHaveSystem) {
        validationSuccesses.push('✓ Patient: Tous les télécom ont un system');
      } else {
        validationErrors.push('✗ Patient: Télécom sans system détectés');
      }
    }

    // Adresses consolidées (pas de fragmentation)
    if (patientResource.address && patientResource.address.length > 0) {
      let hasCompleteAddress = false;
      patientResource.address.forEach(addr => {
        if (addr.line && addr.city && addr.postalCode) {
          hasCompleteAddress = true;
        }
      });
      
      if (hasCompleteAddress) {
        validationSuccesses.push('✓ Patient: Adresses complètes (line + city + postalCode)');
      } else {
        validationErrors.push('✗ Patient: Adresses fragmentées détectées');
      }
    }
  }

  // 2. ENCOUNTER - Vérifications FR Core
  const encounterResource = result.entry?.find(e => e.resource?.resourceType === 'Encounter')?.resource;
  if (encounterResource) {
    console.log('\n=== VALIDATION ENCOUNTER FR CORE ===');
    
    // Profil FR Core
    if (encounterResource.meta?.profile?.includes('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-encounter')) {
      validationSuccesses.push('✓ Encounter: Profil fr-core-encounter présent');
    } else {
      validationErrors.push('✗ Encounter: Profil fr-core-encounter manquant');
    }

    // Extensions limitées à fr-core-encounter-estimated-discharge-date uniquement
    if (encounterResource.extension) {
      let hasOnlyAuthorizedExtensions = true;
      encounterResource.extension.forEach(ext => {
        if (ext.url !== 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-encounter-estimated-discharge-date') {
          hasOnlyAuthorizedExtensions = false;
        }
      });
      
      if (hasOnlyAuthorizedExtensions) {
        validationSuccesses.push('✓ Encounter: Seules extensions FR Core canoniques');
      } else {
        validationErrors.push('✗ Encounter: Extensions non-canoniques détectées');
      }
    } else {
      validationSuccesses.push('✓ Encounter: Aucune extension non-autorisée');
    }

    // Champs hospitalization pour class="IMP"
    if (encounterResource.class?.code === 'IMP') {
      if (encounterResource.hospitalization) {
        validationSuccesses.push('✓ Encounter: Champs hospitalization présents pour class=IMP');
      } else {
        validationErrors.push('✗ Encounter: Champs hospitalization manquants pour class=IMP');
      }
    }
  }

  // 3. LOCATION - Vérifications FR Core
  const locationResources = result.entry?.filter(e => e.resource?.resourceType === 'Location') || [];
  if (locationResources.length > 0) {
    console.log('\n=== VALIDATION LOCATION FR CORE ===');
    
    locationResources.forEach((entry, idx) => {
      const location = entry.resource;
      
      // Profil FR Core
      if (location.meta?.profile?.includes('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-location')) {
        validationSuccesses.push(`✓ Location ${idx+1}: Profil fr-core-location présent`);
      } else {
        validationErrors.push(`✗ Location ${idx+1}: Profil fr-core-location manquant`);
      }

      // Identifiant obligatoire
      if (location.identifier && location.identifier.length > 0) {
        validationSuccesses.push(`✓ Location ${idx+1}: Identifiant présent`);
      } else {
        validationErrors.push(`✗ Location ${idx+1}: Identifiant manquant`);
      }

      // Type obligatoire
      if (location.type && location.type.length > 0) {
        validationSuccesses.push(`✓ Location ${idx+1}: Type présent`);
      } else {
        validationErrors.push(`✗ Location ${idx+1}: Type manquant`);
      }
    });
  }

  // 4. PRACTITIONER - Vérifications FR Core
  const practitionerResources = result.entry?.filter(e => e.resource?.resourceType === 'Practitioner') || [];
  if (practitionerResources.length > 0) {
    console.log('\n=== VALIDATION PRACTITIONER FR CORE ===');
    
    practitionerResources.forEach((entry, idx) => {
      const practitioner = entry.resource;
      
      // Profil FR Core
      if (practitioner.meta?.profile?.includes('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-practitioner')) {
        validationSuccesses.push(`✓ Practitioner ${idx+1}: Profil fr-core-practitioner présent`);
      } else {
        // Vérifier les logs pour confirmer que le profil a été ajouté
        console.log(`[DEBUG] Practitioner ${idx+1} meta:`, JSON.stringify(practitioner.meta, null, 2));
        validationErrors.push(`✗ Practitioner ${idx+1}: Profil fr-core-practitioner manquant`);
      }

      // Identifiants RPPS non dupliqués
      if (practitioner.identifier && practitioner.identifier.length > 0) {
        const rppsIds = practitioner.identifier.filter(id => 
          id.type?.coding?.[0]?.code === 'RPPS' || 
          id.system === 'urn:oid:1.2.250.1.71.4.2.1'
        );
        
        if (rppsIds.length === 1) {
          validationSuccesses.push(`✓ Practitioner ${idx+1}: Un seul identifiant RPPS (pas de doublon)`);
        } else if (rppsIds.length > 1) {
          validationErrors.push(`✗ Practitioner ${idx+1}: Identifiants RPPS dupliqués détectés`);
        }
      }
    });
  }

  // 5. COVERAGE - Vérifications FR Core
  const coverageResources = result.entry?.filter(e => e.resource?.resourceType === 'Coverage') || [];
  if (coverageResources.length > 0) {
    console.log('\n=== VALIDATION COVERAGE FR CORE ===');
    
    coverageResources.forEach((entry, idx) => {
      const coverage = entry.resource;
      
      // Profil FR Core
      if (coverage.meta?.profile?.includes('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-coverage')) {
        validationSuccesses.push(`✓ Coverage ${idx+1}: Profil fr-core-coverage présent`);
      } else {
        validationErrors.push(`✗ Coverage ${idx+1}: Profil fr-core-coverage manquant`);
      }

      // Payor obligatoire
      if (coverage.payor && coverage.payor.length > 0) {
        validationSuccesses.push(`✓ Coverage ${idx+1}: Payor présent (obligatoire)`);
      } else {
        validationErrors.push(`✗ Coverage ${idx+1}: Payor manquant (obligatoire)`);
      }

      // Pas de dates incorrectes
      if (!coverage.period || !coverage.period.end) {
        validationSuccesses.push(`✓ Coverage ${idx+1}: Pas de dates incorrectes`);
      } else {
        // Vérifier si la date semble valide
        const endDate = new Date(coverage.period.end);
        if (endDate.getFullYear() < 2020 || endDate.getFullYear() > 2030) {
          validationErrors.push(`✗ Coverage ${idx+1}: Date de fin suspecte: ${coverage.period.end}`);
        } else {
          validationSuccesses.push(`✓ Coverage ${idx+1}: Date de fin valide`);
        }
      }
    });
  }

  // 6. RELATEDPERSON - Vérifications FR Core
  const relatedPersonResources = result.entry?.filter(e => e.resource?.resourceType === 'RelatedPerson') || [];
  if (relatedPersonResources.length > 0) {
    console.log('\n=== VALIDATION RELATEDPERSON FR CORE ===');
    
    relatedPersonResources.forEach((entry, idx) => {
      const relatedPerson = entry.resource;
      
      // Profil FR Core
      if (relatedPerson.meta?.profile?.includes('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-related-person')) {
        validationSuccesses.push(`✓ RelatedPerson ${idx+1}: Profil fr-core-related-person présent`);
      } else {
        validationErrors.push(`✗ RelatedPerson ${idx+1}: Profil fr-core-related-person manquant`);
      }

      // Relationship avec ValueSet FR Core
      if (relatedPerson.relationship && relatedPerson.relationship.length > 0) {
        const relationship = relatedPerson.relationship[0];
        if (relationship.coding && relationship.coding.length > 0) {
          const coding = relationship.coding[0];
          if (coding.system === 'https://hl7.fr/ig/fhir/core/ValueSet/fr-core-vs-patient-contact-role') {
            validationSuccesses.push(`✓ RelatedPerson ${idx+1}: ValueSet fr-core-vs-patient-contact-role utilisé`);
          } else {
            validationErrors.push(`✗ RelatedPerson ${idx+1}: ValueSet FR Core non utilisé`);
          }
        }
      }
    });
  }

  // 7. MESSAGEHEADER - Vérifications FR Core
  const messageHeaderResource = result.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
  if (messageHeaderResource) {
    console.log('\n=== VALIDATION MESSAGEHEADER FR CORE ===');
    
    // Event coding corrigé (pas 'unknown')
    if (messageHeaderResource.eventCoding?.code && messageHeaderResource.eventCoding.code !== 'unknown') {
      validationSuccesses.push('✓ MessageHeader: Event coding corrigé (pas "unknown")');
    } else {
      validationErrors.push('✗ MessageHeader: Event coding incorrect ou "unknown"');
    }
  }

  // RÉSUMÉ DE VALIDATION
  console.log('\n=== RÉSUMÉ DE VALIDATION FR CORE ===');
  console.log(`✓ Succès: ${validationSuccesses.length}`);
  console.log(`✗ Erreurs: ${validationErrors.length}`);
  console.log('');

  if (validationSuccesses.length > 0) {
    console.log('CORRECTIONS APPLIQUÉES AVEC SUCCÈS:');
    validationSuccesses.forEach(success => console.log(success));
    console.log('');
  }

  if (validationErrors.length > 0) {
    console.log('ERREURS RESTANTES À CORRIGER:');
    validationErrors.forEach(error => console.log(error));
    console.log('');
  }

  const conformityRate = Math.round((validationSuccesses.length / (validationSuccesses.length + validationErrors.length)) * 100);
  console.log(`TAUX DE CONFORMITÉ FR CORE: ${conformityRate}%`);
  
  if (conformityRate === 100) {
    console.log('🎉 CONFORMITÉ FR CORE 100% ATTEINTE !');
  } else if (conformityRate >= 90) {
    console.log('✨ Conformité FR Core excellente');
  } else if (conformityRate >= 80) {
    console.log('👍 Conformité FR Core bonne');
  } else {
    console.log('⚠️  Conformité FR Core à améliorer');
  }

  console.log('\n' + '='.repeat(50));

} catch (error) {
  console.error('❌ ERREUR LORS DU TEST:', error.message);
  console.error('Stack trace:', error.stack);
}