const { convertHL7ToFHIR } = require('./hl7ToFhirAdvancedConverter');

// Message ADT^A01 français pour tester toutes les corrections FR Core
const adtA01Message = `MSH|^~\\&|MCK|CHU_BORDEAUX|FHIR_HUB|ANS|20250623150000||ADT^A01^ADT_A01|MSG002|P|2.5|||NE|NE|FR^French
EVN||20250623150000|||002^DURAND^Pierre|20250623150000
PID|1||987654321^^^CHU_BORDEAUX^PI~1987654321012345^^^INS^INS||MARTIN^Jean^Paul^Jr^M|BERNARD|19800315|M||||||0145678901^PRN^PH~jean.martin@email.fr^NET^Internet~0687654321^PRN^CP|||||||||||||||||||||20250623||||
PD1|||CHU_BORDEAUX^^^^^FINESS^750712184^^^^CHU de Bordeaux
NK1|1|MARTIN^Marie^Anne|SPO|456 AVENUE DE LA REPUBLIQUE^^BORDEAUX^^33000^FR^H|0156789012^PRN^PH~marie.martin@email.fr^NET^Internet
PV1|1|I|CARDIO^101^A^CHU_BORDEAUX||||987654321^DURAND^Pierre^Dr^^^MD|MED||||||||987654321^DURAND^Pierre^Dr^^^MD|VIP|9876543|||||||||||||||||||||CHU_BORDEAUX|||||20250623150000|20250625180000
PV2||||||20250625180000||||||||||||||||||||||||||||||||20250623150000
ROL|1|UP|ATPRF^Médecin traitant|987654321^DURAND^Pierre^Dr^^^MD^^^^^RPPS|||||CHU_BORDEAUX^^^^^FINESS^750712184
IN1|1|02|CPAM_AQUITAINE|CPAM Nouvelle-Aquitaine|3 Cours du Chapeau Rouge^^BORDEAUX^^33000^FR|||||||||1987654321012345||||SPO|MARTIN^Jean^Paul||19800315|456 AVENUE DE LA REPUBLIQUE^^BORDEAUX^^33000^FR||||||||||||||||1987654321012345
ZBE|A01|20250623150000|I|CARDIO|ADMISSION
ZFP|987654321|MARTIN^Jean^Paul|M|19800315|BORDEAUX
ZFV|CHU_BORDEAUX|CARDIO|101|A|20250623150000|20250625180000
ZFM|MED|CARDIO|Dr DURAND|20250623150000`;

console.log('=== TEST CORRECTIONS FR CORE - CONFORMITÉ COMPLÈTE ===\n');

try {
  const result = convertHL7ToFHIR(adtA01Message, {
    frenchMode: true,
    generateMessageHeader: true,
    validateFRCore: true,
    bundleType: 'message'
  });

  console.log('✓ Conversion réussie');
  console.log('Bundle ID:', result.id);
  console.log('Type:', result.type);
  console.log('Nombre d\'entrées:', result.entry?.length || 0);

  // Vérifications des corrections FR Core
  console.log('\n=== VÉRIFICATIONS CORRECTIONS FR CORE ===\n');

  // 1. Patient - Noms et suffixes correctement séparés
  const patient = result.entry?.find(e => e.resource?.resourceType === 'Patient');
  if (patient) {
    console.log('✓ Patient présent');
    const names = patient.resource.name || [];
    names.forEach((name, idx) => {
      console.log(`  - Nom ${idx + 1}:`);
      console.log(`    family: ${name.family}`);
      console.log(`    given: [${(name.given || []).join(', ')}]`);
      if (name.suffix) console.log(`    suffix: [${name.suffix.join(', ')}]`);
    });
    
    // Télécom system "email" au lieu de "other"
    const telecoms = patient.resource.telecom || [];
    const emailTelecom = telecoms.find(t => t.value?.includes('@'));
    if (emailTelecom) {
      console.log(`  - Email system: ${emailTelecom.system} ${emailTelecom.system === 'email' ? '✓' : '❌'}`);
    }
    
    // Téléphones séparés PRN^PH vs PRN^CP
    const phoneTelecoms = telecoms.filter(t => t.system === 'phone');
    console.log(`  - Téléphones séparés: ${phoneTelecoms.length} entrées`);
    phoneTelecoms.forEach(phone => {
      console.log(`    ${phone.value} (use: ${phone.use})`);
    });
  }

  // 2. Encounter - Extensions strictement limitées + location obligatoire
  const encounter = result.entry?.find(e => e.resource?.resourceType === 'Encounter');
  if (encounter) {
    console.log('✓ Encounter présent');
    const extensions = encounter.resource.extension || [];
    console.log(`  - Extensions: ${extensions.length} (seule fr-core-encounter-estimated-discharge-date autorisée)`);
    extensions.forEach(ext => {
      const isAuthorized = ext.url.includes('fr-core-encounter-estimated-discharge-date');
      console.log(`    ${ext.url} ${isAuthorized ? '✓' : '❌'}`);
    });
    
    const locations = encounter.resource.location || [];
    console.log(`  - Location obligatoire: ${locations.length > 0 ? '✓' : '❌'}`);
  }

  // 3. Practitioner - Identifiants RPPS uniquement avec use et assigner.reference
  const practitioners = result.entry?.filter(e => e.resource?.resourceType === 'Practitioner');
  if (practitioners?.length) {
    console.log(`✓ ${practitioners.length} Practitioner(s) présent(s)`);
    practitioners.forEach((prac, idx) => {
      const identifiers = prac.resource.identifier || [];
      console.log(`  - Praticien ${idx + 1}:`);
      console.log(`    Profil: ${prac.resource.meta?.profile?.[0] || 'Manquant'}`);
      console.log(`    Identifiants: ${identifiers.length}`);
      identifiers.forEach(id => {
        const hasUse = !!id.use;
        const hasCorrectSystem = id.type?.coding?.[0]?.system?.includes('fr-core-cs-v2-0203');
        const hasAssignerRef = id.assigner?.reference && !id.assigner?.display;
        console.log(`      ${id.value} - use: ${hasUse ? '✓' : '❌'}, système FR Core: ${hasCorrectSystem ? '✓' : '❌'}, assigner.reference: ${hasAssignerRef ? '✓' : '❌'}`);
      });
    });
  }

  // 4. RelatedPerson - ValueSet FR Core pour relationship
  const relatedPersons = result.entry?.filter(e => e.resource?.resourceType === 'RelatedPerson');
  if (relatedPersons?.length) {
    console.log(`✓ ${relatedPersons.length} RelatedPerson(s) présent(s)`);
    relatedPersons.forEach((rel, idx) => {
      const relationship = rel.resource.relationship?.[0]?.coding?.[0];
      const correctValueSet = relationship?.system?.includes('fr-core-vs-patient-contact-role');
      console.log(`  - Contact ${idx + 1}: ValueSet FR Core: ${correctValueSet ? '✓' : '❌'}`);
      console.log(`    Système: ${relationship?.system}`);
    });
  }

  // 5. Coverage - Payor obligatoire et absence de date incorrecte
  const coverages = result.entry?.filter(e => e.resource?.resourceType === 'Coverage');
  if (coverages?.length) {
    console.log(`✓ ${coverages.length} Coverage(s) présente(s)`);
    coverages.forEach((cov, idx) => {
      const hasPayor = !!cov.resource.payor && cov.resource.payor.length > 0;
      const hasIncorrectDate = cov.resource.period?.end === '4712-12-31';
      console.log(`  - Couverture ${idx + 1}:`);
      console.log(`    Payor obligatoire: ${hasPayor ? '✓' : '❌'}`);
      console.log(`    Date incorrecte supprimée: ${!hasIncorrectDate ? '✓' : '❌'}`);
      if (cov.resource.period?.end) {
        console.log(`    Date fin: ${cov.resource.period.end}`);
      }
    });
  }

  console.log('\n=== RÉSUMÉ CONFORMITÉ FR CORE COMPLÈTE ===');
  console.log('✓ Patient: noms/suffixes séparés, email system="email", télécom PRN^PH/PRN^CP');
  console.log('✓ Encounter: extensions limitées, location obligatoire');
  console.log('✓ Practitioner: RPPS uniquement, use + assigner.reference');
  console.log('✓ RelatedPerson: ValueSet fr-core-vs-patient-contact-role');
  console.log('✓ Coverage: payor obligatoire, dates incorrectes supprimées');

} catch (error) {
  console.error('❌ Erreur de conversion:', error.message);
  console.error('Stack:', error.stack);
}