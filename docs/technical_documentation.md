# Documentation Technique FHIRHub

## Architecture du système

### Vue d'ensemble
FHIRHub est construit selon une architecture modulaire Node.js utilisant Express pour l'API REST et SQLite pour la persistance des données. L'application fonctionne indépendamment de tout service externe, avec toutes les terminologies préchargées pour un fonctionnement hors-ligne complet.

```
              +-------------------------+
              |  Interface Utilisateur  |
              |     (React / HTML)      |
              +------------+------------+
                           |
                           v
+---------+    +----------------------+    +-----------------+
| Requête |--->|   Serveur Express    |--->| Authentification|
|   HL7   |    | (Middleware, Routes) |    | (JWT, API Key)  |
+---------+    +----------------------+    +-----------------+
                           |
                           v
+---------------+   +---------------+    +---------------+
| Parseur HL7   |-->| Convertisseur |--->| Adaptateur    |
| (hl7Parser.js)|   | HL7 → FHIR    |    | Terminologies |
+---------------+   +---------------+    +---------------+
                           |
         +-----------------+-----------------+
         |                 |                 |
         v                 v                 v
+---------------+  +----------------+  +---------------+
| Cache         |  | Base de données|  | Système       |
| (Memory/Disk) |  | (SQLite)       |  | de fichiers   |
+---------------+  +----------------+  +---------------+
```

### Flux de traitement
1. Le message HL7 est reçu via API ou interface web
2. Le message est parsé par hl7Parser.js
3. Le parseur crée un modèle objet du message
4. Le convertisseur transforme ce modèle en ressources FHIR
5. Les terminologies françaises sont appliquées
6. Le résultat est mis en cache et retourné

## Composants clés du système

### Parseur HL7 (hl7Parser.js)

Le parseur HL7 est le cœur du système, responsable de l'analyse syntaxique des messages HL7 v2.5. Son implémentation utilise une approche par automate à états finis pour gérer efficacement la complexité syntaxique de HL7.

```javascript
// Extrait du parseur HL7 montrant l'analyse des segments
function parseHL7Message(message) {
  // Normaliser les séparateurs de segment
  const segments = message.split(/\r\n|\r|\n/);
  const parsedMessage = { 
    segments: [], 
    header: null, 
    type: null, 
    version: null 
  };

  for (const segmentText of segments) {
    if (!segmentText.trim()) continue;
    
    // Identifier les caractères de séparation à partir du MSH
    let separators = { 
      field: '|', 
      component: '^', 
      repeat: '~', 
      escape: '\\', 
      subcomponent: '&' 
    };
    
    if (segmentText.startsWith('MSH')) {
      separators.field = segmentText.charAt(3);
      if (segmentText.length > 4) {
        separators.component = segmentText.charAt(4);
        separators.repeat = segmentText.charAt(5);
        separators.escape = segmentText.charAt(6);
        separators.subcomponent = segmentText.charAt(7);
      }
      
      // Extraire les méta-données du message
      const fields = segmentText.split(separators.field);
      if (fields.length > 8) {
        const messageParts = fields[8].split(separators.component);
        parsedMessage.type = messageParts[0];
        parsedMessage.trigger = messageParts[1] || '';
      }
      if (fields.length > 11) {
        parsedMessage.version = fields[11];
      }
    }
    
    // Parser tous les segments avec leurs champs
    const segment = parseSegment(segmentText, separators);
    parsedMessage.segments.push(segment);
    
    // Conserver le segment MSH comme en-tête
    if (segment.id === 'MSH') {
      parsedMessage.header = segment;
    }
  }
  
  return parsedMessage;
}

function parseSegment(segmentText, separators) {
  const fields = segmentText.split(separators.field);
  const segmentId = fields[0];
  
  const segment = {
    id: segmentId,
    fields: []
  };
  
  // Le premier champ pour tous les segments sauf MSH est le segment ID
  const startIdx = segmentId === 'MSH' ? 1 : 1;
  
  for (let i = startIdx; i < fields.length; i++) {
    const fieldValue = parseField(fields[i], separators);
    segment.fields.push(fieldValue);
  }
  
  return segment;
}

function parseField(fieldText, separators) {
  if (!fieldText) return [];
  
  const repeats = fieldText.split(separators.repeat);
  return repeats.map(r => parseComponents(r, separators));
}

function parseComponents(componentText, separators) {
  if (!componentText) return [];
  
  const components = componentText.split(separators.component);
  return components.map(c => parseSubcomponents(c, separators));
}

function parseSubcomponents(subComponentText, separators) {
  if (!subComponentText) return [];
  
  return subComponentText.split(separators.subcomponent);
}
```

Le parseur utilise une approche récursive pour décomposer les messages HL7 en leur hiérarchie naturelle:
1. Message → Segments → Fields → Components → Subcomponents
2. Gestion spéciale du segment MSH pour extraire les caractères de séparation
3. Détection automatique du type de message et de sa version

### Convertisseur HL7 vers FHIR (hl7ToFhirAdvancedConverter.js)

Le convertisseur traduit les structures HL7 en ressources FHIR R4 en utilisant une architecture basée sur des mappeurs spécialisés par type de message et segment.

```javascript
class HL7ToFHIRConverter {
  constructor(terminologyAdapter) {
    this.terminologyAdapter = terminologyAdapter;
    this.segmentMappers = {
      'PID': this.mapPIDToPatient.bind(this),
      'PV1': this.mapPV1ToEncounter.bind(this),
      'OBR': this.mapOBRToServiceRequest.bind(this),
      'OBX': this.mapOBXToObservation.bind(this),
      // Autres mappeurs de segments
    };
    
    this.messageTypeMappers = {
      'ADT': this.processADTMessage.bind(this),
      'ORU': this.processORUMessage.bind(this),
      'ORM': this.processORMMessage.bind(this),
      // Autres mappeurs de types de messages
    };
  }
  
  convert(parsedHL7Message) {
    // Créer un bundle FHIR pour contenir toutes les ressources
    const bundle = this.createBundle();
    
    // Déterminer le type de message et appeler le mapper approprié
    const messageType = parsedHL7Message.type;
    const mapper = this.messageTypeMappers[messageType];
    
    if (mapper) {
      mapper(parsedHL7Message, bundle);
    } else {
      // Stratégie de repli: traiter segment par segment
      this.processGenericMessage(parsedHL7Message, bundle);
    }
    
    // Post-traitement: ajouter les références entre ressources
    this.processReferences(bundle);
    
    return bundle;
  }
  
  processGenericMessage(parsedHL7Message, bundle) {
    // Pour chaque segment, appliquer le mapper approprié
    for (const segment of parsedHL7Message.segments) {
      const mapper = this.segmentMappers[segment.id];
      if (mapper) {
        const resource = mapper(segment, parsedHL7Message);
        if (resource) {
          this.addResourceToBundle(bundle, resource);
        }
      }
    }
  }
  
  // Exemple de mapper de segment PID → Patient
  mapPIDToPatient(pidSegment, message) {
    const patient = {
      resourceType: 'Patient',
      id: this.generateId('patient'),
      identifier: [],
      name: [],
      telecom: [],
      address: []
    };
    
    // Mapper les identifiants patient (PID-3)
    const identifiers = this.getRepeatingField(pidSegment, 2);
    for (const identifier of identifiers) {
      const idValue = this.getComponentValue(identifier, 0);
      const idType = this.getComponentValue(identifier, 4);
      
      const fhirIdentifier = {
        value: idValue
      };
      
      // Utiliser l'adaptateur de terminologie pour mapper le type d'ID
      if (idType) {
        const systemUri = this.terminologyAdapter.getIdentifierSystem(idType);
        if (systemUri) {
          fhirIdentifier.system = systemUri;
        }
        
        // Détecter et baliser les INS
        if (this.terminologyAdapter.isINSIdentifier(idType)) {
          fhirIdentifier.extension = [{
            url: "https://annuaire.sante.fr/fhir/StructureDefinition/INS-NIR",
            valueBoolean: true
          }];
        }
      }
      
      patient.identifier.push(fhirIdentifier);
    }
    
    // Mapper les noms (PID-5)
    const names = this.getRepeatingField(pidSegment, 4);
    for (const name of names) {
      const familyName = this.getComponentValue(name, 0);
      const givenName = this.getComponentValue(name, 1);
      
      if (familyName || givenName) {
        const fhirName = {
          use: 'official'
        };
        
        if (familyName) fhirName.family = familyName;
        if (givenName) fhirName.given = [givenName];
        
        patient.name.push(fhirName);
      }
    }
    
    // Mapper les autres champs PID
    // ...
    
    return patient;
  }
  
  // Méthodes utilitaires pour faciliter l'extraction des données
  getField(segment, fieldIndex) {
    return segment.fields[fieldIndex] || [];
  }
  
  getRepeatingField(segment, fieldIndex) {
    const field = this.getField(segment, fieldIndex);
    return field.length ? field : [[]];
  }
  
  getComponentValue(field, componentIndex) {
    if (!field[0] || !field[0][componentIndex]) return null;
    return field[0][componentIndex][0] || null;
  }
  
  // Génération d'IDs uniques pour les ressources
  generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

Cette architecture présente plusieurs avantages techniques:
1. **Modularité**: Chaque segment et type de message a son propre mapper
2. **Extensibilité**: Nouveaux types de messages facilement ajoutables
3. **Séparation des préoccupations**: Parsing indépendant de la conversion
4. **Réutilisabilité**: Les mappeurs de segments sont partagés entre types de messages

### Adaptateur de terminologies françaises (french_terminology_adapter.js)

L'adaptateur de terminologies est responsable de la traduction des codes HL7 vers les systèmes de codification FHIR français conformes aux spécifications de l'ANS.

```javascript
class FrenchTerminologyAdapter {
  constructor() {
    this.terminologySystems = require('../french_terminology/ans_terminology_systems.json');
    this.oidMappings = require('../french_terminology/ans_oids.json');
    this.commonCodes = require('../french_terminology/ans_common_codes.json');
    this.fhirSystems = require('../french_terminology/fhir_r4_french_systems.json');
    
    // Index pour recherche rapide
    this.systemsByCode = this.indexSystemsByCode();
    this.oidsByName = this.indexOIDsByName();
  }
  
  indexSystemsByCode() {
    const index = {};
    
    for (const [domain, systems] of Object.entries(this.terminologySystems)) {
      for (const system of systems) {
        if (system.code) {
          index[system.code] = system;
        }
      }
    }
    
    return index;
  }
  
  indexOIDsByName() {
    const index = {};
    
    for (const [category, oids] of Object.entries(this.oidMappings)) {
      for (const [name, oid] of Object.entries(oids)) {
        index[name] = oid;
      }
    }
    
    return index;
  }
  
  // Conversion des systèmes de terminologie
  getCodeSystem(hl7CodeSystem) {
    const system = this.systemsByCode[hl7CodeSystem];
    
    if (system) {
      return system.uri || `urn:oid:${system.oid}`;
    }
    
    // Fallback aux systèmes FHIR standard
    return this.fhirSystems[hl7CodeSystem] || null;
  }
  
  // Gestion des OIDs pour les identifiants
  getIdentifierSystem(hl7IdType) {
    // Cas particulier pour l'INS
    if (this.isINSIdentifier(hl7IdType)) {
      return "urn:oid:1.2.250.1.213.1.4.8";
    }
    
    // OID pour les IPP (identifiants patients)
    if (hl7IdType === 'PI') {
      return "urn:oid:1.2.250.1.71.4.2.7";
    }
    
    // Recherche dans le mapping d'OIDs
    const oid = this.oidsByName[hl7IdType];
    if (oid) {
      return `urn:oid:${oid}`;
    }
    
    return null;
  }
  
  // Détection des identifiants spécifiques français
  isINSIdentifier(idType) {
    return ['INS-C', 'INS-NIA', 'INS-NIR'].includes(idType);
  }
  
  // Traduire les codes de sexe
  translateGenderCode(hl7Gender) {
    const genderMap = {
      'M': 'male',
      'F': 'female',
      'O': 'other',
      'U': 'unknown',
      'A': 'other'
    };
    
    return genderMap[hl7Gender] || 'unknown';
  }
  
  // Traduire les codes d'état civil
  translateMaritalStatusCode(hl7MaritalStatus) {
    // Mappings spécifiques France
    const maritalMap = {
      'S': { code: 'S', display: 'Célibataire' },
      'M': { code: 'M', display: 'Marié(e)' },
      'D': { code: 'D', display: 'Divorcé(e)' },
      'W': { code: 'W', display: 'Veuf/Veuve' },
      'P': { code: 'L', display: 'Séparé(e) légalement' }
    };
    
    if (maritalMap[hl7MaritalStatus]) {
      return {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
          code: maritalMap[hl7MaritalStatus].code,
          display: maritalMap[hl7MaritalStatus].display
        }]
      };
    }
    
    return null;
  }
}
```

Cette implémentation:
1. Charge les fichiers de terminologie au démarrage 
2. Crée des index pour optimiser les recherches
3. Fournit des méthodes spécialisées pour différents types de traductions
4. Gère les particularités françaises (INS, RPPS, FINESS)

### Système de cache (cacheManager.js)

Le système de cache utilise une architecture à deux niveaux (mémoire et disque) pour optimiser les performances:

```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const LRUCache = require('lru-cache');
const zlib = require('zlib');

class CacheManager {
  constructor(options = {}) {
    this.options = {
      memoryCacheEnabled: true,
      diskCacheEnabled: true,
      maxMemoryCacheSize: 500,
      diskCachePath: './data/cache',
      cacheStrategy: 'lru',
      cacheExpirationDays: 30,
      ...options
    };
    
    // Initialiser le cache mémoire LRU
    this.memoryCache = new LRUCache({
      max: this.options.maxMemoryCacheSize,
      maxAge: this.options.cacheExpirationDays * 24 * 60 * 60 * 1000
    });
    
    // Statistiques pour monitoring
    this.stats = {
      memory: { hits: 0, misses: 0 },
      disk: { hits: 0, misses: 0 }
    };
    
    // Créer le répertoire de cache si nécessaire
    if (this.options.diskCacheEnabled) {
      if (!fs.existsSync(this.options.diskCachePath)) {
        fs.mkdirSync(this.options.diskCachePath, { recursive: true });
      }
    }
  }
  
  generateCacheKey(hl7Message, segmentFilters = null) {
    // Normaliser le message en supprimant les espaces et sauts de ligne
    const normalizedMessage = hl7Message.trim().replace(/\r\n?/g, '\n');
    
    if (segmentFilters) {
      // Si on veut uniquement hacher certains segments
      const segments = normalizedMessage.split('\n');
      const filteredSegments = segments.filter(segment => {
        const segmentType = segment.substring(0, 3);
        return segmentFilters.includes(segmentType);
      });
      
      return crypto.createHash('sha256')
        .update(filteredSegments.join('\n'))
        .digest('hex');
    }
    
    // Hachage complet du message pour unicité
    return crypto.createHash('sha256')
      .update(normalizedMessage)
      .digest('hex');
  }
  
  async get(key) {
    // Vérifier d'abord le cache mémoire (plus rapide)
    if (this.options.memoryCacheEnabled) {
      const memResult = this.memoryCache.get(key);
      
      if (memResult) {
        this.stats.memory.hits++;
        console.log(`[CACHE] Cache hit (memory): ${key.substring(0, 8)}...`);
        return memResult;
      }
      
      this.stats.memory.misses++;
    }
    
    // Si pas en mémoire, vérifier le cache disque
    if (this.options.diskCacheEnabled) {
      try {
        const cacheFilePath = path.join(this.options.diskCachePath, `${key}.json.gz`);
        
        if (fs.existsSync(cacheFilePath)) {
          // Lire et décompresser le fichier
          const compressedData = fs.readFileSync(cacheFilePath);
          const jsonData = zlib.gunzipSync(compressedData).toString('utf8');
          const data = JSON.parse(jsonData);
          
          // Mise en cache mémoire pour accès futurs
          if (this.options.memoryCacheEnabled) {
            this.memoryCache.set(key, data);
          }
          
          this.stats.disk.hits++;
          console.log(`[CACHE] Cache hit (disk): ${key.substring(0, 8)}...`);
          return data;
        }
        
        this.stats.disk.misses++;
      } catch (error) {
        console.error(`[CACHE] Error reading from disk cache: ${error.message}`);
        this.stats.disk.misses++;
      }
    }
    
    return null;
  }
  
  async set(key, data) {
    // Stocker en mémoire
    if (this.options.memoryCacheEnabled) {
      this.memoryCache.set(key, data);
    }
    
    // Stocker sur disque
    if (this.options.diskCacheEnabled) {
      try {
        const cacheFilePath = path.join(this.options.diskCachePath, `${key}.json.gz`);
        const jsonData = JSON.stringify(data);
        
        // Compression pour économiser l'espace disque
        const compressedData = zlib.gzipSync(jsonData);
        
        // Écriture atomique pour éviter corruption
        fs.writeFileSync(cacheFilePath, compressedData);
        
        console.log(`[CACHE] Nouvelle entrée: ${key.substring(0, 8)}... (total: ${this.memoryCache.size})`);
      } catch (error) {
        console.error(`[CACHE] Error writing to disk cache: ${error.message}`);
      }
    }
  }
  
  async clear(type = 'all') {
    if (type === 'all' || type === 'memory') {
      this.memoryCache.reset();
      console.log(`[CACHE] Cache mémoire vidé`);
    }
    
    if ((type === 'all' || type === 'disk') && this.options.diskCacheEnabled) {
      try {
        const files = fs.readdirSync(this.options.diskCachePath);
        
        for (const file of files) {
          if (file.endsWith('.json.gz')) {
            fs.unlinkSync(path.join(this.options.diskCachePath, file));
          }
        }
        
        console.log(`[CACHE] Cache disque vidé (${files.length} entrées)`);
      } catch (error) {
        console.error(`[CACHE] Error clearing disk cache: ${error.message}`);
      }
    }
  }
  
  getStats() {
    const memorySize = this.memoryCache.size;
    const memoryHits = this.stats.memory.hits;
    const memoryMisses = this.stats.memory.misses;
    const memoryHitRate = memoryHits + memoryMisses > 0 
      ? ((memoryHits / (memoryHits + memoryMisses)) * 100).toFixed(1)
      : 0;
    
    let diskSize = 0;
    let diskEntries = 0;
    
    if (this.options.diskCacheEnabled) {
      try {
        const files = fs.readdirSync(this.options.diskCachePath);
        diskEntries = files.filter(f => f.endsWith('.json.gz')).length;
        
        for (const file of files) {
          if (file.endsWith('.json.gz')) {
            const stats = fs.statSync(path.join(this.options.diskCachePath, file));
            diskSize += stats.size;
          }
        }
      } catch (error) {
        console.error(`[CACHE] Error getting disk cache stats: ${error.message}`);
      }
    }
    
    const diskHits = this.stats.disk.hits;
    const diskMisses = this.stats.disk.misses;
    const diskHitRate = diskHits + diskMisses > 0
      ? ((diskHits / (diskHits + diskMisses)) * 100).toFixed(1)
      : 0;
    
    const totalHits = memoryHits + diskHits;
    const totalMisses = memoryMisses + diskMisses;
    const totalHitRate = totalHits + totalMisses > 0
      ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(1)
      : 0;
    
    return {
      memory: {
        size: memorySize,
        maxSize: this.options.maxMemoryCacheSize,
        hits: memoryHits,
        misses: memoryMisses,
        hitRate: parseFloat(memoryHitRate)
      },
      disk: {
        size: diskSize,
        entries: diskEntries,
        hits: diskHits,
        misses: diskMisses,
        hitRate: parseFloat(diskHitRate)
      },
      combined: {
        hits: totalHits,
        misses: totalMisses,
        hitRate: parseFloat(totalHitRate)
      }
    };
  }
}
```

Points techniques notables:
1. Utilisation de LRU (Least Recently Used) pour l'éviction du cache mémoire
2. Compression gzip des données sur disque pour réduire l'espace
3. Hachage SHA-256 des messages pour générer des clés uniques
4. Stratégie hiérarchique: mémoire d'abord, puis disque
5. Statistiques détaillées pour le monitoring des performances

### Système d'authentification et d'autorisation

FHIRHub implémente deux mécanismes d'authentification:
1. JWT (JSON Web Tokens) pour les utilisateurs de l'interface web
2. Clés API pour les applications intégrées

```javascript
// Middleware d'authentification par clé API
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(); // Passer au middleware suivant (JWT)
  }
  
  const db = req.app.locals.db;
  
  try {
    // Vérifier si la clé API existe et est active
    const key = db.prepare(`
      SELECT ak.*, a.name as app_name
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      WHERE ak.key = ? AND ak.is_active = 1
    `).get(apiKey);
    
    if (!key) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Clé API invalide'
      });
    }
    
    // Mise à jour de la date de dernière utilisation
    db.prepare(`
      UPDATE api_keys 
      SET last_used_at = datetime('now') 
      WHERE id = ?
    `).run(key.id);
    
    // Enregistrer l'activité API
    logApiActivity(db, req, key.id, key.application_id);
    
    // Ajouter les informations de clé à la requête
    req.apiKey = key;
    req.application = { id: key.application_id, name: key.app_name };
    
    next();
  } catch (error) {
    console.error('[AUTH] API Key Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server Error',
      message: 'Erreur lors de la vérification de la clé API'
    });
  }
}

// Middleware d'authentification JWT
function jwtAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Si aucune authentification, vérifier si l'endpoint nécessite une auth
    if (isProtectedEndpoint(req.path)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentification requise'
      });
    }
    
    return next();
  }
  
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Vérifier que l'utilisateur existe toujours
    const db = req.app.locals.db;
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Utilisateur introuvable'
      });
    }
    
    // Sauvegarder l'utilisateur dans la requête
    req.user = user;
    
    // Mettre à jour la date de dernière connexion
    db.prepare(`
      UPDATE users 
      SET last_login = datetime('now'), 
          updated_at = datetime('now') 
      WHERE id = ?
    `).run(user.id);
    
    next();
  } catch (error) {
    console.error('[AUTH] JWT Error:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Token invalide ou expiré'
    });
  }
}

// Middleware combiné (API Key ou JWT)
function authMiddleware(req, res, next) {
  // Essayer d'abord l'authentification par clé API
  apiKeyAuth(req, res, function() {
    // Si aucune clé API valide, essayer JWT
    if (!req.apiKey) {
      jwtAuth(req, res, next);
    } else {
      next();
    }
  });
}
```

L'implémentation utilise une approche en cascade:
1. Vérification de la clé API
2. Si clé API absente ou invalide, vérification du JWT
3. Si les deux sont absents, vérification si l'endpoint nécessite une authentification

### Gestion des mises à jour de terminologies

Les terminologies françaises sont mises à jour via un script Python qui interroge les systèmes officiels de l'ANS:

```python
import requests
import json
import os
from datetime import datetime

def fetch_ans_terminology(url, output_file):
    """Récupère les terminologies depuis l'API de l'ANS"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Ajouter des métadonnées
        data['_metadata'] = {
            'retrieved_at': datetime.now().isoformat(),
            'source_url': url,
            'version': data.get('version', 'unknown')
        }
        
        # Sauvegarder en JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Terminologie sauvegardée: {output_file}")
        return True
    except Exception as e:
        print(f"❌ Erreur lors de la récupération de {url}: {str(e)}")
        return False

def update_all_terminologies():
    """Met à jour toutes les terminologies françaises"""
    base_dir = "french_terminology"
    os.makedirs(base_dir, exist_ok=True)
    
    # Liste des terminologies à récupérer
    terminologies = [
        {
            "name": "JDV_J01-XdsAuthorSpecialty-CI-SIS",
            "url": "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale",
            "output": os.path.join(base_dir, "ans_specialites.json")
        },
        {
            "name": "JDV_J02-HealthcareFacilityTypeCode-CI-SIS",
            "url": "https://mos.esante.gouv.fr/NOS/TRE_R02-SecteurActivite/FHIR/TRE-R02-SecteurActivite",
            "output": os.path.join(base_dir, "ans_secteurs.json")
        },
        # Autres terminologies...
    ]
    
    success_count = 0
    for term in terminologies:
        if fetch_ans_terminology(term["url"], term["output"]):
            success_count += 1
    
    # Générer le fichier de mapping
    generate_mapping_file(base_dir)
    
    print(f"✅ Mise à jour terminée: {success_count}/{len(terminologies)} terminologies mises à jour")

def generate_mapping_file(base_dir):
    """Génère un fichier de mapping global des terminologies"""
    mapping = {
        "version": datetime.now().strftime("%Y%m%d"),
        "last_updated": datetime.now().isoformat(),
        "systems": {}
    }
    
    # Parcourir tous les fichiers JSON
    for filename in os.listdir(base_dir):
        if filename.endswith('.json') and filename.startswith('ans_'):
            try:
                with open(os.path.join(base_dir, filename), 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                system_name = data.get('name', filename.replace('.json', ''))
                system_url = data.get('url', '')
                system_oid = data.get('identifier', {}).get('value', '')
                
                mapping["systems"][system_name] = {
                    "uri": system_url,
                    "oid": system_oid,
                    "file": filename
                }
            except Exception as e:
                print(f"❌ Erreur lors du traitement de {filename}: {str(e)}")
    
    # Sauvegarder le mapping
    with open(os.path.join(base_dir, "ans_terminology_systems.json"), 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Fichier de mapping généré: {len(mapping['systems'])} systèmes indexés")

if __name__ == "__main__":
    update_all_terminologies()
```

Les terminologies sont ensuite chargées par l'adaptateur de terminologies françaises au démarrage de l'application.

## Base de données et schéma

FHIRHub utilise SQLite pour la persistance des données, avec un schéma optimisé pour les performances:

```sql
-- Structure principale
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  email TEXT,
  last_login DATETIME,
  preferences TEXT,
  language TEXT DEFAULT 'fr',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  cors_origins TEXT,
  settings TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  key TEXT NOT NULL UNIQUE,
  hashed_key TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  description TEXT,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversion_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_message TEXT NOT NULL,
  output_message TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  api_key_id INTEGER,
  user_id INTEGER,
  processing_time REAL,
  resource_count INTEGER,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_conversion_logs_timestamp ON conversion_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversion_logs_user_id ON conversion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_logs_api_key_id ON conversion_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_application_id ON api_keys(application_id);
```

Ce schéma assure:
1. L'intégrité référentielle via des contraintes FOREIGN KEY
2. Des indexations pour les requêtes fréquentes
3. La traçabilité complète des conversions
4. L'association des conversions à leur contexte d'exécution

## Système de conversion en masse (batch processing)

FHIRHub implémente un moteur de traitement par lots pour les conversions massives, utilisant un modèle basé sur les workers:

```javascript
class BatchProcessor {
  constructor(options = {}) {
    this.options = {
      concurrency: 5,
      batchSize: 100,
      maxRetries: 3,
      retryDelay: 2000,
      ...options
    };
    
    this.db = options.db;
    this.converter = options.converter;
    this.terminologyAdapter = options.terminologyAdapter;
    this.cacheManager = options.cacheManager;
    this.activeJobs = new Map();
    this.jobResults = new Map();
  }
  
  async processBatch(files, jobId) {
    if (!jobId) {
      jobId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Initialiser le suivi du job
    this.activeJobs.set(jobId, {
      id: jobId,
      totalFiles: files.length,
      processedFiles: 0,
      failedFiles: 0,
      startTime: Date.now(),
      status: 'processing'
    });
    
    this.jobResults.set(jobId, {
      successful: [],
      failed: []
    });
    
    // Diviser les fichiers en lots pour le traitement parallèle
    const batches = this.createBatches(files, this.options.batchSize);
    
    // Traiter les lots séquentiellement, mais avec concurrence intra-lot
    for (const batch of batches) {
      await this.processBatchConcurrently(batch, jobId);
      
      // Mise à jour du statut
      const job = this.activeJobs.get(jobId);
      if (job.failedFiles > 0 && job.failedFiles === job.totalFiles) {
        job.status = 'failed';
        break;
      } else if (job.processedFiles === job.totalFiles) {
        job.status = 'completed';
      }
    }
    
    // Calcul des statistiques finales
    const endTime = Date.now();
    const job = this.activeJobs.get(jobId);
    const results = this.jobResults.get(jobId);
    
    const summary = {
      jobId,
      status: job.status,
      totalFiles: job.totalFiles,
      successfulConversions: results.successful.length,
      failedConversions: results.failed.length,
      processingTimeMs: endTime - job.startTime,
      averageFileTimeMs: job.processedFiles > 0 
        ? (endTime - job.startTime) / job.processedFiles 
        : 0,
      results
    };
    
    // Stocker les résultats dans la base de données
    this.saveBatchResults(jobId, summary);
    
    return summary;
  }
  
  async processBatchConcurrently(batch, jobId) {
    const promises = batch.map(file => this.processFile(file, jobId));
    await Promise.all(promises);
  }
  
  async processFile(file, jobId) {
    const job = this.activeJobs.get(jobId);
    const results = this.jobResults.get(jobId);
    
    let retries = 0;
    
    while (retries <= this.options.maxRetries) {
      try {
        // Lire le fichier HL7
        const content = await fs.promises.readFile(file, 'utf8');
        
        // Vérifier si déjà en cache
        const cacheKey = this.cacheManager.generateCacheKey(content);
        const cachedResult = await this.cacheManager.get(cacheKey);
        
        if (cachedResult) {
          // Utiliser le résultat du cache
          job.processedFiles++;
          results.successful.push({
            file,
            fromCache: true,
            resourceCount: cachedResult.entry ? cachedResult.entry.length : 0
          });
          return;
        }
        
        // Si pas en cache, convertir
        const parsedMessage = this.parseHL7Message(content);
        const fhirBundle = this.converter.convert(parsedMessage);
        
        // Mettre en cache pour usage futur
        await this.cacheManager.set(cacheKey, fhirBundle);
        
        // Sauvegarder au format JSON
        const outputFile = file.replace('.hl7', '.json');
        await fs.promises.writeFile(outputFile, JSON.stringify(fhirBundle, null, 2));
        
        // Mettre à jour les statistiques
        job.processedFiles++;
        results.successful.push({
          file,
          outputFile,
          resourceCount: fhirBundle.entry ? fhirBundle.entry.length : 0
        });
        
        return;
      } catch (error) {
        retries++;
        
        if (retries > this.options.maxRetries) {
          // Échec définitif
          job.processedFiles++;
          job.failedFiles++;
          results.failed.push({
            file,
            error: error.message
          });
          return;
        }
        
        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
      }
    }
  }
  
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
  
  saveBatchResults(jobId, summary) {
    try {
      // Sauvegarder dans la base de données
      const jsonSummary = JSON.stringify(summary);
      
      this.db.prepare(`
        INSERT INTO batch_jobs (
          id, 
          status, 
          total_files, 
          successful_conversions, 
          failed_conversions, 
          processing_time_ms,
          results_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        jobId,
        summary.status,
        summary.totalFiles,
        summary.successfulConversions,
        summary.failedConversions,
        summary.processingTimeMs,
        jsonSummary
      );
    } catch (error) {
      console.error(`Error saving batch results: ${error.message}`);
    }
  }
  
  getJobStatus(jobId) {
    return this.activeJobs.get(jobId) || null;
  }
  
  getAllJobs() {
    return Array.from(this.activeJobs.values());
  }
}
```

Les caractéristiques techniques incluent:
1. Traitement parallèle avec niveau de concurrence configurable
2. Division en lots pour gérer la mémoire
3. Système de retry avec backoff exponentiel
4. Utilisation du cache pour éviter les conversions redondantes

## Processus visuels

FHIRHub implémente un éditeur de processus visuel personnalisé pour configurer des chaînes de traitement:

```javascript
class ProcessEngine {
  constructor(db) {
    this.db = db;
    this.registeredNodeTypes = new Map();
    this.activeProcesses = new Map();
    
    // Enregistrer les types de nœuds disponibles
    this.registerCoreNodeTypes();
  }
  
  registerCoreNodeTypes() {
    // Nœud d'entrée de workflow
    this.registerNodeType('start', {
      execute: async (data, context) => data,
      validateConnections: connections => connections.outputs.length > 0 && connections.inputs.length === 0
    });
    
    // Nœud de filtrage HL7
    this.registerNodeType('filter', {
      execute: async (data, context) => {
        const { segmentType, condition, field, value } = context.config;
        
        if (!data.parsedHL7) return data;
        
        const segments = data.parsedHL7.segments.filter(segment => {
          if (segment.id !== segmentType) return false;
          
          if (!condition || !field || value === undefined) return true;
          
          const fieldValue = this.getHL7FieldValue(segment, field);
          
          switch (condition) {
            case 'equals': return fieldValue === value;
            case 'contains': return fieldValue.includes(value);
            case 'startsWith': return fieldValue.startsWith(value);
            case 'endsWith': return fieldValue.endsWith(value);
            default: return true;
          }
        });
        
        if (segments.length > 0) {
          return { ...data, filteredSegments: segments };
        }
        
        // Si aucun segment ne correspond, arrêter le traitement
        context.stop = true;
        return null;
      },
      validateConnections: connections => connections.outputs.length > 0 && connections.inputs.length === 1
    });
    
    // Nœud de transformation
    this.registerNodeType('transform', {
      execute: async (data, context) => {
        const { transformType } = context.config;
        
        switch (transformType) {
          case 'anonymize':
            return this.anonymizeData(data);
          case 'enrichPatient':
            return this.enrichPatientData(data);
          case 'convertToFHIR':
            return this.convertToFHIR(data);
          default:
            return data;
        }
      },
      validateConnections: connections => connections.outputs.length > 0 && connections.inputs.length === 1
    });
    
    // Nœud de sortie (sauvegarde, API, etc.)
    this.registerNodeType('output', {
      execute: async (data, context) => {
        const { outputType, destination } = context.config;
        
        switch (outputType) {
          case 'file':
            return this.saveToFile(data, destination);
          case 'database':
            return this.saveToDatabase(data);
          case 'api':
            return this.sendToAPI(data, destination);
          default:
            return data;
        }
      },
      validateConnections: connections => connections.inputs.length === 1
    });
  }
  
  registerNodeType(type, handlers) {
    this.registeredNodeTypes.set(type, handlers);
  }
  
  // Exécute un processus complet
  async executeProcess(processId, inputData) {
    const process = await this.getProcess(processId);
    
    if (!process) {
      throw new Error(`Processus ${processId} not found`);
    }
    
    if (!process.is_active) {
      throw new Error(`Processus ${processId} is not active`);
    }
    
    // Convertir JSON en objet
    const flowData = JSON.parse(process.flow_json);
    
    // Trouver le nœud de départ
    const startNode = flowData.nodes.find(node => node.type === 'start');
    
    if (!startNode) {
      throw new Error('No start node found in process');
    }
    
    // Initialiser le contexte d'exécution
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const context = {
      workflowId,
      executionId,
      startTime: Date.now(),
      variables: {},
      nodeResults: {},
      executionPath: [],
      logs: []
    };
    
    // Démarrer l'exécution à partir du nœud de départ
    try {
      this.activeWorkflows.set(executionId, context);
      const result = await this.executeNode(startNode.id, flowData, inputData, context);
      context.endTime = Date.now();
      context.executionTime = context.endTime - context.startTime;
      context.status = 'completed';
      
      // Sauvegarder les logs d'exécution
      this.saveExecutionLogs(context);
      
      return {
        executionId,
        status: 'completed',
        executionTime: context.executionTime,
        result
      };
    } catch (error) {
      context.endTime = Date.now();
      context.executionTime = context.endTime - context.startTime;
      context.status = 'failed';
      context.error = error.message;
      
      // Sauvegarder les logs d'exécution
      this.saveExecutionLogs(context);
      
      return {
        executionId,
        status: 'failed',
        error: error.message,
        executionTime: context.executionTime
      };
    } finally {
      this.activeWorkflows.delete(executionId);
    }
  }
  
  // Exécute un nœud spécifique et suit les connexions
  async executeNode(nodeId, flowData, data, context) {
    // Ajouter à la trajectoire d'exécution
    context.executionPath.push(nodeId);
    
    // Trouver le nœud
    const node = flowData.nodes.find(n => n.id === nodeId);
    
    if (!node) {
      throw new Error(`Node ${nodeId} not found in workflow`);
    }
    
    // Récupérer le gestionnaire pour ce type de nœud
    const handler = this.registeredNodeTypes.get(node.type);
    
    if (!handler) {
      throw new Error(`No handler registered for node type ${node.type}`);
    }
    
    // Créer un contexte spécifique au nœud
    const nodeContext = {
      ...context,
      config: node.data || {},
      stop: false
    };
    
    // Journaliser le début de l'exécution
    context.logs.push({
      timestamp: Date.now(),
      nodeId,
      nodeType: node.type,
      message: `Executing node ${nodeId} (${node.type})`
    });
    
    // Exécuter le nœud
    try {
      const result = await handler.execute(data, nodeContext);
      
      // Stocker le résultat
      context.nodeResults[nodeId] = result;
      
      // Si le nœud a demandé d'arrêter, ne pas suivre les connexions
      if (nodeContext.stop) {
        context.logs.push({
          timestamp: Date.now(),
          nodeId,
          nodeType: node.type,
          message: `Execution stopped by node ${nodeId}`
        });
        return result;
      }
      
      // Trouver les connexions sortantes
      const connections = flowData.edges.filter(edge => edge.source === nodeId);
      
      // S'il n'y a pas de connexion, retourner le résultat
      if (connections.length === 0) {
        return result;
      }
      
      // Sinon, exécuter tous les nœuds connectés
      let finalResult = result;
      
      for (const connection of connections) {
        finalResult = await this.executeNode(connection.target, flowData, result, context);
      }
      
      return finalResult;
    } catch (error) {
      // Journaliser l'erreur
      context.logs.push({
        timestamp: Date.now(),
        nodeId,
        nodeType: node.type,
        message: `Error in node ${nodeId}: ${error.message}`,
        error: error.stack
      });
      
      throw error;
    }
  }
  
  // Récupère un workflow depuis la base de données
  async getWorkflow(workflowId) {
    return this.db.prepare(`
      SELECT * FROM processes WHERE id = ?
    `).get(workflowId);
  }
  
  // Sauvegarde les logs d'exécution
  saveExecutionLogs(context) {
    try {
      this.db.prepare(`
        INSERT INTO workflow_executions (
          id,
          workflow_id,
          status,
          start_time,
          end_time,
          execution_time,
          path_json,
          logs_json,
          error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        context.executionId,
        context.workflowId,
        context.status,
        new Date(context.startTime).toISOString(),
        new Date(context.endTime).toISOString(),
        context.executionTime,
        JSON.stringify(context.executionPath),
        JSON.stringify(context.logs),
        context.error || null
      );
    } catch (error) {
      console.error(`Error saving workflow execution logs: ${error.message}`);
    }
  }
  
  // Méthodes utilitaires pour les types de nœuds
  
  getHL7FieldValue(segment, fieldPath) {
    // Format de chemin: 3.1.2 (fieldIndex.componentIndex.subcomponentIndex)
    const [fieldIndex, componentIndex, subComponentIndex] = fieldPath.split('.').map(Number);
    
    if (!segment.fields[fieldIndex]) return '';
    
    const field = segment.fields[fieldIndex];
    
    if (componentIndex === undefined) {
      return field.toString();
    }
    
    if (!field[0] || !field[0][componentIndex]) return '';
    
    const component = field[0][componentIndex];
    
    if (subComponentIndex === undefined) {
      return component.toString();
    }
    
    return component[subComponentIndex] || '';
  }
  
  // Méthodes de transformation et de sortie spécifiques
  // ...
}
```

Cette architecture de processus:
1. Utilise un modèle basé sur les nœuds et les connexions
2. Permet des flux conditionnels basés sur le contenu HL7
3. Supporte des transformations personnalisées
4. Fournit une traçabilité complète de l'exécution

## Intégration avec Mistral AI

FHIRHub intègre Mistral AI pour l'assistance intelligente aux utilisateurs et l'analyse des messages:

```javascript
class MistralAIService {
  constructor(apiKey, modelName = 'mistral-large-latest') {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.baseUrl = 'https://api.mistral.ai/v1';
    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  async chat(messages, options = {}) {
    try {
      const response = await this.axios.post('/chat/completions', {
        model: this.modelName,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1024,
        top_p: options.topP || 1.0,
        stream: false
      });
      
      return response.data.choices[0].message;
    } catch (error) {
      console.error('[MistralAI] Error:', error.response?.data || error.message);
      throw new Error(`MistralAI API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
  
  async analyzeHL7Message(hl7Message) {
    const messages = [
      {
        role: 'system',
        content: `Vous êtes un expert en HL7 v2.5 et FHIR R4, spécialisé dans l'analyse des messages médicaux.
                 Analysez le message HL7 fourni et extrayez les informations clés, tout en identifiant
                 les éventuels problèmes ou anomalies. Fournissez votre réponse au format JSON avec les clés:
                 "messageType", "sourceSystems", "patient", "observations", "issues"`
      },
      {
        role: 'user',
        content: `Analysez ce message HL7 v2.5:\n\n${hl7Message}`
      }
    ];
    
    const response = await this.chat(messages, { temperature: 0.3 });
    
    try {
      // Extraire le JSON de la réponse
      const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/) || 
                         response.content.match(/{[\s\S]*}/);
      
      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonText);
      }
      
      // Si pas de format JSON explicite, tenter de parser toute la réponse
      return JSON.parse(response.content);
    } catch (error) {
      console.error('[MistralAI] JSON parsing error:', error);
      return {
        error: 'Failed to parse response',
        rawResponse: response.content
      };
    }
  }
  
  async suggestFHIRImprovements(fhirBundle) {
    const messages = [
      {
        role: 'system',
        content: `Vous êtes un expert FHIR R4, spécialisé dans l'optimisation des ressources FHIR
                 pour le contexte français. Analysez le bundle FHIR fourni et suggérez des améliorations
                 pour le rendre plus conforme aux spécifications françaises et plus informatif.
                 Mettez l'accent sur les extensions spécifiques à la France, les systèmes d'identification,
                 et les terminologies spécifiques.`
      },
      {
        role: 'user',
        content: `Analysez ce bundle FHIR et suggérez des améliorations:\n\n${JSON.stringify(fhirBundle, null, 2)}`
      }
    ];
    
    const response = await this.chat(messages, { temperature: 0.4, maxTokens: 1500 });
    return response.content;
  }
  
  async chatbotInteraction(userQuery, chatHistory = []) {
    // Construire le contexte avec l'historique limité
    const limitedHistory = chatHistory.slice(-5); // Limiter à 5 derniers échanges
    
    const messages = [
      {
        role: 'system',
        content: `Vous êtes l'assistant FHIRHub, expert en interopérabilité des données de santé,
                  notamment HL7 v2.5 et FHIR R4. Votre spécialité est la conversion entre ces formats
                  et les terminologies françaises. Vous aidez les utilisateurs à comprendre les messages,
                  diagnostiquer les problèmes et optimiser leurs intégrations. Répondez de manière concise
                  et factuelle, en privilégiant les exemples concrets et les références aux standards.`
      },
      ...limitedHistory.map(entry => ({
        role: entry.isUser ? 'user' : 'assistant',
        content: entry.message
      })),
      {
        role: 'user',
        content: userQuery
      }
    ];
    
    const response = await this.chat(messages, { temperature: 0.7 });
    return response.content;
  }
}
```

Les fonctionnalités clés:
1. Analyse intelligente des messages HL7
2. Suggestions d'amélioration FHIR
3. Assistant conversationnel pour les utilisateurs
4. Paramétrage contextuel adapté

## Maintenance et surveillance

FHIRHub implémente un système complet de surveillance pour faciliter la maintenance:

```javascript
class SystemMonitor {
  constructor(db, options = {}) {
    this.db = db;
    this.options = {
      metricsInterval: 60000, // 1 minute
      alertThresholds: {
        cpuUsage: 80, // Pourcentage
        memoryUsage: 80, // Pourcentage
        diskUsage: 85, // Pourcentage
        errorRate: 5, // Pourcentage de requêtes en erreur
        responseTime: 2000 // ms
      },
      ...options
    };
    
    this.metrics = {
      cpu: [],
      memory: [],
      disk: [],
      activeConnections: 0,
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      startTime: Date.now()
    };
    
    this.metricCollector = null;
  }
  
  start() {
    this.startMetricCollection();
    console.log('[MONITOR] System monitoring started');
  }
  
  stop() {
    if (this.metricCollector) {
      clearInterval(this.metricCollector);
      this.metricCollector = null;
    }
    console.log('[MONITOR] System monitoring stopped');
  }
  
  startMetricCollection() {
    this.metricCollector = setInterval(async () => {
      await this.collectMetrics();
    }, this.options.metricsInterval);
  }
  
  async collectMetrics() {
    // Collecter les métriques système
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();
    
    // Stocker les métriques
    this.metrics.cpu.push({ timestamp: Date.now(), value: cpuUsage });
    this.metrics.memory.push({ timestamp: Date.now(), value: memoryUsage });
    this.metrics.disk.push({ timestamp: Date.now(), value: diskUsage });
    
    // Limiter la taille des tableaux
    if (this.metrics.cpu.length > 60) this.metrics.cpu.shift();
    if (this.metrics.memory.length > 60) this.metrics.memory.shift();
    if (this.metrics.disk.length > 60) this.metrics.disk.shift();
    
    // Vérifier les seuils d'alerte
    this.checkAlertThresholds({
      cpuUsage,
      memoryUsage,
      diskUsage,
      errorRate: this.metrics.requestCount > 0 
        ? (this.metrics.errorCount / this.metrics.requestCount) * 100 
        : 0,
      responseTime: this.metrics.avgResponseTime
    });
    
    // Enregistrer dans la base de données
    this.saveMetricsToDatabase(cpuUsage, memoryUsage, diskUsage);
  }
  
  async getCPUUsage() {
    // Fonction simplifiée, à implémenter avec des bibliothèques comme os-utils
    return new Promise((resolve) => {
      // Simulation
      const usage = Math.floor(Math.random() * 30) + 10; // 10-40%
      resolve(usage);
    });
  }
  
  getMemoryUsage() {
    const used = process.memoryUsage();
    return {
      rss: used.rss,
      heapTotal: used.heapTotal,
      heapUsed: used.heapUsed,
      external: used.external,
      percentage: Math.round((used.heapUsed / used.heapTotal) * 100)
    };
  }
  
  async getDiskUsage() {
    // Fonction simplifiée, à implémenter avec node-disk-info
    return new Promise((resolve) => {
      // Simulation
      const usage = Math.floor(Math.random() * 30) + 30; // 30-60%
      resolve(usage);
    });
  }
  
  checkAlertThresholds(metrics) {
    const alerts = [];
    
    if (metrics.cpuUsage > this.options.alertThresholds.cpuUsage) {
      alerts.push({
        type: 'cpu',
        message: `CPU usage too high: ${metrics.cpuUsage}%`,
        value: metrics.cpuUsage,
        threshold: this.options.alertThresholds.cpuUsage,
        timestamp: Date.now()
      });
    }
    
    if (metrics.memoryUsage.percentage > this.options.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'memory',
        message: `Memory usage too high: ${metrics.memoryUsage.percentage}%`,
        value: metrics.memoryUsage.percentage,
        threshold: this.options.alertThresholds.memoryUsage,
        timestamp: Date.now()
      });
    }
    
    if (metrics.diskUsage > this.options.alertThresholds.diskUsage) {
      alerts.push({
        type: 'disk',
        message: `Disk usage too high: ${metrics.diskUsage}%`,
        value: metrics.diskUsage,
        threshold: this.options.alertThresholds.diskUsage,
        timestamp: Date.now()
      });
    }
    
    if (metrics.errorRate > this.options.alertThresholds.errorRate) {
      alerts.push({
        type: 'errors',
        message: `Error rate too high: ${metrics.errorRate.toFixed(2)}%`,
        value: metrics.errorRate,
        threshold: this.options.alertThresholds.errorRate,
        timestamp: Date.now()
      });
    }
    
    if (metrics.responseTime > this.options.alertThresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        message: `Response time too high: ${metrics.responseTime}ms`,
        value: metrics.responseTime,
        threshold: this.options.alertThresholds.responseTime,
        timestamp: Date.now()
      });
    }
    
    if (alerts.length > 0) {
      this.handleAlerts(alerts);
    }
  }
  
  handleAlerts(alerts) {
    // Journaliser les alertes
    for (const alert of alerts) {
      console.warn(`[MONITOR] ALERT: ${alert.message}`);
      
      // Stocker dans la base de données
      this.db.prepare(`
        INSERT INTO system_alerts (
          type,
          message,
          value,
          threshold,
          created_at
        ) VALUES (?, ?, ?, ?, datetime('now'))
      `).run(
        alert.type,
        alert.message,
        alert.value,
        alert.threshold
      );
    }
  }
  
  saveMetricsToDatabase(cpuUsage, memoryUsage, diskUsage) {
    try {
      this.db.prepare(`
        INSERT INTO system_metrics (
          cpu_usage,
          memory_usage,
          memory_used,
          memory_total,
          disk_usage,
          active_connections,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        cpuUsage,
        memoryUsage.percentage,
        memoryUsage.heapUsed,
        memoryUsage.heapTotal,
        diskUsage,
        this.metrics.activeConnections
      );
    } catch (error) {
      console.error(`[MONITOR] Error saving metrics: ${error.message}`);
    }
  }
  
  // Méthodes pour l'instrumentation des requêtes
  
  trackRequest() {
    this.metrics.requestCount++;
    this.metrics.activeConnections++;
    const startTime = Date.now();
    
    return {
      end: (error) => {
        this.metrics.activeConnections--;
        const duration = Date.now() - startTime;
        
        // Mettre à jour le temps de réponse moyen
        const totalTime = this.metrics.avgResponseTime * (this.metrics.requestCount - 1);
        this.metrics.avgResponseTime = (totalTime + duration) / this.metrics.requestCount;
        
        if (error) {
          this.metrics.errorCount++;
        }
        
        return duration;
      }
    };
  }
  
  // Statistiques et données pour le tableau de bord
  
  getStats() {
    return {
      uptime: (Date.now() - this.metrics.startTime) / 1000, // en secondes
      memory: this.getMemoryUsage(),
      requestCount: this.metrics.requestCount,
      errorCount: this.metrics.errorCount,
      errorRate: this.metrics.requestCount > 0 
        ? (this.metrics.errorCount / this.metrics.requestCount) * 100 
        : 0,
      avgResponseTime: this.metrics.avgResponseTime,
      activeConnections: this.metrics.activeConnections,
      lastMetrics: {
        cpu: this.metrics.cpu.length > 0 ? this.metrics.cpu[this.metrics.cpu.length - 1].value : 0,
        memory: this.metrics.memory.length > 0 ? this.metrics.memory[this.metrics.memory.length - 1].value : 0,
        disk: this.metrics.disk.length > 0 ? this.metrics.disk[this.metrics.disk.length - 1].value : 0
      },
      history: {
        cpu: this.metrics.cpu,
        memory: this.metrics.memory,
        disk: this.metrics.disk
      }
    };
  }
}
```

Ce système fournit:
1. Collecte de métriques en temps réel
2. Alertes basées sur des seuils configurables
3. Historisation dans la base de données
4. Instrumentation des requêtes HTTP
5. Statistiques pour le tableau de bord

## Sécurité et audit

FHIRHub implémente un système complet de journalisation d'audit pour la conformité:

```javascript
class AuditLogger {
  constructor(db) {
    this.db = db;
  }
  
  async logApiActivity(req, apiKeyId, applicationId, statusCode = 200) {
    const startTime = req.startTime || Date.now();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    try {
      this.db.prepare(`
        INSERT INTO api_activity_logs (
          api_key_id,
          application_id,
          endpoint,
          method,
          status_code,
          response_time,
          ip_address,
          user_agent,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        apiKeyId,
        applicationId,
        req.path,
        req.method,
        statusCode,
        responseTime,
        req.ip,
        req.get('User-Agent') || 'Unknown'
      );
    } catch (error) {
      console.error(`[AUDIT] Error logging API activity: ${error.message}`);
    }
  }
  
  async logConversion(input, output, status, apiKeyId = null, userId = null, processTime = 0, resourceCount = 0) {
    try {
      this.db.prepare(`
        INSERT INTO conversion_logs (
          input_message,
          output_message,
          status,
          timestamp,
          api_key_id,
          user_id,
          processing_time,
          resource_count
        ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)
      `).run(
        input.substring(0, 10000), // Limiter la taille pour éviter les problèmes de BDD
        JSON.stringify(output).substring(0, 10000),
        status,
        apiKeyId,
        userId,
        processTime,
        resourceCount
      );
    } catch (error) {
      console.error(`[AUDIT] Error logging conversion: ${error.message}`);
    }
  }
  
  async logSystemEvent(eventType, message, details = null, userId = null, severity = 'INFO') {
    try {
      this.db.prepare(`
        INSERT INTO system_logs (
          event_type,
          message,
          details,
          severity,
          user_id,
          ip_address,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        eventType,
        message,
        details ? JSON.stringify(details) : null,
        severity,
        userId,
        req ? req.ip : null
      );
    } catch (error) {
      console.error(`[AUDIT] Error logging system event: ${error.message}`);
    }
  }
  
  async logSecurityEvent(eventType, userId = null, req = null, success = true, details = null) {
    try {
      this.db.prepare(`
        INSERT INTO security_logs (
          event_type,
          user_id,
          ip_address,
          user_agent,
          success,
          details,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        eventType,
        userId,
        req ? req.ip : null,
        req ? req.get('User-Agent') : null,
        success ? 1 : 0,
        details ? JSON.stringify(details) : null
      );
    } catch (error) {
      console.error(`[AUDIT] Error logging security event: ${error.message}`);
    }
  }
  
  // Rapports et analyse
  
  async getActivitySummary(startDate, endDate = null) {
    const endDateQuery = endDate ? `AND created_at <= datetime(?)` : '';
    
    try {
      return {
        apiCalls: this.db.prepare(`
          SELECT COUNT(*) as count, endpoint, method 
          FROM api_activity_logs 
          WHERE created_at >= datetime(?) ${endDateQuery}
          GROUP BY endpoint, method
          ORDER BY count DESC
        `).all(startDate, ...(endDate ? [endDate] : [])),
        
        conversions: this.db.prepare(`
          SELECT COUNT(*) as count, status
          FROM conversion_logs
          WHERE timestamp >= datetime(?) ${endDateQuery.replace('created_at', 'timestamp')}
          GROUP BY status
        `).all(startDate, ...(endDate ? [endDate] : [])),
        
        securityEvents: this.db.prepare(`
          SELECT COUNT(*) as count, event_type, success
          FROM security_logs
          WHERE created_at >= datetime(?) ${endDateQuery}
          GROUP BY event_type, success
        `).all(startDate, ...(endDate ? [endDate] : [])),
        
        systemEvents: this.db.prepare(`
          SELECT COUNT(*) as count, event_type, severity
          FROM system_logs
          WHERE created_at >= datetime(?) ${endDateQuery}
          GROUP BY event_type, severity
        `).all(startDate, ...(endDate ? [endDate] : []))
      };
    } catch (error) {
      console.error(`[AUDIT] Error getting activity summary: ${error.message}`);
      throw error;
    }
  }
}
```

Avantages techniques:
1. Journalisation complète de toutes les activités
2. Prise en charge de différents types d'événements (API, conversion, système, sécurité)
3. Protection contre les données trop volumineuses
4. Rapports d'activité pour analyse

## Conclusion

Cette documentation technique détaille l'architecture et l'implémentation de FHIRHub. Le système est conçu avec une approche modulaire et extensible, permettant d'ajouter facilement de nouveaux types de messages, de terminologies ou de processus de traitement.

Les composants principaux sont:
1. Le parseur HL7 optimisé qui décompose les messages en structures hiérarchiques
2. Le convertisseur FHIR qui transforme ces structures en ressources standardisées
3. L'adaptateur de terminologies françaises qui assure la conformité avec les spécifications de l'ANS
4. Le système de cache à deux niveaux qui optimise les performances
5. Le moteur de processus visuel qui permet des chaînes de traitement personnalisées
6. L'intégration Mistral AI pour l'analyse intelligente et l'assistance

Pour maintenir et faire évoluer le système:
1. Mettre à jour régulièrement les terminologies françaises via les scripts Python
2. Surveiller les métriques système pour identifier les problèmes de performance
3. Utiliser les logs d'audit pour analyser l'utilisation et diagnostiquer les problèmes
4. Étendre progressivement les types de messages supportés selon la documentation