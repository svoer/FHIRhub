# 🌐 CONFIGURATION CORS - FHIRHUB

## 🎯 Qu'est-ce que CORS ?

### Définition technique
**Cross-Origin Resource Sharing (CORS)** est un mécanisme de sécurité web standardisé (RFC 6454) qui contrôle les requêtes HTTP entre domaines différents. Il permet aux serveurs de spécifier quels domaines, méthodes et headers sont autorisés lors d'accès cross-origin.

### Architecture CORS dans FHIRHub
FHIRHub implémente une configuration CORS flexible qui s'adapte automatiquement à l'environnement de déploiement, permettant un développement local simplifié tout en maintenant une sécurité stricte en production.

```javascript
// Configuration actuelle dans app.js
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? validateCorsOrigin : true,
    credentials: true,
    optionsSuccessStatus: 200
}));
```

## 🛡️ Mécanisme de sécurité CORS

### Same-Origin Policy - Le problème résolu
Sans CORS, la **Same-Origin Policy** du navigateur bloque toutes les requêtes entre domaines différents :

```javascript
// Même origine (autorisé)
https://fhirhub.hopital.fr/api/fhir ← depuis https://fhirhub.hopital.fr/app

// Origines différentes (bloqué sans CORS)
https://fhirhub.hopital.fr/api/fhir ← depuis https://app-externe.com
https://fhirhub.hopital.fr/api/fhir ← depuis http://localhost:3000
https://fhirhub.hopital.fr/api/fhir ← depuis https://autre-sous-domaine.hopital.fr
```

### Requêtes preflight - Validation préventive
Pour les requêtes complexes, le navigateur envoie automatiquement une requête preflight :

```http
# Requête preflight automatique du navigateur
OPTIONS /api/fhir/Patient HTTP/1.1
Host: fhirhub.hopital.fr
Origin: https://dossier-patient.hopital.fr
Access-Control-Request-Method: POST
Access-Control-Request-Headers: x-api-key, Content-Type

# Réponse du serveur FHIRHub (si autorisé)
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://dossier-patient.hopital.fr
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: x-api-key, Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
Vary: Origin
```

### Déclenchement des requêtes preflight
```javascript
// Requêtes simples (pas de preflight)
- Méthodes: GET, HEAD, POST
- Content-Type: application/x-www-form-urlencoded, multipart/form-data, text/plain
- Headers standard uniquement

// Requêtes complexes (preflight requis)
- Méthodes: PUT, DELETE, PATCH
- Content-Type: application/json, application/fhir+json
- Headers personnalisés: x-api-key, Authorization
- Credentials inclus
```

## ⚙️ Configuration CORS dans FHIRHub

### Configuration actuelle par environnement

#### Mode développement
```javascript
// Development - Accès libre pour simplifier le dev
if (process.env.NODE_ENV !== 'production') {
    app.use(cors({
        origin: true,           // Autorise toutes les origines
        credentials: true,      // Autorise cookies/auth
        optionsSuccessStatus: 200
    }));
}
```

#### Mode production
```javascript
// Production - Validation stricte
function validateCorsOrigin(origin, callback) {
    // Liste blanche des domaines autorisés
    const allowedOrigins = [
        'https://fhirhub.hopital.fr',
        'https://dossier-patient.hopital.fr', 
        'https://app-mobile.hopital.fr',
        'https://tableau-bord.hopital.fr'
    ];
    
    // Variables d'environnement pour configuration externe
    if (process.env.ALLOWED_ORIGINS) {
        const envOrigins = process.env.ALLOWED_ORIGINS.split(',');
        allowedOrigins.push(...envOrigins);
    }
    
    // Autoriser les requêtes sans origine (ex: Postman, curl)
    if (!origin) return callback(null, true);
    
    // Vérifier si l'origine est autorisée
    if (allowedOrigins.includes(origin)) {
        callback(null, true);
    } else {
        console.warn(`[CORS] Origine non autorisée tentant l'accès: ${origin}`);
        callback(new Error('Non autorisé par la politique CORS'), false);
    }
}
```

### Configuration avancée par route

```javascript
// Configuration CORS granulaire (recommandée pour l'avenir)
const corsConfig = {
    // API publique - Moins restrictif
    public: {
        origin: ['https://app1.com', 'https://app2.fr'],
        credentials: false,
        methods: ['GET'],
        allowedHeaders: ['Content-Type'],
        maxAge: 86400
    },
    
    // API FHIR - Très restrictif
    fhir: {
        origin: ['https://secure-app.hopital.fr'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
        maxAge: 3600  // Cache plus court pour sécurité
    },
    
    // API Admin - Ultra restrictif
    admin: {
        origin: ['https://admin.hopital.fr'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 300   // Cache très court
    }
};

// Application par route
app.use('/api/public', cors(corsConfig.public));
app.use('/api/fhir', cors(corsConfig.fhir));
app.use('/api/admin', cors(corsConfig.admin));
```

### Headers CORS détaillés

```javascript
// Headers CORS complets générés par FHIRHub
const corsHeaders = {
    // Origine autorisée (jamais '*' avec credentials: true)
    'Access-Control-Allow-Origin': 'https://app-autorisee.fr',
    
    // Méthodes HTTP autorisées
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    
    // Headers autorisés dans les requêtes
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, X-Requested-With',
    
    // Headers exposés aux scripts côté client
    'Access-Control-Expose-Headers': 'X-Total-Count, X-Rate-Limit-Remaining',
    
    // Autorisation des credentials (cookies, auth headers)
    'Access-Control-Allow-Credentials': 'true',
    
    // Durée de cache des requêtes preflight
    'Access-Control-Max-Age': '86400',
    
    // Header Vary pour cache correct
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
};
```

## 🎯 Avantages de CORS bien configuré

### Sécurité renforcée

```javascript
// Protection contre les attaques cross-origin
const securityBenefits = {
    csrf_protection: {
        description: "Empêche les requêtes malveillantes depuis des sites tiers",
        implementation: "Validation stricte de l'origine + credentials"
    },
    
    data_leakage_prevention: {
        description: "Contrôle précis des domaines autorisés à accéder aux données",
        implementation: "Liste blanche explicite des origines"
    },
    
    api_abuse_prevention: {
        description: "Limite l'utilisation de l'API aux applications autorisées",
        implementation: "Combinaison CORS + API Keys + Rate Limiting"
    }
};
```

### Flexibilité d'intégration

```javascript
// Cas d'usage supportés
const integrationScenarios = {
    spa_applications: {
        description: "Applications single-page (React, Vue, Angular)",
        cors_config: {
            origin: "https://spa.hopital.fr",
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE']
        }
    },
    
    mobile_apps: {
        description: "Applications mobiles via WebView",
        cors_config: {
            origin: "https://mobile-app.hopital.fr",
            credentials: true,
            methods: ['GET', 'POST']
        }
    },
    
    third_party_integrations: {
        description: "Intégrations tierces autorisées",
        cors_config: {
            origin: "https://partenaire-medical.com",
            credentials: false,  // Plus sécurisé pour les tiers
            methods: ['GET', 'POST']
        }
    },
    
    development_tools: {
        description: "Outils de développement local",
        cors_config: {
            origin: ["http://localhost:3000", "http://localhost:8080"],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE']
        }
    }
};
```

### Performance optimisée

```javascript
// Optimisations de performance CORS
const performanceOptimizations = {
    preflight_caching: {
        header: "Access-Control-Max-Age: 86400",
        benefit: "Cache les réponses preflight pendant 24h",
        impact: "Réduction de 50% des requêtes OPTIONS"
    },
    
    efficient_headers: {
        implementation: "Headers minimal mais complet",
        benefit: "Réduction de la taille des réponses",
        impact: "Économie de bande passante"
    },
    
    conditional_cors: {
        implementation: "CORS appliqué seulement si nécessaire",
        benefit: "Pas de surcharge pour les requêtes same-origin",
        impact: "Performances maximales pour l'usage principal"
    }
};
```

## 🚨 Bonnes pratiques CORS

### Configuration sécurisée

#### ✅ Pratiques recommandées
```javascript
// Configuration de production sécurisée
const secureCorsConfig = {
    // Liste blanche explicite - JAMAIS de wildcard
    origin: [
        'https://app-principal.hopital.fr',
        'https://app-mobile.hopital.fr',
        'https://dashboard.hopital.fr'
    ],
    
    // Credentials seulement si nécessaire
    credentials: true,
    
    // Méthodes strictement nécessaires
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    
    // Headers minimaux requis
    allowedHeaders: [
        'Content-Type',
        'Authorization', 
        'x-api-key',
        'X-Requested-With'
    ],
    
    // Headers exposés utiles
    exposedHeaders: [
        'X-Total-Count',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
    ],
    
    // Cache approprié pour l'environnement
    maxAge: process.env.NODE_ENV === 'production' ? 86400 : 300,
    
    // Headers Vary pour cache correct
    preflightContinue: false,
    optionsSuccessStatus: 200
};
```

#### ❌ Pratiques dangereuses à éviter
```javascript
// CONFIGURATIONS DANGEREUSES - NE JAMAIS FAIRE

// 1. Wildcard avec credentials (IMPOSSIBLE techniquement)
app.use(cors({
    origin: '*',              // ❌ Interdit avec credentials
    credentials: true         // ❌ Combinaison impossible
}));

// 2. Validation d'origine trop permissive
function badOriginCheck(origin, callback) {
    if (origin.includes('.hopital.')) {  // ❌ Trop large
        callback(null, true);
    }
    // Permet: https://malicious.hopital.attacker.com
}

// 3. Méthodes trop permissives
app.use(cors({
    methods: '*'              // ❌ Autorise TRACE, CONNECT, etc.
}));

// 4. Headers non contrôlés
app.use(cors({
    allowedHeaders: '*'       // ❌ Accepte n'importe quel header
}));

// 5. Cache preflight trop long
app.use(cors({
    maxAge: 31536000         // ❌ 1 an - trop long pour la sécurité
}));
```

### Validation et tests

```javascript
// Tests de sécurité CORS automatisés
const corsSecurityTests = {
    origin_validation: {
        test: "Tentative d'accès depuis origine non autorisée",
        expect: "Erreur CORS",
        command: `curl -H "Origin: https://attacker.com" ${API_URL}/api/fhir/Patient`
    },
    
    method_validation: {
        test: "Tentative de méthode non autorisée",
        expect: "Erreur 405 Method Not Allowed",
        command: `curl -X TRACE ${API_URL}/api/fhir/Patient`
    },
    
    header_validation: {
        test: "Tentative header malveillant",
        expect: "Header rejeté",
        command: `curl -H "X-Malicious-Header: attack" ${API_URL}/api/fhir/Patient`
    },
    
    credentials_validation: {
        test: "Vérification gestion credentials",
        expect: "Access-Control-Allow-Credentials: true",
        command: `curl -H "Origin: https://app.hopital.fr" ${API_URL}/api/fhir/Patient`
    }
};
```

## 🔍 Débogage et diagnostic CORS

### Erreurs CORS courantes et solutions

```javascript
// Guide de résolution des erreurs CORS
const corsErrorGuide = {
    "Access to fetch has been blocked by CORS policy": {
        cause: "Origine non autorisée dans la configuration serveur",
        solution: "Ajouter le domaine à la liste blanche CORS",
        debug: "Vérifier req.headers.origin dans les logs serveur"
    },
    
    "CORS preflight request failed": {
        cause: "Requête OPTIONS échoue ou headers manquants",
        solution: "Vérifier que le serveur répond aux requêtes OPTIONS",
        debug: "Inspecter la réponse de la requête OPTIONS dans Network tab"
    },
    
    "Credential is not supported if the CORS header 'Access-Control-Allow-Origin' is '*'": {
        cause: "Tentative d'utiliser credentials avec origin wildcard",
        solution: "Spécifier une origine exacte au lieu de '*'",
        debug: "Remplacer origin: '*' par origin: 'https://domain.com'"
    },
    
    "Request header field x-api-key is not allowed by Access-Control-Allow-Headers": {
        cause: "Header personnalisé non autorisé",
        solution: "Ajouter 'x-api-key' à allowedHeaders",
        debug: "Vérifier la configuration allowedHeaders côté serveur"
    }
};
```

### Outils de diagnostic

```javascript
// Console de débogage CORS intégrée
function debugCorsRequest(req, res, next) {
    const origin = req.headers.origin;
    const method = req.method;
    
    console.log(`[CORS-DEBUG] ${method} request from origin: ${origin || 'same-origin'}`);
    console.log(`[CORS-DEBUG] User-Agent: ${req.headers['user-agent']}`);
    console.log(`[CORS-DEBUG] Headers: ${JSON.stringify(req.headers, null, 2)}`);
    
    // Middleware de réponse pour logger les headers CORS
    const originalSend = res.send;
    res.send = function(data) {
        console.log(`[CORS-DEBUG] Response headers: ${JSON.stringify(res.getHeaders(), null, 2)}`);
        originalSend.call(this, data);
    };
    
    next();
}

// Activer le debug en développement
if (process.env.NODE_ENV === 'development') {
    app.use('/api', debugCorsRequest);
}
```

### Headers de diagnostic utiles

```http
# Headers pour faciliter le débogage
Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin

# Headers CORS détaillés
Access-Control-Allow-Origin: https://app.hopital.fr
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, x-api-key
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
Access-Control-Expose-Headers: X-Total-Count, X-Rate-Limit-Remaining
```

## 📊 Monitoring CORS

### Métriques de surveillance

```javascript
// Dashboard monitoring CORS
const corsMetrics = {
    successful_requests: {
        total: 1250000,
        by_origin: {
            'https://app.hopital.fr': 850000,
            'https://mobile.hopital.fr': 300000,
            'https://dashboard.hopital.fr': 100000
        }
    },
    
    blocked_requests: {
        total: 1500,
        by_reason: {
            'origin_not_allowed': 1200,
            'method_not_allowed': 200,
            'header_not_allowed': 100
        },
        top_blocked_origins: [
            'https://suspicious-site.com',
            'http://localhost:3000',  // Dev non configuré
            'https://old-app.hopital.fr'  // App obsolète
        ]
    },
    
    preflight_requests: {
        total: 75000,
        cache_hit_rate: 0.85,  // 85% des preflight sont en cache
        avg_response_time: 45   // ms
    }
};
```

### Alertes de sécurité CORS

```javascript
// Système d'alertes automatiques
const corsSecurityAlerts = {
    high_volume_blocked: {
        condition: "blocked_requests > 100 per hour",
        action: "Investigate potential attack",
        notification: "security_team + ops_team"
    },
    
    new_origin_requests: {
        condition: "requests from previously unseen origin",
        action: "Log for manual review",
        notification: "ops_team"
    },
    
    unusual_preflight_failures: {
        condition: "preflight_failure_rate > 10%",
        action: "Check CORS configuration",
        notification: "dev_team"
    }
};
```

## 🔧 Améliorations CORS recommandées

### Interface d'administration CORS (à implémenter)

```javascript
// Interface admin pour gestion CORS dynamique
const corsAdminInterface = {
    features: [
        'Gestion liste blanche des domaines',
        'Test de configuration en temps réel',
        'Historique des modifications',
        'Import/export de configurations',
        'Monitoring des requêtes bloquées'
    ],
    
    endpoints: [
        'GET /admin/cors/origins',      // Liste des origines
        'POST /admin/cors/origins',     // Ajouter origine
        'DELETE /admin/cors/origins',   // Supprimer origine
        'GET /admin/cors/test',         // Tester configuration
        'GET /admin/cors/metrics'       // Métriques CORS
    ]
};
```

### Configuration avancée par environnement

```bash
# Variables d'environnement pour CORS flexible
CORS_ALLOWED_ORIGINS=https://app1.fr,https://app2.com
CORS_ALLOW_CREDENTIALS=true
CORS_MAX_AGE=86400
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE
CORS_ALLOWED_HEADERS=Content-Type,Authorization,x-api-key
CORS_DEBUG_MODE=false

# Configuration spécifique par environnement
CORS_DEV_ORIGINS=http://localhost:3000,http://localhost:8080
CORS_STAGING_ORIGINS=https://staging-app.hopital.fr
CORS_PROD_ORIGINS=https://app.hopital.fr,https://mobile.hopital.fr
```

La configuration CORS de FHIRHub fournit une base solide pour la sécurité cross-origin, avec des possibilités d'extension pour des besoins enterprise avancés.