# ⚙️ Guide de Configuration FHIRHub

## 📋 Aperçu

Ce guide détaille toutes les options de configuration disponibles pour FHIRHub, incluant les variables d'environnement, les fichiers de configuration, et les options avancées.

## 🔧 Variables d'Environnement

### Configuration de Base

```bash
# Application
NODE_ENV=production                    # Environnement: development, production
PORT=5000                             # Port d'écoute FHIRHub
HAPI_FHIR_URL=http://localhost:8080/fhir  # URL du serveur HAPI FHIR

# Base de données
DATABASE_PATH=./data/fhirhub/fhirhub.db   # Chemin base SQLite
```

### Sécurité et Authentification

```bash
# JWT et sécurité
JWT_SECRET=your_very_long_secret_key_here  # Secret JWT (min 32 caractères)
JWT_EXPIRES_IN=24h                     # Durée validité tokens JWT
API_KEY_LENGTH=32                      # Longueur clés API générées

# Rate Limiting
API_RATE_LIMIT=1000                    # Requêtes/15min par IP
CONVERSION_RATE_LIMIT=30               # Conversions/min par IP/API Key
AUTH_RATE_LIMIT=10                     # Tentatives auth/15min par IP
AI_RATE_LIMIT=10                       # Requêtes IA/min par IP

# Headers de sécurité
ENABLE_SECURITY_HEADERS=true           # Activer headers sécurité
ENABLE_CORS_VALIDATION=true            # Validation CORS stricte
ALLOWED_ORIGINS=http://localhost:5000,https://fhirhub.hospital.fr
```

### Performance et Cache

```bash
# Cache
CACHE_MAX_SIZE=1000                    # Entrées max cache conversion
CACHE_TTL=3600                         # Durée vie cache (secondes)
CACHE_CHECK_PERIOD=600                 # Vérification cache (secondes)

# Node.js Performance
NODE_OPTIONS=--max-old-space-size=1024 --max-http-header-size=16384
MAX_REQUEST_SIZE=10mb                  # Taille max requêtes
REQUEST_TIMEOUT=30000                  # Timeout requêtes (ms)

# Worker Threads
WORKER_THREADS_ENABLED=false           # Threads workers pour conversions
MAX_WORKER_THREADS=4                   # Nombre max threads
```

### Intégration FHIR

```bash
# HAPI FHIR
FHIR_REQUEST_TIMEOUT=30000             # Timeout requêtes FHIR (ms)
FHIR_MAX_RETRY_ATTEMPTS=3              # Tentatives max
FHIR_RETRY_DELAY=1000                  # Délai entre tentatives (ms)
FHIR_VALIDATION_ENABLED=false          # Validation FHIR stricte
FHIR_AUTO_CREATE_RESOURCES=true        # Création auto ressources

# Serveurs FHIR externes
EXTERNAL_FHIR_SERVERS=https://hapi.fhir.org/baseR4,https://server.fire.ly
FHIR_TERMINOLOGY_SERVER=https://tx.fhir.org/r4
```

### Intelligence Artificielle

```bash
# Configuration IA générale
AI_ENABLED=true                        # Activer fonctionnalités IA
AI_DEFAULT_PROVIDER=mistral           # Fournisseur par défaut
AI_REQUEST_TIMEOUT=60000              # Timeout requêtes IA (ms)
AI_MAX_TOKENS=4000                    # Tokens max par requête
AI_TEMPERATURE=0.7                    # Température génération

# Mistral AI
MISTRAL_API_KEY=your_mistral_api_key
MISTRAL_MODEL=mistral-large-2411
MISTRAL_BASE_URL=https://api.mistral.ai/v1

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:8b
```

### Logging et Monitoring

```bash
# Logging
LOG_LEVEL=info                         # Niveau: error, warn, info, debug
LOG_FORMAT=json                        # Format: json, text
LOG_MAX_SIZE=100MB                     # Taille max fichiers log
LOG_MAX_FILES=5                        # Nombre max fichiers log
LOG_COMPRESS=true                      # Compression logs archivés

# Chemins des logs
LOG_DIR=./data/fhirhub/logs
ACCESS_LOG_FILE=access.log
ERROR_LOG_FILE=error.log
CONVERSION_LOG_FILE=conversion.log
AI_LOG_FILE=ai.log

# Monitoring
METRICS_ENABLED=true                   # Métriques Prometheus
METRICS_PORT=9090                      # Port exposition métriques
HEALTH_CHECK_ENABLED=true              # Health checks
UPTIME_MONITORING=true                 # Monitoring uptime
```

### Terminologies Françaises

```bash
# Terminologies ANS
FRENCH_TERMINOLOGY_ENABLED=true       # Terminologies françaises
ANS_TERMINOLOGY_URL=https://mos.esante.gouv.fr
FINESS_API_URL=https://api.finess.esante.fr
RPPS_API_URL=https://api.rpps.esante.fr

# Cache terminologies
TERMINOLOGY_CACHE_TTL=86400           # Cache 24h
TERMINOLOGY_AUTO_UPDATE=true          # MAJ automatique
TERMINOLOGY_UPDATE_INTERVAL=weekly    # Fréquence MAJ

# Fichiers terminologies locaux
TERMINOLOGY_DIR=./data/fhirhub/terminologies
FINESS_FILE=finess.json
RPPS_FILE=rpps.json
CIM10_FILE=cim10.json
CCAM_FILE=ccam.json
```

## 📁 Fichiers de Configuration

### 1. Configuration Principale (config/default.json)

```json
{
  "server": {
    "port": 5000,
    "host": "0.0.0.0",
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:5000"],
      "credentials": true
    },
    "security": {
      "helmet": true,
      "rateLimiting": true,
      "inputValidation": true
    }
  },
  "database": {
    "type": "sqlite",
    "path": "./data/fhirhub/fhirhub.db",
    "autoBackup": true,
    "backupInterval": "daily",
    "maxBackups": 7
  },
  "fhir": {
    "server": {
      "url": "http://localhost:8080/fhir",
      "timeout": 30000,
      "retries": 3
    },
    "validation": {
      "enabled": false,
      "strict": false
    },
    "profiles": {
      "frCore": true,
      "international": true
    }
  },
  "conversion": {
    "cache": {
      "enabled": true,
      "maxSize": 1000,
      "ttl": 3600
    },
    "validation": {
      "hl7": true,
      "fhir": false
    },
    "frenchSupport": {
      "enabled": true,
      "terminologies": true,
      "nameParser": true,
      "addressParser": true
    }
  },
  "ai": {
    "enabled": true,
    "defaultProvider": "mistral",
    "timeout": 60000,
    "maxTokens": 4000,
    "temperature": 0.7,
    "providers": {
      "mistral": {
        "model": "mistral-large-2411",
        "baseUrl": "https://api.mistral.ai/v1"
      },
      "openai": {
        "model": "gpt-4",
        "baseUrl": "https://api.openai.com/v1"
      },
      "ollama": {
        "model": "llama3:8b",
        "baseUrl": "http://localhost:11434"
      }
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "files": {
      "access": "access.log",
      "error": "error.log",
      "conversion": "conversion.log",
      "ai": "ai.log"
    },
    "rotation": {
      "maxSize": "100MB",
      "maxFiles": 5,
      "compress": true
    }
  },
  "monitoring": {
    "metrics": true,
    "healthChecks": true,
    "uptime": true
  }
}
```

### 2. Configuration Production (config/production.json)

```json
{
  "server": {
    "security": {
      "helmet": true,
      "rateLimiting": true,
      "inputValidation": true,
      "strictCors": true
    }
  },
  "database": {
    "autoBackup": true,
    "backupInterval": "hourly",
    "maxBackups": 24
  },
  "logging": {
    "level": "warn",
    "format": "json",
    "syslog": true
  },
  "ai": {
    "rateLimiting": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 3600000
    }
  }
}
```

### 3. Configuration Développement (config/development.json)

```json
{
  "server": {
    "security": {
      "rateLimiting": false,
      "strictCors": false
    }
  },
  "logging": {
    "level": "debug",
    "format": "text",
    "console": true
  },
  "fhir": {
    "validation": {
      "enabled": true,
      "strict": false
    }
  },
  "conversion": {
    "cache": {
      "enabled": false
    }
  }
}
```

## 🔐 Configuration de Sécurité

### 1. Configuration JWT

```javascript
// config/jwt.js
module.exports = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  algorithm: 'HS256',
  issuer: 'fhirhub',
  audience: 'fhirhub-api',
  refreshTokenExpiry: '7d'
};
```

### 2. Configuration Rate Limiting

```javascript
// config/rateLimiting.js
module.exports = {
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.API_RATE_LIMIT || 1000
  },
  conversion: {
    windowMs: 60 * 1000, // 1 minute
    max: process.env.CONVERSION_RATE_LIMIT || 30
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.AUTH_RATE_LIMIT || 10,
    skipSuccessfulRequests: true
  },
  ai: {
    windowMs: 60 * 1000, // 1 minute
    max: process.env.AI_RATE_LIMIT || 10
  }
};
```

### 3. Configuration CORS

```javascript
// config/cors.js
module.exports = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5000'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY']
};
```

## 🌐 Configuration HAPI FHIR

### 1. Configuration Standalone (application.yaml)

```yaml
spring:
  datasource:
    url: 'jdbc:h2:file:./data/hapi-fhir/database/h2;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE'
    username: sa
    password: sa
    driverClassName: org.h2.Driver
  jpa:
    properties:
      hibernate.dialect: org.hibernate.dialect.H2Dialect
      hibernate.show_sql: false
      hibernate.format_sql: false
      hibernate.hbm2ddl.auto: update
  h2:
    console:
      enabled: false

hapi:
  fhir:
    fhir_version: R4
    server_address: http://localhost:8080/fhir
    default_encoding: json
    default_pretty_print: true
    allow_external_references: true
    allow_multiple_delete: true
    allow_cascading_deletes: true
    
    # Validation
    validation:
      enabled: false
      request_only: true
    
    # Sécurité
    cors:
      enabled: true
      allowed_origin:
        - http://localhost:5000
        - http://localhost:3000
    
    # Performance
    expunge_enabled: true
    subscription:
      resthook_enabled: false
      websocket_enabled: false
      email_enabled: false
    narrative_enabled: false
    bulk_export_enabled: false
    binary_storage_enabled: false
    advanced_lucene_indexing: false
    
    # Logging
    logger:
      log_exceptions: true
      error_format: JSON

logging:
  level:
    ca.uhn.fhir: WARN
    org.springframework: WARN
    org.hibernate: ERROR
    root: WARN
```

### 2. Configuration Docker HAPI FHIR

```yaml
# docker/hapi-fhir/application.yaml
spring:
  datasource:
    url: 'jdbc:h2:file:/data/hapi/database/h2;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE'
    username: sa
    password: sa
    driverClassName: org.h2.Driver

hapi:
  fhir:
    fhir_version: R4
    server_address: http://hapi-fhir:8080/fhir
    # ... reste de la configuration
```

## 🧠 Configuration IA

### 1. Configuration Mistral AI

```javascript
// config/ai/mistral.js
module.exports = {
  apiKey: process.env.MISTRAL_API_KEY,
  baseUrl: process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1',
  model: process.env.MISTRAL_MODEL || 'mistral-large-2411',
  maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 4000,
  temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
  timeout: parseInt(process.env.AI_REQUEST_TIMEOUT) || 60000
};
```

### 2. Configuration Multi-Providers

```javascript
// config/ai/providers.js
module.exports = {
  mistral: {
    enabled: !!process.env.MISTRAL_API_KEY,
    priority: 1,
    models: ['mistral-large-2411', 'mistral-medium'],
    costPerToken: 0.000002
  },
  openai: {
    enabled: !!process.env.OPENAI_API_KEY,
    priority: 2,
    models: ['gpt-4', 'gpt-3.5-turbo'],
    costPerToken: 0.00003
  },
  ollama: {
    enabled: true,
    priority: 3,
    models: ['llama3:8b', 'mistral:7b'],
    costPerToken: 0
  }
};
```

## 📊 Configuration Monitoring

### 1. Configuration Prometheus

```javascript
// config/prometheus.js
module.exports = {
  enabled: process.env.METRICS_ENABLED === 'true',
  port: process.env.METRICS_PORT || 9090,
  path: '/metrics',
  collectDefaultMetrics: true,
  customMetrics: {
    conversions: {
      name: 'fhirhub_conversions_total',
      help: 'Total number of HL7 to FHIR conversions'
    },
    conversionDuration: {
      name: 'fhirhub_conversion_duration_seconds',
      help: 'Duration of HL7 to FHIR conversions'
    },
    aiRequests: {
      name: 'fhirhub_ai_requests_total',
      help: 'Total number of AI requests'
    }
  }
};
```

### 2. Configuration Health Checks

```javascript
// config/healthcheck.js
module.exports = {
  enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
  endpoint: '/api/system/health',
  checks: {
    database: {
      enabled: true,
      timeout: 5000
    },
    hapiFhir: {
      enabled: true,
      url: process.env.HAPI_FHIR_URL,
      timeout: 10000
    },
    aiProviders: {
      enabled: true,
      timeout: 15000
    },
    diskSpace: {
      enabled: true,
      threshold: 90 // Pourcentage
    },
    memory: {
      enabled: true,
      threshold: 90 // Pourcentage
    }
  }
};
```

## 🔧 Scripts de Configuration

### 1. Script de Configuration Initiale

```bash
#!/bin/bash
# scripts/setup-config.sh

echo "Configuration initiale FHIRHub"

# Copier les fichiers de configuration exemples
cp config/examples/default.json config/default.json
cp config/examples/production.json config/production.json
cp config/examples/development.json config/development.json

# Générer un secret JWT sécurisé
JWT_SECRET=$(openssl rand -hex 32)
sed -i "s/your_jwt_secret_here/$JWT_SECRET/g" .env

# Configurer les permissions
chmod 600 .env config/*.json

echo "Configuration terminée"
```

### 2. Script de Validation Configuration

```bash
#!/bin/bash
# scripts/validate-config.sh

echo "Validation de la configuration FHIRHub"

# Vérifier les variables obligatoires
REQUIRED_VARS=("NODE_ENV" "PORT" "HAPI_FHIR_URL" "JWT_SECRET")

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "ERREUR: Variable $var manquante"
        exit 1
    fi
done

# Vérifier la connectivité HAPI FHIR
if ! curl -sf "$HAPI_FHIR_URL/metadata" >/dev/null; then
    echo "ERREUR: HAPI FHIR non accessible à $HAPI_FHIR_URL"
    exit 1
fi

# Vérifier les clés API IA
if [ -n "$MISTRAL_API_KEY" ]; then
    echo "✓ Clé Mistral AI configurée"
fi

if [ -n "$OPENAI_API_KEY" ]; then
    echo "✓ Clé OpenAI configurée"
fi

echo "Configuration valide"
```

## 🔄 Configuration Avancée

### 1. Clustering et Load Balancing

```javascript
// config/cluster.js
module.exports = {
  enabled: process.env.CLUSTER_ENABLED === 'true',
  workers: process.env.CLUSTER_WORKERS || require('os').cpus().length,
  sticky: true,
  loadBalancer: {
    algorithm: 'round-robin',
    healthCheck: true
  }
};
```

### 2. Configuration SSL/TLS

```javascript
// config/ssl.js
module.exports = {
  enabled: process.env.SSL_ENABLED === 'true',
  port: process.env.SSL_PORT || 443,
  cert: process.env.SSL_CERT_PATH,
  key: process.env.SSL_KEY_PATH,
  ca: process.env.SSL_CA_PATH,
  redirectHttp: true
};
```

### 3. Configuration Cache Redis

```javascript
// config/redis.js
module.exports = {
  enabled: process.env.REDIS_ENABLED === 'true',
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  keyPrefix: 'fhirhub:',
  ttl: 3600
};
```

Cette configuration complète permet d'adapter FHIRHub à tous les environnements et besoins spécifiques.