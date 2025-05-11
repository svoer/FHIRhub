/**
 * Module de règles spécifiques pour la conversion HL7 vers FHIR
 * Définit des règles et mappings personnalisés pour différents segments et champs HL7
 * Adapté aux spécificités des systèmes de santé français
 * 
 * @module hl7ToFhirRules
 * @author FHIRHub Team
 */

/**
 * Règles de conversion pour les différents types de messages HL7
 * Chaque règle définit comment traiter un segment ou un champ spécifique
 */
const conversionRules = {
  // Règles pour le segment PID
  PID: {
    // PID-3: Identifiants du patient
    identifiers: {
      // Mappage des types d'identifiants spécifiques à la France
      systemMapping: {
        'ASIP-SANTE-INS-NIR': 'urn:oid:1.2.250.1.213.1.4.8',
        'ASIP-SANTE-INS-C': 'urn:oid:1.2.250.1.213.1.4.2',
        'ADELI': 'urn:oid:2.16.840.1.113883.3.31.2.2',
        'RPPS': 'urn:oid:1.2.250.1.71.4.2.1',
        // Ajouter d'autres mappings si nécessaire
      }
    },
    // PID-8: Genre selon codification française
    gender: {
      // Mappage des codes de genre HL7 vers FHIR
      mapping: {
        'M': 'male',
        'F': 'female',
        'U': 'unknown',
        'O': 'other',
        'A': 'other' // Ambigu
      }
    },
    // PID-11: Adresses
    address: {
      // Types d'adresses spécifiques à la France
      useMapping: {
        'H': 'home',
        'C': 'temp',
        'B': 'work',
        'BDL': 'birth',
        // Ajouter d'autres mappings si nécessaire
      }
    },
    // PID-13: Numéros de téléphone
    telecom: {
      // Types de systèmes de communication selon standard français
      systemMapping: {
        'PH': 'phone',
        'CP': 'phone',
        'FX': 'fax',
        'Internet': 'email',
        'NET': 'email',
        // Ajouter d'autres mappings si nécessaire
      },
      // Types d'utilisation
      useMapping: {
        'PRN': 'home',
        'WPN': 'work',
        'ORN': 'old',
        // Ajouter d'autres mappings si nécessaire
      }
    }
  },

  // Règles pour le segment NK1 (Proches)
  NK1: {
    // NK1-3: Relation avec le patient
    relationship: {
      // Mappage des types de relations selon codification française
      mapping: {
        'SPO': 'spouse',
        'DOM': 'domestic partner',
        'CHD': 'child',
        'PAR': 'parent',
        'SIB': 'sibling',
        'GRP': 'grandparent',
        'GRC': 'grandchild',
        'EXT': 'extended family',
        'FAM': 'family',
        'OTH': 'other',
        'UNK': 'unknown',
        'FEMME': 'spouse', // Spécifique à la France
        // Ajouter d'autres mappings si nécessaire
      }
    }
  },

  // Règles pour le segment PV1 (Visite/Hospitalisation)
  PV1: {
    // PV1-2: Type de patient
    patientClass: {
      // Mappage des types de patients selon codification française
      mapping: {
        'I': 'inpatient',
        'O': 'outpatient',
        'E': 'emergency',
        'P': 'preadmit',
        'R': 'recurring',
        'B': 'obstetrics',
        'C': 'commercial account',
        'N': 'not applicable',
        'U': 'unknown',
        // Ajouter d'autres mappings si nécessaire
      }
    },
    // PV1-3: Point de service/localisation
    location: {
      // Extraire le niveau de détail maximal disponible
      extract: [
        // [index du composant, nom de l'attribut FHIR]
        [0, 'identifier'], // Identifiant du point de service
        [3, 'display'],    // Nom du point de service
        // Ajouter d'autres extractions si nécessaire
      ]
    }
  },
  
  // Règles pour les segments spécifiques aux Z-segments (segments personnalisés)
  Z: {
    // Règles générales pour les segments Z
    general: {
      // Ajouter les données Z comme extensions FHIR
      addAsExtension: true,
      // Préfixe d'URL pour les extensions Z
      extensionUrlPrefix: 'https://fhirhub.health/fhir/StructureDefinition/'
    },
    // Segments spécifiques
    segments: {
      // ZBE: Données d'admission/séjour
      ZBE: {
        // Identifiant de l'épisode de soins
        episodeIdentifier: 0,
        // Date d'admission
        admissionDate: 1,
        // Type d'opération
        operationType: 3
      },
      // ZFD: Données administratives françaises
      ZFD: {
        // Mappage des champs ZFD vers des extensions FHIR
        mapping: {
          // [index du champ ZFD, nom de l'extension]
          4: 'identityMethod',
          5: 'verificationDateTime'
        }
      }
    }
  },
  
  // Règles pour le segment ROL (Rôle)
  ROL: {
    // ROL-3: Type de rôle
    roleType: {
      // Mappage des types de rôles français vers les codes FHIR
      mapping: {
        'ODRP': 'PRIMPHYS', // Médecin traitant
        'ATND': 'ATND',     // Médecin responsable
        'CON': 'CON',       // Consultant
        'REFF': 'REFF',     // Référent
        // Ajouter d'autres mappings si nécessaire
      }
    }
  },
  
  // Règles pour les segments d'assurance (IN1, IN2)
  IN: {
    // IN1-2: Identifiant de l'organisme d'assurance (spécifique à la France)
    insurerMapping: {
      // Codes des organismes d'assurance français
      '972': 'CPAM Martinique',
      '971': 'CPAM Guadeloupe',
      '973': 'CPAM Guyane',
      '974': 'CPAM Réunion',
      '975': 'CPAM Saint-Pierre-et-Miquelon',
      '976': 'CPAM Mayotte',
      '977': 'CPAM Saint-Barthélemy',
      '978': 'CPAM Saint-Martin',
      // Ajouter d'autres codes si nécessaire
    }
  }
};

/**
 * Règles de nettoyage et validation des données FHIR générées
 */
const cleaningRules = {
  // Valeurs vides à supprimer
  emptyValues: ["", null, undefined, "null", "undefined"],
  
  // Attributs à nettoyer de manière récursive
  cleanRecursively: [
    "identifier", "name", "telecom", "address", "contact",
    "communication", "extension", "valueExtension"
  ],
  
  // Attributs à ignorer lors du nettoyage (à conserver même vides)
  ignoreAttributes: [
    "text", "div", "status"
  ]
};

module.exports = {
  conversionRules,
  cleaningRules
};