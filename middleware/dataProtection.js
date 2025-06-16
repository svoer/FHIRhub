/**
 * Middleware de protection des données conforme RGPD/HDS
 * Gestion du chiffrement, anonymisation et droits des patients
 * @module middleware/dataProtection
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration du chiffrement AES-256-GCM (conforme ANSSI)
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Gestionnaire de clés de chiffrement sécurisé
 */
class SecureKeyManager {
  constructor() {
    this.masterKey = this.loadOrGenerateMasterKey();
  }

  loadOrGenerateMasterKey() {
    const keyPath = path.join(process.cwd(), 'data', '.encryption.key');
    
    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath);
      }
    } catch (error) {
      console.warn('[SECURITY] Impossible de charger la clé maître, génération d\'une nouvelle clé');
    }

    // Générer une nouvelle clé maître
    const masterKey = crypto.randomBytes(KEY_LENGTH);
    
    try {
      // Créer le répertoire si nécessaire
      const dataDir = path.dirname(keyPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Sauvegarder la clé avec permissions restrictives
      fs.writeFileSync(keyPath, masterKey, { mode: 0o600 });
      console.log('[SECURITY] Nouvelle clé maître générée et sauvegardée');
    } catch (error) {
      console.error('[SECURITY] Erreur lors de la sauvegarde de la clé:', error.message);
    }

    return masterKey;
  }

  deriveKey(context, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16);
    }
    
    return {
      key: crypto.pbkdf2Sync(this.masterKey, salt, 100000, KEY_LENGTH, 'sha256'),
      salt: salt
    };
  }
}

const keyManager = new SecureKeyManager();

/**
 * Chiffrement sécurisé des données sensibles
 */
function encryptSensitiveData(data, context = 'default') {
  try {
    const salt = crypto.randomBytes(16);
    const { key } = keyManager.deriveKey(context, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipherGCM(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: ENCRYPTION_ALGORITHM
    };
  } catch (error) {
    console.error('[ENCRYPTION] Erreur de chiffrement:', error);
    throw new Error('Échec du chiffrement des données');
  }
}

/**
 * Déchiffrement sécurisé des données
 */
function decryptSensitiveData(encryptedData, context = 'default') {
  try {
    const { encrypted, iv, salt, authTag, algorithm } = encryptedData;
    
    if (algorithm !== ENCRYPTION_ALGORITHM) {
      throw new Error('Algorithme de chiffrement non supporté');
    }
    
    const { key } = keyManager.deriveKey(context, Buffer.from(salt, 'hex'));
    
    const decipher = crypto.createDecipherGCM(algorithm, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[DECRYPTION] Erreur de déchiffrement:', error);
    throw new Error('Échec du déchiffrement des données');
  }
}

/**
 * Anonymisation avancée des données FHIR
 */
function anonymizeFHIRData(fhirBundle) {
  try {
    const anonymized = JSON.parse(JSON.stringify(fhirBundle));
    
    if (anonymized.entry) {
      anonymized.entry.forEach(entry => {
        if (entry.resource) {
          anonymizeResource(entry.resource);
        }
      });
    }
    
    return anonymized;
  } catch (error) {
    console.error('[ANONYMIZATION] Erreur d\'anonymisation:', error);
    return fhirBundle;
  }
}

/**
 * Anonymisation d'une ressource FHIR spécifique
 */
function anonymizeResource(resource) {
  switch (resource.resourceType) {
    case 'Patient':
      anonymizePatientResource(resource);
      break;
    case 'Observation':
      anonymizeObservationResource(resource);
      break;
    case 'Encounter':
      anonymizeEncounterResource(resource);
      break;
    default:
      // Anonymiser les champs communs
      anonymizeCommonFields(resource);
  }
}

/**
 * Anonymisation spécifique des patients
 */
function anonymizePatientResource(patient) {
  // Anonymiser les identifiants
  if (patient.identifier) {
    patient.identifier = patient.identifier.map(id => ({
      ...id,
      value: generateAnonymousId(id.value)
    }));
  }
  
  // Anonymiser les noms
  if (patient.name) {
    patient.name = patient.name.map(name => ({
      use: name.use,
      family: 'ANONYME',
      given: ['PATIENT']
    }));
  }
  
  // Anonymiser les contacts
  if (patient.telecom) {
    patient.telecom = patient.telecom.map(contact => ({
      system: contact.system,
      use: contact.use,
      value: anonymizeContactValue(contact.value, contact.system)
    }));
  }
  
  // Anonymiser les adresses
  if (patient.address) {
    patient.address = patient.address.map(addr => ({
      use: addr.use,
      type: addr.type,
      city: 'VILLE_ANONYME',
      postalCode: anonymizePostalCode(addr.postalCode),
      country: addr.country
    }));
  }
  
  // Garder le genre et la date de naissance (avec précision réduite)
  if (patient.birthDate) {
    patient.birthDate = anonymizeBirthDate(patient.birthDate);
  }
}

/**
 * Anonymisation des observations
 */
function anonymizeObservationResource(observation) {
  // Garder les codes et valeurs médicales (nécessaires pour l'analyse)
  // Anonymiser seulement les références aux patients
  if (observation.subject && observation.subject.reference) {
    observation.subject.reference = generateAnonymousReference(observation.subject.reference);
  }
  
  if (observation.performer) {
    observation.performer = observation.performer.map(perf => ({
      ...perf,
      reference: perf.reference ? generateAnonymousReference(perf.reference) : undefined
    }));
  }
  
  anonymizeCommonFields(observation);
}

/**
 * Anonymisation des rencontres
 */
function anonymizeEncounterResource(encounter) {
  if (encounter.subject && encounter.subject.reference) {
    encounter.subject.reference = generateAnonymousReference(encounter.subject.reference);
  }
  
  if (encounter.participant) {
    encounter.participant = encounter.participant.map(part => ({
      ...part,
      individual: part.individual ? {
        ...part.individual,
        reference: generateAnonymousReference(part.individual.reference)
      } : undefined
    }));
  }
  
  anonymizeCommonFields(encounter);
}

/**
 * Anonymisation des champs communs
 */
function anonymizeCommonFields(resource) {
  // Supprimer les métadonnées sensibles
  if (resource.meta) {
    delete resource.meta.lastUpdated;
    delete resource.meta.source;
  }
  
  // Anonymiser les extensions personnalisées
  if (resource.extension) {
    resource.extension = resource.extension.filter(ext => 
      !ext.url.includes('identifier') && !ext.url.includes('name')
    );
  }
}

/**
 * Génération d'identifiants anonymes reproductibles
 */
function generateAnonymousId(originalId) {
  const hash = crypto.createHash('sha256');
  hash.update(originalId + process.env.ANONYMIZATION_SALT || 'default-salt');
  return 'ANON_' + hash.digest('hex').substring(0, 12);
}

/**
 * Génération de références anonymes
 */
function generateAnonymousReference(originalRef) {
  const parts = originalRef.split('/');
  if (parts.length >= 2) {
    const resourceType = parts[parts.length - 2];
    const id = parts[parts.length - 1];
    return `${resourceType}/${generateAnonymousId(id)}`;
  }
  return generateAnonymousId(originalRef);
}

/**
 * Anonymisation des valeurs de contact
 */
function anonymizeContactValue(value, system) {
  switch (system) {
    case 'phone':
      return '+33-XX-XX-XX-XX';
    case 'email':
      return 'patient@anonyme.fr';
    case 'fax':
      return '+33-XX-XX-XX-XX';
    default:
      return 'ANONYMISE';
  }
}

/**
 * Anonymisation des codes postaux
 */
function anonymizePostalCode(postalCode) {
  if (!postalCode) return undefined;
  
  // Garder seulement le département (2 premiers chiffres)
  if (postalCode.length >= 2) {
    return postalCode.substring(0, 2) + 'XXX';
  }
  
  return 'XXXXX';
}

/**
 * Anonymisation des dates de naissance
 */
function anonymizeBirthDate(birthDate) {
  if (!birthDate) return undefined;
  
  const date = new Date(birthDate);
  const year = date.getFullYear();
  
  // Garder seulement l'année si > 89 ans, sinon anonymiser partiellement
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  
  if (age > 89) {
    return year.toString();
  } else {
    // Garder année et mois, anonymiser le jour
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}-15`; // Jour fixe au milieu du mois
  }
}

/**
 * Middleware de protection automatique des données
 */
function dataProtectionMiddleware(req, res, next) {
  // Intercepter les réponses contenant des données sensibles
  if (req.path.includes('/convert') || req.path.includes('/patient')) {
    const originalSend = res.send;
    
    res.send = function(data) {
      try {
        let responseData = data;
        
        // Si c'est du JSON, l'analyser
        if (typeof data === 'string') {
          try {
            responseData = JSON.parse(data);
          } catch (e) {
            // Pas du JSON, passer tel quel
            return originalSend.call(this, data);
          }
        }
        
        // Vérifier si l'anonymisation est requise
        const shouldAnonymize = req.query.anonymize === 'true' || 
                               req.headers['x-anonymize'] === 'true';
        
        if (shouldAnonymize && responseData.resourceType === 'Bundle') {
          responseData = anonymizeFHIRData(responseData);
        }
        
        // Chiffrer les données si configuré
        const shouldEncrypt = req.headers['x-encrypt'] === 'true';
        if (shouldEncrypt && req.containsHealthData) {
          const encrypted = encryptSensitiveData(responseData, 'api-response');
          this.set('Content-Type', 'application/json');
          this.set('X-Data-Encrypted', 'true');
          return originalSend.call(this, JSON.stringify(encrypted));
        }
        
        return originalSend.call(this, JSON.stringify(responseData));
        
      } catch (error) {
        console.error('[DATA_PROTECTION] Erreur de traitement:', error);
        return originalSend.call(this, data);
      }
    };
  }
  
  next();
}

/**
 * Middleware de gestion des droits RGPD
 */
function rgpdRightsMiddleware(req, res, next) {
  // Ajouter les endpoints de droits RGPD
  if (req.path === '/api/rgpd/data-export' && req.method === 'GET') {
    return handleDataExport(req, res);
  }
  
  if (req.path === '/api/rgpd/data-deletion' && req.method === 'DELETE') {
    return handleDataDeletion(req, res);
  }
  
  if (req.path === '/api/rgpd/data-portability' && req.method === 'GET') {
    return handleDataPortability(req, res);
  }
  
  next();
}

/**
 * Gestion de l'export des données (droit d'accès RGPD)
 */
async function handleDataExport(req, res) {
  try {
    const patientId = req.query.patientId;
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Identifiant patient requis'
      });
    }

    // Rechercher toutes les données du patient
    const db = req.app.locals.db;
    const conversions = db.prepare(`
      SELECT * FROM conversion_logs 
      WHERE input_message LIKE ? 
      ORDER BY timestamp DESC
    `).all(`%${patientId}%`);

    // Anonymiser les données pour l'export
    const exportData = {
      patientId: generateAnonymousId(patientId),
      exportDate: new Date().toISOString(),
      conversions: conversions.map(conv => ({
        id: conv.id,
        timestamp: conv.timestamp,
        status: conv.status,
        resourceCount: conv.resource_count,
        // Les données médicales sont anonymisées
        medicalData: '[DONNÉES MÉDICALES ANONYMISÉES]'
      }))
    };

    res.json({
      success: true,
      data: exportData,
      message: 'Export des données patient généré (anonymisé)'
    });

  } catch (error) {
    console.error('[RGPD] Erreur export données:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'export des données'
    });
  }
}

/**
 * Gestion de la suppression des données (droit à l'effacement RGPD)
 */
async function handleDataDeletion(req, res) {
  try {
    const patientId = req.body.patientId;
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Identifiant patient requis'
      });
    }

    // Note: En pratique, pour les données de santé, la suppression complète
    // peut être limitée par les obligations légales de conservation
    
    const db = req.app.locals.db;
    
    // Marquer les données comme supprimées plutôt que suppression physique
    const result = db.prepare(`
      UPDATE conversion_logs 
      SET input_message = '[DONNÉES SUPPRIMÉES]',
          output_message = '[DONNÉES SUPPRIMÉES]',
          status = 'deleted'
      WHERE input_message LIKE ?
    `).run(`%${patientId}%`);

    res.json({
      success: true,
      message: `${result.changes} enregistrements marqués comme supprimés`,
      note: 'Suppression logique appliquée conformément aux obligations légales'
    });

  } catch (error) {
    console.error('[RGPD] Erreur suppression données:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression des données'
    });
  }
}

/**
 * Gestion de la portabilité des données (droit à la portabilité RGPD)
 */
async function handleDataPortability(req, res) {
  try {
    const patientId = req.query.patientId;
    const format = req.query.format || 'fhir';

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Identifiant patient requis'
      });
    }

    // Générer un export au format demandé
    const exportData = await generatePortableData(patientId, format);

    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="patient-data-${generateAnonymousId(patientId)}.json"`
    });

    res.json({
      success: true,
      format: format,
      data: exportData,
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[RGPD] Erreur portabilité données:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération des données portables'
    });
  }
}

/**
 * Génération de données portables
 */
async function generatePortableData(patientId, format) {
  // Ici, on génèrerait les données au format demandé
  // Pour cet exemple, on retourne un format FHIR anonymisé
  
  return {
    resourceType: 'Bundle',
    id: generateAnonymousId(patientId),
    type: 'collection',
    entry: [
      {
        resource: {
          resourceType: 'Patient',
          id: generateAnonymousId(patientId),
          name: [{ family: 'ANONYME', given: ['PATIENT'] }],
          // Autres données anonymisées...
        }
      }
    ]
  };
}

module.exports = {
  encryptSensitiveData,
  decryptSensitiveData,
  anonymizeFHIRData,
  dataProtectionMiddleware,
  rgpdRightsMiddleware,
  SecureKeyManager,
  generateAnonymousId
};