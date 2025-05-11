/**
 * Service de conversion HL7 vers FHIR
 * Basé sur les librairies simple-hl7 et fhir
 */

import * as simpleHL7 from 'simple-hl7';

// Initialisation du parser HL7
const hl7Parser = new simpleHL7.Parser();

/**
 * Vérifie si un message HL7 est valide
 * @param hl7Message Message HL7 à valider
 * @returns True si le message est valide, sinon False
 */
export function isValidHL7(hl7Message: string): boolean {
  try {
    // Vérification basique de la structure du message
    if (!hl7Message.includes('MSH|')) {
      console.error('[HL7 Validation Error] Message ne contient pas de segment MSH');
      return false;
    }
    
    // Remplacer les \n par \r pour assurer la compatibilité avec HL7
    // HL7 utilise CR comme séparateur de segment standard
    const normalizedMessage = hl7Message.replace(/\n/g, '\r');
    
    try {
      // Essayer de parser le message
      const parsedMessage = hl7Parser.parse(normalizedMessage);
      console.log('[HL7 Validation] Message parsé avec succès:', parsedMessage.segments.length, 'segments');
      return true; // Si on arrive ici, c'est que le parsing a réussi
    } catch (parseError) {
      console.error('[HL7 Parsing Error]', parseError);
      return false;
    }
  } catch (error) {
    console.error('[HL7 Validation Error]', error);
    return false;
  }
}

/**
 * Convertit un message HL7 v2.5 en ressource FHIR R4
 * @param hl7Message Message HL7 à convertir
 * @returns Ressource FHIR générée
 */
export function convertHL7ToFHIR(hl7Message: string): any {
  try {
    // Normaliser le message HL7 avant de le parser
    const normalizedMessage = hl7Message.replace(/\n/g, '\r');
    
    // Parser le message HL7 pour valider la structure
    const parsedHL7 = hl7Parser.parse(normalizedMessage);
    
    // Diviser le message HL7 en segments
    const segments = normalizedMessage.split('\r').filter(Boolean);
    
    // Trouver les segments par type
    const mshSegment = segments.find(s => s.startsWith('MSH|')) || null;
    const pidSegment = segments.find(s => s.startsWith('PID|')) || null;
    const pd1Segment = segments.find(s => s.startsWith('PD1|')) || null;
    const pv1Segment = segments.find(s => s.startsWith('PV1|')) || null;
    const pv2Segment = segments.find(s => s.startsWith('PV2|')) || null;
    
    // Créer les ressources FHIR
    const patientId = `patient-${Date.now()}`;
    const encounterId = `encounter-${Date.now()}`;
    
    // Extraire les informations du patient
    const patientResource = {
      resourceType: 'Patient',
      id: patientId,
      identifier: extractPatientIdentifiers(pidSegment),
      name: extractPatientNames(pidSegment),
      gender: extractPatientGender(pidSegment),
      birthDate: extractPatientBirthDate(pidSegment),
      address: extractPatientAddress(pidSegment),
      telecom: extractPatientTelecom(pidSegment),
      active: true
    };
    
    // Extraire les informations de l'encounter
    const encounterResource = {
      resourceType: 'Encounter',
      id: encounterId,
      status: 'in-progress',
      class: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB',
          display: 'ambulatory'
        }]
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      period: extractEncounterPeriod(pv1Segment),
      participant: extractEncounterParticipants(pv1Segment)
    };
    
    // Créer le bundle FHIR
    const bundleId = `bundle-${Date.now()}`;
    const fhirBundle = {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'transaction',
      timestamp: new Date().toISOString(),
      meta: {
        lastUpdated: new Date().toISOString(),
        profile: ['http://esante.gouv.fr/ci-sis/fhir/StructureDefinition/FrBundle']
      },
      identifier: {
        system: 'urn:ietf:rfc:3986',
        value: `urn:uuid:${bundleId}`
      },
      entry: [
        {
          fullUrl: `urn:uuid:${patientId}`,
          resource: patientResource,
          request: {
            method: 'POST',
            url: 'Patient'
          }
        },
        {
          fullUrl: `urn:uuid:${encounterId}`,
          resource: encounterResource,
          request: {
            method: 'POST',
            url: 'Encounter'
          }
        }
      ]
    };
    
    return fhirBundle;
  } catch (error) {
    console.error('[Conversion Error]', error);
    throw error;
  }
}

/**
 * Extrait un segment par son type
 * @param segments Liste des segments
 * @param type Type de segment recherché (MSH, PID, etc.)
 */
function extractSegmentByType(segments: string[], type: string): string | null {
  return segments.find(s => s.startsWith(type + '|')) || null;
}

/**
 * Extrait les identifiants du patient
 * @param pidSegment Segment PID (chaîne brute)
 */
function extractPatientIdentifiers(pidSegment: string | null): any[] {
  const identifiers = [];
  
  if (!pidSegment) return identifiers;
  
  try {
    // Découper le segment PID en champs
    const fields = pidSegment.split('|');
    
    // Champ 3 - ID patient
    if (fields[3]) {
      const idParts = fields[3].split('^');
      const idValue = idParts[0];
      // Format: ID^Namespace^Type^System
      const idSystem = idParts[3] || 'urn:oid:1.2.250.1.213.1.4.10';
      
      identifiers.push({
        use: 'official',
        system: idSystem,
        value: idValue
      });
    }
    
    // Numéro de Sécurité Sociale (champ 19)
    if (fields[19]) {
      const ssnParts = fields[19].split('^');
      const ssnValue = ssnParts[0];
      
      identifiers.push({
        use: 'official',
        system: 'urn:oid:1.2.250.1.213.1.4.8',
        value: ssnValue,
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'SS',
            display: 'Numéro de sécurité sociale'
          }]
        }
      });
    }
  } catch (error) {
    console.error('[PatientIdentifiers Error]', error);
  }
  
  return identifiers;
}

/**
 * Extrait les noms du patient
 * @param pidSegment Segment PID (chaîne brute)
 */
function extractPatientNames(pidSegment: string | null): any[] {
  const names = [];
  
  if (!pidSegment) return names;
  
  try {
    // Découper le segment PID en champs
    const fields = pidSegment.split('|');
    
    // Champ 5 - Nom du patient
    if (fields[5]) {
      const nameParts = fields[5].split('^');
      const familyName = nameParts[0];
      const givenName = nameParts[1];
      const prefix = nameParts[4] || '';
      
      if (familyName) {
        // Gérer les prénoms composés
        const givenNames = givenName ? givenName.split(' ').filter(Boolean) : [];
        
        names.push({
          use: 'official',
          family: familyName,
          given: givenNames.length > 0 ? givenNames : undefined,
          prefix: prefix ? [prefix] : undefined
        });
      }
    }
  } catch (error) {
    console.error('[PatientNames Error]', error);
  }
  
  return names;
}

/**
 * Extrait le genre du patient
 * @param pidSegment Segment PID (chaîne brute)
 */
function extractPatientGender(pidSegment: string | null): string | undefined {
  if (!pidSegment) return undefined;
  
  try {
    // Découper le segment PID en champs
    const fields = pidSegment.split('|');
    
    // Champ 8 - Sexe
    if (fields[8]) {
      const gender = fields[8];
      
      // Convertir en code FHIR
      switch (gender) {
        case 'M': return 'male';
        case 'F': return 'female';
        case 'O': return 'other';
        case 'U': return 'unknown';
        default: return 'unknown';
      }
    }
  } catch (error) {
    console.error('[PatientGender Error]', error);
  }
  
  return undefined;
}

/**
 * Extrait la date de naissance du patient
 * @param pidSegment Segment PID (chaîne brute)
 */
function extractPatientBirthDate(pidSegment: string | null): string | undefined {
  if (!pidSegment) return undefined;
  
  try {
    // Découper le segment PID en champs
    const fields = pidSegment.split('|');
    
    // Champ 7 - Date de naissance
    if (fields[7] && fields[7].length >= 8) {
      const birthDate = fields[7];
      
      // Formater en YYYY-MM-DD
      const year = birthDate.substring(0, 4);
      const month = birthDate.substring(4, 6);
      const day = birthDate.substring(6, 8);
      
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    console.error('[PatientBirthDate Error]', error);
  }
  
  return undefined;
}

/**
 * Extrait l'adresse du patient
 * @param pidSegment Segment PID (chaîne brute)
 */
function extractPatientAddress(pidSegment: string | null): any[] {
  const addresses = [];
  
  if (!pidSegment) return addresses;
  
  try {
    // Découper le segment PID en champs
    const fields = pidSegment.split('|');
    
    // Champ 11 - Adresse
    if (fields[11]) {
      const addressParts = fields[11].split('^');
      const street = addressParts[0] || '';
      const city = addressParts[2] || '';
      const postalCode = addressParts[4] || '';
      const country = addressParts[5] || 'FRA';
      
      if (street || city || postalCode) {
        addresses.push({
          use: 'home',
          type: 'physical',
          line: street ? [street] : undefined,
          city: city,
          postalCode: postalCode,
          country: country
        });
      }
    }
  } catch (error) {
    console.error('[PatientAddress Error]', error);
  }
  
  return addresses;
}

/**
 * Extrait les informations de contact du patient
 * @param pidSegment Segment PID (chaîne brute)
 */
function extractPatientTelecom(pidSegment: string | null): any[] {
  const telecoms = [];
  
  if (!pidSegment) return telecoms;
  
  try {
    // Découper le segment PID en champs
    const fields = pidSegment.split('|');
    
    // Champ 13 - Téléphone / Email
    if (fields[13]) {
      const contacts = fields[13].split('~');
      
      contacts.forEach(contact => {
        if (contact.includes('@')) {
          // Email
          telecoms.push({
            system: 'email',
            value: contact,
            use: 'home'
          });
        } else if (contact.match(/\d+/)) {
          // Téléphone
          let use = 'home';
          
          if (contact.includes('6') || contact.includes('7')) {
            // Probablement un mobile
            use = 'mobile';
          }
          
          telecoms.push({
            system: 'phone',
            value: contact,
            use: use
          });
        }
      });
    }
  } catch (error) {
    console.error('[PatientTelecom Error]', error);
  }
  
  return telecoms;
}

/**
 * Extrait la période de l'encounter
 * @param pv1Segment Segment PV1 (chaîne brute)
 */
function extractEncounterPeriod(pv1Segment: string | null): any | undefined {
  const period: any = {};
  
  if (!pv1Segment) return undefined;
  
  try {
    // Découper le segment PV1 en champs
    const fields = pv1Segment.split('|');
    
    // Champ 44 - Date d'admission
    if (fields[44] && fields[44].length >= 8) {
      const admitDate = fields[44];
      
      // Formater en YYYY-MM-DD
      const year = admitDate.substring(0, 4);
      const month = admitDate.substring(4, 6);
      const day = admitDate.substring(6, 8);
      
      let time = 'T00:00:00+00:00';
      
      if (admitDate.length >= 14) {
        const hour = admitDate.substring(8, 10);
        const minute = admitDate.substring(10, 12);
        const second = admitDate.substring(12, 14);
        time = `T${hour}:${minute}:${second}+00:00`;
      }
      
      period.start = `${year}-${month}-${day}${time}`;
    }
    
    // Champ 45 - Date de sortie
    if (fields[45] && fields[45].length >= 8) {
      const dischargeDate = fields[45];
      
      // Formater en YYYY-MM-DD
      const year = dischargeDate.substring(0, 4);
      const month = dischargeDate.substring(4, 6);
      const day = dischargeDate.substring(6, 8);
      
      let time = 'T00:00:00+00:00';
      
      if (dischargeDate.length >= 14) {
        const hour = dischargeDate.substring(8, 10);
        const minute = dischargeDate.substring(10, 12);
        const second = dischargeDate.substring(12, 14);
        time = `T${hour}:${minute}:${second}+00:00`;
      }
      
      period.end = `${year}-${month}-${day}${time}`;
    }
  } catch (error) {
    console.error('[EncounterPeriod Error]', error);
  }
  
  return Object.keys(period).length > 0 ? period : undefined;
}

/**
 * Extrait les participants à l'encounter
 * @param pv1Segment Segment PV1 (chaîne brute)
 */
function extractEncounterParticipants(pv1Segment: string | null): any[] {
  const participants = [];
  
  if (!pv1Segment) return participants;
  
  try {
    // Découper le segment PV1 en champs
    const fields = pv1Segment.split('|');
    
    // Champ 7 - Médecin référent
    if (fields[7]) {
      const docParts = fields[7].split('^');
      const id = docParts[0] || '';
      const lastName = docParts[1] || '';
      const firstName = docParts[2] || '';
      const title = docParts[5] || '';
      
      if (id || lastName) {
        let display = '';
        
        if (title) display += title + ' ';
        if (lastName) display += lastName;
        if (firstName) display += ' ' + firstName;
        
        participants.push({
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'ATND',
              display: 'Médecin responsable'
            }]
          }],
          individual: {
            reference: id ? `Practitioner/${id}` : undefined,
            display: display || 'Médecin référent'
          }
        });
      }
    }
    
    // Champ 8 - Médecin consultant
    if (fields[8]) {
      const docParts = fields[8].split('^');
      const id = docParts[0] || '';
      const lastName = docParts[1] || '';
      const firstName = docParts[2] || '';
      const title = docParts[5] || '';
      
      if (id || lastName) {
        let display = '';
        
        if (title) display += title + ' ';
        if (lastName) display += lastName;
        if (firstName) display += ' ' + firstName;
        
        participants.push({
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'CON',
              display: 'Médecin consultant'
            }]
          }],
          individual: {
            reference: id ? `Practitioner/${id}` : undefined,
            display: display || 'Médecin consultant'
          }
        });
      }
    }
  } catch (error) {
    console.error('[EncounterParticipants Error]', error);
  }
  
  return participants;
}

/**
 * Journalise une conversion HL7 vers FHIR
 * @param apiKeyId Identifiant de la clé API utilisée
 * @param sourceFormat Format source (HL7v2.5)
 * @param sourceContent Contenu source (message HL7)
 * @param resultContent Contenu résultat (JSON FHIR)
 * @param status Statut de la conversion (success, error, warning)
 * @param processingTime Temps de traitement en ms
 * @param errorMessage Message d'erreur (si applicable)
 */
export function logConversion(
  apiKeyId: number | string,
  sourceFormat: string,
  sourceContent: string,
  resultContent: string,
  status: 'success' | 'error' | 'warning',
  processingTime: number,
  errorMessage?: string
): void {
  // Cette fonction sera implémentée ultérieurement pour enregistrer les logs dans la BDD
  console.log(`[CONVERSION LOG] API Key: ${apiKeyId}, Status: ${status}, Time: ${processingTime}ms`);
  
  if (status === 'error' && errorMessage) {
    console.error(`[CONVERSION ERROR] ${errorMessage}`);
  }
}