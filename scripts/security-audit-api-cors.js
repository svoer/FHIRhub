#!/usr/bin/env node

/**
 * Script d'audit de sécurité pour les API Keys et CORS de FHIRHub
 * Effectue des tests de sécurité automatisés et génère un rapport détaillé
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const BASE_URL = process.env.FHIRHUB_URL || 'http://localhost:5000';
const TEST_ORIGINS = [
    'https://legitimate-app.hopital.fr',
    'https://malicious-site.com',
    'http://localhost:3000',
    null  // Test sans origine
];

// Couleurs pour l'affichage console
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

/**
 * Classe principale pour l'audit de sécurité
 */
class SecurityAudit {
    constructor() {
        this.results = {
            apiKeyTests: [],
            corsTests: [],
            securityScore: 0,
            vulnerabilities: [],
            recommendations: []
        };
    }

    /**
     * Affiche un message coloré
     */
    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    /**
     * Teste la sécurité des clés API
     */
    async auditApiKeys() {
        this.log('\n🔑 AUDIT DES CLÉS API', 'bold');
        this.log('=' .repeat(50), 'blue');

        // Test 1: Validation des clés invalides
        await this.testInvalidApiKeys();
        
        // Test 2: Test de la clé de développement
        await this.testDevKey();
        
        // Test 3: Test du rate limiting
        await this.testRateLimiting();
        
        // Test 4: Test des headers d'authentification
        await this.testAuthHeaders();
    }

    /**
     * Teste la configuration CORS
     */
    async auditCors() {
        this.log('\n🌐 AUDIT CORS', 'bold');
        this.log('=' .repeat(50), 'blue');

        // Test 1: Validation des origines
        await this.testCorsOrigins();
        
        // Test 2: Test des méthodes HTTP
        await this.testCorsMethods();
        
        // Test 3: Test des headers
        await this.testCorsHeaders();
        
        // Test 4: Test des credentials
        await this.testCorsCredentials();
    }

    /**
     * Test des clés API invalides
     */
    async testInvalidApiKeys() {
        this.log('\n📋 Test des clés API invalides...', 'cyan');
        
        const invalidKeys = [
            '',
            'invalid-key',
            'null',
            'undefined',
            '12345',
            'a'.repeat(1000), // Clé trop longue
            '../../../etc/passwd', // Injection de chemin
            '<script>alert("xss")</script>' // XSS
        ];

        for (const key of invalidKeys) {
            try {
                const response = await axios.get(`${BASE_URL}/api/system/health`, {
                    headers: { 'x-api-key': key },
                    timeout: 5000
                });

                if (response.status === 200) {
                    this.results.vulnerabilities.push({
                        severity: 'high',
                        type: 'api_key_validation',
                        description: `Clé API invalide acceptée: "${key}"`
                    });
                    this.log(`❌ VULNÉRABILITÉ: Clé invalide acceptée: ${key}`, 'red');
                } else {
                    this.log(`✅ Clé rejetée correctement: ${key.substring(0, 20)}...`, 'green');
                }
            } catch (error) {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    this.log(`✅ Clé rejetée correctement: ${key.substring(0, 20)}...`, 'green');
                    this.results.apiKeyTests.push({
                        test: 'invalid_key_rejection',
                        key: key.substring(0, 20),
                        status: 'pass'
                    });
                } else {
                    this.log(`⚠️ Erreur inattendue pour clé "${key}": ${error.message}`, 'yellow');
                }
            }
        }
    }

    /**
     * Test de la clé de développement
     */
    async testDevKey() {
        this.log('\n📋 Test de la clé de développement...', 'cyan');
        
        try {
            const response = await axios.get(`${BASE_URL}/api/system/health`, {
                headers: { 'x-api-key': 'dev-key' },
                timeout: 5000
            });

            if (response.status === 200) {
                if (process.env.NODE_ENV === 'production') {
                    this.results.vulnerabilities.push({
                        severity: 'critical',
                        type: 'dev_key_in_production',
                        description: 'Clé de développement active en production'
                    });
                    this.log('❌ CRITIQUE: Clé dev-key active en production!', 'red');
                } else {
                    this.log('✅ Clé dev-key fonctionne en développement', 'green');
                    this.results.apiKeyTests.push({
                        test: 'dev_key_access',
                        status: 'pass'
                    });
                }
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'production') {
                this.log('✅ Clé dev-key correctement désactivée en production', 'green');
            } else {
                this.log('⚠️ Clé dev-key non disponible en développement', 'yellow');
            }
        }
    }

    /**
     * Test du rate limiting
     */
    async testRateLimiting() {
        this.log('\n📋 Test du rate limiting...', 'cyan');
        
        const requests = [];
        const testKey = 'test-rate-limit-key';
        
        // Envoyer 35 requêtes rapidement (limite: 30/minute)
        for (let i = 0; i < 35; i++) {
            requests.push(
                axios.get(`${BASE_URL}/api/system/health`, {
                    headers: { 'x-api-key': testKey },
                    timeout: 1000,
                    validateStatus: () => true // Accepter tous les codes de statut
                })
            );
        }

        try {
            const responses = await Promise.all(requests);
            const rateLimited = responses.filter(r => r.status === 429).length;
            
            if (rateLimited > 0) {
                this.log(`✅ Rate limiting actif: ${rateLimited} requêtes bloquées`, 'green');
                this.results.apiKeyTests.push({
                    test: 'rate_limiting',
                    status: 'pass',
                    blocked_requests: rateLimited
                });
            } else {
                this.results.vulnerabilities.push({
                    severity: 'medium',
                    type: 'rate_limiting_missing',
                    description: 'Rate limiting non actif ou limite trop élevée'
                });
                this.log('❌ Rate limiting non détecté', 'red');
            }
        } catch (error) {
            this.log(`⚠️ Erreur lors du test de rate limiting: ${error.message}`, 'yellow');
        }
    }

    /**
     * Test des headers d'authentification
     */
    async testAuthHeaders() {
        this.log('\n📋 Test des headers d\'authentification...', 'cyan');
        
        const headerTests = [
            { header: 'x-api-key', value: 'dev-key' },
            { header: 'X-API-KEY', value: 'dev-key' }, // Test casse
            { header: 'authorization', value: 'Bearer test-token' },
            { header: 'Authorization', value: 'API-Key dev-key' }
        ];

        for (const test of headerTests) {
            try {
                const response = await axios.get(`${BASE_URL}/api/system/health`, {
                    headers: { [test.header]: test.value },
                    timeout: 5000,
                    validateStatus: () => true
                });

                this.log(`Header ${test.header}: ${response.status}`, 
                    response.status === 200 ? 'green' : 'yellow');
                
                this.results.apiKeyTests.push({
                    test: 'header_recognition',
                    header: test.header,
                    status: response.status === 200 ? 'pass' : 'fail'
                });
            } catch (error) {
                this.log(`❌ Erreur avec header ${test.header}: ${error.message}`, 'red');
            }
        }
    }

    /**
     * Test des origines CORS
     */
    async testCorsOrigins() {
        this.log('\n📋 Test des origines CORS...', 'cyan');
        
        for (const origin of TEST_ORIGINS) {
            try {
                const headers = {};
                if (origin) headers.origin = origin;

                const response = await axios.options(`${BASE_URL}/api/system/health`, {
                    headers,
                    timeout: 5000
                });

                const allowOrigin = response.headers['access-control-allow-origin'];
                const originDisplay = origin || 'sans origine';
                
                if (allowOrigin) {
                    this.log(`✅ CORS autorisé pour: ${originDisplay}`, 'green');
                    this.results.corsTests.push({
                        test: 'origin_allowed',
                        origin: originDisplay,
                        status: 'pass'
                    });
                } else {
                    this.log(`❌ CORS bloqué pour: ${originDisplay}`, 'red');
                    this.results.corsTests.push({
                        test: 'origin_blocked',
                        origin: originDisplay,
                        status: 'pass' // Bloquer est correct pour sécurité
                    });
                }
            } catch (error) {
                this.log(`⚠️ Erreur CORS pour ${origin || 'sans origine'}: ${error.message}`, 'yellow');
            }
        }
    }

    /**
     * Test des méthodes HTTP CORS
     */
    async testCorsMethods() {
        this.log('\n📋 Test des méthodes HTTP CORS...', 'cyan');
        
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'TRACE', 'CONNECT'];
        
        for (const method of methods) {
            try {
                const response = await axios.options(`${BASE_URL}/api/system/health`, {
                    headers: {
                        'origin': 'https://test.com',
                        'access-control-request-method': method
                    },
                    timeout: 5000
                });

                const allowedMethods = response.headers['access-control-allow-methods'];
                const isAllowed = allowedMethods?.includes(method);
                
                if (['TRACE', 'CONNECT'].includes(method) && isAllowed) {
                    this.results.vulnerabilities.push({
                        severity: 'medium',
                        type: 'dangerous_http_method',
                        description: `Méthode HTTP dangereuse autorisée: ${method}`
                    });
                    this.log(`❌ Méthode dangereuse autorisée: ${method}`, 'red');
                } else {
                    this.log(`${isAllowed ? '✅' : '❌'} Méthode ${method}: ${isAllowed ? 'autorisée' : 'bloquée'}`, 
                            isAllowed ? 'green' : 'yellow');
                }

                this.results.corsTests.push({
                    test: 'method_validation',
                    method,
                    allowed: isAllowed,
                    status: ['TRACE', 'CONNECT'].includes(method) ? (isAllowed ? 'fail' : 'pass') : 'pass'
                });
            } catch (error) {
                this.log(`⚠️ Erreur test méthode ${method}: ${error.message}`, 'yellow');
            }
        }
    }

    /**
     * Test des headers CORS
     */
    async testCorsHeaders() {
        this.log('\n📋 Test des headers CORS...', 'cyan');
        
        const testHeaders = [
            'content-type',
            'authorization',
            'x-api-key',
            'x-malicious-header',
            'x-forwarded-for',
            'cookie'
        ];

        for (const header of testHeaders) {
            try {
                const response = await axios.options(`${BASE_URL}/api/system/health`, {
                    headers: {
                        'origin': 'https://test.com',
                        'access-control-request-headers': header
                    },
                    timeout: 5000
                });

                const allowedHeaders = response.headers['access-control-allow-headers'];
                const isAllowed = allowedHeaders?.toLowerCase().includes(header.toLowerCase());
                
                this.log(`${isAllowed ? '✅' : '❌'} Header ${header}: ${isAllowed ? 'autorisé' : 'bloqué'}`, 
                        isAllowed ? 'green' : 'yellow');

                this.results.corsTests.push({
                    test: 'header_validation',
                    header,
                    allowed: isAllowed,
                    status: 'info'
                });
            } catch (error) {
                this.log(`⚠️ Erreur test header ${header}: ${error.message}`, 'yellow');
            }
        }
    }

    /**
     * Test des credentials CORS
     */
    async testCorsCredentials() {
        this.log('\n📋 Test des credentials CORS...', 'cyan');
        
        try {
            const response = await axios.options(`${BASE_URL}/api/system/health`, {
                headers: { 'origin': 'https://test.com' },
                timeout: 5000
            });

            const allowCredentials = response.headers['access-control-allow-credentials'];
            const allowOrigin = response.headers['access-control-allow-origin'];
            
            if (allowCredentials === 'true' && allowOrigin === '*') {
                this.results.vulnerabilities.push({
                    severity: 'high',
                    type: 'cors_wildcard_with_credentials',
                    description: 'CORS configuré avec origin wildcard et credentials activés'
                });
                this.log('❌ VULNÉRABILITÉ: Origin wildcard avec credentials!', 'red');
            } else {
                this.log(`✅ Credentials CORS: ${allowCredentials || 'false'}`, 'green');
                this.log(`✅ Allow-Origin: ${allowOrigin || 'non défini'}`, 'green');
            }

            this.results.corsTests.push({
                test: 'credentials_validation',
                credentials_allowed: allowCredentials === 'true',
                origin_wildcard: allowOrigin === '*',
                status: (allowCredentials === 'true' && allowOrigin === '*') ? 'fail' : 'pass'
            });
        } catch (error) {
            this.log(`⚠️ Erreur test credentials: ${error.message}`, 'yellow');
        }
    }

    /**
     * Calcule le score de sécurité
     */
    calculateSecurityScore() {
        let score = 100;
        
        // Déductions basées sur les vulnérabilités
        this.results.vulnerabilities.forEach(vuln => {
            switch (vuln.severity) {
                case 'critical': score -= 25; break;
                case 'high': score -= 15; break;
                case 'medium': score -= 10; break;
                case 'low': score -= 5; break;
            }
        });

        // Bonus pour les bonnes pratiques
        const passedTests = [
            ...this.results.apiKeyTests.filter(t => t.status === 'pass'),
            ...this.results.corsTests.filter(t => t.status === 'pass')
        ].length;

        if (passedTests > 10) score += 5; // Bonus pour bonne couverture

        this.results.securityScore = Math.max(0, Math.min(100, score));
    }

    /**
     * Génère les recommandations
     */
    generateRecommendations() {
        const recommendations = [];

        // Recommandations basées sur les vulnérabilités
        if (this.results.vulnerabilities.length === 0) {
            recommendations.push('✅ Aucune vulnérabilité critique détectée');
        } else {
            recommendations.push('🔧 Vulnérabilités à corriger:');
            this.results.vulnerabilities.forEach(vuln => {
                recommendations.push(`  - ${vuln.description} (${vuln.severity})`);
            });
        }

        // Recommandations générales
        recommendations.push('\n💡 Améliorations recommandées:');
        recommendations.push('  - Implémenter le hachage des clés API');
        recommendations.push('  - Ajouter un système de rotation automatique des clés');
        recommendations.push('  - Configurer des alertes de sécurité en temps réel');
        recommendations.push('  - Effectuer des audits de sécurité réguliers');
        recommendations.push('  - Documenter et former l\'équipe sur les bonnes pratiques');

        this.results.recommendations = recommendations;
    }

    /**
     * Génère le rapport final
     */
    generateReport() {
        this.calculateSecurityScore();
        this.generateRecommendations();

        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 RAPPORT D\'AUDIT DE SÉCURITÉ FHIRHUB', 'bold');
        this.log('='.repeat(60), 'bold');

        // Score de sécurité
        const scoreColor = this.results.securityScore >= 80 ? 'green' : 
                          this.results.securityScore >= 60 ? 'yellow' : 'red';
        this.log(`\n🎯 Score de sécurité: ${this.results.securityScore}/100`, scoreColor);

        // Résumé des tests
        this.log(`\n📋 Tests effectués:`, 'cyan');
        this.log(`  - Tests API Keys: ${this.results.apiKeyTests.length}`);
        this.log(`  - Tests CORS: ${this.results.corsTests.length}`);
        this.log(`  - Vulnérabilités trouvées: ${this.results.vulnerabilities.length}`);

        // Vulnérabilités
        if (this.results.vulnerabilities.length > 0) {
            this.log(`\n🚨 Vulnérabilités détectées:`, 'red');
            this.results.vulnerabilities.forEach((vuln, index) => {
                this.log(`  ${index + 1}. [${vuln.severity.toUpperCase()}] ${vuln.description}`, 'red');
            });
        }

        // Recommandations
        this.log(`\n💡 Recommandations:`, 'blue');
        this.results.recommendations.forEach(rec => {
            this.log(rec);
        });

        // Informations techniques
        this.log(`\n🔧 Détails techniques:`, 'magenta');
        this.log(`  - URL testée: ${BASE_URL}`);
        this.log(`  - Date d'audit: ${new Date().toISOString()}`);
        this.log(`  - Version Node.js: ${process.version}`);
        this.log(`  - Environnement: ${process.env.NODE_ENV || 'development'}`);

        return this.results;
    }

    /**
     * Exporte le rapport en JSON
     */
    exportReport(filename = `security-audit-${Date.now()}.json`) {
        const fs = require('fs');
        fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
        this.log(`\n💾 Rapport exporté: ${filename}`, 'green');
    }

    /**
     * Exécute l'audit complet
     */
    async runFullAudit() {
        this.log('🔍 AUDIT DE SÉCURITÉ FHIRHUB - DÉMARRAGE', 'bold');
        this.log(`Target: ${BASE_URL}`, 'cyan');
        this.log(`Date: ${new Date().toISOString()}`, 'cyan');

        try {
            await this.auditApiKeys();
            await this.auditCors();
            
            const report = this.generateReport();
            
            // Exporter si option activée
            if (process.argv.includes('--export')) {
                this.exportReport();
            }

            return report;
        } catch (error) {
            this.log(`❌ Erreur fatale durant l'audit: ${error.message}`, 'red');
            throw error;
        }
    }
}

/**
 * Point d'entrée principal
 */
async function main() {
    const audit = new SecurityAudit();
    
    try {
        await audit.runFullAudit();
        process.exit(0);
    } catch (error) {
        console.error('Erreur lors de l\'audit:', error);
        process.exit(1);
    }
}

// Exécuter l'audit si appelé directement
if (require.main === module) {
    main();
}

module.exports = SecurityAudit;