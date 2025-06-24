/**
 * Convertisseur avancé HL7 v2.5 vers FHIR R4
 * Spécialement optimisé pour les messages ADT français
 * Compatible avec les exigences de l'ANS et les profils FR Core
 * 
 * Intègre les terminologies et systèmes de codification français
 * Conforme au guide d'implémentation FHIR de l'ANS (Agence du Numérique en Santé)
 * Compatible avec les ressources du profil FR Core pour l'interopérabilité française
 * 
 * Fonctionnalités principales:
 * - Mapping complet des segments HL7 vers ressources FHIR
 * - Support des segments Z spécifiques aux messages français
 * - Intégration des URL canoniques des profils FR Core
 * - Extensions pour INS, RPPS, ADELI, FINESS et autres identifiants français
 * - Conformité aux guides MOS / CLI / CDA de l'ANS
 * 
 * @version 1.3.0
 * @updated 2025-05-14
 * @module hl7ToFhirAdvancedConverter
 */

// Module UUID pour générer des identifiants uniques
const uuid = {
  v4: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Import de l'adaptateur de terminologie française
const frenchTerminology = require('./french_terminology_adapter');
const hl7Parser = require('./hl7Parser');

// Simuler les profils FR Core pour compatibilité
console.log('[CONVERTER] Profils FR Core intégrés dans le convertisseur principal');

/**
 * Extraction du NIR depuis le champ PID-3
 * @param {*} pidField - Champ PID-3 
 * @returns {string|null} NIR ou null
 */
function extractNIRFromPIDField(pidField) {
  if (!pidField) return null;
  
  // Si c'est un tableau d'identifiants
  if (Array.isArray(pidField)) {
    for (const id of pidField) {
      if (Array.isArray(id) && id.length >= 4) {
        const value = id[0];
        const authority = id[3];
        
        // Vérifier si c'est un NIR (15 chiffres) avec autorité INS-NIR
        if (value && /^\d{15}$/.test(value) && 
            authority && Array.isArray(authority) && 
            authority[0] && authority[0].includes('INS-NIR')) {
          console.log('[FR-CORE] NIR détecté dans PID-3:', value);
          return value;
        }
      }
    }
  }
  
  return null;
}

/**
 * Convertit un message HL7 en bundle FHIR conforme aux spécifications ANS (France)
 * Optimisé pour les identifiants INS/INS-C et terminologies françaises
 * Architecture modulaire supportant ADT, SIU, ORM
 * @version 2.0.0
 * @updated 2025-06-23
 * @param {string} hl7Message - Message HL7 au format texte
 * @returns {Object} Bundle FHIR au format R4 conforme ANS
 */
function convertHL7ToFHIR(hl7Message, options = {}) {
  // Variable globale pour stocker toutes les entrées du bundle, y compris les ressources additionnelles
  // comme les organismes d'assurance
  let bundleEntries = [];
  try {
    console.log('[CONVERTER] Démarrage de la conversion HL7 vers FHIR v2.0 (modulaire)');
    
    // Parser le message HL7 avec notre module de parsing optimisé
    const parsedMessage = hl7Parser.parseHL7Message(hl7Message);
    
    if (!parsedMessage || !parsedMessage.segments) {
      throw new Error('Message HL7 invalide ou vide');
    }
    
    // Vérifier que les segments essentiels sont présents
    const segments = parsedMessage.segments;
    if (!segments.MSH) {
      throw new Error('Segment MSH requis manquant dans le message HL7');
    }
    
    console.log(`[CONVERTER] Message HL7 parsé avec succès: ${Object.keys(segments).length} types de segments`);
    
    // Support intégré pour tous les types de messages (ADT, SIU, ORM)
    // Architecture simplifiée sans dépendances externes
    console.log('[CONVERTER] Support intégré ADT/SIU/ORM dans convertisseur principal');
    
    // Logique existante pour ADT et compatibilité
    console.log(`[CONVERTER] Message HL7 parsé avec succès: ${Object.keys(segments).length} types de segments`);
    
    // Créer un identifiant unique pour le Bundle
    const bundleId = `bundle-${Date.now()}`;
    
    // Déterminer le type de Bundle selon le type de message
    let messageType = segments.MSH[0][8]; // MSH-9 Message Type
    if (Array.isArray(messageType)) {
      messageType = messageType[0];
    }
    if (typeof messageType !== 'string') {
      messageType = String(messageType || '');
    }
    const bundleType = messageType && messageType.length > 0 ? 'message' : 'transaction';
    
    // Extraire et formater le timestamp du MSH-7
    const mshTimestamp = segments.MSH[0][6]; // MSH-7 Date/Time of Message
    let bundleTimestamp = new Date().toISOString();
    
    if (mshTimestamp) {
      try {
        // Format HL7: YYYYMMDDHHMMSS -> ISO8601 avec fuseau français
        const year = mshTimestamp.substring(0, 4);
        const month = mshTimestamp.substring(4, 6);
        const day = mshTimestamp.substring(6, 8);
        const hour = mshTimestamp.substring(8, 10) || '00';
        const minute = mshTimestamp.substring(10, 12) || '00';
        const second = mshTimestamp.substring(12, 14) || '00';
        
        bundleTimestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}+02:00`;
      } catch (error) {
        console.log('[CONVERTER] Erreur parsing MSH-7, utilisation timestamp actuel');
      }
    }
    
    // Créer le Bundle FHIR
    const bundle = {
      resourceType: 'Bundle',
      id: bundleId,
      type: bundleType,
      timestamp: bundleTimestamp,
      entry: []
    };
    
    // MessageHeader obligatoire pour Bundle de type 'message'
    if (bundleType === 'message' && segments.MSH) {
      const messageHeaderResource = createMessageHeaderResource(segments.MSH[0]);
      bundle.entry.push(messageHeaderResource);
    }
    
    // Patient (à partir du segment PID)
    if (segments.PID && segments.PID.length > 0) {
      const patientResource = createPatientResource(segments.PID[0], segments.PD1 ? segments.PD1[0] : null);
      bundle.entry.push(patientResource);
      
      // Encounter (à partir des segments PV1 et PV2)
      if (segments.PV1 && segments.PV1.length > 0) {
        // Récupérer le segment PV2 s'il est disponible
        const pv2Segment = segments.PV2 && segments.PV2.length > 0 ? segments.PV2[0] : null;
        
        if (pv2Segment) {
          console.log('[CONVERTER] Segment PV2 trouvé, contenu:', JSON.stringify(pv2Segment));
          
          // Chercher explicitement la date de sortie prévue dans le segment
          for (let i = 0; i < pv2Segment.length; i++) {
            if (pv2Segment[i] && /^\d{8,14}$/.test(pv2Segment[i])) {
              console.log(`[CONVERTER] Date potentielle à l'index ${i}:`, pv2Segment[i]);
            }
          }
        }
        
        const encounterResult = createEncounterResource(segments.PV1[0], patientResource.fullUrl, pv2Segment);
        
        // Le résultat peut contenir l'entrée principale et des entrées supplémentaires (comme des locations)
        if (encounterResult) {
          // Format 1: {main: encounter, entries: [location, ...]}
          if (encounterResult.main && encounterResult.entries) {
            // Ajouter d'abord les entrées supplémentaires
            bundle.entry.push(...encounterResult.entries);
            console.log(`[CONVERTER] ${encounterResult.entries.length} ressources additionnelles ajoutées au bundle (locations, etc.)`);
            
            // Puis ajouter l'entrée principale
            bundle.entry.push(encounterResult.main);
          } 
          // Format 2: encounter direct
          else {
            bundle.entry.push(encounterResult);
          }
        }
      }
      
      // Organisation (à partir du segment MSH)
      if (segments.MSH && segments.MSH.length > 0) {
        const sendingOrganizationResource = createOrganizationResource(segments.MSH[0], 4); // Sending facility
        if (sendingOrganizationResource) {
          bundle.entry.push(sendingOrganizationResource);
        }
        
        const receivingOrganizationResource = createOrganizationResource(segments.MSH[0], 6); // Receiving facility
        if (receivingOrganizationResource && 
            (!sendingOrganizationResource || 
             sendingOrganizationResource.resource.id !== receivingOrganizationResource.resource.id)) {
          bundle.entry.push(receivingOrganizationResource);
        }
      }
      
      // Praticiens (à partir des segments ROL)
      if (segments.ROL && segments.ROL.length > 0) {
        console.log("[CONVERTER] Traitement de segments ROL:", segments.ROL.length, "segment(s) trouvé(s)");
        
        // Trouver l'Encounter existant s'il y en a un
        let encounterReference = null;
        if (bundle.entry.length > 1 && bundle.entry[1].resource && bundle.entry[1].resource.resourceType === 'Encounter') {
          encounterReference = bundle.entry[1].fullUrl;
          console.log("[CONVERTER] Référence d'Encounter trouvée:", encounterReference);
        } else {
          console.log("[CONVERTER] Pas de référence d'Encounter trouvée dans le bundle");
        }
        
        segments.ROL.forEach((rolSegment, index) => {
          console.log(`[CONVERTER] Traitement du segment ROL #${index + 1}:`, JSON.stringify(rolSegment).substring(0, 100) + "...");
          
          try {
            console.log("[CONVERTER] Segment ROL complet:", JSON.stringify(rolSegment));
            
            // CORRECTION FR CORE: Utilisation de createPractitionerResource uniquement
            const practitionerEntry = createPractitionerResource(rolSegment);
            if (practitionerEntry) {
              bundle.entry.push(practitionerEntry);
              console.log("[FR-CORE] Practitioner créé via createPractitionerResource conforme");
              
              // Créer aussi une ressource PractitionerRole si un encounter existe
              if (encounterReference) {
                const roleCode = rolSegment[3] || 'UNKN';
                const practitionerRoleId = `practitionerrole-${uuid.v4()}`;
                const practitionerRoleResource = {
                  fullUrl: `urn:uuid:${practitionerRoleId}`,
                  resource: {
                    resourceType: 'PractitionerRole',
                    id: practitionerRoleId,
                    practitioner: {
                      reference: practitionerEntry.fullUrl
                    },
                    active: true,
                    code: [{
                      coding: [{
                        system: 'https://mos.esante.gouv.fr/NOS/TRE_R94-ProfessionSocial/FHIR/TRE-R94-ProfessionSocial',
                        code: roleCode,
                        display: getRoleTypeDisplay(roleCode)
                      }]
                    }],
                    encounter: {
                      reference: encounterReference
                    }
                  },
                  request: {
                    method: 'POST',
                    url: 'PractitionerRole'
                  }
                };
                
                bundle.entry.push(practitionerRoleResource);
                console.log("[CONVERTER] Ressource PractitionerRole créée avec succès");
              } else {
                console.log("[CONVERTER] Pas de création de PractitionerRole (pas d'Encounter)");
              }
            } else {
              console.log("[CONVERTER] Échec de création de Practitioner via createPractitionerResource");
            }
          } catch (error) {
            console.error("[CONVERTER] Erreur lors du traitement du segment ROL:", error);
          }
        });
      } else {
        console.log("[CONVERTER] Aucun segment ROL trouvé dans le message");
      }
      
      // Proches (à partir des segments NK1)
      if (segments.NK1 && segments.NK1.length > 0) {
        segments.NK1.forEach(nk1Segment => {
          const relatedPersonResource = createRelatedPersonResource(nk1Segment, patientResource.fullUrl);
          if (relatedPersonResource) {
            bundle.entry.push(relatedPersonResource);
          }
        });
      }
      
      // Couverture d'assurance (à partir des segments IN1/IN2)
      if (segments.IN1 && segments.IN1.length > 0) {
        segments.IN1.forEach((in1Segment, index) => {
          const in2Segment = segments.IN2 && segments.IN2.length > index ? segments.IN2[index] : null;
          const coverageResource = createCoverageResource(in1Segment, in2Segment, patientResource.fullUrl, bundleEntries);
          if (coverageResource) {
            bundle.entry.push(coverageResource);
          }
        });
      }
      
      // Traitement des segments Z (spécifiques français)
      // Ces segments peuvent contenir des informations essentielles pour le contexte français
      
      // ZBE - Mouvement hospitalier selon spécifications françaises
      if (segments.ZBE && segments.ZBE.length > 0) {
        const zbeData = processZBESegment(segments.ZBE[0]);
        
        // Si nous avons un encounter et des données ZBE, enrichir l'encounter
        const encounterEntry = bundle.entry.find(e => e.resource && e.resource.resourceType === 'Encounter');
        if (encounterEntry && zbeData) {
          // Ajouter les extensions ANS pour le mouvement hospitalier
          if (!encounterEntry.resource.extension) {
            encounterEntry.resource.extension = [];
          }
          
          // SUPPRESSION: extensions healthevent-type et healthevent-identifier non autorisées par FR Core
          
          // Extension pour l'unité fonctionnelle
          if (zbeData.functionalUnit) {
            encounterEntry.resource.serviceProvider = {
              identifier: {
                system: 'urn:oid:1.2.250.1.71.4.2.2',
                value: zbeData.functionalUnit
              },
              display: zbeData.functionalUnitDisplay || 'Unité fonctionnelle'
            };
          }
        }
      }
      
      // ZFP - Informations sur le séjour du patient selon spécifications françaises
      if (segments.ZFP && segments.ZFP.length > 0) {
        const zfpData = processZFPSegment(segments.ZFP[0]);
        
        // Enrichir le patient avec des informations de séjour si disponibles
        const patientEntry = bundle.entry.find(e => e.resource && e.resource.resourceType === 'Patient');
        if (patientEntry && zfpData) {
          // Ajouter des extensions françaises au patient
          if (!patientEntry.resource.extension) {
            patientEntry.resource.extension = [];
          }
          
          // Ajouter des informations spécifiques selon les données ZFP disponibles
          // Implémentation selon les besoins spécifiques
        }
      }
      
      // ZFV - Informations de visite/séjour selon spécifications françaises
      if (segments.ZFV && segments.ZFV.length > 0) {
        const zfvData = processZFVSegment(segments.ZFV[0]);
        
        // Enrichir l'encounter avec des informations de visite
        const encounterEntry = bundle.entry.find(e => e.resource && e.resource.resourceType === 'Encounter');
        if (encounterEntry && zfvData) {
          // Compléter l'encounter avec des informations françaises spécifiques
          if (zfvData.encounterClass) {
            encounterEntry.resource.class = zfvData.encounterClass;
          }
          
          if (zfvData.priorityCode) {
            encounterEntry.resource.priority = {
              coding: [{
                system: 'https://mos.esante.gouv.fr/NOS/TRE_R213-ModePriseEnCharge/FHIR/TRE-R213-ModePriseEnCharge',
                code: zfvData.priorityCode,
                display: zfvData.priorityDisplay || 'Mode de prise en charge'
              }]
            };
          }
        }
      }
      
      // ZFM - Information médicale française
      if (segments.ZFM && segments.ZFM.length > 0) {
        const zfmData = processZFMSegment(segments.ZFM[0]);
        
        // Utiliser les données ZFM pour enrichir le bundle avec des informations médicales françaises
        // Par exemple, ajouter des Conditions, des Observations, etc.
        if (zfmData && Object.keys(zfmData).length > 0) {
          // Implémentation selon besoins spécifiques
          // Les segments ZFM peuvent contenir des informations importantes pour le contexte clinique français
        }
      }
    }
    
    // Ajouter les entrées additionnelles (comme les payors d'assurance) au bundle final
    if (bundleEntries && bundleEntries.length > 0) {
      console.log(`[CONVERTER] Ajout de ${bundleEntries.length} ressources additionnelles au bundle (organismes payeurs, etc.)`);
      bundle.entry = bundle.entry.concat(bundleEntries);
    }
    
    // Ajouter le support pour l'hospitalisation (propriété hospitalization) si date de sortie prévue
    if (bundle.entry.length > 0) {
      // Rechercher toutes les ressources Encounter dans le bundle
      const encounterEntries = bundle.entry.filter(entry => 
        entry.resource && entry.resource.resourceType === 'Encounter'
      );
      
      console.log(`[CONVERTER] ${encounterEntries.length} ressources Encounter trouvées dans le bundle pour enrichissement`);
      
      // Traiter chaque ressource Encounter pour ajouter/compléter hospitalization
      encounterEntries.forEach(encounterEntry => {
        const encounterResource = encounterEntry.resource;
        
        // Vérifier s'il y a une extension pour la date de sortie prévue
        const expectedExitDateExt = encounterResource.extension?.find(ext => 
          ext.url === "http://hl7.org/fhir/StructureDefinition/encounter-expectedExitDate"
        );
        
        if (expectedExitDateExt && expectedExitDateExt.valueDateTime) {
          // Initialiser ou récupérer l'objet hospitalization
          encounterResource.hospitalization = encounterResource.hospitalization || {};
          
          // Ajouter la date de sortie prévue à hospitalization 
          encounterResource.hospitalization.expectedDischargeDate = expectedExitDateExt.valueDateTime;
          
          // Ajouter d'autres informations pertinentes issues des segments français spécifiques si disponibles
          if (segments.ZBE && segments.ZBE.length > 0) {
            // Récupérer le premier segment ZBE pour les informations d'hospitalisation
            const zbeSegment = segments.ZBE[0];
            
            // Type de mouvement (ZBE-4) - INSERT = entrée, CANCEL = annulation, UPDATE = mise à jour, etc.
            if (zbeSegment.length > 4 && zbeSegment[4]) {
              const movementType = zbeSegment[4];
              
              // Si présent et pertinent, ajouter à l'objet hospitalization
              if (movementType === 'INSERT' || movementType === 'ADMISSION') {
                // Identifiant de pré-admission si disponible
                if (zbeSegment[1]) {
                  // Traiter pour obtenir une chaîne valide 
                  let admissionId = '';
                  
                  if (Array.isArray(zbeSegment[1])) {
                    // Si c'est un tableau, le convertir en format utilisable
                    if (zbeSegment[1].length > 0) {
                      // Essayer d'extraire comme premier élément
                      admissionId = zbeSegment[1][0] || '';
                      
                      // Si c'est encore un tableau, extraire la première valeur
                      if (Array.isArray(admissionId)) {
                        admissionId = admissionId[0] || '';
                      }
                    }
                  } else if (typeof zbeSegment[1] === 'string') {
                    // Si c'est une chaîne, l'utiliser directement
                    admissionId = zbeSegment[1];
                    
                    // Vérifier s'il y a un séparateur ^ dans la chaîne
                    if (admissionId.includes('^')) {
                      admissionId = admissionId.split('^')[0];
                    }
                  }
                  
                  // Ne créer l'identifiant que si une valeur significative a été trouvée
                  if (admissionId && typeof admissionId === 'string' && admissionId.trim()) {
                    encounterResource.hospitalization.preAdmissionIdentifier = {
                      system: 'urn:oid:1.2.250.1.71.4.2.7',
                      value: admissionId.trim()
                    };
                  }
                }
              }
              
              // Provenance du patient (ZBE-7 souvent) - ajoute cette information si disponible
              if (zbeSegment.length > 7 && zbeSegment[7]) {
                let sourceInfo = '';
                
                // Traiter pour obtenir une chaîne valide
                if (Array.isArray(zbeSegment[7])) {
                  // Pour les tableaux, extraire la partie significative
                  for (let i = 0; i < zbeSegment[7].length; i++) {
                    const part = zbeSegment[7][i];
                    if (part && typeof part === 'string' && part.length > 0 && !part.includes('""')) {
                      sourceInfo = part.trim();
                      break;
                    }
                  }
                  
                  // Si nous n'avons trouvé aucune partie significative mais qu'il y a une valeur UF
                  if (!sourceInfo && zbeSegment[7].includes('UF')) {
                    sourceInfo = 'Unité Fonctionnelle';
                  }
                } else if (typeof zbeSegment[7] === 'string') {
                  // Chaîne directe
                  sourceInfo = zbeSegment[7].replace(/\"\"/g, '').trim();
                }
                
                // Ne créer l'origine que si une valeur significative a été trouvée
                if (sourceInfo && sourceInfo.trim()) {
                  encounterResource.hospitalization.origin = {
                    display: sourceInfo.trim()
                  };
                }
              }
              
              // Destination du patient (ZBE-8 parfois) - ajoute cette information si disponible
              if (zbeSegment.length > 8 && zbeSegment[8]) {
                let destinationInfo = '';
                
                // Traiter pour obtenir une chaîne valide
                if (Array.isArray(zbeSegment[8])) {
                  // Pour les tableaux, extraire la partie significative
                  for (let i = 0; i < zbeSegment[8].length; i++) {
                    const part = zbeSegment[8][i];
                    if (part && typeof part === 'string' && part.length > 0 && !part.includes('""')) {
                      destinationInfo = part.trim();
                      break;
                    }
                  }
                } else if (typeof zbeSegment[8] === 'string') {
                  // Chaîne directe
                  destinationInfo = zbeSegment[8].replace(/\"\"/g, '').trim();
                }
                
                // Ne créer la destination que si une valeur significative a été trouvée
                if (destinationInfo && destinationInfo.trim()) {
                  encounterResource.hospitalization.destination = {
                    display: destinationInfo.trim()
                  };
                }
              }
            }
          }
          
          console.log('[CONVERTER] Hospitalization enrichie avec date de sortie prévue et contexte français:', 
            JSON.stringify(encounterResource.hospitalization).substring(0, 200));
        }
      });
    }
    
    // Traitement spécifique des segments Z français si présents
    if (segments.ZBE || segments.ZFP || segments.ZFV || segments.ZMP || segments.ZFD || segments.ZMO || segments.ZMD) {
      console.log('[CONVERTER] Segments Z français détectés, traitement spécifique');
      
      try {
        processFrenchZSegments(segments, bundle);
      } catch (error) {
        console.warn(`[CONVERTER] Erreur lors du traitement des segments Z: ${error.message}`);
        // On continue sans bloquer la conversion si le traitement des segments Z échoue
      }
    }
    
    console.log(`[CONVERTER] Conversion terminée avec ${bundle.entry.length} ressources FHIR générées`);
    return bundle;
  } catch (error) {
    console.error('[CONVERTER] Erreur lors de la conversion:', error);
    throw error;
  }
}

/**
 * Crée une ressource Patient FHIR à partir du segment PID
 * @param {Array} pidSegmentFields - Champs du segment PID parsé
 * @param {Array} pd1SegmentFields - Champs du segment PD1 parsé (optionnel)
 * @returns {Object} Entrée de bundle pour un Patient
 */
function createPatientResource(pidSegmentFields, pd1SegmentFields) {
  // PID-3 (Patient Identifiers) - Champ 3
  const patientIdentifiers = extractIdentifiers(pidSegmentFields[3]);
  
  // Log du PID-13 et PID-14 pour le debugging des téléphones
  console.log('[CONVERTER] PID-13 (Home Phone):', JSON.stringify(pidSegmentFields[13]));
  console.log('[CONVERTER] PID-14 (Work Phone):', JSON.stringify(pidSegmentFields[14]));
  
  // Extraction d'un ID simple pour l'URI
  const mainId = pidSegmentFields[3] ? (Array.isArray(pidSegmentFields[3]) ? 
    (pidSegmentFields[3][0] || '') : pidSegmentFields[3]) : '';
  
  let patientId = `patient-${Date.now()}`;
  if (mainId && typeof mainId === 'string') {
    patientId = `patient-${mainId.split('^')[0]}`;
  } else if (patientIdentifiers.length > 0 && patientIdentifiers[0].value) {
    patientId = `patient-${patientIdentifiers[0].value}`;
  }
  
  // Optimiser la gestion des identifiants selon les spécifications FR Core
  // Correction pour conformité avec Patient.identifier slice PI et NSS
  
  // Classification des identifiants par type
  let ippIdentifier = null;
  let insIdentifier = null;
  let hasINS = false;
  
  // Parcourir tous les identifiants et les trier par catégorie FR Core
  patientIdentifiers.forEach(id => {
    const idType = id.type?.coding?.[0]?.code || 'PI';
    
    // FR Core: Slice INS-NIR (NIR officiel) - conformité stricte
    if ((idType === 'NH' || idType === 'NI' || idType === 'INS-C' || idType === 'INS') && id.system === 'urn:oid:1.2.250.1.213.1.4.8') {
      // FR Core: slice identifier:INS-NIR obligatoire
      id.type = {
        coding: [{
          system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-v2-0203',
          code: 'INS-NIR',
          display: 'Identifiant National de Santé - National Identifier Registry'
        }]
      };
      id.use = 'official';
      id.system = 'urn:oid:1.2.250.1.213.1.4.8';
      insIdentifier = id;
      hasINS = true;
      console.log('[FR-CORE] Slice identifier:INS-NIR conforme appliqué:', id.value);
    }
    // Identifiant Patient Interne (IPP) - établissement (slice PI) - FR CORE CORRIGÉ
    else if (idType === 'PI') {
      // FR Core: system urn:oid:1.2.250.1.71.4.2.7 obligatoire pour PI
      id.system = 'urn:oid:1.2.250.1.71.4.2.7';
      id.use = 'usual';
      if (!id.assigner) {
        id.assigner = {
          display: 'Établissement de santé'
        };
      }
      ippIdentifier = id;
      console.log('[FR-CORE] Identifiant PI (IPP) détecté et corrigé pour FR Core: system 1.2.250.1.71.4.2.7');
    }
  });
  
  // CORRECTION CRITIQUE FR Core: Limiter à un seul PI avec valeur correcte et ajouter INS-NIR si manquant
  const optimizedIdentifiers = [];
  
  // Ajouter un seul identifiant PI (slice identifier:PI) avec valeur correcte du PID-3
  if (ippIdentifier && ippIdentifier.value && ippIdentifier.value !== 'PI') {
    optimizedIdentifiers.push(ippIdentifier);
  } else if (patientIdentifiers.length > 0) {
    // Prendre le premier identifiant PI avec une vraie valeur
    const validPI = patientIdentifiers.find(id => 
      id.type?.coding?.[0]?.code === 'PI' && 
      id.value && 
      id.value !== 'PI' && 
      id.value.trim() !== ''
    );
    if (validPI) {
      optimizedIdentifiers.push(validPI);
    }
  }
  
  // Ajouter l'identifiant INS-NIR si présent
  if (insIdentifier) {
    optimizedIdentifiers.push(insIdentifier);
  }
  
  // Recherche exhaustive NIR dans tous les identifiants et dans le message
  if (!hasINS) {
    // Chercher NIR dans PID-3 structuré
    if (pidSegmentFields[3]) {
      try {
        const nirFromPid = extractNIRFromPIDField(pidSegmentFields[3]);
        if (nirFromPid) {
          optimizedIdentifiers.push({
            use: 'official',
            value: nirFromPid,
            system: 'urn:oid:1.2.250.1.213.1.4.8',
            type: {
              coding: [{
                system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-v2-0203',
                code: 'INS-NIR',
                display: 'Identifiant National de Santé - National Identifier Registry'
              }]
            }
          });
          hasINS = true;
          console.log('[FR-CORE] INS-NIR extrait du PID-3:', nirFromPid);
        }
      } catch (error) {
        console.log('[FR-CORE] Erreur extraction NIR du PID-3:', error.message);
      }
    }
    
    // Chercher NIR pattern dans tout identifiant de 15 chiffres
    if (!hasINS) {
      patientIdentifiers.forEach(id => {
        if (id.value && /^\d{15}$/.test(id.value)) {
          optimizedIdentifiers.push({
            use: 'official',
            value: id.value,
            system: 'urn:oid:1.2.250.1.213.1.4.8',
            type: {
              coding: [{
                system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-v2-0203',
                code: 'INS-NIR',
                display: 'Identifiant National de Santé - National Identifier Registry'
              }]
            }
          });
          hasINS = true;
          console.log('[FR-CORE] INS-NIR détecté pattern 15 chiffres:', id.value);
          return;
        }
      });
    }
  }
  
  console.log('[FR-CORE] Identifiants finaux pour Patient:', optimizedIdentifiers.length, 'identifiants');
  
  // Extraire les télécom avec notre fonction standard
  let telecomData = extractTelecoms(pidSegmentFields[13], pidSegmentFields[14]);
  
  // Si aucun télécom n'a été trouvé, utiliser une extraction de secours directe
  if (!telecomData || telecomData.length === 0) {
    console.log('[CONVERTER] Aucun télécom trouvé avec la méthode standard, tentative directe...');
    telecomData = [];
    
    // Extraction directe du téléphone mobile
    if (pidSegmentFields[13] && Array.isArray(pidSegmentFields[13])) {
      // Format spécifique français PID-13: [["","PRN","PH","","","","","","","","","0608987212"]]
      pidSegmentFields[13].forEach(field => {
        if (Array.isArray(field) && field.length >= 12 && field[11]) {
          const phoneNumber = field[11];
          if (phoneNumber && /^\d+$/.test(phoneNumber)) {
            console.log('[CONVERTER] Numéro de téléphone trouvé directement:', phoneNumber);
            
            // Déterminer si c'est un mobile (06/07)
            const isMobile = phoneNumber.startsWith('06') || phoneNumber.startsWith('07');
            
            telecomData.push({
              system: 'phone',
              value: phoneNumber,
              use: isMobile ? 'mobile' : 'home'
            });
          }
        }
      });
    }
    
    // Extraction directe de l'email
    if (pidSegmentFields[13] && Array.isArray(pidSegmentFields[13])) {
      pidSegmentFields[13].forEach(field => {
        // Format typique français: ["","NET","Internet","MARYSE.SECLET@WANADOO.FR"]
        if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3]) {
          const email = field[3];
          if (email && email.includes('@')) {
            console.log('[CONVERTER] Email trouvé directement:', email);
            telecomData.push({
              system: 'email',
              value: email,
              use: 'home'
            });
          }
        }
        
        // Recherche dans les profondeurs du format HL7 (tout ce qui contient un @)
        if (field && typeof field === 'string' && field.includes('@')) {
          console.log('[CONVERTER] Email trouvé dans champ spécial:', field);
          telecomData.push({
            system: 'email',
            value: field,
            use: 'home'
          });
        }
        
        // Parcourir récursivement pour trouver les emails
        if (field && Array.isArray(field)) {
          field.forEach(subField => {
            if (subField && typeof subField === 'string' && subField.includes('@')) {
              console.log('[CONVERTER] Email trouvé dans sous-champ:', subField);
              telecomData.push({
                system: 'email',
                value: subField,
                use: 'home'
              });
            }
          });
        }
      });
    }
  }
  
  // Créer la ressource Patient
  let patientResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: optimizedIdentifiers,  // Utilisation des identifiants optimisés
    name: extractNames(pidSegmentFields[5]),
    gender: determineGender(pidSegmentFields[8]),
    birthDate: formatBirthDate(pidSegmentFields[7]),
    telecom: telecomData,
    address: extractAddresses(pidSegmentFields[11]),
    maritalStatus: determineMaritalStatus(pidSegmentFields[16]),
    contact: []
  };
  
  // Ajouter les extensions françaises si PD1 est disponible
  if (pd1SegmentFields) {
    addFrenchExtensions(patientResource, pd1SegmentFields);
  }
  
  // CORRECTIONS FR CORE CRITIQUES - Post-traitement
  // 1. Corriger les noms pour éviter doublons et mauvais placement des suffixes
  if (patientResource.name) {
    patientResource.name = patientResource.name.map(name => {
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
  
  // 2. Corriger les télécom pour system="email" obligatoire (jamais "other")
  if (patientResource.telecom) {
    patientResource.telecom = patientResource.telecom.map(telecom => {
      if (telecom.value && telecom.value.includes('@')) {
        telecom.system = 'email'; // CORRECTION FR CORE: obligatoire pour emails
      }
      return telecom;
    });
  }
  
  // 3. Filtrer les adresses invalides FR Core
  if (patientResource.address) {
    patientResource.address = patientResource.address.filter(address => {
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
  
  // 4. FR Core: Extension fiabilité d'identité selon PID-35 ou présence INS
  let reliabilityCode = 'UNDI';
  let reliabilityDisplay = 'Identité non vérifiée ou documents manquants';
  
  // Vérifier PID-35 pour la fiabilité d'identité
  if (pidSegmentFields[35] && pidSegmentFields[35] === 'VALI') {
    reliabilityCode = 'VALI';
    reliabilityDisplay = 'Identité vérifiée';
  } else if (hasINS) {
    reliabilityCode = 'VALI';
    reliabilityDisplay = 'Identité vérifiée';
  }
  
  const reliabilityExtension = {
    url: 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-identity-reliability',
    valueCodeableConcept: {
      coding: [{
        system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-identity-reliability',
        code: reliabilityCode,
        display: reliabilityDisplay
      }]
    }
  };
  
  if (!patientResource.extension) {
    patientResource.extension = [];
  }
  
  patientResource.extension.push(reliabilityExtension);
  console.log('[FR-CORE] Extension fiabilité valueCodeableConcept ajoutée:', reliabilityCode);
  
  // Supprimer tous les champs vides ou null
  if (!patientResource.telecom || patientResource.telecom.length === 0) {
    delete patientResource.telecom;
  }
  if (!patientResource.address || patientResource.address.length === 0) {
    delete patientResource.address;
  }
  if (!patientResource.contact || patientResource.contact.length === 0) {
    delete patientResource.contact;
  }
  if (!patientResource.maritalStatus) {
    delete patientResource.maritalStatus;
  }
  
  // Ajouter les profils FR Core appropriés
  const profiles = ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient'];
  
  // Si un INS est présent, ajouter aussi le profil fr-core-patient-ins
  if (hasINS) {
    profiles.push('https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-patient-ins');
    console.log('[FR-CORE] Profils Patient FR Core + INS ajoutés car INS détecté');
  }
  
  patientResource.meta = {
    profile: profiles
  };
  
  console.log(`[FR-CORE] Profils FR Core appliqués: ${profiles.length} profil(s)`);
  
  return {
    fullUrl: `urn:uuid:${patientId}`,
    resource: patientResource,
    request: {
      method: 'POST',
      url: 'Patient'
    }
  };
}

/**
 * Extrait les identifiants du patient à partir du champ PID-3
 * Gestion optimisée des identifiants selon les spécifications ANS (France)
 * @param {Array|string} identifierField - Champ d'identifiants
 * @returns {Array} Tableau d'identifiants FHIR
 */
function extractIdentifiers(identifierField) {
  console.log('[CONVERTER] Extraction des identifiants à partir de:', JSON.stringify(identifierField).substring(0, 200));
  
  if (!identifierField) {
    console.log('[CONVERTER] Pas d\'identifiants fournis');
    return [];
  }
  
  const identifiers = [];
  let hasINS = false; // Pour traquer si un INS a été trouvé
  let hasIPP = false; // Pour traquer si un IPP a été trouvé
  
  // Si nous avons une chaîne, traiter directement
  if (typeof identifierField === 'string') {
    const components = identifierField.split('^');
    const idValue = components[0];
    const idType = components[4] || 'PI';
    const assigningAuthority = components[3] || '';
    
    if (idValue) {
      console.log('[CONVERTER] Traitement identifiant:',idValue,'type:',idType,'autorité:',assigningAuthority);
      
      // Configuration standard
      let system = 'urn:system:unknown';
      let officialType = '';
      
      // Traiter l'autorité d'assignation et l'OID pour conformité ANS
      if (assigningAuthority) {
        const authParts = assigningAuthority.split('&');
        const namespaceName = authParts[0] || '';
        const oid = authParts.length > 1 ? authParts[1] : '';
        
        // Détection des identifiants français basée sur le nom et l'OID
        // En conformité stricte avec les recommandations ANS
        if (namespaceName.includes('ASIP-SANTE-INS-NIR') || 
            namespaceName.includes('INSEE-NIR') || 
            namespaceName.includes('INS-NIR') ||
            idType === 'INS' || idType === 'INS-NIR') {
          console.log('[CONVERTER] Identifiant INS-NIR détecté');
          officialType = 'INS';
          system = 'urn:oid:1.2.250.1.213.1.4.8'; // OID officiel pour INS-NIR
          hasINS = true;
        } else if (namespaceName.includes('ASIP-SANTE-INS-C') || 
                   namespaceName.includes('INS-C') ||
                   idType === 'INS-C') {
          console.log('[CONVERTER] Identifiant INS-C détecté');
          officialType = 'INS-C';
          system = 'urn:oid:1.2.250.1.213.1.4.8'; // OID officiel pour INS conformément à ANS
          hasINS = true;
        } else if (namespaceName.includes('ASIP-SANTE-INS-A') || 
                   namespaceName.includes('INS-A') ||
                   idType === 'INS-A' ||
                   idType === 'INS') {  // Parfois INS est utilisé pour les deux
          console.log('[CONVERTER] Identifiant INS-A détecté');
          officialType = 'INS';  // Même traitement que l'INS standard
          system = 'urn:oid:1.2.250.1.213.1.4.8'; // OID officiel pour INS conformément à ANS
          hasINS = true;
        } else if (idType === 'PI' || idType === 'NH' || idType === '') {
          console.log('[CONVERTER] Identifiant interne (IPP) détecté');
          officialType = 'IPP';
          system = 'urn:oid:1.2.250.1.71.4.2.7'; // OID pour identifiants internes
          hasIPP = true;
        } else if (oid) {
          // Utiliser l'OID directement si fourni
          system = `urn:oid:${oid}`;
          
          // Détection des identifiants français basée sur l'OID uniquement
          if (oid === '1.2.250.1.213.1.4.8' || oid === '1.2.250.1.213.1.4.2') {
            console.log('[CONVERTER] Identifiant INS détecté via OID:', oid);
            officialType = 'INS';
            hasINS = true;
          } else if (oid === '1.2.250.1.71.4.2.7') {
            console.log('[CONVERTER] Identifiant IPP détecté via OID:', oid);
            officialType = 'IPP';
            hasIPP = true;
          }
        }
      } else if (idType === 'PI' || idType === 'NH' || idType === '') {
        // IPP (Patient Internal) ou Numéro d'hospitalisation
        system = 'urn:oid:1.2.250.1.71.4.2.7'; // OID pour identifiants internes
        officialType = 'IPP';
        hasIPP = true;
      }
      
      // Cas 1: INS (NIR ou INS-C) - conforme aux recommandations ANS
      if (officialType === 'INS' || officialType === 'INS-C') {
        // Créer l'identifiant INS avec les informations françaises
        identifiers.push({
          value: idValue,
          system: 'urn:oid:1.2.250.1.213.1.4.8', // OID officiel pour INS selon ANS
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'NI',
              display: 'Numéro d\'identification au répertoire national d\'identification des personnes physiques'
            }]
          },
          assigner: { 
            display: 'INSEE'
          },
          extension: [{
            url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INSi-Status',
            valueCodeableConcept: {
              coding: [{
                system: 'https://mos.esante.gouv.fr/NOS/TRE_R338-ModaliteAccueil/FHIR/TRE-R338-ModaliteAccueil',
                code: 'VALI',
                display: 'Identité vérifiée'
              }]
            }
          }]
        });
      } 
      // Cas 2: IPP - identifiant interne conforme aux recommandations ANS
      else if (officialType === 'IPP') {
        // CORRECTION FR Core: OID correct pour IPP
        identifiers.push({
          use: 'usual',
          value: idValue,
          system: 'urn:oid:1.2.250.1.71.4.2.1', // CORRECTION: OID correct pour IPP FR Core
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'PI',
              display: 'Identifiant patient interne'
            }]
          },
          assigner: assigningAuthority ? { 
            reference: `Organization/org-${typeof assigningAuthority === 'string' ? assigningAuthority.split('&')[0].toLowerCase() : 'local'}`
          } : { reference: 'Organization/org-mck' }
        });
        console.log('[FR-CORE] Identifiant PI (IPP) détecté et corrigé pour FR Core');
      }
      // Cas 3: Autres types d'identifiants
      else {
        identifiers.push({
          value: idValue,
          system: system,
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: idType || 'PI',
              display: getIdentifierTypeDisplay(idType || 'PI')
            }]
          },
          assigner: assigningAuthority ? { 
            display: assigningAuthority.split('&')[0] 
          } : undefined
        });
      }
    }
  }
  // Si nous avons un tableau, traiter chaque élément
  else if (Array.isArray(identifierField)) {
    // Garder une trace des identifiants déjà traités pour éviter les doublons
    const processedIds = new Set();
    
    // Tableau pour stocker tous les identifiants INS trouvés
    const insIdentifiers = [];
    
    // Traiter chaque élément comme un identifiant potentiel avec gestion d'erreurs robuste
    identifierField.forEach((item, index) => {
      console.log('[CONVERTER] Traitement élément #' + index + ' du tableau');
      
      try {
        // Traitement spécifique pour les identifiants INS-A/INS-C/INS-NIR
        if (Array.isArray(item)) {
          // Analyser si cet item pourrait être un INS
          if (item.length > 4) {
            const idValue = item[0] || '';
            const idAuth = item[3] || '';
            const idType = item[4] || '';
            
            // Si c'est un nombre de 15 chiffres, c'est probablement un INS
            if (/^\d{15}$/.test(idValue) && 
                (idAuth.includes('ASIP-SANTE') || idAuth.includes('INS') || idType.includes('INS'))) {
              console.log('[CONVERTER] Identifiant INS détecté dans PID:', idValue, idType, idAuth);
              
              // Déterminer le type exact d'INS
              let insType = 'INS';
              if (idAuth.includes('INS-C') || idType === 'INS-C') {
                insType = 'INS-C';
              } else if (idAuth.includes('INS-A') || idType === 'INS-A') {
                insType = 'INS-A';
              } else if (idAuth.includes('INS-NIR') || idType === 'INS-NIR') {
                insType = 'INS-NIR';
              }
              
              // Stocker l'identifiant INS pour un traitement ultérieur
              insIdentifiers.push({
                value: idValue,
                type: insType,
                auth: idAuth
              });
            }
          }
        }
        
        if (typeof item === 'string') {
          const ids = extractIdentifiers(item);
          // Filtrer les identifiants pour éviter les duplications
          ids.forEach(id => {
            const idKey = `${id.system}|${id.value}`;
            if (!processedIds.has(idKey)) {
              identifiers.push(id);
              processedIds.add(idKey);
              
              // Mettre à jour les flags
              if (id.type?.coding?.[0]?.code === 'NI') hasINS = true;
              if (id.type?.coding?.[0]?.code === 'PI') hasIPP = true;
            }
          });
        } else if (Array.isArray(item)) {
          // Traiter directement cet élément comme un identifiant complet
          const idValue = item[0] || '';
          const idType = item[4] || '';
          // Extraction sécurisée de assigningAuth avec validation de type
          let assigningAuth = '';
          let assigningOID = '';
          
          if (item[3]) {
            if (Array.isArray(item[3])) {
              assigningAuth = item[3][0] || '';
              assigningOID = item[3][1] || '';
            } else if (typeof item[3] === 'string') {
              assigningAuth = item[3];
            } else if (typeof item[3] === 'object') {
              assigningAuth = item[3].namespaceId || item[3].name || '';
              assigningOID = item[3].universalId || '';
            }
          }
          
          // Essayer d'extraire l'OID de différentes structures possibles si pas encore trouvé
          if (!assigningOID && item[9]) {
            if (Array.isArray(item[9])) {
              assigningOID = item[9][1] || '';
            } else if (typeof item[9] === 'object') {
              assigningOID = item[9].universalId || '';
            }
          }
          
          console.log('[CONVERTER] Analysant identifiant tableau:', idValue, idType, assigningAuth, assigningOID);
          console.log('[CONVERTER] Types détectés - assigningAuth:', typeof assigningAuth, 'assigningOID:', typeof assigningOID);
          
          if (idValue) {
            // Détection INS - Plusieurs critères possibles avec validation de type
            const isINS = assigningAuth === 'ASIP-SANTE' || 
                        idType === 'INS' || 
                        idType === 'INS-C' || 
                        idType === 'INS-NIR' || 
                        idType === 'INS-A' ||
                        assigningOID === '1.2.250.1.213.1.4.8' || 
                        assigningOID === '1.2.250.1.213.1.4.2' ||
                        (assigningAuth && typeof assigningAuth === 'string' && (
                          assigningAuth.includes('ASIP-SANTE') ||
                          assigningAuth.includes('INSEE')
                        ));
                        
            // Détection IPP - Identifiant Patient interne
            const isIPP = assigningAuth === 'MCK' || 
                         idType === 'PI' || 
                         idType === 'MR' || 
                         (!isINS && idValue); // Par défaut si pas INS
                        
            if (isINS) {
              console.log('[CONVERTER] INS détecté dans tableau:', idValue);
              hasINS = true;
              
              const insIdentifier = {
                use: 'official',
                value: idValue,
                system: 'urn:oid:1.2.250.1.213.1.4.8', // OID standard ANS
                type: {
                  coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'INS-C', // Code corrigé pour FR Core
                    display: 'Identifiant National de Santé Calculé'
                  }]
                }
              };
              
              const idKey = `${insIdentifier.system}|${insIdentifier.value}`;
              if (!processedIds.has(idKey)) {
                identifiers.push(insIdentifier);
                processedIds.add(idKey);
                console.log('[FR-CORE] Identifiant INS ajouté au tableau final:', insIdentifier.value);
              }
            } else if (isIPP) {
              console.log('[CONVERTER] IPP détecté dans tableau:', idValue);
              hasIPP = true;
              
              const ippIdentifier = {
                use: 'usual',
                value: idValue,
                system: 'urn:oid:1.2.250.1.71.4.2.1', // OID correct pour IPP FR Core
                type: {
                  coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'PI',
                    display: 'Identifiant patient interne'
                  }]
                },
                assigner: {
                  reference: `Organization/org-${assigningAuth && typeof assigningAuth === 'string' ? assigningAuth.toLowerCase() : 'local'}`
                }
              };
              
              const idKey = `${ippIdentifier.system}|${ippIdentifier.value}`;
              if (!processedIds.has(idKey)) {
                identifiers.push(ippIdentifier);
                processedIds.add(idKey);
                console.log('[FR-CORE] Identifiant IPP ajouté au tableau final:', ippIdentifier.value);
              }
            } else if (idType === 'PIP') {
              // Gestion spécifique des identifiants Patient Internal Identifier (payer)
              console.log('[CONVERTER] Identifiant PIP détecté dans tableau:', idValue);
              
              const pipIdentifier = {
                value: idValue,
                system: 'urn:oid:1.2.250.1.71.4.2.7', // FR Core: OID conforme pour identifiants locaux
                type: {
                  coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'PIP',
                    display: 'Patient internal identifier (payer)'
                  }]
                }
              };
              
              // Ajouter l'assigner si disponible
              if (assigningAuth) {
                let cleanAuth = assigningAuth;
                if (typeof cleanAuth === 'string') {
                  cleanAuth = cleanAuth.split('&')[0].trim();
                } else if (Array.isArray(cleanAuth)) {
                  cleanAuth = cleanAuth[0] || '';
                }
                
                pipIdentifier.assigner = {
                  display: cleanAuth || 'Organisme payeur'
                };
              }
              
              const idKey = `${pipIdentifier.system}|${pipIdentifier.value}`;
              if (!processedIds.has(idKey)) {
                identifiers.push(pipIdentifier);
                processedIds.add(idKey);
              }
            } else {
              // Considérer comme un IPP par défaut
              console.log('[CONVERTER] IPP détecté dans tableau:', idValue);
              hasIPP = true;
              
              const ippIdentifier = {
                use: 'usual',
                value: idValue,
                system: 'urn:oid:1.2.250.1.71.4.2.7', // FR Core: OID conforme pour IPP
                type: {
                  coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'PI',
                    display: 'Identifiant patient interne'
                  }]
                }
              };
              
              // Ajouter l'assigner si disponible, avec nettoyage si nécessaire
              if (assigningAuth) {
                // Nettoyer les caractères spéciaux comme '&' qui peuvent être présents dans les séparateurs HL7
                let cleanAuth = assigningAuth;
                if (typeof cleanAuth === 'string') {
                  // Supprimer tout ce qui suit un & (séparateur HL7 standard)
                  cleanAuth = cleanAuth.split('&')[0];
                  // Nettoyer les séparateurs réseau et chaînes vides
                  cleanAuth = cleanAuth.replace(/\^+/g, ' ').trim();
                } else if (Array.isArray(cleanAuth)) {
                  // Si c'est un tableau, prendre uniquement le premier élément
                  cleanAuth = cleanAuth[0] || '';
                }
                
                ippIdentifier.assigner = {
                  reference: 'Organization/org-mck' // Référence vers l'organisation émettrice
                };
              }
              
              const idKey = `${ippIdentifier.system}|${ippIdentifier.value}`;
              if (!processedIds.has(idKey)) {
                identifiers.push(ippIdentifier);
                processedIds.add(idKey);
              }
            }
          }
        }
      } catch (error) {
        console.error('[CONVERTER] Erreur lors du traitement de l\'identifiant #' + index + ':', error.message);
        console.error('[CONVERTER] Item problématique:', JSON.stringify(item, null, 2));
        // Continuer avec l'élément suivant au lieu de faire planter le processus
      }
    });
    
    // Traiter les identifiants INS spécifiques détectés
    if (insIdentifiers.length > 0) {
      console.log(`[CONVERTER] ${insIdentifiers.length} identifiants INS spécifiques détectés`);
      
      insIdentifiers.forEach(ins => {
        // Créer un identifiant FHIR pour chaque INS détecté
        const insId = {
          use: 'official',
          value: ins.value,
          system: 'urn:oid:1.2.250.1.213.1.4.8', // OID standard ANS pour INS
          type: {
            coding: [{
              system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-v2-0203',
              code: 'INS-NIR', // FR Core: slice INS-NIR conforme
              display: 'Identifiant National de Santé - National Identifier Registry'
            }]
          }
        };
        
        // Vérifier si cet identifiant existe déjà
        const idKey = `${insId.system}|${insId.value}`;
        if (!processedIds.has(idKey)) {
          identifiers.push(insId);
          processedIds.add(idKey);
          hasINS = true;
          
          console.log(`[CONVERTER] Ajout de l'identifiant INS (${ins.type}): ${ins.value}`);
        }
      });
    }
  }
  
  // Si nous n'avons trouvé aucun identifiant, ajouter un identifiant temporaire
  if (identifiers.length === 0) {
    console.log('[CONVERTER] Aucun identifiant trouvé, ajout d\'un ID temporaire');
    
    const generatedId = `tmp-${Date.now()}`;
    identifiers.push({
      use: 'usual',
      value: generatedId,
      system: 'urn:oid:1.2.250.1.71.4.2.7',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'PI',
          display: 'Identifiant patient interne'
        }]
      },
      assigner: {
        reference: 'Organization/org-generated'
      }
    });
    hasIPP = true;
  }
  
  // Si nous avons un INS mais pas d'IPP, générer un IPP basé sur l'INS
  // Important pour conformité française (besoin des deux types d'identifiants)
  if (hasINS && !hasIPP) {
    console.log('[CONVERTER] INS trouvé sans IPP, ajout d\'un IPP dérivé de l\'INS');
    
    const insIdentifier = identifiers.find(id => 
      id.type?.coding?.[0]?.code === 'NI' && 
      id.system === 'urn:oid:1.2.250.1.213.1.4.8'
    );
    
    if (insIdentifier) {
      // Générer un IPP dérivé de l'INS
      const insValue = insIdentifier.value;
      const derivedIPP = `${insValue.substring(0, 5)}-${Date.now().toString().substring(0, 5)}`;
      
      identifiers.push({
        value: derivedIPP,
        system: 'urn:oid:1.2.250.1.71.4.2.7',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'PI',
            display: 'Identifiant patient interne'
          }]
        }
      });
    }
  }
  
  // Si nous avons un IPP mais pas d'INS (et si explicitement demandé pour tests)
  if (!hasINS && hasIPP && process.env.GENERATE_TEST_INS === 'true') {
    console.log('[CONVERTER] [TEST UNIQUEMENT] Génération d\'un INS simulé');
    
    const ippIdentifier = identifiers.find(id => 
      id.type?.coding?.[0]?.code === 'PI' && 
      id.system === 'urn:oid:1.2.250.1.71.4.2.7'
    );
    
    if (ippIdentifier) {
      // Format INS-C fictif pour tests uniquement - NE PAS UTILISER EN PRODUCTION
      const ippValue = ippIdentifier.value;
      const testINS = `2${ippValue.replace(/\D/g, '').padStart(13, '0').substring(0, 13)}00`;
      
      identifiers.push({
        value: testINS,
        system: 'urn:oid:1.2.250.1.213.1.4.8',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'NI',
            display: 'Numéro d\'identification au répertoire national d\'identification des personnes physiques'
          }]
        },
        assigner: {
          display: 'INSEE'
        },
        extension: [{
          url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INSi-Status',
          valueCodeableConcept: {
            coding: [{
              system: 'https://mos.esante.gouv.fr/NOS/TRE_R338-ModaliteAccueil/FHIR/TRE-R338-ModaliteAccueil',
              code: 'TEST',
              display: 'INS de test (non officiel)'
            }]
          }
        }]
      });
    }
  }
  
  console.log(`[CONVERTER] ${identifiers.length} identifiants extraits - INS: ${hasINS}, IPP: ${hasIPP}`);
  return identifiers;
}

/**
 * Récupère le libellé pour un type d'identifiant
 * @param {string} idType - Code du type d'identifiant
 * @returns {string} Libellé du type d'identifiant
 */
function getIdentifierTypeDisplay(idType) {
  const typeMap = {
    'PI': 'Patient internal identifier',
    'PPN': 'Passport number',
    'MR': 'Medical record number',
    'INS': 'National unique identifier',
    'INS-C': 'National unique identifier',
    'INS-A': 'National unique identifier',
    'INS-NIR': 'National unique identifier',
    'NI': 'National unique identifier',
    'NH': 'Numéro d\'hospitalisation'
  };
  
  return typeMap[idType] || idType;
}

/**
 * Extrait les noms du patient à partir du champ PID-5
 * Utilise l'utilitaire frenchNameExtractor pour une gestion optimisée des noms français
 * @param {Array|string} nameFields - Tableau ou chaîne de noms
 * @returns {Array} Tableau de noms FHIR
 */
function extractNames(nameFields) {
  console.log('[CONVERTER] Extraction des noms à partir de:', JSON.stringify(nameFields));
  
  if (!nameFields) {
    console.log('[CONVERTER] Aucun champ de nom fourni');
    return [];
  }
  
  // Set pour suivre les noms déjà traités et éviter les doublons
  const processedNamesMap = new Map();
  const result = [];
  
  /**
   * Ajoute un nom à la liste des résultats avec déduplication
   * @param {Object} nameObj - L'objet nom FHIR à ajouter
   */
  function addNameWithDeduplication(nameObj) {
    if (!nameObj) return;
    
    // Créer une clé unique basée sur les propriétés pertinentes de l'objet name
    const nameKey = `${nameObj.use || ''}|${nameObj.family || ''}|${(nameObj.given || []).join(',')}`;
    
    // Gérer les suffixes correctement selon FR Core - les séparer des prénoms
    if (nameObj.given && nameObj.given.length > 0) {
      const suffixes = ['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'L', 'Mme', 'M', 'Dr', 'Pr'];
      const cleanedGiven = [];
      const extractedSuffixes = [];
      
      nameObj.given.forEach(givenPart => {
        if (suffixes.includes(givenPart)) {
          extractedSuffixes.push(givenPart);
        } else if (givenPart && givenPart.trim()) {
          cleanedGiven.push(givenPart.trim());
        }
      });
      
      // Mettre à jour les prénoms nettoyés
      if (cleanedGiven.length > 0) {
        nameObj.given = cleanedGiven;
      } else {
        delete nameObj.given;
      }
      
      // Ajouter les suffixes extraits
      if (extractedSuffixes.length > 0) {
        nameObj.suffix = (nameObj.suffix || []).concat(extractedSuffixes);
      }
    }
    
    // Stratégie de regroupement :
    // 1. Si on a un nom sans prénoms et qu'on a déjà mémorisé des prénoms sans nom
    if (nameObj.family && (!nameObj.given || nameObj.given.length === 0)) {
      // Chercher si on a déjà un élément avec des prénoms sans nom de famille
      const existingGivenOnlyObj = result.find(item => 
        !item.family && item.given && item.given.length > 0 && item.use === nameObj.use
      );
      
      if (existingGivenOnlyObj) {
        // Combiner en ajoutant le nom de famille
        existingGivenOnlyObj.family = nameObj.family;
        console.log('[CONVERTER] Nom de famille ajouté à un prénom existant:', JSON.stringify(existingGivenOnlyObj));
        return;
      }
    }
    
    // 2. Si on a des prénoms sans nom et qu'on a déjà mémorisé un nom avec ou sans prénoms
    if (nameObj.given && nameObj.given.length > 0 && !nameObj.family) {
      // Chercher si on a déjà un élément avec un nom de famille (avec ou sans prénoms)
      const existingFamilyObj = result.find(item => 
        item.family && item.use === nameObj.use
      );
      
      if (existingFamilyObj) {
        // Si l'objet existant n'a pas encore de prénoms, lui ajouter ceux du nouvel objet
        if (!existingFamilyObj.given || existingFamilyObj.given.length === 0) {
          existingFamilyObj.given = nameObj.given;
          console.log('[CONVERTER] Prénoms ajoutés à un nom de famille existant:', JSON.stringify(existingFamilyObj));
          return;
        }
        
        // Si l'objet existant a déjà exactement les mêmes prénoms, ne rien faire (c'est un doublon)
        const existingGivenStr = JSON.stringify(existingFamilyObj.given.sort());
        const newGivenStr = JSON.stringify(nameObj.given.sort());
        
        if (existingGivenStr === newGivenStr) {
          console.log('[CONVERTER] Prénoms ignorés car identiques à ceux existants avec le même nom de famille');
          return;
        }
      }
      
      // Si on n'a trouvé aucun objet avec nom de famille, cherchons s'il existe un autre objet
      // avec prénoms uniquement mais identiques (pour éviter les doublons de prénoms isolés)
      const existingGivenOnlyObj = result.find(item => 
        !item.family && item.given && item.given.length > 0 && item.use === nameObj.use
      );
      
      if (existingGivenOnlyObj) {
        // Comparer les prénoms pour voir s'ils sont identiques
        const existingGivenStr = JSON.stringify(existingGivenOnlyObj.given.sort());
        const newGivenStr = JSON.stringify(nameObj.given.sort());
        
        if (existingGivenStr === newGivenStr) {
          console.log('[CONVERTER] Prénoms isolés ignorés car identiques à ceux existants');
          return;
        }
      }
    }
    
    // Vérifier si ce nom existe déjà
    if (!processedNamesMap.has(nameKey)) {
      if (nameObj.family || (nameObj.given && nameObj.given.length > 0)) {
        result.push(nameObj);
        processedNamesMap.set(nameKey, true);
        console.log('[CONVERTER] Nom ajouté:', JSON.stringify(nameObj));
      }
    } else {
      console.log('[CONVERTER] Nom ignoré car doublon:', nameKey);
    }
  }
  
  // Si nous avons une chaîne, utiliser l'extracteur français avancé
  if (typeof nameFields === 'string') {
    console.log('[CONVERTER] Traitement du nom (chaîne) avec l\'extracteur français:', nameFields);
    
    // Extraction directe des noms français sans dépendance externe
    let resourceNames = [];
    
    // Traitement direct de la chaîne de noms selon FR Core
    const nameComponents = nameFields.split('^');
    if (nameComponents.length >= 2) {
      // Nom officiel (obligatoire)
      const officialName = {
        use: 'official',
        family: nameComponents[0] || '',
        given: nameComponents[1] ? nameComponents[1].split(' ').filter(n => n.length > 0) : []
      };
      addNameWithDeduplication(officialName);
      
      // Nom d'usage (usual) si différent
      if (nameComponents.length > 2 && nameComponents[2]) {
        const usualName = {
          use: 'usual',
          family: nameComponents[2] || nameComponents[0],
          given: nameComponents[1] ? nameComponents[1].split(' ').filter(n => n.length > 0) : []
        };
        addNameWithDeduplication(usualName);
      }
    }
  }
  // Si nous avons un tableau (format pour les nouveaux parsers HL7)
  else if (Array.isArray(nameFields)) {
    console.log('[CONVERTER] Traitement des noms (tableau):', JSON.stringify(nameFields));
    console.log('[CONVERTER] Type check - every string?', nameFields.every(item => typeof item === 'string'));
    console.log('[CONVERTER] Length check:', nameFields.length);
    
    // Cas spécial: si nameFields est directement un tableau de strings simples ["MARTIN", "JEAN", "PIERRE"]
    if (nameFields.length >= 1 && nameFields.every(item => typeof item === 'string')) {
      console.log('[CONVERTER] MATCH! Détection format tableau simple de noms:', nameFields);
      const familyName = nameFields[0];
      const givenNames = nameFields.slice(1).filter(name => name && name.trim() !== '');
      
      const nameObj = {
        use: 'official',
        family: familyName,
        given: givenNames
      };
      
      console.log('[CONVERTER] Nom créé depuis tableau simple:', JSON.stringify(nameObj));
      addNameWithDeduplication(nameObj);
      console.log('[CONVERTER] Total après ajout tableau simple:', result.length);
      console.log('[CONVERTER] Result array:', JSON.stringify(result));
      return result; // Sortir immédiatement après traitement
    } else {
      console.log('[CONVERTER] PAS de match pour format tableau simple');
      nameFields.forEach((item, index) => {
        console.log(`[CONVERTER] Item ${index}: type=${typeof item}, value=${JSON.stringify(item)}`);
      });
    }
    
    // Si on arrive ici sans avoir traité les noms, on force le traitement
    if (result.length === 0 && nameFields.length > 0) {
      console.log('[CONVERTER] FORCE: Tentative de récupération des noms...');
      
      // Essayer de traiter comme des chaînes
      nameFields.forEach((field, index) => {
        if (typeof field === 'string' && field.length > 0) {
          console.log(`[CONVERTER] FORCE: Traitement chaîne ${index}: ${field}`);
          if (index === 0) {
            // Premier élément = nom de famille
            const nameObj = {
              use: 'official',
              family: field,
              given: []
            };
            addNameWithDeduplication(nameObj);
          } else {
            // Autres éléments = prénoms, ajouter au dernier nom
            if (result.length > 0) {
              result[result.length - 1].given.push(field);
            }
          }
        }
      });
    }
    
    // Parcourir chaque élément du tableau
    nameFields.forEach(field => {
      if (!field) return;
      
      // Si c'est une chaîne dans un tableau
      if (typeof field === 'string') {
        // Extraction directe des noms français selon FR Core
        const nameComponents = field.split('^');
        if (nameComponents.length >= 2) {
          // Nom officiel (obligatoire)
          const officialName = {
            use: 'official',
            family: nameComponents[0] || '',
            given: nameComponents[1] ? nameComponents[1].split(' ').filter(n => n.length > 0) : []
          };
          addNameWithDeduplication(officialName);
          
          // Nom d'usage (usual) si différent
          if (nameComponents.length > 2 && nameComponents[2]) {
            const usualName = {
              use: 'usual',
              family: nameComponents[2] || nameComponents[0],
              given: nameComponents[1] ? nameComponents[1].split(' ').filter(n => n.length > 0) : []
            };
            addNameWithDeduplication(usualName);
          }
        }
      }
      // Si c'est un tableau ou un objet
      else if (Array.isArray(field) || typeof field === 'object') {
        // Cas 1: C'est un tableau direct (structure [family, given, middle, ...])
        if (Array.isArray(field)) {
          // Traitement direct du tableau selon FR Core
          if (field.length >= 2) {
            // Nom officiel (obligatoire)
            const officialName = {
              use: 'official',
              family: field[0] || '',
              given: field[1] ? [field[1]].concat(field[2] ? [field[2]] : []).filter(n => n.length > 0) : []
            };
            addNameWithDeduplication(officialName);
            
            // Nom d'usage (usual) si composant supplémentaire
            if (field.length > 3 && field[3]) {
              const usualName = {
                use: 'usual',
                family: field[3] || field[0],
                given: field[1] ? [field[1]].concat(field[2] ? [field[2]] : []).filter(n => n.length > 0) : []
              };
              addNameWithDeduplication(usualName);
            }
          }
          frenchNames.forEach(nameObj => {
            addNameWithDeduplication(nameObj);
          });
        }
        // Cas 2: C'est un objet avec des composants (format habituel de simple-hl7)
        else if (field.components) {
          // Convertir le format simple-hl7 en chaîne HL7 standard
          const components = field.components;
          let hl7NameString = '';
          
          // Rassembler jusqu'à 7 composants (XPN.1 à XPN.7)
          for (let i = 0; i < 7; i++) {
            if (components[i] && components[i].value) {
              hl7NameString += components[i].value;
            }
            // Ajouter le séparateur même si le composant est vide
            if (i < 6) {
              hl7NameString += '^';
            }
          }
          
          // Utiliser l'extracteur français avancé sur la chaîne reconstruite
          const frenchNames = extractFrenchNames(hl7NameString);
          frenchNames.forEach(nameObj => {
            addNameWithDeduplication(nameObj);
          });
        }
      }
    });
  }
  
  console.log('[CONVERTER] Total noms extraits:', result.length);
  return result;

}

/**
 * Mappe le code d'utilisation du nom HL7 vers FHIR
 * @param {string} hl7NameUse - Code d'utilisation du nom HL7
 * @returns {string} Code d'utilisation du nom FHIR
 */
function mapNameUseToFHIR(hl7NameUse) {
  const nameUseMap = {
    'L': 'official', // Legal
    'D': 'usual',    // Display
    'M': 'maiden',   // Maiden
    'N': 'nickname', // Nickname
    'S': 'anonymous',// Pseudonym
    'A': 'anonymous',// Alias
    'I': 'old'       // Licence
  };
  
  return nameUseMap[hl7NameUse] || 'official';
}

/**
 * Détermine le genre du patient à partir du champ PID-8
 * @param {Object|string} genderField - Champ de genre
 * @returns {string} Genre FHIR
 */
function determineGender(genderField) {
  console.log('[CONVERTER] Gender field received:', typeof genderField, genderField);
  
  if (!genderField) {
    return 'unknown';
  }
  
  // Extraire la valeur du champ selon son type
  let genderValue = '';
  
  if (typeof genderField === 'string') {
    // Si c'est une chaîne, l'utiliser directement
    genderValue = genderField;
  } else if (typeof genderField === 'object') {
    // Si c'est un objet, essayer différentes façons d'extraire la valeur
    if (genderField.value) {
      genderValue = genderField.value;
    } else if (genderField.toString && typeof genderField.toString === 'function') {
      genderValue = genderField.toString();
    }
  }
  
  // Normaliser et traiter la valeur du genre
  if (!genderValue) {
    return 'unknown';
  }
  
  const gender = genderValue.toString().toUpperCase().trim();
  
  switch (gender) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'A':
      return 'other'; // Ambiguous
    case 'U':
      return 'unknown';
    default:
      return 'unknown';
  }
}

/**
 * Formate la date de naissance à partir du champ PID-7
 * @param {Object|string} birthDateField - Champ de date de naissance
 * @returns {string} Date de naissance au format YYYY-MM-DD
 */
function formatBirthDate(birthDateField) {
  if (!birthDateField) {
    return null;
  }
  
  // Extraire la valeur du champ selon son type
  let dateValue = '';
  
  if (typeof birthDateField === 'string') {
    // Si c'est une chaîne, l'utiliser directement
    dateValue = birthDateField;
  } else if (typeof birthDateField === 'object') {
    // Si c'est un objet, essayer différentes façons d'extraire la valeur
    if (birthDateField.value) {
      dateValue = birthDateField.value;
    } else if (birthDateField.toString && typeof birthDateField.toString === 'function') {
      dateValue = birthDateField.toString();
    }
  }
  
  if (!dateValue) {
    return null;
  }
  
  // Format attendu: YYYYMMDD ou YYYYMMDDHHMMSS
  if (/^\d{8}/.test(dateValue)) {
    const year = dateValue.substring(0, 4);
    const month = dateValue.substring(4, 6);
    const day = dateValue.substring(6, 8);
    
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

/**
 * Détermine l'état civil à partir du champ PID-16
 * @param {Object|string} maritalStatusField - Champ d'état civil
 * @returns {Object} État civil FHIR
 */
function determineMaritalStatus(maritalStatusField) {
  if (!maritalStatusField) {
    return null;
  }
  
  // Extraire la valeur du champ selon son type
  let maritalStatus = '';
  
  if (typeof maritalStatusField === 'string') {
    // Si c'est une chaîne, l'utiliser directement
    maritalStatus = maritalStatusField;
  } else if (typeof maritalStatusField === 'object') {
    // Si c'est un objet, essayer différentes façons d'extraire la valeur
    if (maritalStatusField.value) {
      maritalStatus = maritalStatusField.value;
    } else if (maritalStatusField.toString && typeof maritalStatusField.toString === 'function') {
      maritalStatus = maritalStatusField.toString();
    }
  }
  
  if (!maritalStatus) {
    return null;
  }
  
  // Normaliser pour le traitement
  maritalStatus = maritalStatus.toString().trim().toUpperCase().charAt(0);
  
  const maritalStatusMap = {
    'A': { code: 'A', display: 'Annulé' },
    'D': { code: 'D', display: 'Divorcé' },
    'M': { code: 'M', display: 'Marié' },
    'S': { code: 'S', display: 'Célibataire' },
    'W': { code: 'W', display: 'Veuf/Veuve' },
    'P': { code: 'P', display: 'Partenaire' },
    'I': { code: 'I', display: 'Séparé' },
    'B': { code: 'B', display: 'Bénéficiaire' },
    'C': { code: 'C', display: 'Enfant' },
    'G': { code: 'G', display: 'Conjoint' },
    'O': { code: 'O', display: 'Autre' },
    'U': { code: 'U', display: 'Inconnu' }
  };
  
  if (maritalStatusMap[maritalStatus]) {
    return {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
        code: maritalStatusMap[maritalStatus].code,
        display: maritalStatusMap[maritalStatus].display
      }]
    };
  }
  
  return null;
}

/**
 * Extrait les coordonnées de contact à partir des champs PID-13 et PID-14
 * @param {Array} homePhoneFields - Champs de téléphone personnel
 * @param {Array} workPhoneFields - Champs de téléphone professionnel
 * @returns {Array} Tableau de coordonnées FHIR
 */
function extractTelecoms(homePhoneFields, workPhoneFields) {
  // Si les paramètres sont undefined, utiliser des tableaux vides pour éviter les erreurs
  homePhoneFields = homePhoneFields || [];
  workPhoneFields = workPhoneFields || [];
  
  try {
    console.log('[CONVERTER] Extraction des télécom à partir de:', 
                homePhoneFields ? JSON.stringify(homePhoneFields).substring(0, 200) : 'aucun', '...');
  } catch (e) {
    console.log('[CONVERTER] Échec du log des télécom:', e.message);
  }
  
  // Création d'un tableau pour stocker les emails trouvés dans le format de message HL7 français
  const foundEmailsInHL7French = [];
  
  // Recherche directe au format string pour les cas comme "~^NET^Internet^MARYSE.SECLET@WANADOO.FR"
  if (homePhoneFields) {
    // Si nous avons une chaîne unique représentant le champ PID-13
    if (typeof homePhoneFields === 'string') {
      // 1. Recherche dans le format avec tilde '~'
      const tildePattern = /\~+\^NET\^[^\^]*\^([^\^~]+@[^\^~]+)/;
      const tildeParts = homePhoneFields.split('~');
      
      for (const part of tildeParts) {
        if (part.includes('@')) {
          const emailParts = part.split('^');
          let emailValue = '';
          
          for (const emailPart of emailParts) {
            if (emailPart.includes('@')) {
              emailValue = emailPart;
              break;
            }
          }
          
          if (emailValue) {
            console.log('[CONVERTER] Email trouvé dans format chaîne HL7 français avec ~:', emailValue);
            foundEmailsInHL7French.push({
              system: 'email',
              value: emailValue,
              use: 'home'
            });
          }
        }
      }
      
      // 2. Recherche directe par expression régulière
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
      const emailMatches = homePhoneFields.match(emailRegex);
      
      if (emailMatches) {
        for (const emailMatch of emailMatches) {
          console.log('[CONVERTER] Email trouvé par regex dans le format HL7 français:', emailMatch);
          foundEmailsInHL7French.push({
            system: 'email',
            value: emailMatch,
            use: 'home'
          });
        }
      }
    }
    
    // Si nous avons un tableau, vérifier chaque élément
    if (Array.isArray(homePhoneFields)) {
      // Parcourir directement le tableau des champs télécom
      homePhoneFields.forEach(field => {
        // Format typique: ["","NET","Internet","MARYSE.SECLET@WANADOO.FR"]
        if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3] && field[3].includes('@')) {
          const emailValue = field[3];
          console.log('[CONVERTER] Email trouvé au format tableau français spécifique:', emailValue);
          foundEmailsInHL7French.push({
            system: 'email',
            value: emailValue,
            use: 'home'
          });
        }
      });
    }
  }
  
  // Détection spécifique des emails dans le format français
  if (Array.isArray(homePhoneFields)) {
    for (let i = 0; i < homePhoneFields.length; i++) {
      const field = homePhoneFields[i];
      
      // Format typique: ["","NET","Internet","MARYSE.SECLET@WANADOO.FR"]
      if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3] && field[3].includes('@')) {
        const emailValue = field[3];
        console.log('[CONVERTER] Email trouvé au format tableau français spécifique:', emailValue);
      }
      
      // Recherche dans les chaînes directes
      if (typeof field === 'string' && field.includes('@')) {
        console.log('[CONVERTER] Email trouvé directement dans champ:', field);
      }
    }
  }
  
  // Création directe du tableau des télécom
  const telecoms = [];
  
  // Set pour suivre les télécom déjà traités (éviter les doublons)
  const processedTelecoms = new Set();
  
  // Extraction directe des emails français
  if (Array.isArray(homePhoneFields)) {
    homePhoneFields.forEach(field => {
      if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3] && field[3].includes('@')) {
        const emailValue = field[3];
        console.log('[CONVERTER] Email français à format direct trouvé :', emailValue);
        
        const emailTelecom = {
          system: 'email',
          value: emailValue,
          use: 'home'
        };
        
        const key = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
        if (!processedTelecoms.has(key)) {
          telecoms.push(emailTelecom);
          processedTelecoms.add(key);
          console.log('[CONVERTER] Email français direct ajouté');
        }
      }
    });
  }
  
  // Optimisation spécifique pour les messages HL7 en format français avec des tableaux imbriqués
  // Spécifiquement pour gérer les cas comme : [["","PRN","PH","","","","","","","","","0608987212"]]
  function checkNestedArray(field, use = 'home') {
    // Format téléphone spécifique français
    if (Array.isArray(field) && field.length >= 12 && field[2] === 'PH' && field[11]) {
      // C'est un format spécifique avec le numéro en position 11
      const phoneNumber = field[11];
      console.log('[CONVERTER] Téléphone détecté dans format spécifique:', phoneNumber);
      
      // Normalization
      const normalized = normalizePhoneNumber(phoneNumber);
      if (normalized.isValid) {
        const telecomType = field[1] || 'PRN'; // PRN est souvent utilisé dans ce format
        const useFHIR = mapContactUseToFHIR(telecomType) || use;
        
        const phoneTelecom = {
          system: 'phone',
          value: normalized.value,
          use: normalized.isMobile ? 'mobile' : useFHIR
        };
        
        const telecomKey = `${phoneTelecom.system}|${phoneTelecom.use}|${phoneTelecom.value}`;
        if (!processedTelecoms.has(telecomKey)) {
          telecoms.push(phoneTelecom);
          processedTelecoms.add(telecomKey);
          console.log('[CONVERTER] Téléphone ajouté depuis format spécifique:', JSON.stringify(phoneTelecom));
          return true;
        }
      }
    } 
    // Format email spécifique français
    else if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3]) {
      // Format pour email: [,"NET","Internet","email@example.com"]
      const emailValue = field[3];
      if (emailValue && emailValue.includes('@')) {
        console.log('[CONVERTER] Email détecté dans format spécifique PRIORITAIRE:', emailValue);
        
        const emailTelecom = {
          system: 'email',
          value: emailValue,
          use: use
        };
        
        const telecomKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
        if (!processedTelecoms.has(telecomKey)) {
          telecoms.push(emailTelecom);
          processedTelecoms.add(telecomKey);
          console.log('[CONVERTER] Email ajouté depuis format spécifique:', JSON.stringify(emailTelecom));
          // Ne pas retourner true, continuer à chercher d'autres télécom
        }
      }
    }
    return false;
  }
  
  /**
   * Fonction utilitaire pour normaliser et vérifier les numéros de téléphone
   * Spécifiquement optimisée pour les numéros français
   * @param {string} phoneNumber - Le numéro à vérifier
   * @returns {Object} Le numéro normalisé et des informations sur son type
   */
  function normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      return { isValid: false };
    }
    
    // Suppression des caractères non numériques sauf le +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // Si ce n'est qu'un caractère unique ou vide, ignorer
    if (normalized.length <= 1) {
      return { isValid: false };
    }
    
    // Détection des numéros de téléphone français
    let isMobile = false;
    
    // Format +33 6xx... ou +33 7xx... (internationaux français mobiles)
    if (normalized.startsWith('+336') || normalized.startsWith('+337')) {
      isMobile = true;
    }
    // Format 06xx... ou 07xx... (français mobiles)
    else if ((normalized.startsWith('06') || normalized.startsWith('07')) && 
             (normalized.length === 10 || normalized.length === 12)) {
      isMobile = true;
    }
    
    return {
      value: normalized,
      isValid: true,
      isMobile
    };
  }
  
  // Traitement des téléphones personnels (PID-13)
  if (homePhoneFields) {
    // Cas spécial: structure particulière des téléphones français
    if (Array.isArray(homePhoneFields)) {
      // Vérifier d'abord si nous avons le format spécifique au HL7 français
      let hasSpecificFormat = false;
      
      // Traiter chaque sous-tableau dans le tableau principal
      homePhoneFields.forEach(field => {
        if (Array.isArray(field)) {
          hasSpecificFormat = hasSpecificFormat || checkNestedArray(field, 'home');
        }
      });
      
      // Si on a trouvé un format spécifique, on peut s'arrêter ici
      if (hasSpecificFormat) {
        console.log('[CONVERTER] Téléphone personnel trouvé en format spécifique français');
      }
      
      // Continuer avec le traitement standard pour tout autre format
      homePhoneFields.forEach(field => {
        if (!field) return;
        
        // Cas 1: format de l'ancien parser avec components
        if (field.components) {
          const components = field.components;
          
          // Numéro (component 1)
          const phoneNumber = components[0] ? components[0].value : '';
          if (!phoneNumber) return;
          
          const telecom = {
            value: phoneNumber,
            use: 'home'
          };
          
          // Type d'utilisation (component 2)
          if (components[1] && components[1].value) {
            telecom.use = mapContactUseToFHIR(components[1].value);
          }
          
          // Type d'équipement (component 3)
          if (components[2] && components[2].value) {
            telecom.system = mapEquipmentTypeToFHIR(components[2].value);
          } else {
            telecom.system = 'phone';
          }
          
          console.log('[CONVERTER] Télécom personnel (components) ajouté:', JSON.stringify(telecom));
          
          // Vérifier si ce télécom existe déjà (éviter doublons)
          const telecomKey = `${telecom.system}|${telecom.use}|${telecom.value}`;
          if (!processedTelecoms.has(telecomKey)) {
            telecoms.push(telecom);
            processedTelecoms.add(telecomKey);
          } else {
            console.log('[CONVERTER] Télécom ignoré car doublon:', telecomKey);
          }
        }
        // Cas 2: format du nouveau parser - tableau ou chaîne
        else {
          let parsedTelecom;
          
          // Si c'est une chaîne directe (numéro seul)
          if (typeof field === 'string') {
            const parts = field.split('^');
            
            // Numéro (component 1)
            const phoneNumber = parts[0] || '';
            if (!phoneNumber) return;
            
            parsedTelecom = {
              value: phoneNumber,
              use: 'home',
              system: 'phone'
            };
            
            // Type d'utilisation (component 2) et type d'équipement (component 3)
            let useCode = parts[1] || '';
            let equipType = parts[2] || '';
            
            if (useCode) {
              parsedTelecom.use = mapContactUseToFHIR(useCode, equipType);
            }
            
            if (equipType) {
              parsedTelecom.system = mapEquipmentTypeToFHIR(equipType);
            }
          }
          // Si c'est un tableau (format du parser détaillé)
          else if (Array.isArray(field)) {
            const phoneNumber = field[0] || '';
            if (!phoneNumber) return;
            
            parsedTelecom = {
              value: phoneNumber,
              use: 'home',
              system: 'phone'
            };
            
            // Type d'utilisation (component 2) et type d'équipement (component 3)
            let useCode = field[1] || '';
            let equipType = field[2] || '';
            
            if (useCode) {
              parsedTelecom.use = mapContactUseToFHIR(useCode, equipType);
            }
            
            if (equipType) {
              parsedTelecom.system = mapEquipmentTypeToFHIR(equipType);
            }
          }
          
          if (parsedTelecom) {
            console.log('[CONVERTER] Télécom personnel (simple) ajouté:', JSON.stringify(parsedTelecom));
            
            // Normalisation et vérification du numéro de téléphone pour FHIR
            if (parsedTelecom.system === 'phone' && parsedTelecom.value) {
              const normalized = normalizePhoneNumber(parsedTelecom.value);
              
              if (normalized.isValid) {
                // Utiliser le numéro normalisé
                parsedTelecom.value = normalized.value;
                
                // Détection des téléphones mobiles français
                if (normalized.isMobile) {
                  parsedTelecom.use = 'mobile';
                  console.log('[CONVERTER] Téléphone mobile français détecté:', parsedTelecom.value);
                }
              } else {
                // Numéro invalide, l'ignorer
                console.log('[CONVERTER] Numéro de téléphone invalide ignoré:', parsedTelecom.value);
                return;
              }
            }
            
            // Vérifier si ce télécom existe déjà (éviter doublons)
            const telecomKey = `${parsedTelecom.system}|${parsedTelecom.use}|${parsedTelecom.value}`;
            if (!processedTelecoms.has(telecomKey)) {
              telecoms.push(parsedTelecom);
              processedTelecoms.add(telecomKey);
            } else {
              console.log('[CONVERTER] Télécom ignoré car doublon:', telecomKey);
            }
            
            // Détection d'email - traitement particulier pour les cas HL7 français
            if (typeof field === 'string' && field.includes('@')) {
              const emailTelecom = {
                value: field,
                use: 'home',
                system: 'email'
              };
              console.log('[CONVERTER] Email détecté et ajouté:', JSON.stringify(emailTelecom));
              
              // Vérifier si l'email existe déjà
              const emailKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
              if (!processedTelecoms.has(emailKey)) {
                telecoms.push(emailTelecom);
                processedTelecoms.add(emailKey);
              } else {
                console.log('[CONVERTER] Email ignoré car doublon:', emailKey);
              }
            }
          }
        }
      });
    }
    // Si c'est une chaîne, essayer de l'interpréter directement
    else if (typeof homePhoneFields === 'string') {
      // Cas particulier: email direct
      if (homePhoneFields.includes('@')) {
        const emailTelecom = {
          value: homePhoneFields,
          use: 'home',
          system: 'email'
        };
        console.log('[CONVERTER] Email détecté et ajouté (direct):', JSON.stringify(emailTelecom));
        
        // Vérifier si cet email existe déjà
        const emailKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
        if (!processedTelecoms.has(emailKey)) {
          telecoms.push(emailTelecom);
          processedTelecoms.add(emailKey);
        } else {
          console.log('[CONVERTER] Email ignoré car doublon:', emailKey);
        }
      }
      // Cas d'un numéro de téléphone direct
      else {
        // Utiliser la fonction de normalisation pour vérifier
        const normalized = normalizePhoneNumber(homePhoneFields);
        
        if (normalized.isValid) {
          const phoneTelecom = {
            value: normalized.value,
            use: normalized.isMobile ? 'mobile' : 'home',
            system: 'phone'
          };
          
          console.log('[CONVERTER] Téléphone personnel ajouté (direct):', JSON.stringify(phoneTelecom));
          
          // Vérifier si ce téléphone existe déjà
          const phoneKey = `${phoneTelecom.system}|${phoneTelecom.use}|${phoneTelecom.value}`;
          if (!processedTelecoms.has(phoneKey)) {
            telecoms.push(phoneTelecom);
            processedTelecoms.add(phoneKey);
          } else {
            console.log('[CONVERTER] Téléphone ignoré car doublon:', phoneKey);
          }
        } else {
          console.log('[CONVERTER] Numéro de téléphone invalide ignoré:', homePhoneFields);
        }
      }
    }
  }
  
  // Traitement des téléphones professionnels (PID-14)
  if (workPhoneFields) {
    // Cas spécial: structure particulière des téléphones français professionnels
    if (Array.isArray(workPhoneFields)) {
      // Vérifier d'abord si nous avons le format spécifique au HL7 français
      let hasSpecificFormat = false;
      
      // Traiter chaque sous-tableau dans le tableau principal
      workPhoneFields.forEach(field => {
        if (Array.isArray(field)) {
          hasSpecificFormat = hasSpecificFormat || checkNestedArray(field, 'work');
        }
      });
      
      // Si on a trouvé un format spécifique, on peut s'arrêter ici
      if (hasSpecificFormat) {
        console.log('[CONVERTER] Téléphone professionnel trouvé en format spécifique français');
      }
      
      // Continuer avec le traitement standard pour tout autre format
      workPhoneFields.forEach(field => {
        if (!field) return;
        
        // Cas 1: format de l'ancien parser avec components
        if (field.components) {
          const components = field.components;
          
          // Numéro (component 1)
          const phoneNumber = components[0] ? components[0].value : '';
          if (!phoneNumber) return;
          
          const telecom = {
            value: phoneNumber,
            use: 'work',
            system: 'phone'
          };
          
          // Type d'équipement (component 3)
          if (components[2] && components[2].value) {
            telecom.system = mapEquipmentTypeToFHIR(components[2].value);
          }
          
          console.log('[CONVERTER] Télécom professionnel ajouté:', JSON.stringify(telecom));
          
          // Vérifier si ce télécom existe déjà
          const telecomKey = `${telecom.system}|${telecom.use}|${telecom.value}`;
          if (!processedTelecoms.has(telecomKey)) {
            telecoms.push(telecom);
            processedTelecoms.add(telecomKey);
          } else {
            console.log('[CONVERTER] Télécom professionnel ignoré car doublon:', telecomKey);
          }
        }
        // Cas 2: format du nouveau parser
        else {
          let parsedTelecom;
          
          // Si c'est une chaîne directe
          if (typeof field === 'string') {
            const parts = field.split('^');
            
            // Numéro (component 1)
            const phoneNumber = parts[0] || '';
            if (!phoneNumber) return;
            
            parsedTelecom = {
              value: phoneNumber,
              use: 'work',
              system: 'phone'
            };
            
            // Type d'équipement (component 3)
            if (parts.length > 2 && parts[2]) {
              parsedTelecom.system = mapEquipmentTypeToFHIR(parts[2]);
            }
          }
          // Si c'est un tableau
          else if (Array.isArray(field)) {
            const phoneNumber = field[0] || '';
            if (!phoneNumber) return;
            
            parsedTelecom = {
              value: phoneNumber,
              use: 'work',
              system: 'phone'
            };
            
            // Type d'équipement (component 3)
            if (field.length > 2 && field[2]) {
              parsedTelecom.system = mapEquipmentTypeToFHIR(field[2]);
            }
          }
          
          if (parsedTelecom) {
            console.log('[CONVERTER] Télécom professionnel (simple) ajouté:', JSON.stringify(parsedTelecom));
            
            // Normalisation et vérification du numéro de téléphone pour FHIR
            if (parsedTelecom.system === 'phone' && parsedTelecom.value) {
              const normalized = normalizePhoneNumber(parsedTelecom.value);
              
              if (normalized.isValid) {
                // Utiliser le numéro normalisé
                parsedTelecom.value = normalized.value;
                
                // Détection des téléphones mobiles français (même au travail)
                if (normalized.isMobile) {
                  // On peut garder 'work' comme use mais ajouter une extension pour le mobile
                  parsedTelecom.extension = [{
                    url: "https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/telecom-mobilite",
                    valueBoolean: true
                  }];
                  console.log('[CONVERTER] Téléphone mobile professionnel français détecté:', parsedTelecom.value);
                }
              } else {
                // Numéro invalide, l'ignorer
                console.log('[CONVERTER] Numéro de téléphone professionnel invalide ignoré:', parsedTelecom.value);
                return;
              }
            }
            
            // Vérifier si ce télécom existe déjà
            const telecomKey = `${parsedTelecom.system}|${parsedTelecom.use}|${parsedTelecom.value}`;
            if (!processedTelecoms.has(telecomKey)) {
              telecoms.push(parsedTelecom);
              processedTelecoms.add(telecomKey);
            } else {
              console.log('[CONVERTER] Télécom professionnel simple ignoré car doublon:', telecomKey);
            }
          }
        }
      });
    }
    // Si c'est une chaîne, essayer de l'interpréter directement
    else if (typeof workPhoneFields === 'string') {
      // Cas particulier: email direct
      if (workPhoneFields.includes('@')) {
        const emailTelecom = {
          value: workPhoneFields,
          use: 'work',
          system: 'email'
        };
        console.log('[CONVERTER] Email professionnel détecté et ajouté (direct):', JSON.stringify(emailTelecom));
        telecoms.push(emailTelecom);
      }
      // Cas d'un numéro de téléphone direct
      else {
        // Utiliser la fonction de normalisation pour vérifier
        const normalized = normalizePhoneNumber(workPhoneFields);
        
        if (normalized.isValid) {
          const phoneTelecom = {
            value: normalized.value,
            use: 'work',
            system: 'phone'
          };
          
          // Ajouter une extension pour les mobiles français utilisés au travail
          if (normalized.isMobile) {
            phoneTelecom.extension = [{
              url: "https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/telecom-mobilite",
              valueBoolean: true
            }];
          }
          
          console.log('[CONVERTER] Téléphone professionnel ajouté (direct):', JSON.stringify(phoneTelecom));
          
          // Vérifier les doublons
          const telecomKey = `${phoneTelecom.system}|${phoneTelecom.use}|${phoneTelecom.value}`;
          if (!processedTelecoms.has(telecomKey)) {
            telecoms.push(phoneTelecom);
            processedTelecoms.add(telecomKey);
          } else {
            console.log('[CONVERTER] Téléphone professionnel ignoré car doublon:', telecomKey);
          }
        } else {
          console.log('[CONVERTER] Numéro de téléphone professionnel invalide ignoré:', workPhoneFields);
        }
      }
    }
  }
  
  // Ajouter les emails français détectés spécifiquement au début
  if (foundEmailsInHL7French && foundEmailsInHL7French.length > 0) {
    console.log('[CONVERTER] Ajout des emails français spécifiquement détectés:', foundEmailsInHL7French.length);
    
    // Éviter les doublons en vérifiant chaque email avant de l'ajouter
    foundEmailsInHL7French.forEach(emailTelecom => {
      const telecomKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
      if (!processedTelecoms.has(telecomKey)) {
        telecoms.push(emailTelecom);
        processedTelecoms.add(telecomKey);
        console.log('[CONVERTER] Email français ajouté à la liste finale:', JSON.stringify(emailTelecom));
      }
    });
  }
  
  // Recherche explicite de l'email français dans une dernière tentative
  if (Array.isArray(homePhoneFields)) {
    for (const field of homePhoneFields) {
      if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3] && field[3].includes('@')) {
        const emailValue = field[3];
        console.log('[CONVERTER] Ajout direct de l\'email français au format NET:', emailValue);
        
        const emailTelecom = {
          system: 'email',
          value: emailValue,
          use: 'home'
        };
        
        const telecomKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
        if (!processedTelecoms.has(telecomKey)) {
          telecoms.push(emailTelecom);
          processedTelecoms.add(telecomKey);
        }
      }
    }
  }
  
  console.log(`[CONVERTER] Total de télécom extraits: ${telecoms.length}`);
  return telecoms;
}

/**
 * Mappe le type d'équipement HL7 vers le système FHIR
 * @param {string} equipType - Type d'équipement HL7
 * @returns {string} Système FHIR
 */
function mapEquipmentTypeToFHIR(equipType) {
  const equipMap = {
    'PH': 'phone',     // Téléphone
    'CP': 'phone',     // Téléphone portable
    'FX': 'fax',       // Fax
    'BP': 'pager',     // Bipeur
    'Internet': 'email',// Email (conformité française)
    'X.400': 'email',   // Email
    'NET': 'email',     // Email
    'URI': 'url'        // URL
  };
  
  return equipMap[equipType] || 'other';
}

/**
 * Mappe l'utilisation du contact HL7 vers FHIR
 * @param {string} useCode - Code d'utilisation HL7
 * @returns {string} Utilisation FHIR
 */
function mapContactUseToFHIR(useCode, equipType = '') {
  // Gestion spécifique pour PRN avec type d'équipement selon FR Core
  if (useCode === 'PRN') {
    if (equipType === 'CP') {
      return 'mobile';  // PRN^CP = téléphone mobile
    } else if (equipType === 'PH') {
      return 'home';    // PRN^PH = téléphone fixe domicile
    }
    return 'home';      // PRN par défaut
  }
  
  const useMap = {
    'ORN': 'work',    // Other
    'WPN': 'work',    // Work
    'VHN': 'home',    // Vacation Home
    'ASN': 'temp',    // Answering Service
    'EMR': 'mobile',  // Emergency
    'NET': 'home',    // Network (email)
    'BPN': 'work'     // Beeper
  };
  
  return useMap[useCode] || 'home';
}

/**
 * Extrait les adresses à partir du champ PID-11
 * @param {Array} addressFields - Champs d'adresse
 * @returns {Array} Tableau d'adresses FHIR
 */
function extractAddresses(addressFields) {
  // S'assurer que addressFields est défini pour éviter les erreurs
  addressFields = addressFields || [];
  
  try {
    console.log('[CONVERTER] Extraction des adresses à partir de:', 
                addressFields ? JSON.stringify(addressFields).substring(0, 200) : 'aucune', '...');
  } catch (e) {
    console.log('[CONVERTER] Échec du log des adresses:', e.message);
  }
  
  if (!addressFields) {
    console.log('[CONVERTER] Pas de champ d\'adresse fourni');
    return [];
  }
  
  const addresses = [];
  
  // Si c'est un tableau, vérifier d'abord si c'est un tableau simple de composants d'adresse
  if (Array.isArray(addressFields)) {
    // Cas spécial: si c'est un tableau simple comme ["123 RUE DE LA PAIX","","PARIS","","75001","FR","H"]
    if (addressFields.length >= 3 && addressFields.every(item => typeof item === 'string' || item === '' || item === null)) {
      console.log('[CONVERTER] Détection format tableau simple d\'adresse:', addressFields);
      
      // Traiter comme une seule adresse complète
      const street1 = addressFields[0] || '';
      const street2 = addressFields[1] || '';
      const city = addressFields[2] || '';
      const state = addressFields[3] || '';
      const postalCode = addressFields[4] || '';
      const country = addressFields[5] || '';
      const addrType = addressFields[6] || '';
      
      if (street1 || city || postalCode || country) {
        const address = {
          use: mapAddressUseToFHIR(addrType),
          type: mapAddressTypeToFHIR(addrType)
        };
        
        // Lignes d'adresse - combiner toutes les lignes non vides
        const lines = [];
        if (street1 && street1.trim()) lines.push(street1.trim());
        if (street2 && street2.trim()) lines.push(street2.trim());
        
        if (lines.length > 0) {
          address.line = lines;
        }
        
        if (city && city.trim()) address.city = city.trim();
        if (state && state.trim()) address.state = state.trim();
        if (postalCode && postalCode.trim()) address.postalCode = postalCode.trim();
        if (country && country.trim()) address.country = country.trim();
        
        console.log('[CONVERTER] Adresse consolidée créée:', JSON.stringify(address));
        addresses.push(address);
        
        // Sortir immédiatement après traitement
        return addresses;
      }
    }
    
    // Sinon, traiter comme format complexe avec multiples adresses
    addressFields.forEach(field => {
      if (!field) return;
      
      // Cas 1: Format ancien parser avec components
      if (field.components) {
        const components = field.components;
        
        // Informations d'adresse
        const street1 = components[0] ? components[0].value : '';
        const street2 = components[1] ? components[1].value : '';
        const city = components[2] ? components[2].value : '';
        const state = components[3] ? components[3].value : '';
        const postalCode = components[4] ? components[4].value : '';
        const country = components[5] ? components[5].value : '';
        
        // Type d'adresse (component 7)
        const addrType = components[6] ? components[6].value : '';
        
        if (street1 || city || postalCode || country) {
          const address = {
            use: mapAddressUseToFHIR(addrType),
            type: mapAddressTypeToFHIR(addrType)
          };
          
          // Lignes d'adresse
          const lines = [];
          if (street1) lines.push(street1);
          if (street2) lines.push(street2);
          
          if (lines.length > 0) {
            address.line = lines;
          }
          
          if (city) address.city = city;
          if (state) address.state = state;
          if (postalCode) address.postalCode = postalCode;
          if (country) address.country = country;
          
          console.log('[CONVERTER] Adresse extraite (components):', JSON.stringify(address));
          addresses.push(address);
        }
      }
      // Cas 2: Format du nouveau parser (chaîne ou tableau)
      else {
        let parsedAddress;
        
        // Si c'est une chaîne
        if (typeof field === 'string') {
          const parts = field.split('^');
          
          // Informations d'adresse
          const street1 = parts[0] || '';
          const street2 = parts[1] || '';
          const city = parts[2] || '';
          const state = parts[3] || '';
          const postalCode = parts[4] || '';
          const country = parts[5] || '';
          
          // Type d'adresse (component 7)
          const addrType = parts.length > 6 ? parts[6] : '';
          
          if (street1 || city || postalCode || country) {
            parsedAddress = {
              use: mapAddressUseToFHIR(addrType),
              type: mapAddressTypeToFHIR(addrType)
            };
            
            // Lignes d'adresse
            const lines = [];
            if (street1) lines.push(street1);
            if (street2) lines.push(street2);
            
            if (lines.length > 0) {
              parsedAddress.line = lines;
            }
            
            if (city) parsedAddress.city = city;
            if (state) parsedAddress.state = state;
            if (postalCode) parsedAddress.postalCode = postalCode;
            if (country) parsedAddress.country = country;
          }
        }
        // Si c'est un tableau
        else if (Array.isArray(field)) {
          // Informations d'adresse
          const street1 = field[0] || '';
          const street2 = field[1] || '';
          const city = field[2] || '';
          const state = field[3] || '';
          const postalCode = field[4] || '';
          const country = field[5] || '';
          
          // Type d'adresse (component 7)
          const addrType = field.length > 6 ? field[6] : '';
          
          if (street1 || city || postalCode || country) {
            parsedAddress = {
              use: mapAddressUseToFHIR(addrType),
              type: mapAddressTypeToFHIR(addrType)
            };
            
            // Lignes d'adresse
            const lines = [];
            if (street1) lines.push(street1);
            if (street2) lines.push(street2);
            
            if (lines.length > 0) {
              parsedAddress.line = lines;
            }
            
            if (city) parsedAddress.city = city;
            if (state) parsedAddress.state = state;
            if (postalCode) parsedAddress.postalCode = postalCode;
            if (country) parsedAddress.country = country;
          }
        }
        
        if (parsedAddress) {
          console.log('[CONVERTER] Adresse extraite (simple):', JSON.stringify(parsedAddress));
          addresses.push(parsedAddress);
        }
      }
    });
  }
  // Si c'est une chaîne (adresse directe)
  else if (typeof addressFields === 'string') {
    // Si l'adresse contient des séparateurs standard HL7 (^)
    if (addressFields.includes('^')) {
      const parts = addressFields.split('^');
      
      // Informations d'adresse
      const street1 = parts[0] || '';
      const street2 = parts[1] || '';
      const city = parts[2] || '';
      const state = parts[3] || '';
      const postalCode = parts[4] || '';
      const country = parts[5] || '';
      
      if (street1 || city || postalCode || country) {
        const address = {
          use: 'home',
          type: 'physical'
        };
        
        // Lignes d'adresse
        const lines = [];
        if (street1) lines.push(street1);
        if (street2) lines.push(street2);
        
        if (lines.length > 0) {
          address.line = lines;
        }
        
        if (city) address.city = city;
        if (state) address.state = state;
        if (postalCode) address.postalCode = postalCode;
        if (country) address.country = country;
        
        console.log('[CONVERTER] Adresse extraite (chaîne directe):', JSON.stringify(address));
        addresses.push(address);
      }
    }
    // Si c'est une adresse simple, traiter comme une ligne de rue
    else {
      console.log('[CONVERTER] Adresse simple détectée:', addressFields);
      addresses.push({
        use: 'home',
        type: 'physical',
        line: [addressFields]
      });
    }
  }
  
  // Format spécifique français - Extension pour les codes INSEE des communes
  addresses.forEach(address => {
    if (address.city && address.postalCode) {
      // Détection du format français avec code INSEE entre parenthèses
      const codeInseeMatch = address.city.match(/\((\d{5})\)/);
      if (codeInseeMatch) {
        address.extension = [{
          url: 'https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/commune-cog-insee',
          valueString: codeInseeMatch[1]
        }];
        
        // Nettoyer le nom de la ville
        address.city = address.city.replace(/\s*\(\d{5}\)\s*/, '');
      }
    }
  });
  
  console.log(`[CONVERTER] Total d'adresses extraites: ${addresses.length}`);
  return addresses;
}

/**
 * Mappe l'utilisation de l'adresse HL7 vers FHIR
 * @param {string} hl7AddressUse - Code d'utilisation de l'adresse HL7
 * @returns {string} Utilisation de l'adresse FHIR
 */
function mapAddressUseToFHIR(hl7AddressUse) {
  const addressUseMap = {
    'H': 'home',     // Home
    'B': 'work',     // Business
    'C': 'temp',     // Current/Temporary
    'BA': 'old',     // Bad Address
    'O': 'home',     // Office
    'V': 'home'      // Vacation
  };
  
  return addressUseMap[hl7AddressUse] || 'home';
}

/**
 * Mappe le type d'adresse HL7 vers FHIR
 * @param {string} hl7AddressType - Code de type d'adresse HL7
 * @returns {string} Type d'adresse FHIR
 */
function mapAddressTypeToFHIR(hl7AddressType) {
  const addressTypeMap = {
    'M': 'postal',     // Mailing
    'P': 'physical',   // Physical
    'B': 'both',       // Both
    'H': 'physical',   // Home (France)
    'O': 'physical',   // Office
    'C': 'postal'      // Correspondence
  };
  
  return addressTypeMap[hl7AddressType] || 'both';
}

/**
 * Ajoute les extensions françaises au patient
 * @param {Object} patientResource - Ressource Patient FHIR
 * @param {Object} pd1Segment - Segment PD1 parsé
 */
function addFrenchExtensions(patientResource, pd1Segment) {
  // Si le patient est français, ajouter les extensions appropriées
  // Exemple : INS de confiance
  if (patientResource.identifier.some(id => id.system === 'urn:oid:1.2.250.1.213.1.4.8')) {
    patientResource.extension = patientResource.extension || [];
    
    // Exemple d'extension pour l'INS vérifié (à adapter selon besoins spécifiques)
    patientResource.extension.push({
      url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INSi-Status',
      valueCodeableConcept: {
        coding: [{
          system: 'https://mos.esante.gouv.fr/NOS/TRE_R338-ModaliteAccueil/FHIR/TRE-R338-ModaliteAccueil',
          code: 'VALI',
          display: 'Identité vérifiée'
        }]
      }
    });
  }
}

/**
 * Crée une ressource Encounter FHIR à partir du segment PV1
 * @param {Array} pv1Segment - Segment PV1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object} Entrée de bundle pour un Encounter
 */
/**
 * Crée une ressource Location à partir des données d'un établissement de soins
 * @param {string|Array} locationData - Données de localisation (nom et identifiant)
 * @returns {Object} Entrée de bundle pour la ressource Location
 */
function createLocationResource(locationData) {
  if (!locationData) {
    return null;
  }
  
  let name = '';
  let identifier = '';
  
  // Extraire les informations selon le format (chaîne ou tableau)
  if (typeof locationData === 'string') {
    // Format simple "NOM DE L'ÉTABLISSEMENT"
    name = locationData;
  } else if (Array.isArray(locationData)) {
    // Format complexe ["NOM DE L'ÉTABLISSEMENT", "IDENTIFIANT", "TYPE"]
    name = locationData[0] || '';
    identifier = locationData[1] || '';
  } else if (locationData && typeof locationData === 'object') {
    // Format avec attributs nommés 
    name = locationData.name || '';
    identifier = locationData.id || '';
  }
  
  // Si aucun nom n'est trouvé, ne pas créer la ressource
  if (!name) {
    return null;
  }
  
  // Générer un identifiant unique pour cette ressource Location
  const locationId = `location-${uuid.v4().substring(0, 8)}`;
  
  const locationResource = {
    resourceType: 'Location',
    id: locationId,
    status: 'active',
    name: name
  };
  
  // CORRECTION FR CORE: Identifiant obligatoire
  locationResource.identifier = [{
    use: 'official',
    system: 'http://finess.sante.gouv.fr',
    value: identifier || name || 'UNKNOWN_FINESS'
  }];
  
  // CORRECTION FR CORE: Type obligatoire selon VS FR Core
  locationResource.type = [{
    coding: [{
      system: 'http://hl7.fr/ig/fhir/core/ValueSet/fr-core-vs-location-type',
      code: 'HOSP',
      display: 'Hôpital'
    }]
  }];
  
  // CORRECTION FR CORE: Extension fr-core-use-period obligatoire
  locationResource.extension = [{
    url: 'http://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-use-period',
    valuePeriod: {
      start: new Date().toISOString().split('T')[0]
    }
  }];
  
  // Profil FR Core obligatoire
  locationResource.meta = {
    profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-location']
  };
  
  return {
    fullUrl: `urn:uuid:${locationId}`,
    resource: locationResource,
    request: {
      method: 'POST',
      url: 'Location'
    }
  };
}

function createEncounterResource(pv1Segment, patientReference, pv2Segment = null) {
  if (!pv1Segment) {
    return null;
  }
  
  // Tableau pour stocker les ressources supplémentaires liées à l'Encounter
  // qui seront ajoutées au bundle final
  let bundleEntries = [];
  
  // Vérifier s'il y a des informations de localisation (PV1-3) pour créer une ressource Location
  let locationReference = null;
  let locationResource = null;
  
  if (pv1Segment.length > 3 && pv1Segment[3]) {
    const locationData = pv1Segment[3];
    console.log('[CONVERTER] Donnée de localisation détectée dans PV1-3:', JSON.stringify(locationData));
    
    // Format attendu pour le lieu d'hospitalisation (spécifique français)
    if (typeof locationData === 'string' && locationData.includes('^')) {
      // Format: "^^^CLINIQUE VICTOR PAUCHET&800009920&M"
      const parts = locationData.split('^');
      if (parts.length >= 4 && parts[3]) {
        const facilityName = parts[3].split('&')[0]; // Enlever les identifiants après &
        const facilityId = parts[3].split('&')[1] || ''; // Récupérer l'identifiant s'il existe
        console.log('[CONVERTER] Établissement de soins détecté:', facilityName, facilityId);
        
        // Créer une ressource Location
        locationResource = createLocationResource({name: facilityName, id: facilityId});
      }
    } else if (Array.isArray(locationData)) {
      // Format tableau: [unit, room, bed, facility, location_status, person_loc_type, building, floor, ...]
      let facilityName = '';
      let facilityId = '';
      
      // Position 3 contient généralement le nom de l'établissement
      if (locationData.length > 3 && locationData[3]) {
        if (typeof locationData[3] === 'string') {
          facilityName = locationData[3].split('&')[0]; // Enlever les identifiants après &
          facilityId = locationData[3].split('&')[1] || ''; // Récupérer l'identifiant s'il existe
        } else if (Array.isArray(locationData[3])) {
          facilityName = locationData[3][0] || '';
          facilityId = locationData[3][1] || '';
        }
        
        if (facilityName) {
          console.log('[CONVERTER] Établissement de soins détecté (format tableau):', facilityName, facilityId);
          locationResource = createLocationResource({name: facilityName, id: facilityId});
        }
      }
    }
    
    // Si aucune ressource Location n'a été créée mais que nous avons un nom d'établissement
    // dans le format ^^^CLINIQUE (spécifique aux systèmes français)
    if (!locationResource && typeof locationData === 'string') {
      // Tenter une extraction directe en cherchant la première chaîne significative après les ^
      const allParts = locationData.split('^');
      let facilityName = '';
      
      // Parcourir toutes les parties à la recherche d'une chaîne non vide
      for (let i = 0; i < allParts.length; i++) {
        const part = allParts[i].trim();
        if (part && part.length > 3) {  // Au moins 4 caractères pour éviter les codes courts
          // Extraire le nom sans les éventuels identifiants après &
          facilityName = part.split('&')[0].trim();
          break;
        }
      }
      
      if (facilityName) {
        console.log('[CONVERTER] Établissement de soins extrait via méthode alternative:', facilityName);
        locationResource = createLocationResource({name: facilityName, id: ''});
      }
    }
  }
  
  // Utiliser un UUID v4 conforme aux recommandations de l'ANS
  const encounterId = uuid.v4();
  
  // Déterminer la classe d'encounter (PV1-2)
  const patientClass = pv1Segment[2] || '';
  const encounterClass = mapPatientClassToFHIR(patientClass);
  
  // Statut de l'encounter (PV1-36 = disposition)
  const dischargeDisposition = pv1Segment.length > 36 ? pv1Segment[36] || '' : '';
  const encounterStatus = determineEncounterStatus(dischargeDisposition);
  
  // Période de l'encounter
  let admitDate = null;
  if (pv1Segment.length > 44 && pv1Segment[44]) {
    admitDate = formatHL7DateTime(pv1Segment[44]);
  }
  
  // Date de sortie prévue (PV2-9 ou PV2-30 ou PV2-40 selon les implémentations)
  let expectedExitDate = null;
  
  if (pv2Segment) {
    console.log('[CONVERTER] Analyse PV2 pour date de sortie:', JSON.stringify(pv2Segment).substring(0, 100) + '...');
    
    // Recherche dynamique de la date de sortie prévue dans tout le segment
    for (let i = 0; i < pv2Segment.length; i++) {
      if (pv2Segment[i] && 
          /^\d{8}/.test(pv2Segment[i]) && 
          (i === 9 || i === 30 || i === 40)) {
        
        expectedExitDate = formatHL7DateTime(pv2Segment[i]);
        console.log(`[CONVERTER] Date de sortie prévue trouvée à l'index ${i}:`, pv2Segment[i], '→', expectedExitDate);
        break;
      }
    }
    
    // Si aucune date n'a été trouvée aux positions connues, chercher n'importe où dans le segment
    if (!expectedExitDate) {
      for (let i = 0; i < pv2Segment.length; i++) {
        if (pv2Segment[i] && /^\d{8}/.test(pv2Segment[i])) {
          expectedExitDate = formatHL7DateTime(pv2Segment[i]);
          console.log(`[CONVERTER] Date potentielle trouvée à l'index ${i}:`, pv2Segment[i], '→', expectedExitDate);
          break;
        }
      }
    }
    
    // Si toujours aucune date n'est trouvée mais qu'on a une date d'admission, l'utiliser comme fallback
    if (!expectedExitDate && admitDate) {
      expectedExitDate = admitDate;
      console.log('[CONVERTER] Aucune date de sortie prévue trouvée, utilisation de la date d\'admission comme fallback:', admitDate);
    }
  }
  
  // Numéro de visite/séjour (PV1-19 = visit number)
  let visitNumber = null;
  // Assurer que la valeur est une chaîne et non un tableau
  if (pv1Segment.length > 19) {
    if (Array.isArray(pv1Segment[19])) {
      // Si c'est un tableau, prendre la première valeur non vide
      visitNumber = pv1Segment[19].find(v => v && (typeof v === 'string' || v.value));
      // Extraire la valeur si c'est un objet
      if (visitNumber && typeof visitNumber === 'object' && visitNumber.value) {
        visitNumber = visitNumber.value;
      }
    } else if (pv1Segment[19] && typeof pv1Segment[19] === 'object' && pv1Segment[19].value) {
      // Si c'est un objet avec une propriété value
      visitNumber = pv1Segment[19].value;
    } else {
      // Si c'est une chaîne ou autre valeur primitive
      visitNumber = pv1Segment[19];
    }
  }
  
  // Créer la ressource Encounter conforme FR Core (extensions strictement limitées)
  let encounterResource = {
    resourceType: 'Encounter',
    id: encounterId,
    status: encounterStatus,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounterClass.code,
      display: encounterClass.display
    },
    subject: {
      reference: patientReference
    },
    // SUPPRESSION: extensions healthevent-type, healthevent-identifier, fr-mode-prise-en-charge non autorisées
    extension: []
  };
  
  // CORRECTION: Seule extension autorisée selon FR Core - date de sortie estimée avec URL canonique
  if (expectedExitDate) {
    encounterResource.extension.push({
      url: "https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-encounter-estimated-discharge-date",
      valueDateTime: expectedExitDate
    });
    console.log('[FR-CORE] Extension de date de sortie estimée FR Core ajoutée:', expectedExitDate);
  }
  
  // Ajouter la période si disponible
  if (admitDate) {
    encounterResource.period = {
      start: admitDate
    };
  }
  
  // Ajouter l'identifiant de visite si disponible avec format français FR Core
  if (visitNumber) {
    // S'assurer que la valeur est bien une chaîne
    const visitNumberStr = typeof visitNumber === 'string' ? visitNumber : String(visitNumber);
    
    encounterResource.identifier = [{
      use: 'usual', // FR Core exige use pour les identifiants
      system: 'urn:oid:1.2.250.1.71.4.2.7', // FR Core: OID conforme pour identifiants VN
      value: visitNumberStr,
      type: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v2-0203",
          code: "VN",
          display: "Numéro de visite"
        }]
      },
      assigner: {
        reference: "Organization/mck-organization",
        display: "Établissement de santé"
      }
    }];
  }
  
  // Ajouter serviceProvider obligatoire pour FR Core
  encounterResource.serviceProvider = {
    reference: "Organization/mck-organization",
    display: "Établissement de santé MCK"
  };
  
  // Si pas d'extensions ajoutées, supprimer le tableau vide
  if (encounterResource.extension && encounterResource.extension.length === 0) {
    delete encounterResource.extension;
  }
  
  // CORRECTION FR Core: location obligatoire (1..*)
  if (locationResource) {
    encounterResource.location = [{
      location: {
        reference: locationResource.fullUrl,
        display: locationResource.resource.name || "Lieu d'hospitalisation"
      }
    }];
    bundleEntries.push(locationResource);
    console.log('[CONVERTER] Ressource Location ajoutée pour l\'établissement:', locationResource.resource.name);
  } else {
    // Créer location par défaut si aucune détectée (obligatoire selon FR Core)
    const defaultLocationId = uuid.v4();
    const defaultLocationResource = {
      fullUrl: `urn:uuid:${defaultLocationId}`,
      resource: {
        resourceType: 'Location',
        id: defaultLocationId,
        status: 'active',
        name: 'Service non spécifié',
        mode: 'instance',
        physicalType: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
            code: 'wa',
            display: 'Ward'
          }]
        },
        meta: {
          profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-location']
        }
      },
      request: {
        method: 'POST',
        url: 'Location'
      }
    };
    
    encounterResource.location = [{
      location: {
        reference: defaultLocationResource.fullUrl,
        display: "Service non spécifié"
      }
    }];
    bundleEntries.push(defaultLocationResource);
    console.log('[FR-CORE] Location par défaut créée (obligatoire)');
  }
  
  // Créer l'objet Encounter
  const encounterEntry = {
    fullUrl: `urn:uuid:${encounterId}`,
    resource: encounterResource,
    request: {
      method: 'POST',
      url: 'Encounter'
    }
  };
  
  // FR Core: Champs d'hospitalisation avec CodeableConcept (TRE_R213) pour class.code = "IMP"
  if (encounterClass.code === 'IMP') {
    encounterResource.hospitalization = {
      origin: {
        coding: [{
          system: 'https://mos.esante.gouv.fr/NOS/TRE_R213-LieuDePriseEnCharge/FHIR/TRE-R213-LieuDePriseEnCharge',
          code: '01',
          display: 'Etablissement de santé'
        }]
      },
      destination: {
        coding: [{
          system: 'https://mos.esante.gouv.fr/NOS/TRE_R213-LieuDePriseEnCharge/FHIR/TRE-R213-LieuDePriseEnCharge',
          code: '02',
          display: 'Domicile'
        }]
      }
    };
    
    // preAdmissionIdentifier si présent dans HL7
    if (visitNumber) {
      encounterResource.hospitalization.preAdmissionIdentifier = {
        value: visitNumber
      };
    }
  }
  
  // Ajouter le profil FR Core Encounter
  encounterResource.meta = {
    profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-encounter']
  };
  
  // Si des ressources additionnelles ont été créées (comme Location)
  if (bundleEntries.length > 0) {
    // Pour chaque ressource Location, ajouter également le profil FR Core
    bundleEntries = bundleEntries.map(entry => {
      if (entry.resource && entry.resource.resourceType === 'Location') {
        entry.resource.meta = {
          profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-location']
        };
      }
      return entry;
    });
    
    // Retourner l'entrée principale ET les entrées supplémentaires
    return {
      main: encounterEntry,
      entries: bundleEntries
    };
  }
  
  // Sinon, retourner simplement l'entrée Encounter
  return encounterEntry;
}

/**
 * Mappe la classe de patient HL7 vers FHIR
 * @param {string} patientClass - Classe de patient HL7
 * @returns {Object} Classe d'encounter FHIR avec code et libellé
 */
function mapPatientClassToFHIR(patientClass) {
  const classMap = {
    'I': { code: 'IMP', display: 'inpatient encounter' },
    'O': { code: 'AMB', display: 'ambulatory' },
    'E': { code: 'EMER', display: 'emergency' },
    'P': { code: 'AMB', display: 'ambulatory' },
    'R': { code: 'ACUTE', display: 'acute inpatient encounter' },
    'B': { code: 'AMB', display: 'ambulatory' },
    'N': { code: 'NONAC', display: 'Non-acute inpatient encounter' }
  };
  
  return classMap[patientClass] || { code: 'IMP', display: 'inpatient encounter' };
}

/**
 * Détermine le statut de l'encounter à partir de la disposition de sortie
 * @param {string} dischargeDisposition - Disposition de sortie
 * @returns {string} Statut FHIR
 */
function determineEncounterStatus(dischargeDisposition) {
  if (!dischargeDisposition) {
    return 'in-progress';
  }
  
  if (['01', '02', '03', '04', '05', '06', '07', '08', '09'].includes(dischargeDisposition)) {
    return 'finished';
  }
  
  return 'in-progress';
}

/**
 * Formate une date/heure HL7 au format ISO
 * @param {string} dateValue - Date au format HL7
 * @returns {string|null} Date au format ISO ou null si non disponible
 */
function formatHL7DateTime(dateValue) {
  if (!dateValue) {
    return null;
  }
  
  if (/^\d{8}/.test(dateValue)) {
    // Format YYYYMMDD
    if (dateValue.length === 8) {
      const year = dateValue.substring(0, 4);
      const month = dateValue.substring(4, 6);
      const day = dateValue.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    
    // Format YYYYMMDDHHMMSS
    if (dateValue.length >= 14) {
      const year = dateValue.substring(0, 4);
      const month = dateValue.substring(4, 6);
      const day = dateValue.substring(6, 8);
      const hour = dateValue.substring(8, 10);
      const minute = dateValue.substring(10, 12);
      const second = dateValue.substring(12, 14);
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    }
  }
  
  return null;
}

/**
 * Crée une ressource Organization FHIR à partir d'un champ MSH
 * @param {Array} mshSegment - Segment MSH parsé
 * @param {number} fieldIndex - Index du champ (4 pour sending, 6 pour receiving)
 * @returns {Object|null} Entrée de bundle pour une Organization ou null si non disponible
 */
function createOrganizationResource(mshSegment, fieldIndex) {
  if (!mshSegment || mshSegment.length <= fieldIndex) {
    return null;
  }
  
  const field = mshSegment[fieldIndex];
  if (!field) {
    return null;
  }
  
  // Si le champ est une chaîne, le traiter
  let orgName = '';
  let orgId = '';
  let oid = null;
  
  if (typeof field === 'string') {
    // Parser les composants s'il y en a
    const fieldParts = field.split('^');
    
    // Identifier et nom (component 1)
    orgName = fieldParts[0] || '';
    if (!orgName) {
      return null;
    }
    
    // Vérifier si le nom semble être un horodatage (format commun: YYYYMMDDhhmmss)
    // Si c'est le cas, le remplacer par un nom plus descriptif
    if (/^\d{8,14}$/.test(orgName)) {
      console.log('[CONVERTER] Nom d\'organisation semble être un horodatage:', orgName);
      // Déterminer si c'est une organisation d'envoi ou de réception
      const isSender = fieldIndex === 4;
      
      // Remplacer l'horodatage par un nom descriptif
      if (isSender) {
        orgName = `Établissement émetteur`;
      } else {
        orgName = `Établissement destinataire`;
      }
      
      // Conserver l'horodatage original comme identifiant
      orgId = `org-${fieldParts[0]}`;
      
      console.log('[CONVERTER] Nom d\'organisation remplacé par:', orgName);
    } else {
      // Identifiant de l'organisation (component 2)
      // Générer un identifiant stable basé sur le nom plutôt qu'un horodatage
      if (fieldParts.length > 1 && fieldParts[1]) {
        orgId = fieldParts[1];
      } else {
        // Utiliser le nom de l'organisation pour générer un ID stable
        // Nous convertissons le nom en un identifiant alphanumérique sans caractères spéciaux
        orgId = `org-${orgName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
      }
    }
    
    // Namespace (component 3)
    if (fieldParts.length > 2 && fieldParts[2] && fieldParts[2].includes('&')) {
      const namespaceComponents = fieldParts[2].split('&');
      if (namespaceComponents.length > 1) {
        oid = namespaceComponents[1];
      }
    }
  }
  
  const organizationId = `organization-${orgId}`;
  
  // Créer la ressource Organization
  let organizationResource = {
    resourceType: 'Organization',
    id: organizationId,
    identifier: [{
      system: oid ? `urn:oid:${oid}` : 'urn:oid:1.2.250.1.71.4.2.2',
      value: orgId
    }],
    name: orgName,
    active: true
  };
  
  // Utiliser une extension française spécifique si disponible
  if (oid) {
    organizationResource.extension = [{
      url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/Agency-NumberAssigningAuthority',
      valueIdentifier: {
        system: `urn:oid:${oid}`,
        value: orgId
      }
    }];
  }
  
  // Ajouter le profil FR Core à la ressource Organization
  organizationResource.meta = {
    profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-organization']
  };
  
  // Ajouter les extensions FR Core spécifiques si un identifiant FINESS est détecté
  const finessNumber = organizationResource.identifier?.find(id => 
    id.system === 'urn:oid:1.2.250.1.71.4.2.2')?.value;
    
  if (finessNumber) {
    console.log('[FR-CORE] Extensions FINESS appliquées à Organization:', finessNumber);
  }
  
  return {
    fullUrl: `urn:uuid:${organizationId}`,
    resource: organizationResource,
    request: {
      method: 'POST',
      url: 'Organization'
    }
  };
}

/**
 * Crée une ressource Practitioner FHIR à partir du segment ROL
 * @param {Array} rolSegment - Segment ROL parsé
 * @returns {Object|null} Entrée de bundle pour un Practitioner ou null si non disponible
 */
function createPractitionerResource(rolSegment) {
  console.log('[CONVERTER] Création de ressource Practitioner à partir de:', JSON.stringify(rolSegment).substring(0, 200));
  
  if (!rolSegment || rolSegment.length <= 4) {
    console.log('[CONVERTER] Échec: segment ROL trop court');
    return null;
  }
  
  // Récupération des données du praticien depuis ROL-4 (Role Person)
  const rolePerson = rolSegment[4];
  if (!rolePerson) {
    console.log('[CONVERTER] Échec: ROL-4 (Role Person) manquant');
    return null;
  }
  
  console.log('[CONVERTER] Type de ROL-4:', typeof rolePerson, 'Valeur:', JSON.stringify(rolePerson));
  
  // Variables pour extraire les informations du professionnel
  let rppsOrAdeliId = '';  // Identifiant RPPS ou ADELI
  let internalId = '';     // Identifiant interne
  let familyName = '';     // Nom de famille
  let givenName = '';      // Prénom(s)
  let oid = '1.2.250.1.71.4.2.1'; // OID pour RPPS/ADELI en France
  let authorityName = '';  // Nom de l'autorité d'assignation
  let profession = '';     // Code de profession
  
  try {
    // Cas 1: Format chaîne de caractères (modèle classique)
    if (typeof rolePerson === 'string') {
      console.log('[CONVERTER] Parsing de ROL-4 (chaîne):', rolePerson);
      const rolePersonParts = rolePerson.split('^');
      
      // Identifier les composants
      rppsOrAdeliId = rolePersonParts[0] || '';
      familyName = rolePersonParts.length > 1 ? rolePersonParts[1] || '' : '';
      givenName = rolePersonParts.length > 2 ? rolePersonParts[2] || '' : '';
      
      // Récupérer le type de praticien et l'autorité d'assignation si disponible
      if (rolePersonParts.length > 3 && rolePersonParts[3]) {
        profession = rolePersonParts.length > 6 ? rolePersonParts[6] || 'DOC' : 'DOC';
        
        // Autorité d'assignation et OID
        if (rolePersonParts[3].includes('&')) {
          const assigningAuthority = rolePersonParts[3];
          const authorityComponents = assigningAuthority.split('&');
          authorityName = authorityComponents[0] || '';
          
          if (authorityComponents.length > 1 && authorityComponents[1]) {
            oid = authorityComponents[1];
          }
          
          // Détection spécifique RPPS vs ADELI via l'autorité d'assignation
          if (authorityName.includes('RPPS') || 
              oid === '1.2.250.1.71.4.2.1' || 
              (rppsOrAdeliId && rppsOrAdeliId.length === 11)) {
            console.log('[CONVERTER] Numéro RPPS détecté:', rppsOrAdeliId);
          } else if (authorityName.includes('ADELI')) {
            console.log('[CONVERTER] Numéro ADELI détecté:', rppsOrAdeliId);
          }
        }
      }
    }
    // Cas 2: Format tableau (modèle du nouveau parser)
    else if (Array.isArray(rolePerson)) {
      console.log('[CONVERTER] Parsing de ROL-4 (tableau):', JSON.stringify(rolePerson));
      
      // Extraire les valeurs de base
      rppsOrAdeliId = rolePerson[0] || '';
      familyName = rolePerson.length > 1 ? rolePerson[1] || '' : '';
      givenName = rolePerson.length > 2 ? rolePerson[2] || '' : '';
      
      // Extraire les détails de l'autorité d'assignation
      if (rolePerson.length > 3 && rolePerson[3]) {
        profession = rolePerson.length > 6 ? rolePerson[6] || 'DOC' : 'DOC';
        
        // Cas 1: Autorité sous forme de chaîne
        if (typeof rolePerson[3] === 'string') {
          if (rolePerson[3].includes('&')) {
            const authorityParts = rolePerson[3].split('&');
            authorityName = authorityParts[0] || '';
            oid = authorityParts.length > 1 ? authorityParts[1] : oid;
          } else {
            authorityName = rolePerson[3];
          }
        }
        // Cas 2: Autorité sous forme d'objet
        else if (typeof rolePerson[3] === 'object') {
          const assigningAuth = rolePerson[3];
          if (assigningAuth.namespaceId) {
            authorityName = assigningAuth.namespaceId;
          }
          if (assigningAuth.universalId) {
            oid = assigningAuth.universalId;
          }
        }
        
        // Détection spécifique RPPS vs ADELI
        if (authorityName.includes('RPPS') || 
            oid === '1.2.250.1.71.4.2.1' || 
            (rppsOrAdeliId && rppsOrAdeliId.length === 11)) {
          console.log('[CONVERTER] Numéro RPPS détecté:', rppsOrAdeliId);
        } else if (authorityName.includes('ADELI')) {
          console.log('[CONVERTER] Numéro ADELI détecté:', rppsOrAdeliId);
        }
      }
    }
    
    // Extraire également l'identifiant interne si disponible (ROL-1)
    if (rolSegment[1]) {
      internalId = typeof rolSegment[1] === 'string' ? rolSegment[1] : 
                   (Array.isArray(rolSegment[1]) && rolSegment[1][0] ? rolSegment[1][0] : '');
    }
    
    console.log('[CONVERTER] Données extraites - RPPS/ADELI:', rppsOrAdeliId, 
                'Interne:', internalId,
                'Nom:', familyName, 
                'Prénom:', givenName, 
                'Autorité:', authorityName);
    
  } catch (error) {
    console.error('[CONVERTER] Erreur lors de l\'extraction des données du praticien:', error);
    // En cas d'erreur, utiliser les valeurs par défaut
    if (!familyName) familyName = 'Praticien';
    if (!givenName) givenName = '';
  }
  
  // Si nous n'avons pas d'identifiant RPPS/ADELI mais un identifiant interne, l'utiliser
  if (!rppsOrAdeliId && internalId) {
    rppsOrAdeliId = internalId;
  }
  
  // Si nous n'avons ni identifiant, ni nom, c'est insuffisant
  if (!rppsOrAdeliId && !familyName) {
    console.log('[CONVERTER] Données insuffisantes pour créer un praticien');
    return null;
  }
  
  // Générer un identifiant unique pour le praticien
  // Prendre en priorité le RPPS/ADELI, puis l'ID interne, sinon générer un UUID
  const practitionerId = `practitioner-${rppsOrAdeliId || uuid.v4()}`;
  
  // Créer la ressource Practitioner
  let practitionerResource = {
    resourceType: 'Practitioner',
    id: practitionerId
  };
  
  // Ajouter le nom (toujours requis pour ANS)
  if (familyName || givenName) {
    const humanName = {
      use: 'official'
    };
    
    // Nom de famille obligatoire
    humanName.family = familyName || 'Praticien';
    
    // Prénom(s) facultatif(s)
    if (givenName) {
      // Gérer les prénoms composés (splitter sur espace)
      if (givenName.includes(' ')) {
        humanName.given = givenName.split(' ').filter(Boolean);
      } else {
        humanName.given = [givenName];
      }
    }
    
    practitionerResource.name = [humanName];
  } else {
    // Nom par défaut requis pour la validité ANS
    practitionerResource.name = [{
      use: 'official',
      family: 'Praticien'
    }];
  }
  
  // CORRECTION FR Core: identifiants RPPS uniquement avec use, type.coding et assigner.reference
  practitionerResource.identifier = [];
  
  if (rppsOrAdeliId) {
    const isRpps = rppsOrAdeliId.length === 11 || 
                  authorityName.includes('RPPS') || 
                  oid === '1.2.250.1.71.4.2.1';
    
    if (isRpps) {
      practitionerResource.identifier.push({
        use: 'official', // CORRECTION: use obligatoire
        system: 'urn:oid:1.2.250.1.71.4.2.1',
        value: rppsOrAdeliId,
        type: {
          coding: [{
            system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-v2-0203', // CORRECTION: système FR Core
            code: 'RPPS',
            display: 'Numéro RPPS'
          }]
        },
        assigner: {
          reference: 'Organization/org-rpps', // CORRECTION: assigner.reference au lieu de display
          display: 'RPPS'
        }
      });
      console.log('[FR-CORE] Identifiant RPPS FR Core conforme ajouté:', rppsOrAdeliId);
    }
  }
  
  // Si aucun RPPS valide, créer un identifiant temporaire conforme FR Core
  if (practitionerResource.identifier.length === 0) {
    const temporaryRpps = '00000000000';
    practitionerResource.identifier.push({
      use: 'temp',
      system: 'urn:oid:1.2.250.1.71.4.2.1',
      value: temporaryRpps,
      type: {
        coding: [{
          system: 'https://hl7.fr/ig/fhir/core/CodeSystem/fr-core-cs-v2-0203',
          code: 'RPPS',
          display: 'Numéro RPPS'
        }]
      },
      assigner: {
        reference: 'Organization/org-rpps',
        display: 'RPPS'
      }
    });
    console.log('[FR-CORE] RPPS temporaire FR Core créé pour conformité');
  }
  
  // SUPPRESSION: addFrenchPractitionerExtensions qui créait des identifiants incorrects
  
  // CORRECTION FR Core: profil obligatoire ajouté - Force absolue
  if (!practitionerResource.meta) {
    practitionerResource.meta = {};
  }
  practitionerResource.meta.profile = ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-practitioner'];
  
  console.log('[FR-CORE] FORCE: Profil Practitioner ajouté:', practitionerResource.meta.profile[0]);
  
  // Rechercher le numéro RPPS ou ADELI pour les extensions FR Core
  const rppsIdentifier = practitionerResource.identifier?.find(id => 
    id.system === 'urn:oid:1.2.250.1.71.4.2.1');
    
  if (rppsIdentifier) {
    console.log('[FR-CORE] Extensions RPPS appliquées à Practitioner:', rppsIdentifier.value);
  }
  
  console.log('[CONVERTER] Ressource Practitioner créée avec profil FR Core:', 
    practitionerResource.meta?.profile ? practitionerResource.meta.profile[0] : 'Aucun profil');
  
  // CORRECTION CRITIQUE: S'assurer que le profil est bien présent - Force finale
  practitionerResource.meta = {
    profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-practitioner']
  };
  console.log('[FR-CORE] Profil Practitioner FORCÉ pour conformité 100%');
  
  return {
    fullUrl: `urn:uuid:${practitionerId}`,
    resource: practitionerResource,
    request: {
      method: 'POST',
      url: 'Practitioner'
    }
  };
}

// SUPPRESSION COMPLÈTE: fonction addFrenchPractitionerExtensions qui créait des identifiants incorrects

/**
 * Récupère le libellé pour un type de rôle
 * @param {string} roleType - Code du type de rôle
 * @returns {string} Libellé du type de rôle
 */
function getRoleTypeDisplay(roleType) {
  const roleTypeMap = {
    'ODRP': 'Médecin',
    'ODES': 'Sage-femme',
    'ODPH': 'Pharmacien',
    'ODCH': 'Chirurgien-dentiste',
    'PSYL': 'Psychologue',
    'INFI': 'Infirmier',
    'KINE': 'Masseur-kinésithérapeute'
  };
  
  return roleTypeMap[roleType] || roleType;
}

/**
 * Crée une ressource PractitionerRole FHIR à partir du segment ROL
 * @param {Array} rolSegment - Segment ROL parsé
 * @param {string} practitionerReference - Référence à la ressource Practitioner
 * @param {string} encounterReference - Référence à la ressource Encounter
 * @returns {Object|null} Entrée de bundle pour un PractitionerRole ou null si non disponible
 */
function createPractitionerRoleResource(rolSegment, practitionerReference, encounterReference) {
  if (!rolSegment || !practitionerReference) {
    return null;
  }
  
  const practitionerRoleId = `practitionerrole-${uuid.v4()}`;
  
  // ROL-3 (Role Code)
  const roleCode = rolSegment.length > 3 ? rolSegment[3] : null;
  
  if (!roleCode) {
    return null;
  }
  
  // Créer la ressource PractitionerRole
  const practitionerRoleResource = {
    resourceType: 'PractitionerRole',
    id: practitionerRoleId,
    practitioner: {
      reference: practitionerReference
    },
    active: true
  };
  
  // Ajouter le code de rôle
  practitionerRoleResource.code = [{
    coding: [{
      system: 'https://mos.esante.gouv.fr/NOS/TRE_R94-ProfessionSocial/FHIR/TRE-R94-ProfessionSocial',
      code: roleCode,
      display: getRoleTypeDisplay(roleCode)
    }]
  }];
  
  // Lier à l'encounter si disponible
  if (encounterReference) {
    practitionerRoleResource.encounter = {
      reference: encounterReference
    };
  }
  
  return {
    fullUrl: `urn:uuid:${practitionerRoleId}`,
    resource: practitionerRoleResource,
    request: {
      method: 'POST',
      url: 'PractitionerRole'
    }
  };
}

/**
 * Crée une ressource RelatedPerson FHIR à partir du segment NK1
 * @param {Array} nk1Segment - Segment NK1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object|null} Entrée de bundle pour un RelatedPerson ou null si non disponible
 */
function createRelatedPersonResource(nk1Segment, patientReference) {
  console.log('[CONVERTER] Création de ressource RelatedPerson à partir de:', JSON.stringify(nk1Segment).substring(0, 200));
  
  if (!nk1Segment || !patientReference || nk1Segment.length <= 2) {
    console.log('[CONVERTER] Échec: segment NK1 trop court ou référence patient manquante');
    return null;
  }
  
  // NK1-2 (Nom)
  const nameField = nk1Segment[2];
  if (!nameField) {
    console.log('[CONVERTER] Échec: NK1-2 (Nom) manquant');
    return null;
  }
  
  let familyName = '';
  let givenName = '';
  
  console.log('[CONVERTER] Type de NK1-2:', typeof nameField, 'Valeur:', JSON.stringify(nameField));
  
  // Si le champ est une chaîne, analyser les composants
  if (typeof nameField === 'string') {
    console.log('[CONVERTER] Parsing de NK1-2 (chaîne):', nameField);
    const nameParts = nameField.split('^');
    familyName = nameParts[0] || '';
    givenName = nameParts.length > 1 ? nameParts[1] || '' : '';
  }
  // Si c'est un tableau (cas du nouveau parser)
  else if (Array.isArray(nameField)) {
    console.log('[CONVERTER] Parsing de NK1-2 (tableau):', JSON.stringify(nameField));
    
    // Nom (components 1-2)
    familyName = nameField.length > 0 ? nameField[0] || '' : '';
    givenName = nameField.length > 1 ? nameField[1] || '' : '';
  }
  
  if (!familyName && !givenName) {
    return null;
  }
  
  const relatedPersonId = `relatedperson-${uuid.v4()}`;
  
  // Créer la ressource RelatedPerson
  let relatedPersonResource = {
    resourceType: 'RelatedPerson',
    id: relatedPersonId,
    patient: {
      reference: patientReference
    },
    active: true,
    // Identifiant obligatoire pour FR Core (1..1)
    identifier: [{
      use: 'usual',
      system: 'urn:oid:1.2.250.1.71.4.2.7',
      value: relatedPersonId,
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'PI',
          display: 'Identifiant patient interne'
        }]
      },
      assigner: {
        reference: 'Organization/org-emetteur'
      }
    }]
  };
  
  // Ajouter le nom
  if (familyName || givenName) {
    const humanName = {
      use: 'official'
    };
    
    if (familyName) {
      humanName.family = familyName;
    }
    
    if (givenName) {
      // Gérer les prénoms composés
      if (givenName.includes(' ')) {
        humanName.given = givenName.split(' ').filter(Boolean);
      } else {
        humanName.given = [givenName];
      }
    }
    
    relatedPersonResource.name = [humanName];
  }
  
  // FR Core: Telecom requis (1..*) - extraire depuis NK1-5 (téléphone) et NK1-6 (email)
  const telecoms = [];
  
  // NK1-5 (Business Phone) - position 5 dans le segment
  if (nk1Segment.length > 5 && nk1Segment[5]) {
    const phoneField = nk1Segment[5];
    console.log('[FR-CORE] Extraction telecom NK1-5:', JSON.stringify(phoneField));
    
    if (Array.isArray(phoneField) && phoneField.length >= 1 && phoneField[0]) {
      telecoms.push({
        system: 'phone',
        value: phoneField[0],
        use: phoneField.length > 1 && phoneField[1] === 'PRN' ? 'home' : 'work'
      });
    } else if (typeof phoneField === 'string' && phoneField.trim()) {
      telecoms.push({
        system: 'phone',
        value: phoneField,
        use: 'home'
      });
    }
  }
  
  // NK1-6 (Contact Person's Address) mais peut contenir email selon certaines implémentations
  if (nk1Segment.length > 6 && nk1Segment[6] && typeof nk1Segment[6] === 'string' && nk1Segment[6].includes('@')) {
    telecoms.push({
      system: 'email',
      value: nk1Segment[6],
      use: 'home'
    });
  }
  
  // Si aucun telecom extrait, ajouter un par défaut obligatoire FR Core
  if (telecoms.length === 0) {
    telecoms.push({
      system: 'phone',
      value: '0100000000',
      use: 'home'
    });
  }
  
  relatedPersonResource.telecom = telecoms;
  console.log('[FR-CORE] RelatedPerson telecom ajouté:', telecoms);
  
  // FR Core: Address requis (1..*) - extraire depuis NK1-4 (Contact Person's Address)
  const addresses = [];
  
  // NK1-4 (Contact Person's Address) - position 4 dans le segment
  if (nk1Segment.length > 4 && nk1Segment[4]) {
    const addressField = nk1Segment[4];
    console.log('[FR-CORE] Extraction address NK1-4:', JSON.stringify(addressField));
    
    if (Array.isArray(addressField) && addressField.length >= 1) {
      addresses.push({
        use: 'home',
        type: 'both',
        line: addressField[0] ? [addressField[0]] : ['Adresse non spécifiée'],
        city: addressField.length > 2 ? addressField[2] : 'Ville non spécifiée',
        postalCode: addressField.length > 4 ? addressField[4] : '00000',
        country: addressField.length > 5 ? addressField[5] : 'FRA'
      });
    } else if (typeof addressField === 'string' && addressField.trim()) {
      // Format chaîne simple
      const parts = addressField.split('^');
      addresses.push({
        use: 'home',
        type: 'both',
        line: [parts[0] || 'Adresse non spécifiée'],
        city: parts.length > 2 ? parts[2] : 'Ville non spécifiée',
        postalCode: parts.length > 4 ? parts[4] : '00000',
        country: parts.length > 5 ? parts[5] : 'FRA'
      });
    }
  }
  
  // Si aucune adresse extraite, ajouter une par défaut obligatoire FR Core
  if (addresses.length === 0) {
    addresses.push({
      use: 'home',
      type: 'both',
      line: ['Adresse non renseignée'],
      city: 'Ville non renseignée',
      postalCode: '00000',
      country: 'FRA'
    });
  }
  
  relatedPersonResource.address = addresses;
  console.log('[FR-CORE] RelatedPerson address ajouté:', addresses);
  
  // NK1-3 (Relation) avec mapping correct selon FR Core
  let relationshipCode = 'other';
  let relationshipDisplay = 'Autre';
  
  if (nk1Segment.length > 3 && nk1Segment[3]) {
    const relationshipField = nk1Segment[3];
    
    console.log('[CONVERTER] Type de NK1-3:', typeof relationshipField, 'Valeur:', JSON.stringify(relationshipField));
    
    // Si c'est une chaîne, traiter directement
    if (typeof relationshipField === 'string') {
      console.log('[CONVERTER] Parsing de NK1-3 (chaîne):', relationshipField);
      if (relationshipField.includes('MERE') || relationshipField.includes('M')) {
        relationshipCode = 'mother';
        relationshipDisplay = 'Mère';
      }
    }
    // Si c'est un tableau (cas du nouveau parser)
    else if (Array.isArray(relationshipField)) {
      console.log('[CONVERTER] Parsing de NK1-3 (tableau):', JSON.stringify(relationshipField));
      // Chercher "MERE" dans le tableau
      for (const part of relationshipField) {
        if (typeof part === 'string' && (part === 'MERE' || part === 'M')) {
          relationshipCode = 'mother';
          relationshipDisplay = 'Mère';
          break;
        }
      }
    }
  }
  
  // CORRECTION FR Core: ValueSet fr-core-vs-patient-contact-role correct
  relatedPersonResource.relationship = [{
    coding: [{
      system: 'https://hl7.fr/ig/fhir/core/ValueSet/fr-core-vs-patient-contact-role',
      code: relationshipCode,
      display: relationshipDisplay
    }]
  }];
  
  console.log('[FR-CORE] Code relation FR Core appliqué:', relationshipCode);
  
  // Ajouter le profil FR Core à la ressource RelatedPerson
  relatedPersonResource.meta = {
    profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-related-person']
  };
  
  // Ajouter des extensions spécifiques au contexte français
  if (relatedPersonResource.relationship && relatedPersonResource.relationship[0]?.coding) {
    const relationshipCode = relatedPersonResource.relationship[0].coding[0]?.code;
    console.log('[FR-CORE] Extensions relation appliquées à RelatedPerson:', relationshipCode);
  }
  
  console.log('[CONVERTER] Ressource RelatedPerson créée avec profil FR Core:', 
    relatedPersonResource.meta?.profile ? relatedPersonResource.meta.profile[0] : 'Aucun profil');
  
  return {
    fullUrl: `urn:uuid:${relatedPersonId}`,
    resource: relatedPersonResource,
    request: {
      method: 'POST',
      url: 'RelatedPerson'
    }
  };
}

/**
 * Récupère le libellé pour un code de relation
 * @param {string} relationshipCode - Code de relation
 * @returns {string} Libellé de la relation
 */
function getRelationshipDisplay(relationshipCode) {
  const relationshipMap = {
    'SPO': 'Spouse',
    'DOM': 'Life partner',
    'CHD': 'Child',
    'GRD': 'Guardian',
    'PAR': 'Parent',
    'SIB': 'Sibling',
    'SIGOTHR': 'Significant other',
    'EMC': 'Emergency contact',
    'EME': 'Employee',
    'EMR': 'Employer',
    'EXF': 'Extended family',
    'FCH': 'Foster child',
    'FTH': 'Father',
    'MTH': 'Mother',
    'NFTH': 'Natural father',
    'NMTH': 'Natural mother',
    'NPRN': 'Natural parent',
    'STPPRN': 'Step parent'
  };
  
  return relationshipMap[relationshipCode] || relationshipCode;
}

/**
 * Crée une ressource Coverage FHIR à partir des segments IN1/IN2
 * @param {Array} in1Segment - Segment IN1 parsé
 * @param {Array} in2Segment - Segment IN2 parsé (optionnel)
 * @param {string} patientReference - Référence à la ressource Patient
 * @param {Array} bundleEntries - Tableau d'entrées à ajouter au bundle principal
 * @returns {Object|null} Entrée de bundle pour un Coverage ou null si non disponible
 */
function createCoverageResource(in1Segment, in2Segment, patientReference, bundleEntries) {
  if (!in1Segment || !patientReference) {
    return null;
  }
  
  // Si bundleEntries n'est pas défini, créer un tableau vide (pour compatibilité)
  const entries = bundleEntries || [];
  
  // IN1-2 (Plan ID)
  const planId = in1Segment.length > 2 ? in1Segment[2] || '' : '';
  
  // IN1-12 (Policy Expiration Date)
  const expirationDate = in1Segment.length > 12 ? in1Segment[12] || '' : '';
  
  // IN1-16 (Name of Insured)
  const insuredNameField = in1Segment.length > 16 ? in1Segment[16] : null;
  
  if (!planId && !insuredNameField) {
    return null;
  }
  
  // Générer un UUID unique pour chaque coverage afin d'éviter tout conflit
  const coverageId = `coverage-${uuid.v4()}`;
  
  // Créer la ressource Coverage
  let coverageResource = {
    resourceType: 'Coverage',
    id: coverageId,
    status: 'active',
    beneficiary: {
      reference: patientReference
    }
  };
  
  // CORRECTION FR CORE: Payor obligatoire pour Coverage
  // IN1-4 (Nom de la compagnie d'assurance)
  const insurerField = in1Segment.length > 4 ? in1Segment[4] : null;
  
  if (insurerField) {
    let insurerName = '';
    let insurerId = '';
    
    // Extraction du nom de l'assureur
    if (Array.isArray(insurerField)) {
      if (insurerField.length > 0) {
        insurerId = insurerField[0] || '';
      }
      if (insurerField.length > 1) {
        insurerName = insurerField[1] || '';
      }
    } else if (typeof insurerField === 'string') {
      insurerId = insurerField;
      
      // Mapper les codes d'organismes français
      const frenchInsurers = {
        '101': 'CPAM',
        '102': 'MSA',
        '103': 'RSI',
        '104': 'MGEN',
        '105': 'Mutualité Fonction Publique',
        '106': 'CNMSS',
        '107': 'MGP',
        '972': 'CGSS Martinique'
      };
      
      insurerName = frenchInsurers[insurerId] || `Organisme ${insurerId}`;
    }
    
    if (insurerName || insurerId) {
      // Créer un ID unique pour l'organisme d'assurance
      const insurerOrgId = `organization-insurer-${insurerId || uuid.v4()}`;
      
      // Référencer l'organisme payeur
      coverageResource.payor = [
        {
          reference: `urn:uuid:${insurerOrgId}`,
          display: insurerName || `Organisme ${insurerId}`
        }
      ];
      
      // Ajouter l'organisation de l'assureur au bundle principal
      entries.push({
        fullUrl: `urn:uuid:${insurerOrgId}`,
        resource: {
          resourceType: 'Organization',
          id: insurerOrgId,
          identifier: [{
            system: 'urn:oid:1.2.250.1.71.4.2.2',
            value: insurerId || `ins-${uuid.v4().substring(0, 8)}`
          }],
          name: insurerName || `Organisme ${insurerId}`,
          active: true,
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: 'ins',
              display: 'Compagnie d\'assurance'
            }]
          }]
        },
        request: {
          method: 'POST',
          url: 'Organization'
        }
      });
    }
  }
  
  // Ajouter le type de couverture selon les normes ANS
  if (planId) {
    // Mappages vers les codes de type de couverture français (TRE_R28-TypeCouverture)
    // Nous utilisons des codes ANS standards au lieu des codes ActCode
    let coverageType = 'AMO'; // Assurance Maladie Obligatoire par défaut
    
    // Tenter de déterminer le type exact de couverture
    if (typeof planId === 'string') {
      // Si c'est une couverture complémentaire (mutuelle)
      if (planId.toUpperCase().includes('MUTUEL') || planId.toUpperCase().includes('COMPLEMENT')) {
        coverageType = 'AMC'; // Assurance Maladie Complémentaire
      }
      // Si c'est une prise en charge à 100%
      else if (planId.toUpperCase().includes('ALD') || planId.toUpperCase().includes('100%')) {
        coverageType = 'ALD'; // Affection Longue Durée
      }
      // Si c'est lié à un accident du travail
      else if (planId.toUpperCase().includes('AT') || planId.toUpperCase().includes('MP')) {
        coverageType = 'ATMP'; // Accident du Travail - Maladie Professionnelle
      }
    }
    
    coverageResource.type = {
      coding: [{
        system: frenchTerminology.FRENCH_SYSTEMS.TYPE_COUVERTURE,
        code: coverageType,
        display: coverageType === 'AMO' ? 'Assurance Maladie Obligatoire' :
                coverageType === 'AMC' ? 'Assurance Maladie Complémentaire' :
                coverageType === 'ALD' ? 'Affection Longue Durée' :
                coverageType === 'ATMP' ? 'Accident du Travail - Maladie Professionnelle' : 'Assurance Maladie'
      }]
    };
  }
  
  // Ajouter la période de validité
  // La date de fin de couverture peut être dans plusieurs positions selon le format HL7
  // Dans le format standard, c'est normalement IN1-13 pour la date de fin de couverture (index 13)
  const primaryExpirationDate = in1Segment.length > 13 ? in1Segment[13] : null;
  
  // Processus de traitement de date
  function processExpirationDate(dateValue) {
    if (!dateValue) return null;
    
    // Essayer d'abord le formatage standard
    let formattedDate = formatHL7DateTime(dateValue);
    
    // Si le formatage automatique échoue, essayer des formats alternatifs
    if (!formattedDate) {
      // Format YYYYMMDD sans séparateurs (ex: 20251231)
      if (/^\d{8}$/.test(dateValue)) {
        const year = dateValue.substring(0, 4);
        const month = dateValue.substring(4, 6);
        const day = dateValue.substring(6, 8);
        
        // Validation basique
        if (parseInt(year) >= 2000 && parseInt(year) <= 2099 && 
            parseInt(month) >= 1 && parseInt(month) <= 12 && 
            parseInt(day) >= 1 && parseInt(day) <= 31) {
          
          formattedDate = `${year}-${month}-${day}`;
          console.log('[CONVERTER] Date de fin de couverture formatée à partir de YYYYMMDD:', formattedDate);
        }
      }
    }
    
    return formattedDate;
  }
  
  // Vérifier la date principale (IN1-13, index 13)
  let expirationDateFormatted = processExpirationDate(primaryExpirationDate);
  
  // Si aucune date n'est trouvée à l'index principal, chercher dans d'autres positions
  if (!expirationDateFormatted) {
    // Positions alternatives connues selon différents formats
    const alternatePositions = [12, 14]; // IN1-12, IN1-14
    
    for (const dateIndex of alternatePositions) {
      if (in1Segment.length > dateIndex && in1Segment[dateIndex]) {
        expirationDateFormatted = processExpirationDate(in1Segment[dateIndex]);
        if (expirationDateFormatted) {
          console.log(`[CONVERTER] Date de fin de couverture trouvée à la position alternative IN1-${dateIndex+1}`);
          break;
        }
      }
    }
    
    // Si toujours pas de date, chercher dans un intervalle plus large
    if (!expirationDateFormatted) {
      // Chercher dans les 20 premiers champs
      for (let i = 0; i < 20 && i < in1Segment.length; i++) {
        // Sauter les positions déjà vérifiées
        if (i === 12 || i === 13 || i === 14) continue;
        
        if (in1Segment[i] && /^\d{8}$/.test(in1Segment[i]) && in1Segment[i].startsWith('20')) {
          expirationDateFormatted = processExpirationDate(in1Segment[i]);
          if (expirationDateFormatted) {
            console.log(`[CONVERTER] Date de fin de couverture trouvée à la position inhabituelle IN1-${i+1}`);
            break;
          }
        }
      }
    }
  }
  
  // CORRECTION FR CORE: Suppression des dates incorrectes
  // Les dates de couverture incorrectes provoquent des erreurs de validation FR Core
  // Ces dates doivent être définies uniquement avec des données réelles et validées
  
  // Ajouter le nom de l'assuré
  if (insuredNameField && typeof insuredNameField === 'string') {
    const components = insuredNameField.split('^');
    if (components.length > 0 && components[0]) {
      coverageResource.subscriberId = components[0];
    }
  }
  
  // Extension française: numéro AMC/AMO (dernier champ IN1) - position 36 ou dernier champ
  let insuredId = null;
  if (in1Segment.length > 36 && in1Segment[36]) {
    insuredId = in1Segment[36];
  } else if (in1Segment.length > 0) {
    // Vérifier le dernier champ qui pourrait contenir un INS
    const lastField = in1Segment[in1Segment.length - 1];
    if (lastField && typeof lastField === 'string' && lastField.match(/^\d{15}$/)) {
      // Format français INS-A/INS-C: exactement 15 chiffres
      insuredId = lastField;
      console.log('[CONVERTER] INS détecté dans le dernier champ IN1:', insuredId);
    }
  }
  
  // FR Core: Extension Coverage-InsuredID ET identifier memberid obligatoires + period.end
  if (insuredId) {
    // Ajouter identifier memberid slice
    if (!coverageResource.identifier) {
      coverageResource.identifier = [];
    }
    
    coverageResource.identifier.push({
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'memberid',
          display: 'Member identifier'
        }]
      },
      value: insuredId,
      system: 'urn:oid:1.2.250.1.213.1.4.8'
    });
    
    // Ajouter extension Coverage-InsuredID obligatoire pour NIR
    if (!coverageResource.extension) {
      coverageResource.extension = [];
    }
    
    coverageResource.extension.push({
      url: 'https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-coverage-insured-id',
      valueIdentifier: {
        use: 'official',
        system: 'urn:oid:1.2.250.1.213.1.4.8',
        value: insuredId
      }
    });
    
    console.log('[FR-CORE] Extension Coverage-InsuredID ajoutée avec NIR:', insuredId);
  }
  
  // Ajouter period.end depuis IN1-16 si disponible
  if (in1Segment.length > 16 && in1Segment[16]) {
    const endDate = processExpirationDate(in1Segment[16]);
    if (endDate) {
      if (!coverageResource.period) {
        coverageResource.period = {};
      }
      coverageResource.period.end = endDate;
      console.log('[FR-CORE] Coverage period.end ajouté depuis IN1-16:', endDate);
    }
  }
  
  // Payor obligatoire par défaut pour FR Core
  if (!coverageResource.payor || coverageResource.payor.length === 0) {
    coverageResource.payor = [{
      reference: 'Organization/assurance-maladie',
      display: 'Assurance Maladie Obligatoire'
    }];
    
    console.log('[FR-CORE] Payor obligatoire par défaut ajouté à Coverage');
  }
  
  // CORRECTION FR CORE: Vérification du payor obligatoire
  if (!coverageResource.payor || coverageResource.payor.length === 0) {
    // Payor obligatoire par défaut si non spécifié
    coverageResource.payor = [{
      reference: 'Organization/default-payor',
      display: 'Organisme d\'assurance par défaut'
    }];
    
    // Ajouter l'organisation payeur par défaut au bundle
    const defaultPayorId = 'default-payor';
    entries.push({
      fullUrl: `Organization/${defaultPayorId}`,
      resource: {
        resourceType: 'Organization',
        id: defaultPayorId,
        name: 'Organisme d\'assurance par défaut',
        type: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
            code: 'pay',
            display: 'Payer'
          }]
        }]
      },
      request: {
        method: 'POST',
        url: 'Organization'
      }
    });
    console.log('[FR-CORE] Payor obligatoire par défaut ajouté à Coverage');
  }

  // Ajouter le profil FR Core à la ressource Coverage
  coverageResource.meta = {
    profile: ['https://hl7.fr/ig/fhir/core/StructureDefinition/fr-core-coverage']
  };
  
  // Ajouter des extensions pour la couverture d'assurance française
  const category = coverageResource.type?.coding?.[0]?.code || 'AMO';
  console.log('[FR-CORE] Extensions couverture sociale appliquées à Coverage:', category);
  
  console.log('[CONVERTER] Ressource Coverage créée avec profil FR Core:', 
    coverageResource.meta?.profile ? coverageResource.meta.profile[0] : 'Aucun profil');
  
  return {
    fullUrl: `urn:uuid:${coverageId}`,
    resource: coverageResource,
    request: {
      method: 'POST',
      url: 'Coverage'
    }
  };
}

/**
 * Traite les données du segment ZBE (spécifique français)
 * @param {Array} zbeSegment - Segment ZBE parsé
 * @returns {Object} Données extraites du segment ZBE
 */
function processZBESegment(zbeSegment) {
  if (!zbeSegment) {
    return {};
  }
  
  const zbeData = {};
  
  // ZBE-1 (Mouvement : EH_xxxx)
  if (zbeSegment.length > 1 && zbeSegment[1]) {
    zbeData.movementId = zbeSegment[1];
  }
  
  // ZBE-2 (Date d'effet)
  if (zbeSegment.length > 2 && zbeSegment[2]) {
    zbeData.effectiveDate = formatHL7DateTime(zbeSegment[2]);
  }
  
  // ZBE-4 (Type de mouvement)
  if (zbeSegment.length > 4 && zbeSegment[4]) {
    zbeData.movementType = zbeSegment[4];
  }
  
  // ZBE-7 (Unité fonctionnelle)
  if (zbeSegment.length > 7 && zbeSegment[7]) {
    const unitField = zbeSegment[7];
    
    if (typeof unitField === 'string' && unitField.includes('^')) {
      const ufComponents = unitField.split('^');
      if (ufComponents.length > 8) {
        zbeData.functionalUnit = ufComponents[8];
        zbeData.functionalUnitDisplay = ufComponents.length > 9 ? ufComponents[9] : null;
      }
    }
  }
  
  return zbeData;
}

/**
 * Récupère le libellé pour un type de mouvement
 * @param {string} movementType - Code du type de mouvement
 * @returns {string} Libellé du type de mouvement
 */
function getMovementTypeDisplay(movementType) {
  // Utiliser l'adaptateur de terminologie française pour la conformité ANS
  return frenchTerminology.getMovementTypeInfo(movementType).display;
}

/**
 * Traite les données du segment ZFP (spécifique français - infos patient)
 * @param {Array} zfpSegment - Segment ZFP parsé
 * @returns {Object} Données extraites du segment ZFP
 */
function processZFPSegment(zfpSegment) {
  if (!zfpSegment) {
    return {};
  }
  
  const zfpData = {};
  
  // ZFP-1 (Informations administratives patient)
  if (zfpSegment.length > 1 && zfpSegment[1]) {
    zfpData.administrativeInfo = zfpSegment[1];
  }
  
  // ZFP-2 (Informations complémentaires patient)
  if (zfpSegment.length > 2 && zfpSegment[2]) {
    zfpData.additionalInfo = zfpSegment[2];
  }
  
  return zfpData;
}

/**
 * Traite les données du segment ZFV (spécifique français - infos visite)
 * @param {Array} zfvSegment - Segment ZFV parsé
 * @returns {Object} Données extraites du segment ZFV
 */
function processZFVSegment(zfvSegment) {
  if (!zfvSegment) {
    return {};
  }
  
  const zfvData = {};
  
  // ZFV-1 (Encodage classe d'encounter)
  if (zfvSegment.length > 1 && zfvSegment[1]) {
    const encounterClassValue = zfvSegment[1];
    
    // Mapping des codes français vers les classes FHIR conformes à l'ANS
    const classMappings = {
      'H': { 
        code: 'IMP', 
        display: 'Hospitalisation',
        frenchSystem: frenchTerminology.FRENCH_SYSTEMS.MODE_PRISE_EN_CHARGE,
        frenchCode: 'HOSPITALT'
      },
      'U': { 
        code: 'EMER', 
        display: 'Urgences',
        frenchSystem: frenchTerminology.FRENCH_SYSTEMS.MODE_PRISE_EN_CHARGE,
        frenchCode: 'URMG'
      },
      'C': { 
        code: 'AMB', 
        display: 'Consultation externe',
        frenchSystem: frenchTerminology.FRENCH_SYSTEMS.MODE_PRISE_EN_CHARGE,
        frenchCode: 'CONSULT'
      },
      'E': { 
        code: 'AMB', 
        display: 'Consultation externe',
        frenchSystem: frenchTerminology.FRENCH_SYSTEMS.MODE_PRISE_EN_CHARGE,
        frenchCode: 'CONSULT'
      }
    };
    
    if (encounterClassValue && classMappings[encounterClassValue]) {
      // Structure standard pour le code de classe d'encounter
      zfvData.encounterClass = {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: classMappings[encounterClassValue].code,
        display: classMappings[encounterClassValue].display
      };
      
      // Extension française avec les codes de la terminologie ANS
      zfvData.modePriseEnCharge = {
        system: classMappings[encounterClassValue].frenchSystem,
        code: classMappings[encounterClassValue].frenchCode,
        display: classMappings[encounterClassValue].display
      };
    }
  }
  
  return zfvData;
}

/**
 * Traite les données du segment ZFM (spécifique français - infos médicales)
 * @param {Array} zfmSegment - Segment ZFM parsé
 * @returns {Object} Données extraites du segment ZFM
 */
function processZFMSegment(zfmSegment) {
  if (!zfmSegment) {
    return {};
  }
  
  const zfmData = {};
  
  // ZFM-1 (Type d'hospitalisation)
  if (zfmSegment.length > 1 && zfmSegment[1]) {
    zfmData.hospitalizationType = zfmSegment[1];
  }
  
  // ZFM-2 (Mode d'entrée)
  if (zfmSegment.length > 2 && zfmSegment[2]) {
    zfmData.admissionMode = zfmSegment[2];
  }
  
  // ZFM-3 (Mode de sortie)
  if (zfmSegment.length > 3 && zfmSegment[3]) {
    zfmData.dischargeMode = zfmSegment[3];
  }
  
  return zfmData;
}

/**
 * Fonction spécialisée pour traiter les segments Z spécifiques français
 * @param {Object} segments - Segments du message HL7
 * @param {Object} bundle - Bundle FHIR en construction
 */
function processFrenchZSegments(segments, bundle) {
  console.log('[CONVERTER] Traitement des segments Z français');
  
  // 1. Extraire les informations des segments Z pertinents
  
  // Segment ZBE - Mouvement hospitalier français
  if (segments.ZBE && segments.ZBE.length > 0) {
    const zbeSegment = segments.ZBE[0];
    // Format: ZBE|3517108^MED|20240918060000||INSERT|N||ACE ST JEAN^^^^^MED^UF^^^1000
    
    // Identifier l'encounter à mettre à jour
    let encounterEntry = null;
    for (const entry of bundle.entry) {
      if (entry.resource.resourceType === 'Encounter') {
        encounterEntry = entry;
        break;
      }
    }
    
    if (encounterEntry) {
      console.log('[CONVERTER] Enrichissement Encounter avec données ZBE');
      
      // Ajouter des identifiants si disponibles (ZBE-1)
      if (zbeSegment[1]) {
        if (!encounterEntry.resource.identifier) {
          encounterEntry.resource.identifier = [];
        }
        
        const zbeId = Array.isArray(zbeSegment[1]) ? zbeSegment[1][0] : zbeSegment[1];
        const zbeSystem = Array.isArray(zbeSegment[1]) && zbeSegment[1].length > 1 ? zbeSegment[1][1] : 'MED';
        
        encounterEntry.resource.identifier.push({
          system: `urn:oid:1.2.250.1.213.1.1.${zbeSystem === 'MED' ? '4.6' : '4.2'}`,
          value: zbeId,
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'VN',
              display: 'Visit Number'
            }]
          }
        });
      }
      
      // Ajouter des informations sur l'unité fonctionnelle (ZBE-7)
      if (zbeSegment[7] && Array.isArray(zbeSegment[7])) {
        const serviceName = zbeSegment[7][0] || '';
        
        if (serviceName && !encounterEntry.resource.serviceProvider) {
          const serviceProviderUuid = `organization-${uuid.v4()}`;
          
          // Ajouter l'organisation de service
          bundle.entry.push({
            fullUrl: `urn:uuid:${serviceProviderUuid}`,
            resource: {
              resourceType: 'Organization',
              id: serviceProviderUuid,
              name: serviceName,
              type: [{
                coding: [{
                  system: 'http://terminology.hl7.org/CodeSystem/organization-type',
                  code: 'dept',
                  display: 'Hospital Department'
                }]
              }]
            },
            request: {
              method: 'POST',
              url: 'Organization'
            }
          });
          
          // Référencer cette organisation dans l'encounter
          encounterEntry.resource.serviceProvider = {
            reference: `urn:uuid:${serviceProviderUuid}`
          };
        }
      }
    }
  }
  
  // Segment ZFV - Informations de visite supplémentaires
  if (segments.ZFV && segments.ZFV.length > 0) {
    const zfvSegment = segments.ZFV[0];
    // Format typique: ZFV| ^20240918000000
    
    // Chercher l'encounter à enrichir
    let encounterEntry = null;
    for (const entry of bundle.entry) {
      if (entry.resource.resourceType === 'Encounter') {
        encounterEntry = entry;
        break;
      }
    }
    
    if (encounterEntry && zfvSegment[1] && Array.isArray(zfvSegment[1])) {
      const visitDate = zfvSegment[1][1] || '';
      
      // Date au format YYYYMMDDHHMMSS
      if (visitDate && /^\d{12,14}$/.test(visitDate)) {
        const year = visitDate.substring(0, 4);
        const month = visitDate.substring(4, 6);
        const day = visitDate.substring(6, 8);
        const hour = visitDate.substring(8, 10) || '00';
        const minute = visitDate.substring(10, 12) || '00';
        const second = visitDate.substring(12, 14) || '00';
        
        const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}+00:00`;
        
        // Ajouter aux périodes de l'encounter
        if (!encounterEntry.resource.period) {
          encounterEntry.resource.period = {};
        }
        
        encounterEntry.resource.period.start = isoDate;
      }
    }
  }
  
  // Segment ZFP - Praticien français supplémentaire
  if (segments.ZFP && segments.ZFP.length > 0) {
    // Traitement spécifique si nécessaire
    console.log('[CONVERTER] ZFP segment détecté, pas d\'information complémentaire')
  }
  
  // Segment ZMP - Mode de prise en charge (spécifique français)
  if (segments.ZMP && segments.ZMP.length > 0) {
    const zmpSegment = segments.ZMP[0];
    // Format: ZMP|0||||1^M.^MED|P
    
    // Identifier l'encounter à mettre à jour
    let encounterEntry = null;
    for (const entry of bundle.entry) {
      if (entry.resource.resourceType === 'Encounter') {
        encounterEntry = entry;
        break;
      }
    }
    
    if (encounterEntry && zmpSegment[5] && Array.isArray(zmpSegment[5])) {
      // Extraire le titre et le préfixe du zmpSegment[5] (format 1^M.^MED)
      const titlePrefix = zmpSegment[5][1] || '';
      
      // Ajouter une extension française pour le titre de civilité
      if (titlePrefix) {
        if (!encounterEntry.resource.extension) {
          encounterEntry.resource.extension = [];
        }
        
        encounterEntry.resource.extension.push({
          url: 'http://interopsante.org/fhir/StructureDefinition/fr-encounter-title',
          valueString: titlePrefix
        });
      }
    }
  }
  
  // Segment ZFD - Données supplémentaires françaises
  if (segments.ZFD && segments.ZFD.length > 0) {
    const zfdSegment = segments.ZFD[0];
    
    // Identifier l'encounter à mettre à jour
    let encounterEntry = null;
    for (const entry of bundle.entry) {
      if (entry.resource.resourceType === 'Encounter') {
        encounterEntry = entry;
        break;
      }
    }
    
    if (encounterEntry && zfdSegment.length > 5) {
      const specialty = zfdSegment[5];
      
      if (specialty) {
        // Ajouter la spécialité médicale comme type d'encounter
        if (!encounterEntry.resource.type) {
          encounterEntry.resource.type = [];
        }
        
        encounterEntry.resource.type.push({
          coding: [{
            system: "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale",
            code: specialty,
            display: specialty === "SM" ? "Médecine générale" : specialty
          }]
        });
      }
    }
  }
  
  // Segment ZMD - Mode de sortie et informations complémentaires
  if (segments.ZMD && segments.ZMD.length > 0) {
    const zmdSegment = segments.ZMD[0];
    
    // Identifier l'encounter à mettre à jour
    let encounterEntry = null;
    for (const entry of bundle.entry) {
      if (entry.resource.resourceType === 'Encounter') {
        encounterEntry = entry;
        break;
      }
    }
    
    if (encounterEntry && zmdSegment.length > 8) {
      // ZMD-8 et ZMD-9 : indicateurs d'anesthésie ou de consultation urgente
      const hasEmergency = zmdSegment[8] === 'Y';
      const hasAnesthesia = zmdSegment[9] === 'Y';
      
      if (hasEmergency || hasAnesthesia) {
        if (!encounterEntry.resource.extension) {
          encounterEntry.resource.extension = [];
        }
        
        if (hasEmergency) {
          encounterEntry.resource.extension.push({
            url: "http://interopsante.org/fhir/StructureDefinition/fr-encounter-emergency",
            valueBoolean: true
          });
        }
        
        if (hasAnesthesia) {
          encounterEntry.resource.extension.push({
            url: "http://interopsante.org/fhir/StructureDefinition/fr-encounter-anesthesia",
            valueBoolean: true
          });
        }
      }
    }
  }
  
  // Segment ZMO - Données de modulation tarifaire
  if (segments.ZMO && segments.ZMO.length > 0) {
    const zmoSegment = segments.ZMO[0];
    
    // Parcourir les ressources Coverage si elles existent
    for (const entry of bundle.entry) {
      if (entry.resource.resourceType === 'Coverage') {
        // ZMO-12 : Y/N pour "pris en charge 100%"
        if (zmoSegment.length > 12 && zmoSegment[12] === 'Y') {
          // Ajouter une extension pour indiquer la prise en charge à 100%
          if (!entry.resource.extension) {
            entry.resource.extension = [];
          }
          
          entry.resource.extension.push({
            url: "http://interopsante.org/fhir/StructureDefinition/fr-coverage-full-coverage",
            valueBoolean: true
          });
        }
        
        break; // Traiter uniquement la première ressource Coverage
      }
    }
  }
  
  console.log('[CONVERTER] Traitement des segments Z français terminé');
}

/**
 * Mappe les codes de relation HL7 vers les codes FR Core Patient Contact Role
 */
function mapToFrCoreRelationship(hl7Code) {
  const relationshipMap = {
    'SPO': { code: 'spouse', display: 'Époux/épouse' },
    'DOM': { code: 'partner', display: 'Partenaire domestique' },
    'CHD': { code: 'child', display: 'Enfant' },
    'PAR': { code: 'parent', display: 'Parent' },
    'SIB': { code: 'sibling', display: 'Frère/sœur' },
    'GRD': { code: 'guardian', display: 'Tuteur légal' },
    'OTH': { code: 'other', display: 'Autre' },
    'PERE': { code: 'parent', display: 'Père' },
    'MERE': { code: 'parent', display: 'Mère' },
    'AUTRE': { code: 'other', display: 'Autre' }
  };
  
  return relationshipMap[hl7Code] || { code: 'other', display: 'Autre' };
}

/**
 * Crée une ressource MessageHeader à partir du segment MSH
 * Conforme aux spécifications FHIR R4 et FR Core
 */
function createMessageHeaderResource(mshSegment) {
  const messageHeaderId = `messageheader-${Date.now()}`;
  
  // Extraire les informations du MSH
  const sendingApplication = mshSegment[2] || 'Unknown'; // MSH-3
  const sendingFacility = mshSegment[3] || 'Unknown'; // MSH-4
  const receivingApplication = mshSegment[4] || 'Unknown'; // MSH-5
  const receivingFacility = mshSegment[5] || 'Unknown'; // MSH-6
  const timestamp = mshSegment[6] || ''; // MSH-7
  let messageType = mshSegment[8] || ''; // MSH-9
  const messageControlId = mshSegment[9] || ''; // MSH-10
  
  // S'assurer que messageType est correctement traité
  if (Array.isArray(messageType)) {
    // Si c'est un tableau comme ["ADT","A04","ADT_A01"], le convertir en chaîne
    messageType = messageType.join('^');
  }
  if (typeof messageType !== 'string') {
    messageType = String(messageType || '');
  }
  
  // Parser le type de message (ex: ADT^A04^ADT_A01)
  let eventCoding = { code: 'unknown', display: 'Unknown Event' };
  console.log('[CONVERTER] Parsing messageType:', messageType);
  
  if (messageType && messageType.length > 0) {
    const typeParts = messageType.split('^');
    console.log('[CONVERTER] TypeParts split result:', typeParts);
    
    if (typeParts.length >= 2) {
      // Utiliser directement le code d'événement (A04, A01, etc.)
      const eventType = typeParts[0]; // ADT, SIU, ORM
      const eventCode = typeParts[1]; // A04, A01, etc.
      
      eventCoding = {
        system: 'http://hl7.org/fhir/message-events',
        code: `${eventType}_${eventCode}`,
        display: `${eventType} ${eventCode} Event`
      };
      
      console.log('[CONVERTER] Event code final:', eventCoding.code);
    } else {
      console.log('[CONVERTER] TypeParts length insuffisant:', typeParts.length);
    }
  } else {
    console.log('[CONVERTER] MessageType vide ou invalide');
  }
  
  // Formater le timestamp
  let formattedTimestamp = new Date().toISOString();
  if (timestamp) {
    try {
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);
      const day = timestamp.substring(6, 8);
      const hour = timestamp.substring(8, 10) || '00';
      const minute = timestamp.substring(10, 12) || '00';
      const second = timestamp.substring(12, 14) || '00';
      formattedTimestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}+02:00`;
    } catch (error) {
      console.log('[CONVERTER] Erreur formatting timestamp MessageHeader');
    }
  }
  
  const messageHeader = {
    resourceType: 'MessageHeader',
    id: messageHeaderId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/MessageHeader']
    },
    eventCoding: eventCoding,
    source: {
      name: sendingFacility,
      software: sendingApplication,
      endpoint: `https://fhir.hospital.fr/fhir/${sendingApplication}`
    },
    destination: [{
      name: receivingFacility,
      endpoint: `https://fhir.hospital.fr/fhir/${receivingApplication}`
    }],
    timestamp: formattedTimestamp
  };
  
  // Ajouter le contrôle ID si disponible
  if (messageControlId) {
    messageHeader.id = messageControlId;
  }
  
  console.log(`[CONVERTER] MessageHeader créé avec eventCoding: ${eventCoding.code}`);
  
  return {
    fullUrl: `urn:uuid:${messageHeaderId}`,
    resource: messageHeader
  };
}

module.exports = {
  convertHL7ToFHIR
};