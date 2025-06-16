# Documentation Technique FHIRHub

## Vue d'ensemble de l'architecture

FHIRHub est une plateforme de conversion HL7 vers FHIR conçue avec une architecture modulaire permettant une scalabilité et une maintenance optimales.

### Architecture globale

```
┌─────────────────────────────────────────────────────────────┐
│                     FHIRHub Platform                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Frontend      │   Backend API   │   Services externes    │
│   (Web UI)      │   (Node.js)     │   (HAPI FHIR, IA)      │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Architecture Frontend

### Structure des composants
```
public/
├── css/                    # Styles modulaires
│   ├── styles.css         # Styles de base
│   ├── sidebar-menu.css   # Navigation latérale
│   ├── metrics-dashboard.css # Tableaux de bord
│   └── ai-indicator.css   # Indicateurs IA
├── js/                    # Scripts JavaScript
│   ├── include-sidebar.js # Inclusion dynamique menu
│   ├── simple-charts.js   # Graphiques temps réel
│   ├── ai-provider-indicator.js # Gestion fournisseurs IA
│   └── support-chatbot.js # Interface chatbot
└── [pages].html          # Pages d'interface
```

### Fonctionnalités interface
- **Navigation dynamique** : Injection automatique du menu latéral
- **Graphiques temps réel** : Métriques de conversion actualisées
- **Interface responsive** : Adaptation mobile et desktop
- **Thème français** : Interface localisée

## Architecture Backend

### Structure modulaire Node.js
```
├── app.js                 # Point d'entrée principal
├── src/                   # Code source métier
│   ├── converters/        # Moteurs de conversion
│   │   ├── HL7ToFHIRConverter.js
│   │   ├── segmentMappers/ # Mappers par segment HL7
│   │   └── resourceBuilders/ # Constructeurs FHIR
│   ├── terminology/       # Gestionnaire terminologies
│   │   ├── FrenchTerminologyManager.js
│   │   └── FrenchTerminologyAdapter.js
│   ├── cache/            # Système de cache
│   │   ├── index.js      # Cache principal
│   │   └── cacheEnabledConverter.js
│   └── services/         # Services métiers
│       ├── conversionLogService.js
│       ├── authService.js
│       └── aiService.js
├── routes/               # Routes API Express
├── middleware/           # Middlewares d'authentification
└── data/                 # Données persistantes
```

### Middleware Stack
1. **CORS** : Gestion requêtes cross-origin
2. **Helmet** : Headers de sécurité
3. **Morgan** : Logging des requêtes
4. **Body Parser** : Parsing JSON/HL7
5. **Rate Limiting** : Protection contre le spam
6. **Authentication** : JWT + API Keys
7. **Validation** : Validation des entrées
8. **Error Handler** : Gestion centralisée des erreurs

## Système d'authentification

### Stratégie dual JWT + API Keys

```javascript
// Architecture d'authentification
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│   Middleware    │────│   Backend       │
│   (JWT Tokens)  │    │   authCombined  │    │   (API Keys)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Implémentation JWT
```javascript
// Génération token
const token = jwt.sign(
  { userId, username, role },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

// Validation token
const verified = jwt.verify(token, process.env.JWT_SECRET);
```

### Implémentation API Keys
```javascript
// Génération clé API
const apiKey = crypto.randomBytes(32).toString('hex');
const hashedKey = await bcrypt.hash(apiKey, 10);

// Validation timing-safe
const isValid = await bcrypt.compare(providedKey, storedHash);
```

## Moteur de conversion HL7 → FHIR

### Architecture du convertisseur

```
Message HL7 → Parser → Segment Mappers → Resource Builders → Bundle FHIR
     ↓           ↓            ↓               ↓              ↓
   Validation  Extraction  Terminologie   Construction    Validation
```

### Mappers de segments supportés
- **MSH** : Message Header → MessageHeader
- **PID** : Patient ID → Patient
- **PV1** : Patient Visit → Encounter
- **OBX** : Observation → Observation
- **ORC/OBR** : Order → ServiceRequest/DiagnosticReport
- **AL1** : Allergies → AllergyIntolerance

### Exemple de conversion PID → Patient
```javascript
function buildPatientFromPID(pidSegment, terminology) {
  const patient = {
    resourceType: 'Patient',
    id: generateUUID(),
    identifier: extractIdentifiers(pidSegment),
    name: extractNames(pidSegment, terminology),
    gender: mapGender(pidSegment[8], terminology),
    birthDate: formatDate(pidSegment[7]),
    address: extractAddresses(pidSegment),
    telecom: extractTelecoms(pidSegment)
  };
  
  return patient;
}
```

## Gestionnaire de terminologies françaises

### Mapping des systèmes ANS
```json
{
  "version": "1.1.0",
  "systems": {
    "COUNTRY": "https://mos.esante.gouv.fr/NOS/TRE_R20-Pays/FHIR/TRE-R20-Pays",
    "GENDER": "https://mos.esante.gouv.fr/NOS/TRE_R303-HL7v3AdministrativeGender/FHIR/TRE-R303-HL7v3AdministrativeGender",
    "PROFESSION": "https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante",
    "SPECIALTY": "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale"
  },
  "oids": {
    "1.2.250.1.213.1.1.5.1": "ADELI",
    "1.2.250.1.213.1.1.5.2": "RPPS"
  }
}
```

### Chargement dynamique
```javascript
class FrenchTerminologyManager {
  loadMappings(filePath) {
    try {
      const mappingsData = fs.readFileSync(filePath, 'utf8');
      this.mappings = JSON.parse(mappingsData);
      this.loaded = true;
      this.lastLoaded = new Date();
      return true;
    } catch (error) {
      console.error('[TERMINOLOGY] Erreur:', error);
      return false;
    }
  }
}
```

## Système de cache intelligent

### Architecture du cache
```javascript
class ConversionCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 500;
    this.ttl = options.ttl || 3600000; // 1 heure
    this.storage = new Map();
    this.stats = { hits: 0, misses: 0 };
  }

  get(key) {
    const item = this.storage.get(key);
    if (!item || this.isExpired(item)) {
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    return item.value;
  }
}
```

### Optimisations de performance
- **LRU Eviction** : Suppression des entrées les moins utilisées
- **TTL configurable** : Expiration automatique des entrées
- **Compression** : Compression des données volumineuses
- **Statistiques** : Monitoring du hit ratio

## Intégration HAPI FHIR

### Configuration serveur local
```properties
# application.properties HAPI FHIR
spring.datasource.url=jdbc:h2:file:./data/hapi-fhir/database/h2
hapi.fhir.fhir_version=R4
hapi.fhir.server_address=http://localhost:8080/fhir
hapi.fhir.validation.enabled=false
```

### Script de démarrage optimisé
```bash
#!/bin/bash
# run-hapi-fhir-simple.sh
java -Xmx512m -Xms256m \
  -XX:+UseG1GC \
  --add-opens java.base/java.lang=ALL-UNNAMED \
  -Dspring.datasource.url=jdbc:h2:file:../data/hapi-fhir/database/h2 \
  -jar hapi-fhir-server-starter-5.4.0.jar
```

### Proxy et intégration
```javascript
// Configuration proxy vers HAPI FHIR
app.use('/api/fhir-proxy', createProxyMiddleware({
  target: 'http://localhost:8080',
  changeOrigin: true,
  pathRewrite: {
    '^/api/fhir-proxy': '/fhir'
  }
}));
```

## Intégration IA multi-fournisseurs

### Architecture modulaire IA
```javascript
class AIProviderManager {
  constructor() {
    this.providers = {
      'mistral': new MistralProvider(),
      'openai': new OpenAIProvider(),
      'anthropic': new AnthropicProvider()
    };
  }

  async getActiveProvider() {
    const config = await this.getActiveConfig();
    return this.providers[config.provider_type];
  }
}
```

### Chatbot patient intelligent
```javascript
async function analyzePatientData(patientBundle, question) {
  const provider = await aiManager.getActiveProvider();
  
  const context = extractClinicalContext(patientBundle);
  const prompt = buildAnalysisPrompt(context, question);
  
  return await provider.chat(prompt, {
    temperature: 0.3,
    max_tokens: 1000
  });
}
```

## Base de données SQLite

### Schéma principal
```sql
-- Table des logs de conversion
CREATE TABLE conversion_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_message TEXT NOT NULL,
  output_message TEXT,
  status TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  processing_time INTEGER DEFAULT 0,
  resource_count INTEGER DEFAULT 0,
  application_id INTEGER,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

-- Table des applications
CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  cors_origins TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Table des clés API
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  key TEXT UNIQUE NOT NULL,
  hashed_key TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  description TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(application_id) REFERENCES applications(id)
);
```

### Optimisations de performance
```javascript
// Utilisation de Better-SQLite3 pour les performances
const db = new Database(DB_PATH, {
  fileMustExist: false,
  verbose: console.log
});

// Préparation des requêtes pour éviter la re-compilation
const insertConversion = db.prepare(`
  INSERT INTO conversion_logs 
  (input_message, output_message, status, timestamp, processing_time, resource_count, application_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
```

## API RESTful complète

### Endpoints de conversion
```javascript
// POST /api/convert - Conversion principale
router.post('/convert', [
  validateApiKey,
  validateHL7Input,
  convertHL7ToFHIR,
  logConversion
]);

// POST /api/convert/raw - Conversion texte brut
router.post('/convert/raw', [
  validateApiKey,
  parseRawHL7,
  convertHL7ToFHIR
]);

// POST /api/convert/validate - Validation syntaxique
router.post('/convert/validate', [
  validateApiKey,
  validateHL7Syntax
]);
```

### Endpoints de gestion
```javascript
// Gestion des applications
GET    /api/applications          # Liste des applications
POST   /api/applications          # Créer une application
PUT    /api/applications/:id      # Modifier une application
DELETE /api/applications/:id      # Supprimer une application

// Gestion des clés API
GET    /api/api-keys              # Liste des clés
POST   /api/api-keys              # Créer une clé
PUT    /api/api-keys/:id          # Modifier une clé
DELETE /api/api-keys/:id          # Révoquer une clé
```

### Endpoints de monitoring
```javascript
// Statistiques
GET /api/stats                    # Statistiques générales
GET /api/stats/conversions        # Historique des conversions
GET /api/message-types            # Types de messages traités

// Système
GET /api/system/health            # Santé du système
GET /api/system/version           # Version de l'application
GET /api/cache/stats              # Statistiques du cache
```

## Déploiement et infrastructure

### Configuration Docker Compose
```yaml
version: '3.8'
services:
  fhirhub:
    build: .
    container_name: fhirhub
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - ./data/fhirhub/storage:/app/storage
      - ./data/fhirhub/french_terminology:/app/french_terminology
    environment:
      - NODE_ENV=production
      - HAPI_FHIR_URL=http://hapi-fhir:8080/fhir
    depends_on:
      - hapi-fhir

  hapi-fhir:
    image: hapiproject/hapi:latest
    container_name: hapi-fhir
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data/hapi-fhir:/data/hapi
    environment:
      - spring.datasource.url=jdbc:h2:file:/data/hapi/database/h2
      - hapi.fhir.fhir_version=R4
```

### Service systemd
```ini
[Unit]
Description=FHIRHub HL7 to FHIR Conversion Service
After=network.target

[Service]
Type=simple
User=fhirhub
WorkingDirectory=/opt/fhirhub
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
```

### Stratégies de backup
```bash
#!/bin/bash
# backup-docker-data.sh
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Sauvegarde des données
tar -czf "$BACKUP_DIR/fhirhub-data.tar.gz" data/fhirhub/
tar -czf "$BACKUP_DIR/hapi-fhir-data.tar.gz" data/hapi-fhir/

# Sauvegarde de la configuration
cp docker-compose.yml "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/"
```

## Monitoring et observabilité

### Métriques Prometheus (optionnel)
```javascript
const promClient = require('prom-client');

const conversionCounter = new promClient.Counter({
  name: 'fhirhub_conversions_total',
  help: 'Total number of HL7 to FHIR conversions',
  labelNames: ['status', 'message_type']
});

const conversionDuration = new promClient.Histogram({
  name: 'fhirhub_conversion_duration_seconds',
  help: 'Duration of HL7 to FHIR conversions'
});
```

### Logging structuré
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'data/logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'data/logs/combined.log' 
    })
  ]
});
```

## Sécurité et conformité

### Mesures de sécurité implémentées
- **Validation d'entrée** : Sanitisation de tous les inputs
- **Rate limiting** : Protection contre les attaques DDoS
- **Headers de sécurité** : Configuration Helmet.js
- **Audit trail** : Logs de toutes les actions sensibles
- **Isolation des données** : Séparation par application

### Conformité RGPD
```javascript
// Anonymisation des logs
function sanitizeHL7ForLogging(hl7Message) {
  return hl7Message
    .replace(/\|[^|]*\^[^|]*\^[^|]*\|/g, '|[ANONYMIZED]|') // Noms
    .replace(/\|\d{10,}\|/g, '|[ID]|'); // Identifiants
}
```

## Performance et optimisation

### Optimisations Node.js
```javascript
// Configuration optimisée
const app = express();
app.use(compression()); // Compression gzip
app.use(express.json({ limit: '10mb' })); // Limite raisonnable
app.disable('x-powered-by'); // Sécurité

// Pool de connexions pour HAPI FHIR
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50
});
```

### Optimisations base de données
```javascript
// Transaction groupées pour les insertions en masse
const insertMany = db.transaction((conversions) => {
  for (const conversion of conversions) {
    insertConversion.run(conversion);
  }
});

// Index pour les requêtes fréquentes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_conversion_logs_app_id 
  ON conversion_logs(application_id);
  
  CREATE INDEX IF NOT EXISTS idx_conversion_logs_timestamp 
  ON conversion_logs(timestamp);
`);
```

## Stratégies de test

### Tests unitaires (Jest)
```javascript
describe('HL7 to FHIR Conversion', () => {
  test('should convert ADT^A01 message', async () => {
    const hl7Message = 'MSH|^~\\&|SENDING|...';
    const result = await convertHL7ToFHIR(hl7Message);
    
    expect(result.resourceType).toBe('Bundle');
    expect(result.entry).toHaveLength(3);
    expect(result.entry[0].resource.resourceType).toBe('Patient');
  });
});
```

### Tests d'intégration
```bash
#!/bin/bash
# integration-tests.sh

# Test de santé du système
curl -f http://localhost:5000/api/system/health

# Test de conversion basique
curl -X POST "http://localhost:5000/api/convert" \
  -H "X-API-KEY: dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hl7Message": "MSH|^~\\&|TEST|..."}'
```

Cette documentation technique fournit une vue complète de l'architecture FHIRHub, permettant aux développeurs et administrateurs de comprendre, déployer et maintenir efficacement la plateforme.