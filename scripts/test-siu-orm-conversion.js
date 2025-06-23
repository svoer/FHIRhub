#!/usr/bin/env node

/**
 * Script de test pour les nouveaux types de messages SIU et ORM
 * Valide la conversion vers FHIR FRCore
 */

const fs = require('fs');
const path = require('path');

// Simuler l'environnement FHIRHub
process.env.NODE_ENV = 'test';

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSIUConversion() {
    log('\n🗓️ TEST CONVERSION SIU (Scheduling Information)', 'bold');
    log('='.repeat(60), 'blue');

    try {
        // Charger le convertisseur principal
        const converter = require('../hl7ToFhirAdvancedConverter');
        
        // Charger l'exemple SIU
        const siuMessage = fs.readFileSync('test_data/siu_s12_example.hl7', 'utf8');
        log('Message SIU S12 chargé depuis test_data/siu_s12_example.hl7', 'cyan');
        
        // Effectuer la conversion
        const startTime = Date.now();
        const result = converter.convertHL7ToFHIR(siuMessage);
        const conversionTime = Date.now() - startTime;
        
        if (result && result.resourceType === 'Bundle') {
            log(`✅ Conversion SIU réussie en ${conversionTime}ms`, 'green');
            log(`📦 Bundle FHIR généré avec ${result.entry?.length || 0} ressources`, 'green');
            
            // Analyser les ressources générées
            const resourceTypes = {};
            result.entry?.forEach(entry => {
                const resourceType = entry.resource?.resourceType;
                if (resourceType) {
                    resourceTypes[resourceType] = (resourceTypes[resourceType] || 0) + 1;
                }
            });
            
            log('\n📋 Ressources FHIR générées:', 'cyan');
            Object.entries(resourceTypes).forEach(([type, count]) => {
                log(`  • ${type}: ${count}`, 'cyan');
            });
            
            // Vérifier les profils FR Core
            const frCoreProfiles = [];
            result.entry?.forEach(entry => {
                const profiles = entry.resource?.meta?.profile || [];
                profiles.forEach(profile => {
                    if (profile.includes('hl7.fr/ig/fhir/core')) {
                        frCoreProfiles.push(profile);
                    }
                });
            });
            
            if (frCoreProfiles.length > 0) {
                log(`✅ ${frCoreProfiles.length} profils FR Core détectés`, 'green');
            } else {
                log('⚠️ Aucun profil FR Core détecté', 'yellow');
            }
            
            // Sauvegarder le résultat
            fs.writeFileSync('test_output_siu.json', JSON.stringify(result, null, 2));
            log('💾 Résultat sauvegardé dans test_output_siu.json', 'cyan');
            
            return true;
        } else {
            log('❌ Échec de la conversion SIU', 'red');
            log(`Résultat: ${JSON.stringify(result, null, 2)}`, 'red');
            return false;
        }
    } catch (error) {
        log(`❌ Erreur lors de la conversion SIU: ${error.message}`, 'red');
        console.error(error.stack);
        return false;
    }
}

async function testORMConversion() {
    log('\n🧪 TEST CONVERSION ORM (Order Message)', 'bold');
    log('='.repeat(60), 'blue');

    try {
        // Charger le convertisseur principal
        const converter = require('../hl7ToFhirAdvancedConverter');
        
        // Charger l'exemple ORM
        const ormMessage = fs.readFileSync('test_data/orm_o01_example.hl7', 'utf8');
        log('Message ORM O01 chargé depuis test_data/orm_o01_example.hl7', 'cyan');
        
        // Effectuer la conversion
        const startTime = Date.now();
        const result = converter.convertHL7ToFHIR(ormMessage);
        const conversionTime = Date.now() - startTime;
        
        if (result && result.resourceType === 'Bundle') {
            log(`✅ Conversion ORM réussie en ${conversionTime}ms`, 'green');
            log(`📦 Bundle FHIR généré avec ${result.entry?.length || 0} ressources`, 'green');
            
            // Analyser les ressources générées
            const resourceTypes = {};
            result.entry?.forEach(entry => {
                const resourceType = entry.resource?.resourceType;
                if (resourceType) {
                    resourceTypes[resourceType] = (resourceTypes[resourceType] || 0) + 1;
                }
            });
            
            log('\n📋 Ressources FHIR générées:', 'cyan');
            Object.entries(resourceTypes).forEach(([type, count]) => {
                log(`  • ${type}: ${count}`, 'cyan');
            });
            
            // Vérifier la présence de ServiceRequest
            const serviceRequests = result.entry?.filter(entry => 
                entry.resource?.resourceType === 'ServiceRequest'
            );
            
            if (serviceRequests && serviceRequests.length > 0) {
                log(`✅ ${serviceRequests.length} ServiceRequest(s) créée(s)`, 'green');
                serviceRequests.forEach((sr, index) => {
                    const status = sr.resource.status;
                    const code = sr.resource.code?.coding?.[0]?.display || 'Service non spécifié';
                    log(`  └─ ServiceRequest ${index + 1}: ${code} (${status})`, 'cyan');
                });
            }
            
            // Vérifier les profils FR Core
            const frCoreProfiles = [];
            result.entry?.forEach(entry => {
                const profiles = entry.resource?.meta?.profile || [];
                profiles.forEach(profile => {
                    if (profile.includes('hl7.fr/ig/fhir/core')) {
                        frCoreProfiles.push(profile);
                    }
                });
            });
            
            if (frCoreProfiles.length > 0) {
                log(`✅ ${frCoreProfiles.length} profils FR Core détectés`, 'green');
            } else {
                log('⚠️ Aucun profil FR Core détecté', 'yellow');
            }
            
            // Sauvegarder le résultat
            fs.writeFileSync('test_output_orm.json', JSON.stringify(result, null, 2));
            log('💾 Résultat sauvegardé dans test_output_orm.json', 'cyan');
            
            return true;
        } else {
            log('❌ Échec de la conversion ORM', 'red');
            log(`Résultat: ${JSON.stringify(result, null, 2)}`, 'red');
            return false;
        }
    } catch (error) {
        log(`❌ Erreur lors de la conversion ORM: ${error.message}`, 'red');
        console.error(error.stack);
        return false;
    }
}

async function testMessageTypeDetection() {
    log('\n🔍 TEST DÉTECTION TYPES DE MESSAGES', 'bold');
    log('='.repeat(60), 'blue');

    try {
        const messageTypeHandler = require('../src/parsers/hl7MessageTypeHandler');
        
        // Test messages
        const testMessages = [
            { type: 'ADT^A01^ADT_A01', expected: { messageType: 'ADT', eventType: 'A01', supported: true } },
            { type: 'SIU^S12^SIU_S12', expected: { messageType: 'SIU', eventType: 'S12', supported: true } },
            { type: 'ORM^O01^ORM_O01', expected: { messageType: 'ORM', eventType: 'O01', supported: true } },
            { type: 'SIU^S99^SIU_S99', expected: { messageType: 'SIU', eventType: 'S99', supported: false } },
            { type: 'XYZ^Z01^XYZ_Z01', expected: { messageType: 'XYZ', eventType: 'Z01', supported: false } }
        ];
        
        let passed = 0;
        let total = testMessages.length;
        
        testMessages.forEach((test, index) => {
            try {
                const mockMSH = {
                    fields: [null, null, null, null, null, null, null, null, test.type]
                };
                
                const result = messageTypeHandler.detectMessageType(mockMSH);
                
                const success = result.messageType === test.expected.messageType &&
                               result.eventType === test.expected.eventType &&
                               result.supported === test.expected.supported;
                
                if (success) {
                    log(`✅ Test ${index + 1}: ${test.type} → Détection correcte`, 'green');
                    passed++;
                } else {
                    log(`❌ Test ${index + 1}: ${test.type} → Détection incorrecte`, 'red');
                    log(`  Attendu: ${JSON.stringify(test.expected)}`, 'red');
                    log(`  Obtenu: ${JSON.stringify(result)}`, 'red');
                }
            } catch (error) {
                log(`❌ Test ${index + 1}: ${test.type} → Erreur: ${error.message}`, 'red');
            }
        });
        
        log(`\n📊 Résultat détection: ${passed}/${total} tests réussis`, passed === total ? 'green' : 'yellow');
        return passed === total;
        
    } catch (error) {
        log(`❌ Erreur lors du test de détection: ${error.message}`, 'red');
        return false;
    }
}

async function runAllTests() {
    log('🚀 DÉBUT DES TESTS EXTENSION SIU + ORM + FRCORE', 'bold');
    log('='.repeat(70), 'cyan');

    const results = {
        detection: await testMessageTypeDetection(),
        siu: await testSIUConversion(),
        orm: await testORMConversion()
    };

    log('\n' + '='.repeat(70), 'bold');
    log('📋 RAPPORT FINAL DES TESTS', 'bold');
    log('='.repeat(70), 'bold');

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;
    const successRate = ((passed / total) * 100).toFixed(1);

    log(`\n🎯 Score global: ${successRate}% (${passed}/${total} tests réussis)`, passed === total ? 'green' : 'yellow');
    
    log('\n📋 Détail par catégorie:', 'cyan');
    log(`  • Détection types messages: ${results.detection ? '✅' : '❌'}`, results.detection ? 'green' : 'red');
    log(`  • Conversion SIU: ${results.siu ? '✅' : '❌'}`, results.siu ? 'green' : 'red');
    log(`  • Conversion ORM: ${results.orm ? '✅' : '❌'}`, results.orm ? 'green' : 'red');

    if (passed === total) {
        log('\n🎉 Extension SIU + ORM + FRCore opérationnelle !', 'green');
        log('✅ FHIRHub supporte maintenant:', 'green');
        log('  • ADT (Admission, Discharge, Transfer)', 'green');
        log('  • SIU (Scheduling Information Unsolicited)', 'green');
        log('  • ORM (Order Message)', 'green');
        log('  • Profils FHIR FRCore français', 'green');
    } else {
        log('\n⚠️ Certains tests ont échoué', 'yellow');
        log('Vérifiez les logs ci-dessus pour plus de détails.', 'yellow');
    }

    return passed === total;
}

if (require.main === module) {
    runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Erreur fatale:', error);
            process.exit(1);
        });
}

module.exports = { testSIUConversion, testORMConversion, testMessageTypeDetection };