#!/usr/bin/env node

/**
 * Script de test pour la fusion des pages API et la migration Swagger
 * Valide que toutes les redirections fonctionnent et que Swagger est opérationnel
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
 * Classe de test pour la fusion API et Swagger
 */
class SwaggerFusionTest {
    constructor() {
        this.results = {
            redirectionTests: [],
            swaggerTests: [],
            functionalTests: [],
            summary: {
                passed: 0,
                failed: 0,
                total: 0
            }
        };
    }

    /**
     * Affiche un message coloré
     */
    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    /**
     * Teste les redirections des anciennes pages
     */
    async testRedirections() {
        this.log('\n🔄 TEST DES REDIRECTIONS', 'bold');
        this.log('=' .repeat(50), 'blue');

        const redirectionTests = [
            { path: '/api-reference', description: 'Redirection api-reference → api-docs' },
            { path: '/api-reference.html', description: 'Redirection api-reference.html → api-docs' },
            { path: '/api-documentation', description: 'Redirection api-documentation → api-docs' }
        ];

        for (const test of redirectionTests) {
            try {
                const response = await axios.get(`${BASE_URL}${test.path}`, {
                    maxRedirects: 0,
                    validateStatus: (status) => status === 301 || status === 302
                });

                const location = response.headers.location;
                if (location && location.includes('/api-docs')) {
                    this.log(`✅ ${test.description}: OK`, 'green');
                    this.results.redirectionTests.push({
                        test: test.description,
                        status: 'pass',
                        location
                    });
                    this.results.summary.passed++;
                } else {
                    this.log(`❌ ${test.description}: Redirection incorrecte vers ${location}`, 'red');
                    this.results.redirectionTests.push({
                        test: test.description,
                        status: 'fail',
                        location
                    });
                    this.results.summary.failed++;
                }
            } catch (error) {
                this.log(`❌ ${test.description}: Erreur ${error.response?.status || error.message}`, 'red');
                this.results.redirectionTests.push({
                    test: test.description,
                    status: 'fail',
                    error: error.message
                });
                this.results.summary.failed++;
            }
            this.results.summary.total++;
        }
    }

    /**
     * Teste la disponibilité de Swagger
     */
    async testSwaggerAvailability() {
        this.log('\n📚 TEST DE SWAGGER UI', 'bold');
        this.log('=' .repeat(50), 'blue');

        const swaggerTests = [
            { path: '/api-docs', description: 'Interface Swagger UI accessible' },
            { path: '/api-docs.json', description: 'Spécification OpenAPI JSON' },
            { path: '/api-docs.yaml', description: 'Spécification OpenAPI YAML' },
            { path: '/api-docs/postman', description: 'Collection Postman générée' }
        ];

        for (const test of swaggerTests) {
            try {
                const response = await axios.get(`${BASE_URL}${test.path}`, {
                    timeout: 10000
                });

                if (response.status === 200) {
                    // Tests spécifiques selon le type de réponse
                    let validContent = true;
                    let contentDetails = '';

                    if (test.path === '/api-docs.json') {
                        const spec = response.data;
                        validContent = spec.openapi === '3.0.0' && 
                                     spec.info && 
                                     spec.info.title === 'FHIRHub API';
                        contentDetails = `OpenAPI ${spec.openapi}, ${Object.keys(spec.paths || {}).length} endpoints`;
                    } else if (test.path === '/api-docs.yaml') {
                        validContent = response.data.includes('openapi: 3.0.0') && 
                                     response.data.includes('FHIRHub API');
                        contentDetails = 'Format YAML valide';
                    } else if (test.path === '/api-docs/postman') {
                        const collection = response.data;
                        validContent = collection.info && 
                                     collection.info.name === 'FHIRHub API';
                        contentDetails = `Collection avec ${collection.item?.length || 0} requêtes`;
                    } else if (test.path === '/api-docs') {
                        validContent = response.data.includes('swagger-ui') || 
                                     response.data.includes('Swagger UI');
                        contentDetails = 'HTML Swagger UI détecté';
                    }

                    if (validContent) {
                        this.log(`✅ ${test.description}: OK (${contentDetails})`, 'green');
                        this.results.swaggerTests.push({
                            test: test.description,
                            status: 'pass',
                            details: contentDetails
                        });
                        this.results.summary.passed++;
                    } else {
                        this.log(`⚠️ ${test.description}: Contenu invalide`, 'yellow');
                        this.results.swaggerTests.push({
                            test: test.description,
                            status: 'partial',
                            details: 'Contenu non conforme'
                        });
                        this.results.summary.failed++;
                    }
                } else {
                    this.log(`❌ ${test.description}: Status ${response.status}`, 'red');
                    this.results.summary.failed++;
                }
            } catch (error) {
                this.log(`❌ ${test.description}: ${error.message}`, 'red');
                this.results.swaggerTests.push({
                    test: test.description,
                    status: 'fail',
                    error: error.message
                });
                this.results.summary.failed++;
            }
            this.results.summary.total++;
        }
    }

    /**
     * Teste la fonctionnalité des API documentées
     */
    async testApiEndpoints() {
        this.log('\n🔧 TEST DES ENDPOINTS API', 'bold');
        this.log('=' .repeat(50), 'blue');

        const endpointTests = [
            { 
                method: 'GET', 
                path: '/api/system/health', 
                description: 'Health check endpoint',
                expectedStatus: 200
            },
            { 
                method: 'GET', 
                path: '/api/stats', 
                description: 'Statistiques système',
                expectedStatus: 200
            },
            { 
                method: 'POST', 
                path: '/api/convert', 
                description: 'Conversion HL7→FHIR',
                expectedStatus: 200,
                data: {
                    hl7Message: 'MSH|^~\\&|TEST|TEST|TEST|TEST|20240101120000||ADT^A01|123|P|2.5\nPID|1||123^^^TEST^MR||TEST^PATIENT||19800101|M'
                },
                headers: { 'x-api-key': 'dev-key' }
            }
        ];

        for (const test of endpointTests) {
            try {
                const config = {
                    method: test.method,
                    url: `${BASE_URL}${test.path}`,
                    timeout: 15000
                };

                if (test.data) config.data = test.data;
                if (test.headers) config.headers = test.headers;

                const response = await axios(config);

                if (response.status === test.expectedStatus) {
                    let responseDetails = '';
                    
                    if (test.path === '/api/convert' && response.data) {
                        if (response.data.resourceType === 'Bundle') {
                            responseDetails = `Bundle FHIR avec ${response.data.entry?.length || 0} ressources`;
                        } else if (response.data.success) {
                            responseDetails = 'Réponse de conversion valide';
                        }
                    } else if (test.path === '/api/system/health') {
                        responseDetails = `Status: ${response.data.status || 'unknown'}`;
                    } else if (test.path === '/api/stats') {
                        responseDetails = `${response.data.conversions || 0} conversions`;
                    }

                    this.log(`✅ ${test.description}: OK (${responseDetails})`, 'green');
                    this.results.functionalTests.push({
                        test: test.description,
                        status: 'pass',
                        details: responseDetails
                    });
                    this.results.summary.passed++;
                } else {
                    this.log(`❌ ${test.description}: Status ${response.status} (attendu: ${test.expectedStatus})`, 'red');
                    this.results.summary.failed++;
                }
            } catch (error) {
                this.log(`❌ ${test.description}: ${error.response?.status || error.message}`, 'red');
                this.results.functionalTests.push({
                    test: test.description,
                    status: 'fail',
                    error: error.message
                });
                this.results.summary.failed++;
            }
            this.results.summary.total++;
        }
    }

    /**
     * Génère le rapport final
     */
    generateReport() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📊 RAPPORT DE TEST - FUSION API PAGES + SWAGGER', 'bold');
        this.log('='.repeat(60), 'bold');

        // Score global
        const successRate = ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1);
        const scoreColor = successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red';
        
        this.log(`\n🎯 Score de réussite: ${successRate}% (${this.results.summary.passed}/${this.results.summary.total})`, scoreColor);

        // Détails par catégorie
        this.log(`\n📋 Résultats détaillés:`, 'cyan');
        this.log(`  • Redirections: ${this.results.redirectionTests.filter(t => t.status === 'pass').length}/${this.results.redirectionTests.length}`);
        this.log(`  • Tests Swagger: ${this.results.swaggerTests.filter(t => t.status === 'pass').length}/${this.results.swaggerTests.length}`);
        this.log(`  • Tests API: ${this.results.functionalTests.filter(t => t.status === 'pass').length}/${this.results.functionalTests.length}`);

        // Recommandations
        this.log(`\n💡 État de la fusion:`, 'blue');
        if (successRate >= 90) {
            this.log('✅ Fusion réussie - Swagger opérationnel', 'green');
            this.log('✅ Toutes les redirections fonctionnent', 'green');
            this.log('✅ API documentation unifiée', 'green');
        } else if (successRate >= 70) {
            this.log('⚠️ Fusion partiellement réussie', 'yellow');
            this.log('❗ Quelques problèmes à corriger', 'yellow');
        } else {
            this.log('❌ Échec de la fusion - Intervention requise', 'red');
            this.log('❗ Problèmes majeurs détectés', 'red');
        }

        // Informations techniques
        this.log(`\n🔧 Informations techniques:`, 'magenta');
        this.log(`  • URL testée: ${BASE_URL}`);
        this.log(`  • Date du test: ${new Date().toISOString()}`);
        this.log(`  • Swagger disponible sur: ${BASE_URL}/api-docs`);

        return this.results;
    }

    /**
     * Exécute tous les tests
     */
    async runAllTests() {
        this.log('🚀 DÉBUT DES TESTS DE FUSION API + SWAGGER', 'bold');
        this.log(`Target: ${BASE_URL}`, 'cyan');

        try {
            await this.testRedirections();
            await this.testSwaggerAvailability();
            await this.testApiEndpoints();
            
            return this.generateReport();
        } catch (error) {
            this.log(`❌ Erreur fatale durant les tests: ${error.message}`, 'red');
            throw error;
        }
    }
}

/**
 * Point d'entrée principal
 */
async function main() {
    const test = new SwaggerFusionTest();
    
    try {
        const results = await test.runAllTests();
        
        // Code de sortie basé sur le taux de réussite
        const successRate = (results.summary.passed / results.summary.total) * 100;
        process.exit(successRate >= 90 ? 0 : 1);
    } catch (error) {
        console.error('Erreur lors des tests:', error);
        process.exit(1);
    }
}

// Exécuter les tests si appelé directement
if (require.main === module) {
    main();
}

module.exports = SwaggerFusionTest;