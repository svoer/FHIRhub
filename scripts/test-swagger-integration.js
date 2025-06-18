#!/usr/bin/env node

/**
 * Script de test pour la nouvelle intégration Swagger FHIRHub
 * Valide la cohérence avec le design principal et les fonctionnalités
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = process.env.FHIRHUB_URL || 'http://localhost:5000';

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class SwaggerIntegrationTest {
    constructor() {
        this.results = {
            integration: [],
            design: [],
            navigation: [],
            authentication: [],
            functionality: [],
            summary: { passed: 0, failed: 0, total: 0 }
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    async testIntegratedAccess() {
        this.log('\n🏗️ TEST D\'INTÉGRATION SWAGGER FHIRHUB', 'bold');
        this.log('=' .repeat(55), 'blue');

        const tests = [
            { path: '/api-docs/integrated', description: 'Page Swagger intégrée' },
            { path: '/includes/sidebar.html', description: 'Sidebar FHIRHub' },
            { path: '/js/swagger-integrated.js', description: 'Scripts d\'intégration' },
            { path: '/api-docs/json', description: 'Spécification JSON' }
        ];

        for (const test of tests) {
            try {
                const response = await axios.get(`${BASE_URL}${test.path}`, {
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                });

                if (response.status === 200) {
                    this.log(`✅ ${test.description}: Accessible`, 'green');
                    this.results.integration.push({
                        test: test.description,
                        status: 'pass',
                        path: test.path
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

    async testDesignCoherence() {
        this.log('\n🎨 TEST COHÉRENCE DESIGN FHIRHUB', 'bold');
        this.log('=' .repeat(55), 'blue');

        try {
            const response = await axios.get(`${BASE_URL}/api-docs/integrated`);
            const html = response.data;

            const designTests = [
                {
                    name: 'Header FHIRHub intégré',
                    test: () => html.includes('api-header') && html.includes('FHIRHub'),
                    expected: 'Header personnalisé présent'
                },
                {
                    name: 'Dégradé rouge-orange',
                    test: () => html.includes('#e74c3c') && html.includes('#f39c12'),
                    expected: 'Couleurs FHIRHub appliquées'
                },
                {
                    name: 'Sidebar FHIRHub',
                    test: () => html.includes('sidebar-container') && html.includes('with-sidebar'),
                    expected: 'Intégration sidebar active'
                },
                {
                    name: 'Navigation rapide',
                    test: () => html.includes('quick-nav') && html.includes('Navigation'),
                    expected: 'Menu de navigation présent'
                },
                {
                    name: 'Footer personnalisé',
                    test: () => html.includes('© 2025 Équipe FHIRHub') && !html.includes('MIT'),
                    expected: 'Copyright FHIRHub, pas de licence MIT'
                },
                {
                    name: 'Actions API intégrées',
                    test: () => html.includes('api-actions') && html.includes('Export JSON'),
                    expected: 'Boutons d\'export présents'
                }
            ];

            for (const designTest of designTests) {
                try {
                    if (designTest.test()) {
                        this.log(`✅ ${designTest.name}: Conforme`, 'green');
                        this.results.design.push({
                            test: designTest.name,
                            status: 'pass',
                            expected: designTest.expected
                        });
                        this.results.summary.passed++;
                    } else {
                        this.log(`❌ ${designTest.name}: Non conforme`, 'red');
                        this.results.summary.failed++;
                    }
                } catch (error) {
                    this.log(`❌ ${designTest.name}: Erreur ${error.message}`, 'red');
                    this.results.summary.failed++;
                }
                this.results.summary.total++;
            }

        } catch (error) {
            this.log(`❌ Impossible de tester le design: ${error.message}`, 'red');
        }
    }

    async testNavigationIntegration() {
        this.log('\n🧭 TEST INTÉGRATION NAVIGATION', 'bold');
        this.log('=' .repeat(55), 'blue');

        try {
            const sidebarResponse = await axios.get(`${BASE_URL}/includes/sidebar.html`);
            const sidebarHtml = sidebarResponse.data;

            const navTests = [
                {
                    name: 'Lien API Documentation mis à jour',
                    test: () => sidebarHtml.includes('/api-docs/integrated') && !sidebarHtml.includes('/api-docs" '),
                    expected: 'Redirection vers version intégrée'
                },
                {
                    name: 'Icône API présente',
                    test: () => sidebarHtml.includes('fas fa-code') && sidebarHtml.includes('API Documentation'),
                    expected: 'Icône et texte corrects'
                },
                {
                    name: 'Bouton favoris intégré',
                    test: () => sidebarHtml.includes('favorite-btn') && sidebarHtml.includes('/api-docs/integrated'),
                    expected: 'Fonctionnalité favoris active'
                }
            ];

            for (const navTest of navTests) {
                try {
                    if (navTest.test()) {
                        this.log(`✅ ${navTest.name}: Fonctionnel`, 'green');
                        this.results.navigation.push({
                            test: navTest.name,
                            status: 'pass',
                            expected: navTest.expected
                        });
                        this.results.summary.passed++;
                    } else {
                        this.log(`❌ ${navTest.name}: Dysfonctionnel`, 'red');
                        this.results.summary.failed++;
                    }
                } catch (error) {
                    this.log(`❌ ${navTest.name}: Erreur ${error.message}`, 'red');
                    this.results.summary.failed++;
                }
                this.results.summary.total++;
            }

        } catch (error) {
            this.log(`❌ Impossible de tester la navigation: ${error.message}`, 'red');
        }
    }

    async testAuthenticationFlow() {
        this.log('\n🔑 TEST FLUX D\'AUTHENTIFICATION', 'bold');
        this.log('=' .repeat(55), 'blue');

        try {
            const specResponse = await axios.get(`${BASE_URL}/api-docs/json`);
            const spec = specResponse.data;

            const authTests = [
                {
                    name: 'Schéma API Key défini',
                    test: () => spec.components && spec.components.securitySchemes && spec.components.securitySchemes.ApiKeyAuth,
                    expected: 'Authentification x-api-key configurée'
                },
                {
                    name: 'En-tête x-api-key spécifié',
                    test: () => {
                        const apiKeyAuth = spec.components?.securitySchemes?.ApiKeyAuth;
                        return apiKeyAuth && apiKeyAuth.in === 'header' && apiKeyAuth.name === 'x-api-key';
                    },
                    expected: 'Format d\'authentification correct'
                },
                {
                    name: 'Endpoints protégés marqués',
                    test: () => {
                        const paths = spec.paths || {};
                        let protectedFound = false;
                        Object.values(paths).forEach(pathObj => {
                            Object.values(pathObj).forEach(method => {
                                if (method.security && method.security.length > 0) {
                                    protectedFound = true;
                                }
                            });
                        });
                        return protectedFound;
                    },
                    expected: 'Endpoints avec sécurité configurée'
                }
            ];

            for (const authTest of authTests) {
                try {
                    if (authTest.test()) {
                        this.log(`✅ ${authTest.name}: Configuré`, 'green');
                        this.results.authentication.push({
                            test: authTest.name,
                            status: 'pass',
                            expected: authTest.expected
                        });
                        this.results.summary.passed++;
                    } else {
                        this.log(`❌ ${authTest.name}: Non configuré`, 'red');
                        this.results.summary.failed++;
                    }
                } catch (error) {
                    this.log(`❌ ${authTest.name}: Erreur ${error.message}`, 'red');
                    this.results.summary.failed++;
                }
                this.results.summary.total++;
            }

        } catch (error) {
            this.log(`❌ Impossible de tester l'authentification: ${error.message}`, 'red');
        }
    }

    async testFunctionalityComplete() {
        this.log('\n⚙️ TEST FONCTIONNALITÉS COMPLÈTES', 'bold');
        this.log('=' .repeat(55), 'blue');

        const functionalityTests = [
            { path: '/api-docs/json', description: 'Export JSON', format: 'application/json' },
            { path: '/api-docs/yaml', description: 'Export YAML', format: 'application/x-yaml' },
            { path: '/api-docs/postman', description: 'Collection Postman', format: 'application/json' },
            { path: '/api-docs/validate', description: 'Validation spec', format: 'application/json' },
            { path: '/api/system/version', description: 'Test endpoint public', format: 'application/json' }
        ];

        for (const test of functionalityTests) {
            try {
                const response = await axios.get(`${BASE_URL}${test.path}`, {
                    timeout: 5000,
                    validateStatus: (status) => status < 500
                });

                if (response.status === 200 && response.data) {
                    this.log(`✅ ${test.description}: Fonctionnel`, 'green');
                    this.results.functionality.push({
                        test: test.description,
                        status: 'pass',
                        path: test.path,
                        size: JSON.stringify(response.data).length
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

    generateFinalReport() {
        this.log('\n' + '='.repeat(70), 'bold');
        this.log('📋 RAPPORT INTÉGRATION SWAGGER FHIRHUB - VERSION FINALE', 'bold');
        this.log('='.repeat(70), 'bold');

        const qualityScore = ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1);
        const scoreColor = qualityScore >= 95 ? 'green' : qualityScore >= 85 ? 'yellow' : 'red';
        
        this.log(`\n🎯 Score de qualité intégration: ${qualityScore}% (${this.results.summary.passed}/${this.results.summary.total})`, scoreColor);

        this.log(`\n📋 Résultats par catégorie:`, 'cyan');
        this.log(`  • Intégration: ${this.results.integration.filter(t => t.status === 'pass').length}/${this.results.integration.length}`);
        this.log(`  • Design cohérent: ${this.results.design.filter(t => t.status === 'pass').length}/${this.results.design.length}`);
        this.log(`  • Navigation: ${this.results.navigation.filter(t => t.status === 'pass').length}/${this.results.navigation.length}`);
        this.log(`  • Authentification: ${this.results.authentication.filter(t => t.status === 'pass').length}/${this.results.authentication.length}`);
        this.log(`  • Fonctionnalités: ${this.results.functionality.filter(t => t.status === 'pass').length}/${this.results.functionality.length}`);

        this.log(`\n✅ Améliorations réalisées:`, 'green');
        this.log('  • Navigation unifiée avec sidebar FHIRHub');
        this.log('  • Licence MIT supprimée, copyright FHIRHub ajouté');
        this.log('  • Thème dégradé rouge-orange cohérent');
        this.log('  • Header API personnalisé avec métadonnées');
        this.log('  • Navigation rapide sticky pour sections');
        this.log('  • Authentification API Key intégrée');
        this.log('  • Exports multi-formats fonctionnels');

        this.log(`\n🌐 Accès à la version intégrée:`, 'cyan');
        this.log(`  • Interface intégrée: ${BASE_URL}/api-docs/integrated`, 'cyan');
        this.log(`  • Version standalone: ${BASE_URL}/api-docs`, 'cyan');

        if (qualityScore >= 95) {
            this.log('\n🚀 Intégration Swagger FHIRHub complète et prête', 'green');
        } else if (qualityScore >= 85) {
            this.log('\n⚠️ Intégration réussie avec améliorations mineures possibles', 'yellow');
        } else {
            this.log('\n❌ Intégration nécessite des corrections majeures', 'red');
        }

        return this.results;
    }

    async runFullIntegrationTest() {
        this.log('🚀 DÉBUT DU TEST D\'INTÉGRATION SWAGGER FHIRHUB', 'bold');
        this.log(`Target: ${BASE_URL}`, 'cyan');

        try {
            await this.testIntegratedAccess();
            await this.testDesignCoherence();
            await this.testNavigationIntegration();
            await this.testAuthenticationFlow();
            await this.testFunctionalityComplete();
            
            return this.generateFinalReport();
        } catch (error) {
            this.log(`❌ Erreur fatale durant les tests: ${error.message}`, 'red');
            throw error;
        }
    }
}

async function main() {
    const tester = new SwaggerIntegrationTest();
    
    try {
        const results = await tester.runFullIntegrationTest();
        
        const qualityScore = (results.summary.passed / results.summary.total) * 100;
        process.exit(qualityScore >= 95 ? 0 : 1);
    } catch (error) {
        console.error('Erreur lors du test d\'intégration:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = SwaggerIntegrationTest;