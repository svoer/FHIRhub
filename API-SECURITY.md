# 🔑 SÉCURITÉ DES CLÉS API - FHIRHUB

## 🎯 Vue d'ensemble

Les clés API de FHIRHub permettent un accès sécurisé aux endpoints de conversion HL7→FHIR et de gestion des données de santé. Le système implémente une architecture de sécurité multi-niveaux avec authentification dual (JWT + API Keys), rate limiting et audit trail complet.

## 🔧 Architecture de sécurité

### Système d'authentification dual
FHIRHub utilise un système d'authentification flexible qui accepte deux méthodes :
- **JWT (JSON Web Tokens)** : Pour les sessions utilisateur interactives
- **API Keys** : Pour l'intégration programmatique et les services

```javascript
// Ordre de priorité d'authentification
1. Vérification JWT (Bearer token)
2. Fallback vers API Key (header x-api-key)
3. Vérification des permissions et restrictions
```

### Format et structure des clés API

#### Génération sécurisée
- **Entropie** : 256 bits de sécurité cryptographique
- **Longueur** : 64 caractères hexadécimaux
- **Préfixe** : Identifiable par environnement (dev-key pour développement)
- **Unicité** : Garantie par génération crypto.randomBytes()

```javascript
// Exemple d'implémentation actuelle
const crypto = require('crypto');

function generateAPIKey() {
    const randomBytes = crypto.randomBytes(32);
    const apiKey = randomBytes.toString('hex');
    return apiKey;
}

// Clé de développement spéciale
const DEV_KEY = 'dev-key'; // Autorisée uniquement en mode développement
```

### Stockage et validation

#### Base de données sécurisée
```sql
-- Schéma de la table api_keys
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,           -- Clé en texte brut (à améliorer)
    hashed_key TEXT,                    -- Version hachée (recommandée)
    application_id INTEGER NOT NULL,     -- Lien vers l'application
    description TEXT,                   -- Description de l'usage
    is_active INTEGER DEFAULT 1,        -- Statut actif/inactif
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,               -- Date d'expiration optionnelle
    last_used_at TIMESTAMP,             -- Dernière utilisation
    usage_count INTEGER DEFAULT 0,      -- Compteur d'utilisation
    environment TEXT DEFAULT 'production', -- Environnement (dev/prod)
    origin_restrictions TEXT,           -- Restrictions CORS
    FOREIGN KEY (application_id) REFERENCES applications(id)
);
```

#### Validation en temps réel
```javascript
// Processus de validation complet
async function validateApiKey(key) {
    // 1. Gestion spéciale clé développement
    if (key === 'dev-key' && process.env.NODE_ENV !== 'production') {
        return { valid: true, environment: 'development' };
    }
    
    // 2. Recherche en base de données
    const keyInfo = await db.get(`
        SELECT k.*, a.name as application_name
        FROM api_keys k
        LEFT JOIN applications a ON k.application_id = a.id
        WHERE k.key = ? AND k.is_active = 1
    `, [key]);
    
    // 3. Vérifications de sécurité
    if (!keyInfo) return { valid: false, reason: 'key_not_found' };
    if (keyInfo.expires_at && new Date() > new Date(keyInfo.expires_at)) {
        return { valid: false, reason: 'key_expired' };
    }
    
    // 4. Vérification des restrictions d'origine
    if (keyInfo.origin_restrictions) {
        const origin = req.headers.origin || req.headers.referer;
        const allowedOrigins = keyInfo.origin_restrictions.split(',');
        if (!allowedOrigins.some(allowed => origin?.includes(allowed))) {
            return { valid: false, reason: 'origin_not_allowed' };
        }
    }
    
    return { valid: true, keyInfo };
}
```

## 🛡️ Niveaux de sécurité implémentés

### Rate limiting par clé API
```javascript
// Configuration actuelle dans middleware/rateLimiter.js
const conversionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,  // 1 minute
    max: 30,                  // 30 conversions max par minute
    keyGenerator: (req) => {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
        return apiKey ? `conversion_${req.ip}_${apiKey}` : `conversion_${req.ip}`;
    }
});

// Limiteurs spécialisés
- Global: 1000 req/15min par IP
- Conversion: 30 req/min par IP+clé
- Authentification: 10 tentatives/15min par IP
- IA: 10 req/min par IP
```

### Permissions et scopes

#### Système basé sur les applications
```javascript
// Chaque clé API est liée à une application avec permissions
{
    application_id: 1,
    application_name: "Application médicale Dr. Martin",
    permissions: {
        'convert:hl7': true,      // Conversion HL7→FHIR
        'read:fhir': true,        // Lecture ressources FHIR
        'write:fhir': false,      // Écriture ressources FHIR
        'admin:users': false,     // Gestion utilisateurs
        'analytics:view': true    // Accès métriques
    }
}
```

#### Niveaux d'accès par environnement
- **Development** : Accès complet avec clé 'dev-key'
- **Production** : Validation stricte avec permissions granulaires
- **Testing** : Sandbox isolé avec limitations

## 🔄 Cycle de vie des clés API

### 1. Création
```javascript
// Processus de création via interface admin
async function createApiKey(applicationId, description, options = {}) {
    const key = generateAPIKey();
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    
    await db.run(`
        INSERT INTO api_keys (
            application_id, key, hashed_key, description, 
            environment, expires_at, origin_restrictions
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        applicationId, key, hashedKey, description,
        options.environment || 'production',
        options.expiresAt,
        options.originRestrictions
    ]);
    
    // Retourner la clé une seule fois pour sécurité
    return { key, message: "Clé créée - copiez-la maintenant, elle ne sera plus affichée" };
}
```

### 2. Utilisation
```http
# Header principal (recommandé)
GET /api/fhir/Patient/123
x-api-key: your-api-key-here
Content-Type: application/json

# Alternative query parameter (moins sécurisé)
GET /api/fhir/Patient/123?apiKey=your-api-key-here

# Alternative body parameter (POST uniquement)
POST /api/convert
Content-Type: application/json
{
    "apiKey": "your-api-key-here",
    "hl7Message": "MSH|^~\\&|..."
}
```

### 3. Monitoring et audit
```javascript
// Logging automatique de chaque utilisation
{
    timestamp: "2025-06-18T11:39:00Z",
    api_key_id: 123,
    application_name: "App médicale",
    endpoint: "/api/convert",
    method: "POST",
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0...",
    response_code: 200,
    processing_time: 250,
    data_size: 15000
}
```

### 4. Révocation et expiration
```javascript
// Révocation immédiate
async function revokeApiKey(keyId, reason) {
    await db.run(`
        UPDATE api_keys 
        SET is_active = 0, revoked_at = CURRENT_TIMESTAMP, revocation_reason = ?
        WHERE id = ?
    `, [reason, keyId]);
    
    // Audit trail
    await logSecurityEvent('api_key_revoked', { keyId, reason });
}

// Expiration automatique
setInterval(() => {
    db.run(`
        UPDATE api_keys 
        SET is_active = 0 
        WHERE expires_at < CURRENT_TIMESTAMP AND is_active = 1
    `);
}, 60000); // Vérification chaque minute
```

## 🚨 Bonnes pratiques de sécurité

### Côté développeur/intégrateur

#### ✅ Pratiques recommandées
```bash
# Variables d'environnement (jamais en dur dans le code)
export FHIRHUB_API_KEY="your-secure-key-here"
export FHIRHUB_BASE_URL="https://fhirhub.hopital.fr"

# Utilisation sécurisée
curl -H "x-api-key: $FHIRHUB_API_KEY" \
     -H "Content-Type: application/json" \
     "$FHIRHUB_BASE_URL/api/fhir/Patient"
```

```javascript
// Implémentation avec retry et backoff
const fhirClient = {
    apiKey: process.env.FHIRHUB_API_KEY,
    baseUrl: process.env.FHIRHUB_BASE_URL,
    
    async request(endpoint, options = {}) {
        const headers = {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // Retry avec backoff exponentiel
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}${endpoint}`, {
                    ...options,
                    headers
                });
                
                if (response.status === 429) {
                    // Rate limit - attendre avant retry
                    const retryAfter = response.headers.get('Retry-After') || (2 ** attempt);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    continue;
                }
                
                return response;
            } catch (error) {
                if (attempt === 2) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** attempt)));
            }
        }
    }
};
```

#### ❌ Pratiques à éviter
```javascript
// JAMAIS : clé en dur dans le code
const API_KEY = "dev-key"; // ❌ Risque de fuite

// JAMAIS : logs de clés API
console.log("Using API key:", apiKey); // ❌ Exposition en logs

// JAMAIS : transmission non sécurisée
fetch("http://unsecure-site.com/api", {  // ❌ HTTP au lieu de HTTPS
    headers: { "x-api-key": apiKey }
});

// JAMAIS : stockage côté client
localStorage.setItem('apiKey', key); // ❌ Accessible via JavaScript
```

### Côté administrateur système

#### Configuration sécurisée
```bash
# Variables d'environnement production
NODE_ENV=production
BYPASS_AUTH=false                    # Désactiver le bypass auth
JWT_SECRET=your-256-bit-secret-here  # Secret JWT complexe
API_RATE_LIMIT=500                   # Rate limiting production
ALLOWED_ORIGINS=https://app1.com,https://app2.fr  # CORS strict
```

#### Audit et monitoring
```javascript
// Dashboard de monitoring recommandé
const securityMetrics = {
    // Alertes automatiques
    failedAuthAttempts: {
        threshold: 10,
        window: "5 minutes",
        action: "block_ip_temporary"
    },
    
    // Métriques de sécurité
    apiKeyUsage: {
        track: ["usage_count", "last_used", "failed_attempts"],
        alerts: ["unusual_volume", "geographic_anomaly"]
    },
    
    // Audit trail
    securityEvents: [
        "api_key_created", "api_key_revoked", "auth_failed",
        "rate_limit_exceeded", "suspicious_activity"
    ]
};
```

## 📊 Monitoring et alertes de sécurité

### Métriques critiques surveillées
```javascript
// Tableau de bord sécurité temps réel
const securityDashboard = {
    authentication: {
        failed_attempts: 0,
        successful_logins: 0,
        blocked_ips: [],
        suspicious_patterns: []
    },
    
    api_usage: {
        total_requests: 0,
        rate_limited_requests: 0,
        invalid_keys: 0,
        top_consumers: []
    },
    
    system_health: {
        response_times: [],
        error_rates: {},
        security_score: 9.2
    }
};
```

### Système d'alertes automatiques
```javascript
// Configuration des alertes de sécurité
const securityAlerts = {
    critical: {
        multiple_failed_auth: {
            condition: "failed_attempts > 5 in 5 minutes",
            action: "notify_admin + temporary_ip_block"
        },
        
        unusual_api_usage: {
            condition: "requests > 1000% normal_volume",
            action: "notify_security_team + rate_limit_reduce"
        }
    },
    
    warning: {
        expired_keys_in_use: {
            condition: "attempts_with_expired_keys > 0",
            action: "notify_key_owner + usage_report"
        },
        
        geographic_anomaly: {
            condition: "requests_from > 3 countries simultaneously",
            action: "flag_for_review + enhanced_monitoring"
        }
    }
};
```

## 🔧 Améliorations de sécurité recommandées

### Court terme (1-2 semaines)
1. **Hachage des clés** : Implémenter le stockage hashé des clés API
2. **Rotation automatique** : Système de rotation des clés avec période de grâce
3. **Audit détaillé** : Logs enrichis avec géolocalisation et empreinte digitale
4. **Interface admin** : Dashboard de gestion des clés avec alertes temps réel

### Moyen terme (1-2 mois)
1. **Scopes granulaires** : Permissions détaillées par type de ressource FHIR
2. **Rate limiting adaptatif** : Ajustement automatique selon le comportement
3. **Détection d'anomalies** : Machine learning pour identifier les usages suspects
4. **Intégration SIEM** : Export vers systèmes de monitoring de sécurité

### Long terme (3-6 mois)
1. **Zero-trust architecture** : Vérification continue de chaque requête
2. **API Gateway** : Proxy sécurisé avec fonctionnalités avancées
3. **Chiffrement bout-en-bout** : Protection des données en transit et au repos
4. **Conformité réglementaire** : Respect RGPD, HDS, ISO 27001

## 📋 Checklist de sécurité API Keys

### Configuration initiale
- [ ] Variables d'environnement sécurisées configurées
- [ ] Rate limiting activé et testé
- [ ] CORS configuré avec liste blanche stricte
- [ ] HTTPS forcé sur tous les endpoints
- [ ] Logs de sécurité activés et centralisés

### Gestion des clés
- [ ] Processus de création documenté et sécurisé
- [ ] Politique d'expiration définie et appliquée
- [ ] Procédure de révocation testée
- [ ] Audit trail complet en place
- [ ] Documentation utilisateur à jour

### Monitoring continu
- [ ] Dashboard de sécurité opérationnel
- [ ] Alertes automatiques configurées
- [ ] Rapports de sécurité hebdomadaires
- [ ] Tests de pénétration réguliers
- [ ] Formation équipe sur bonnes pratiques

Le système de clés API de FHIRHub fournit une base solide pour l'authentification sécurisée, avec des opportunités d'amélioration continue pour atteindre un niveau de sécurité enterprise.