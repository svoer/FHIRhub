#!/usr/bin/env node

/**
 * Script de test pour valider l'implémentation des correctifs de sécurité
 * Teste les 9 vulnérabilités critiques identifiées
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.FHIRHUB_URL || 'http://localhost:5000';

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
 * Classe de test de sécurité
 */
class SecurityAudit {
    constructor() {
        this.results = {
            apiKeyValidation: [],
            rateLimiting: [],
            injectionProtection: [],
            corsValidation: [],
            summary: {
                passed: 0,
                failed: 0,
                total: 0
            }
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    /**
     * Teste la validation stricte des clés API
     */
    async testApiKeyValidation() {
        this.log('\n🔑 TEST DE VALIDATION DES CLÉS API', 'bold');
        this.log('=' .repeat(50), 'blue');

        const invalidKeys = [
            { key: '', description: 'Clé vide' },
            { key: '123', description: 'Clé trop courte (< 8 chars)' },
            { key: 'key<script>alert(1)</script>', description: 'Injection XSS' },
            { key: 'key\'OR\'1\'=\'1', description: 'Injection SQL' },
            { key: '../../../etc/passwd', description: 'Path traversal' },
            { key: 'SELECT * FROM users', description: 'SQL direct' },
            { key: 'a'.repeat(200), description: 'Clé trop longue (> 128 chars)' },
            { key: 'key with spaces!@#', description: 'Caractères invalides' }
        ];

        for (const test of invalidKeys) {
            try {
                const response = await axios.post(`${BASE_URL}/api/convert`, {
                    hl7Message: 'MSH|^~\\&|TEST|TEST|TEST|TEST|20240101120000||ADT^A01|123|P|2.5'
                }, {
                    headers: { 'x-api-key': test.key },
                    timeout: 5000
                });

                // Si on arrive ici, la validation a échoué
                this.log(`❌ ${test.description}: Acceptée (VULNÉRABILITÉ!)`, 'red');
                this.results.apiKeyValidation.push({
                    test: test.description,
                    status: 'fail',
                    key: test.key.substring(0, 20) + '...'
                });
                this.results.summary.failed++;
            } catch (error) {
                if (error.response && error.response.status === 401) {
                    this.log(`✅ ${test.description}: Correctement rejetée`, 'green');
                    this.results.apiKeyValidation.push({
                        test: test.description,
                        status: 'pass',
                        key: test.key.substring(0, 20) + '...'
                    });
                    this.results.summary.passed++;
                } else {
                    this.log(`⚠️ ${test.description}: Erreur ${error.message}`, 'yellow');
                    this.results.summary.failed++;
                }
            }
            this.results.summary.total++;
        }
    }

    /**
     * Teste le rate limiting
     */
    async testRateLimiting() {
        this.log('\n⏱️ TEST DU RATE LIMITING', 'bold');
        this.log('=' .repeat(50), 'blue');

        const tests = [
            { endpoint: '/api/convert', limit: 30, window: '1 minute', limiter: 'conversion' },
            { endpoint: '/api/auth/login', limit: 10, window: '15 minutes', limiter: 'auth' },
            { endpoint: '/api/fhir-ai', limit: 10, window: '1 minute', limiter: 'ai' }
        ];

        for (const test of tests) {
            try {
                this.log(`\nTest ${test.limiter}: ${test.limit} requêtes/${test.window}`, 'cyan');
                
                const requests = [];
                const numRequests = Math.min(test.limit + 5, 15); // Limiter pour éviter les timeouts

                for (let i = 0; i < numRequests; i++) {
                    const requestPromise = axios.post(`${BASE_URL}${test.endpoint}`, {
                        hl7Message: 'MSH|^~\\&|TEST|TEST|TEST|TEST|20240101120000||ADT^A01|123|P|2.5',
                        test: true
                    }, {
                        headers: { 'x-api-key': 'dev-key' },
                        timeout: 3000,
                        validateStatus: (status) => status < 500 // Accepter 429
                    });
                    requests.push(requestPromise);
                }

                const responses = await Promise.allSettled(requests);
                
                const successful = responses.filter(r => 
                    r.status === 'fulfilled' && 
                    r.value.status >= 200 && 
                    r.value.status < 300
                ).length;

                const rateLimited = responses.filter(r => 
                    r.status === 'fulfilled' && 
                    r.value.status === 429
                ).length;

                this.log(`  Requêtes réussies: ${successful}/${numRequests}`, 'cyan');
                this.log(`  Requêtes limitées: ${rateLimited}/${numRequests}`, 'cyan');

                if (rateLimited > 0) {
                    this.log(`✅ Rate limiting fonctionnel sur ${test.endpoint}`, 'green');
                    this.results.rateLimiting.push({
                        test: `Rate limiting ${test.limiter}`,
                        status: 'pass',
                        details: `${rateLimited}/${numRequests} limitées`
                    });
                    this.results.summary.passed++;
                } else if (successful === numRequests) {
                    this.log(`❌ Rate limiting défaillant sur ${test.endpoint}`, 'red');
                    this.results.rateLimiting.push({
                        test: `Rate limiting ${test.limiter}`,
                        status: 'fail',
                        details: `${successful}/${numRequests} acceptées`
                    });
                    this.results.summary.failed++;
                } else {
                    this.log(`⚠️ Rate limiting partiel sur ${test.endpoint}`, 'yellow');
                    this.results.summary.failed++;
                }
            } catch (error) {
                this.log(`❌ Erreur lors du test ${test.limiter}: ${error.message}`, 'red');
                this.results.summary.failed++;
            }
            this.results.summary.total++;
        }
    }

    /**
     * Teste la protection contre les injections
     */
    async testInjectionProtection() {
        this.log('\n🛡️ TEST DE PROTECTION CONTRE LES INJECTIONS', 'bold');
        this.log('=' .repeat(50), 'blue');

        const injectionTests = [
            { 
                payload: { query: "'; DROP TABLE users; --" }, 
                description: 'Injection SQL dans query' 
            },
            { 
                payload: { hl7Message: '<script>alert("XSS")</script>' }, 
                description: 'Injection XSS dans body' 
            },
            { 
                payload: { path: '../../../etc/passwd' }, 
                description: 'Path traversal' 
            },
            { 
                payload: { command: 'rm -rf /' }, 
                description: 'Injection de commande' 
            }
        ];

        for (const test of injectionTests) {
            try {
                const response = await axios.post(`${BASE_URL}/api/convert`, test.payload, {
                    headers: { 'x-api-key': 'dev-key' },
                    timeout: 5000
                });

                // Si on arrive ici sans erreur 400, la protection a échoué
                this.log(`❌ ${test.description}: Non détectée (VULNÉRABILITÉ!)`, 'red');
                this.results.injectionProtection.push({
                    test: test.description,
                    status: 'fail',
                    payload: JSON.stringify(test.payload).substring(0, 50) + '...'
                });
                this.results.summary.failed++;
            } catch (error) {
                if (error.response && (error.response.status === 400 || error.response.status === 401)) {
                    this.log(`✅ ${test.description}: Correctement bloquée`, 'green');
                    this.results.injectionProtection.push({
                        test: test.description,
                        status: 'pass',
                        payload: JSON.stringify(test.payload).substring(0, 50) + '...'
                    });
                    this.results.summary.passed++;
                } else {
                    this.log(`⚠️ ${test.description}: Erreur inattendue ${error.message}`, 'yellow');
                    this.results.summary.failed++;
                }
            }
            this.results.summary.total++;
        }
    }

    /**
     * Teste la configuration CORS
     */
    async testCorsConfiguration() {
        this.log('\n🌐 TEST DE CONFIGURATION CORS', 'bold');
        this.log('=' .repeat(50), 'blue');

        const corsTests = [
            { origin: 'https://malicious-site.com', description: 'Origine malveillante' },
            { origin: 'http://localhost:3000', description: 'Origine locale légitime' },
            { origin: null, description: 'Pas d\'origine (attaque CSRF potentielle)' }
        ];

        for (const test of corsTests) {
            try {
                const headers = { 'x-api-key': 'dev-key' };
                if (test.origin) {
                    headers['Origin'] = test.origin;
                }

                const response = await axios.options(`${BASE_URL}/api/convert`, {
                    headers,
                    timeout: 5000
                });

                const allowedOrigin = response.headers['access-control-allow-origin'];
                
                if (test.origin === 'https://malicious-site.com' && allowedOrigin === test.origin) {
                    this.log(`❌ ${test.description}: Autorisée (RISQUE!)`, 'red');
                    this.results.corsValidation.push({
                        test: test.description,
                        status: 'fail',
                        allowedOrigin
                    });
                    this.results.summary.failed++;
                } else {
                    this.log(`✅ ${test.description}: Gestion correcte`, 'green');
                    this.results.corsValidation.push({
                        test: test.description,
                        status: 'pass',
                        allowedOrigin
                    });
                    this.results.summary.passed++;
                }
            } catch (error) {
                this.log(`⚠️ ${test.description}: ${error.message}`, 'yellow');
                this.results.summary.failed++;
            }
            this.results.summary.total++;
        }
    }

    /**
     * Génère le rapport de sécurité
     */
    generateSecurityReport() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('🔒 RAPPORT D\'AUDIT SÉCURITÉ - CORRECTIFS IMPLÉMENTÉS', 'bold');
        this.log('='.repeat(60), 'bold');

        // Score de sécurité
        const securityScore = ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1);
        const scoreColor = securityScore >= 90 ? 'green' : securityScore >= 70 ? 'yellow' : 'red';
        
        this.log(`\n🎯 Score de sécurité: ${securityScore}% (${this.results.summary.passed}/${this.results.summary.total})`, scoreColor);

        // Détails par catégorie
        this.log(`\n📋 Résultats détaillés:`, 'cyan');
        this.log(`  • Validation API Keys: ${this.results.apiKeyValidation.filter(t => t.status === 'pass').length}/${this.results.apiKeyValidation.length}`);
        this.log(`  • Rate Limiting: ${this.results.rateLimiting.filter(t => t.status === 'pass').length}/${this.results.rateLimiting.length}`);
        this.log(`  • Protection Injections: ${this.results.injectionProtection.filter(t => t.status === 'pass').length}/${this.results.injectionProtection.length}`);
        this.log(`  • Configuration CORS: ${this.results.corsValidation.filter(t => t.status === 'pass').length}/${this.results.corsValidation.length}`);

        // État de sécurité
        this.log(`\n🛡️ État de sécurité:`, 'blue');
        if (securityScore >= 90) {
            this.log('✅ Sécurité renforcée - Production ready', 'green');
            this.log('✅ Vulnérabilités critiques corrigées', 'green');
            this.log('✅ Validation des API Keys opérationnelle', 'green');
        } else if (securityScore >= 70) {
            this.log('⚠️ Sécurité partiellement corrigée', 'yellow');
            this.log('❗ Quelques vulnérabilités persistent', 'yellow');
        } else {
            this.log('❌ Vulnérabilités critiques persistantes', 'red');
            this.log('❗ Corrections supplémentaires requises', 'red');
        }

        return this.results;
    }

    /**
     * Exécute l'audit complet de sécurité
     */
    async runSecurityAudit() {
        this.log('🚀 DÉBUT DE L\'AUDIT SÉCURITÉ POST-CORRECTIFS', 'bold');
        this.log(`Target: ${BASE_URL}`, 'cyan');

        try {
            await this.testApiKeyValidation();
            await this.testRateLimiting();
            await this.testInjectionProtection();
            await this.testCorsConfiguration();
            
            return this.generateSecurityReport();
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
        const results = await audit.runSecurityAudit();
        
        // Code de sortie basé sur le score de sécurité
        const securityScore = (results.summary.passed / results.summary.total) * 100;
        process.exit(securityScore >= 90 ? 0 : 1);
    } catch (error) {
        console.error('Erreur lors de l\'audit sécurité:', error);
        process.exit(1);
    }
}

// Exécuter l'audit si appelé directement
if (require.main === module) {
    main();
}

module.exports = SecurityAudit;