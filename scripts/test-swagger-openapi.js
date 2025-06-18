#!/usr/bin/env node

/**
 * Script de test pour la nouvelle API Swagger OpenAPI 3.0
 * Valide tous les endpoints et la conformité de la spécification
 */

const axios = require('axios');
const fs = require('fs');

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
 * Classe de test Swagger OpenAPI 3.0
 */
class SwaggerOpenAPITest {
    constructor() {
        this.results = {
            swaggerAccess: [],
            specValidation: [],
            endpointDocumentation: [],
            exportFormats: [],
            tryItOut: [],
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
     * Teste l'accès à l'interface Swagger UI
     */
    async testSwaggerAccess() {
        this.log('\n🌐 TEST D\'ACCÈS SWAGGER UI', 'bold');
        this.log('=' .repeat(50), 'blue');

        const tests = [
            { path: '/api-docs', description: 'Interface Swagger UI principale' },
            { path: '/api-docs/json', description: 'Export JSON OpenAPI' },
            { path: '/api-docs/yaml', description: 'Export YAML OpenAPI' },
            { path: '/api-docs/postman', description: 'Collection Postman' },
            { path: '/api-docs/validate', description: 'Validation de la spécification' }
        ];

        for (const test of tests) {
            try {
                const response = await axios.get(`${BASE_URL}${test.path}`, {
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                });

                if (response.status === 200) {
                    this.log(`✅ ${test.description}: Accessible`, 'green');
                    this.results.swaggerAccess.push({
                        test: test.description,
                        status: 'pass',
                        path: test.path,
                        responseSize: response.data ? JSON.stringify(response.data).length : 'N/A'
                    });
                    this.results.summary.passed++;
                } else {
                    this.log(`❌ ${test.description}: Status ${response.status}`, 'red');
                    this.results.summary.failed++;
                }
            } catch (error) {
                this.log(`❌ ${test.description}: ${error.message}`, 'red');
                this.results.summary.failed++;
            }
            this.results.summary.total++;
        }
    }

    /**
     * Valide la spécification OpenAPI 3.0
     */
    async testSpecValidation() {
        this.log('\n📋 VALIDATION SPÉCIFICATION OPENAPI 3.0', 'bold');
        this.log('=' .repeat(50), 'blue');

        try {
            const response = await axios.get(`${BASE_URL}/api-docs/json`);
            const spec = response.data;

            // Tests de conformité OpenAPI 3.0
            const validationTests = [
                {
                    name: 'Version OpenAPI 3.0',
                    test: () => spec.openapi && spec.openapi.startsWith('3.0'),
                    expected: '3.0.x'
                },
                {
                    name: 'Informations de base',
                    test: () => spec.info && spec.info.title && spec.info.version,
                    expected: 'titre et version présents'
                },
                {
                    name: 'Serveurs définis',
                    test: () => spec.servers && spec.servers.length > 0,
                    expected: 'au moins un serveur'
                },
                {
                    name: 'Schémas de sécurité',
                    test: () => spec.components && spec.components.securitySchemes,
                    expected: 'schémas de sécurité définis'
                },
                {
                    name: 'Schémas de données',
                    test: () => spec.components && spec.components.schemas && Object.keys(spec.components.schemas).length > 0,
                    expected: 'schémas de données définis'
                },
                {
                    name: 'Tags organisationnels',
                    test: () => spec.tags && spec.tags.length >= 5,
                    expected: 'au moins 5 tags'
                },
                {
                    name: 'Endpoints documentés',
                    test: () => spec.paths && Object.keys(spec.paths).length >= 10,
                    expected: 'au moins 10 endpoints'
                }
            ];

            for (const validation of validationTests) {
                try {
                    if (validation.test()) {
                        this.log(`✅ ${validation.name}: Conforme`, 'green');
                        this.results.specValidation.push({
                            test: validation.name,
                            status: 'pass',
                            expected: validation.expected
                        });
                        this.results.summary.passed++;
                    } else {
                        this.log(`❌ ${validation.name}: Non conforme`, 'red');
                        this.results.summary.failed++;
                    }
                } catch (error) {
                    this.log(`❌ ${validation.name}: Erreur ${error.message}`, 'red');
                    this.results.summary.failed++;
                }
                this.results.summary.total++;
            }

            // Afficher les statistiques de la spec
            this.log(`\n📊 Statistiques de la spécification:`, 'cyan');
            this.log(`  • Version: ${spec.openapi}`, 'cyan');
            this.log(`  • Titre: ${spec.info.title}`, 'cyan');
            this.log(`  • Version API: ${spec.info.version}`, 'cyan');
            this.log(`  • Endpoints: ${Object.keys(spec.paths || {}).length}`, 'cyan');
            this.log(`  • Schémas: ${Object.keys(spec.components?.schemas || {}).length}`, 'cyan');
            this.log(`  • Tags: ${(spec.tags || []).length}`, 'cyan');

        } catch (error) {
            this.log(`❌ Erreur lors de la récupération de la spécification: ${error.message}`, 'red');
            this.results.summary.failed++;
            this.results.summary.total++;
        }
    }

    /**
     * Teste la documentation des endpoints principaux
     */
    async testEndpointDocumentation() {
        this.log('\n📖 TEST DOCUMENTATION DES ENDPOINTS', 'bold');
        this.log('=' .repeat(50), 'blue');

        try {
            const response = await axios.get(`${BASE_URL}/api-docs/json`);
            const spec = response.data;

            const expectedEndpoints = [
                { path: '/api/convert/hl7-to-fhir', method: 'post', category: 'Conversion' },
                { path: '/api/fhir-ai/patient-summary', method: 'post', category: 'IA' },
                { path: '/api/applications', method: 'get', category: 'Administration' },
                { path: '/api/applications', method: 'post', category: 'Administration' },
                { path: '/api/api-keys', method: 'get', category: 'Administration' },
                { path: '/api/system/version', method: 'get', category: 'Système' }
            ];

            for (const endpoint of expectedEndpoints) {
                const pathSpec = spec.paths?.[endpoint.path];
                const methodSpec = pathSpec?.[endpoint.method];

                if (methodSpec) {
                    // Vérifier la qualité de la documentation
                    const hasDescription = methodSpec.description && methodSpec.description.length > 50;
                    const hasExamples = methodSpec.requestBody?.content?.['application/json']?.examples || 
                                       methodSpec.responses?.['200']?.content?.['application/json']?.examples;
                    const hasSecurity = methodSpec.security && methodSpec.security.length > 0;
                    const hasResponses = methodSpec.responses && Object.keys(methodSpec.responses).length >= 2;

                    const quality = [hasDescription, hasExamples, hasSecurity, hasResponses].filter(Boolean).length;
                    
                    if (quality >= 3) {
                        this.log(`✅ ${endpoint.method.toUpperCase()} ${endpoint.path}: Bien documenté (${quality}/4)`, 'green');
                        this.results.endpointDocumentation.push({
                            endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
                            status: 'pass',
                            quality: `${quality}/4`,
                            category: endpoint.category
                        });
                        this.results.summary.passed++;
                    } else {
                        this.log(`⚠️ ${endpoint.method.toUpperCase()} ${endpoint.path}: Documentation incomplète (${quality}/4)`, 'yellow');
                        this.results.summary.failed++;
                    }
                } else {
                    this.log(`❌ ${endpoint.method.toUpperCase()} ${endpoint.path}: Non documenté`, 'red');
                    this.results.summary.failed++;
                }
                this.results.summary.total++;
            }

        } catch (error) {
            this.log(`❌ Erreur lors de l'analyse des endpoints: ${error.message}`, 'red');
        }
    }

    /**
     * Teste les formats d'export
     */
    async testExportFormats() {
        this.log('\n📤 TEST DES FORMATS D\'EXPORT', 'bold');
        this.log('=' .repeat(50), 'blue');

        const exports = [
            { path: '/api-docs/json', format: 'JSON', contentType: 'application/json' },
            { path: '/api-docs/yaml', format: 'YAML', contentType: 'application/x-yaml' },
            { path: '/api-docs/postman', format: 'Postman Collection', contentType: 'application/json' }
        ];

        for (const exportTest of exports) {
            try {
                const response = await axios.get(`${BASE_URL}${exportTest.path}`);
                
                if (response.status === 200 && response.data) {
                    const size = JSON.stringify(response.data).length;
                    this.log(`✅ Export ${exportTest.format}: Réussi (${size} caractères)`, 'green');
                    this.results.exportFormats.push({
                        format: exportTest.format,
                        status: 'pass',
                        size: size,
                        path: exportTest.path
                    });
                    this.results.summary.passed++;
                } else {
                    this.log(`❌ Export ${exportTest.format}: Échec`, 'red');
                    this.results.summary.failed++;
                }
            } catch (error) {
                this.log(`❌ Export ${exportTest.format}: ${error.message}`, 'red');
                this.results.summary.failed++;
            }
            this.results.summary.total++;
        }
    }

    /**
     * Teste la fonctionnalité Try-It-Out
     */
    async testTryItOut() {
        this.log('\n🧪 TEST TRY-IT-OUT', 'bold');
        this.log('=' .repeat(50), 'blue');

        // Test simple sur un endpoint public
        try {
            const response = await axios.get(`${BASE_URL}/api/system/version`);
            
            if (response.status === 200 && response.data.success) {
                this.log(`✅ Try-It-Out système: Fonctionnel`, 'green');
                this.results.tryItOut.push({
                    test: 'Version système',
                    status: 'pass',
                    endpoint: 'GET /api/system/version'
                });
                this.results.summary.passed++;
            } else {
                this.log(`❌ Try-It-Out système: Réponse invalide`, 'red');
                this.results.summary.failed++;
            }
        } catch (error) {
            this.log(`❌ Try-It-Out système: ${error.message}`, 'red');
            this.results.summary.failed++;
        }
        this.results.summary.total++;

        // Vérifier que l'authentification est documentée
        try {
            const response = await axios.post(`${BASE_URL}/api/convert/hl7-to-fhir`, {
                hl7Message: 'test'
            });
            // On s'attend à une erreur 401 (pas de clé API)
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.log(`✅ Authentification Try-It-Out: Correctement protégé`, 'green');
                this.results.tryItOut.push({
                    test: 'Protection authentification',
                    status: 'pass',
                    endpoint: 'POST /api/convert/hl7-to-fhir'
                });
                this.results.summary.passed++;
            } else {
                this.log(`⚠️ Authentification Try-It-Out: Comportement inattendu`, 'yellow');
                this.results.summary.failed++;
            }
        }
        this.results.summary.total++;
    }

    /**
     * Génère le rapport complet
     */
    generateReport() {
        this.log('\n' + '='.repeat(60), 'bold');
        this.log('📋 RAPPORT SWAGGER OPENAPI 3.0 - NOUVELLE IMPLÉMENTATION', 'bold');
        this.log('='.repeat(60), 'bold');

        // Score de qualité
        const qualityScore = ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1);
        const scoreColor = qualityScore >= 90 ? 'green' : qualityScore >= 70 ? 'yellow' : 'red';
        
        this.log(`\n🎯 Score de qualité: ${qualityScore}% (${this.results.summary.passed}/${this.results.summary.total})`, scoreColor);

        // Détails par catégorie
        this.log(`\n📋 Résultats détaillés:`, 'cyan');
        this.log(`  • Accès Swagger: ${this.results.swaggerAccess.filter(t => t.status === 'pass').length}/${this.results.swaggerAccess.length}`);
        this.log(`  • Validation spec: ${this.results.specValidation.filter(t => t.status === 'pass').length}/${this.results.specValidation.length}`);
        this.log(`  • Documentation endpoints: ${this.results.endpointDocumentation.filter(t => t.status === 'pass').length}/${this.results.endpointDocumentation.length}`);
        this.log(`  • Formats d'export: ${this.results.exportFormats.filter(t => t.status === 'pass').length}/${this.results.exportFormats.length}`);
        this.log(`  • Try-It-Out: ${this.results.tryItOut.filter(t => t.status === 'pass').length}/${this.results.tryItOut.length}`);

        // État de la migration
        this.log(`\n🚀 État de la migration:`, 'blue');
        if (qualityScore >= 90) {
            this.log('✅ Migration OpenAPI 3.0 réussie', 'green');
            this.log('✅ Interface Swagger UI fonctionnelle', 'green');
            this.log('✅ Documentation complète et exportable', 'green');
            this.log('✅ Try-It-Out opérationnel avec authentification', 'green');
        } else if (qualityScore >= 70) {
            this.log('⚠️ Migration partiellement réussie', 'yellow');
            this.log('❗ Quelques améliorations nécessaires', 'yellow');
        } else {
            this.log('❌ Migration incomplète', 'red');
            this.log('❗ Corrections majeures requises', 'red');
        }

        this.log(`\n🌐 Accès à la documentation:`, 'cyan');
        this.log(`  • Interface Swagger: ${BASE_URL}/api-docs`, 'cyan');
        this.log(`  • Export JSON: ${BASE_URL}/api-docs/json`, 'cyan');
        this.log(`  • Export YAML: ${BASE_URL}/api-docs/yaml`, 'cyan');
        this.log(`  • Collection Postman: ${BASE_URL}/api-docs/postman`, 'cyan');

        return this.results;
    }

    /**
     * Exécute tous les tests de migration Swagger
     */
    async runFullTest() {
        this.log('🚀 DÉBUT DU TEST MIGRATION SWAGGER OPENAPI 3.0', 'bold');
        this.log(`Target: ${BASE_URL}`, 'cyan');

        try {
            await this.testSwaggerAccess();
            await this.testSpecValidation();
            await this.testEndpointDocumentation();
            await this.testExportFormats();
            await this.testTryItOut();
            
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
    const tester = new SwaggerOpenAPITest();
    
    try {
        const results = await tester.runFullTest();
        
        // Code de sortie basé sur le score de qualité
        const qualityScore = (results.summary.passed / results.summary.total) * 100;
        process.exit(qualityScore >= 90 ? 0 : 1);
    } catch (error) {
        console.error('Erreur lors du test Swagger:', error);
        process.exit(1);
    }
}

// Exécuter les tests si appelé directement
if (require.main === module) {
    main();
}

module.exports = SwaggerOpenAPITest;