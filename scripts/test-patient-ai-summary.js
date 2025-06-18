#!/usr/bin/env node

/**
 * Script de test pour valider la fonctionnalité de résumé IA patient
 * Teste les corrections apportées pour résoudre les problèmes de timeout et contamination
 */

const axios = require('axios');

// Configuration du test
const BASE_URL = 'http://localhost:5000';
const TEST_PATIENT_ID = '1428383';
const TEST_SERVER_URL = 'https://hapi.fhir.org/baseR4';

// Données patient de test simplifiées pour éviter la surcharge
const TEST_PATIENT_DATA = {
    patient: {
        id: TEST_PATIENT_ID,
        name: [{ family: 'Martin', given: ['Sarah'] }],
        gender: 'female',
        birthDate: '2020-08-06'
    },
    conditions: [
        {
            id: 'condition1',
            code: { text: 'Hypertension artérielle' },
            clinicalStatus: { coding: [{ code: 'active' }] },
            recordedDate: '2023-01-15'
        },
        {
            id: 'condition2', 
            code: { text: 'Diabète de type 2' },
            clinicalStatus: { coding: [{ code: 'active' }] },
            recordedDate: '2022-08-20'
        }
    ],
    observations: [
        {
            id: 'obs1',
            code: { text: 'Tension artérielle' },
            valueQuantity: { value: 140, unit: 'mmHg' },
            effectiveDateTime: '2023-12-01',
            status: 'final'
        },
        {
            id: 'obs2',
            code: { text: 'Glycémie à jeun' },
            valueQuantity: { value: 126, unit: 'mg/dL' },
            effectiveDateTime: '2023-11-15',
            status: 'final'
        }
    ],
    medications: [
        {
            id: 'med1',
            medicationCodeableConcept: { text: 'Métformine 500mg' },
            status: 'active',
            authoredOn: '2022-09-01'
        }
    ],
    encounters: [
        {
            id: 'enc1',
            status: 'finished',
            class: { display: 'Consultation externe' },
            type: [{ text: 'Suivi diabète' }],
            period: { start: '2023-12-01', end: '2023-12-01' }
        }
    ]
};

/**
 * Teste l'API de résumé IA avec gestion d'erreurs
 */
async function testPatientAISummary() {
    console.log('🧪 Test du résumé IA patient - version corrigée');
    console.log('================================================');
    
    const startTime = Date.now();
    
    try {
        console.log('📤 Envoi de la requête d\'analyse IA...');
        console.log(`Patient ID: ${TEST_PATIENT_ID}`);
        console.log(`Serveur FHIR: ${TEST_SERVER_URL}`);
        console.log(`Données patient: ${Object.keys(TEST_PATIENT_DATA).join(', ')}`);
        
        const response = await axios.post(`${BASE_URL}/api/ai/analyze-patient`, {
            patientId: TEST_PATIENT_ID,
            serverUrl: TEST_SERVER_URL,
            patientData: TEST_PATIENT_DATA
        }, {
            timeout: 120000, // 2 minutes de timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const duration = Date.now() - startTime;
        
        console.log('✅ Réponse reçue avec succès');
        console.log(`⏱️ Temps de traitement: ${duration}ms`);
        console.log(`📊 Code de statut: ${response.status}`);
        
        if (response.data.success) {
            console.log('✅ Analyse IA générée avec succès');
            
            const analysis = response.data.analysis;
            console.log(`📝 Longueur de l'analyse: ${analysis.length} caractères`);
            
            // Vérifications de qualité
            const checks = {
                'Contient du HTML': analysis.includes('<div>') || analysis.includes('<h3>'),
                'Mentionne le patient': analysis.includes('Sarah') || analysis.includes('Martin'),
                'Contient données médicales': analysis.includes('diabète') || analysis.includes('hypertension') || analysis.includes('tension'),
                'Pas de contamination': !analysis.includes('appel d\'offres') && !analysis.includes('marché public'),
                'Longueur appropriée': analysis.length > 500 && analysis.length < 10000
            };
            
            console.log('\n🔍 Vérifications de qualité:');
            for (const [check, passed] of Object.entries(checks)) {
                console.log(`${passed ? '✅' : '❌'} ${check}`);
            }
            
            // Afficher un extrait de l'analyse
            console.log('\n📋 Extrait de l\'analyse générée:');
            console.log('=' .repeat(50));
            console.log(analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''));
            console.log('=' .repeat(50));
            
            // Métadonnées si disponibles
            if (response.data.metadata) {
                console.log('\n📊 Métadonnées:');
                console.log(JSON.stringify(response.data.metadata, null, 2));
            }
            
            // Score de réussite
            const passedChecks = Object.values(checks).filter(Boolean).length;
            const score = (passedChecks / Object.keys(checks).length) * 100;
            console.log(`\n🎯 Score de qualité: ${score.toFixed(1)}%`);
            
            if (score >= 80) {
                console.log('🎉 Test RÉUSSI - Résumé IA de qualité généré');
            } else if (score >= 60) {
                console.log('⚠️ Test PARTIEL - Résumé généré mais qualité à améliorer');
            } else {
                console.log('❌ Test ÉCHOUÉ - Qualité du résumé insuffisante');
            }
            
        } else {
            console.log('❌ Échec de l\'analyse IA');
            console.log('Message d\'erreur:', response.data.message);
            if (response.data.error) {
                console.log('Détails de l\'erreur:', response.data.error);
            }
        }
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`❌ Erreur lors du test (après ${duration}ms)`);
        
        if (error.code === 'ECONNABORTED') {
            console.log('⏰ Timeout de la requête');
        } else if (error.response) {
            console.log(`📊 Code de statut: ${error.response.status}`);
            console.log('Réponse d\'erreur:', error.response.data);
        } else if (error.request) {
            console.log('❌ Pas de réponse du serveur');
            console.log('Vérifiez que FHIRHub est démarré sur', BASE_URL);
        } else {
            console.log('❌ Erreur de configuration:', error.message);
        }
    }
}

/**
 * Teste aussi une question spécifique au chatbot
 */
async function testChatbotQuestion() {
    console.log('\n🤖 Test de question chatbot...');
    
    try {
        const response = await axios.post(`${BASE_URL}/api/ai/analyze-patient`, {
            patientId: TEST_PATIENT_ID,
            serverUrl: TEST_SERVER_URL,
            patientData: TEST_PATIENT_DATA,
            question: 'Quel est l\'état de santé général de ce patient ?',
            chatbot: true
        }, {
            timeout: 60000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.success) {
            console.log('✅ Question chatbot traitée avec succès');
            const answer = response.data.analysis;
            console.log(`Réponse: ${answer.substring(0, 200)}...`);
            
            // Vérifier que c'est une réponse courte et ciblée
            if (answer.length < 1000) {
                console.log('✅ Réponse appropriée pour une question');
            } else {
                console.log('⚠️ Réponse trop longue pour une question simple');
            }
        } else {
            console.log('❌ Échec de la question chatbot');
        }
        
    } catch (error) {
        console.log('❌ Erreur lors du test chatbot:', error.message);
    }
}

/**
 * Vérifie la santé générale du service
 */
async function checkServiceHealth() {
    console.log('\n🏥 Vérification de la santé du service...');
    
    try {
        // Test de santé général
        const healthResponse = await axios.get(`${BASE_URL}/api/system/health`, {
            timeout: 5000
        });
        
        console.log('✅ Service de santé répond');
        
        // Test des fournisseurs IA
        try {
            const aiStatus = await axios.get(`${BASE_URL}/api/ai-providers/active`, {
                timeout: 5000
            });
            
            if (aiStatus.data.success && aiStatus.data.data) {
                console.log(`✅ Fournisseur IA actif: ${aiStatus.data.data.provider_type} (${aiStatus.data.data.model_name})`);
            } else {
                console.log('⚠️ Aucun fournisseur IA actif configuré');
            }
        } catch (error) {
            console.log('⚠️ Impossible de vérifier le fournisseur IA');
        }
        
    } catch (error) {
        console.log('❌ Service de santé non accessible');
        console.log('Assurez-vous que FHIRHub est démarré');
    }
}

/**
 * Point d'entrée principal
 */
async function main() {
    console.log('🔍 DEBUG RÉSUMÉ IA PATIENT - TESTS DE VALIDATION');
    console.log('Date:', new Date().toISOString());
    console.log();
    
    await checkServiceHealth();
    await testPatientAISummary();
    await testChatbotQuestion();
    
    console.log('\n📋 Résumé des tests terminé');
    console.log('Pour plus de détails, consultez les logs du serveur FHIRHub');
}

// Exécuter les tests
if (require.main === module) {
    main().catch(error => {
        console.error('Erreur fatale lors des tests:', error);
        process.exit(1);
    });
}

module.exports = { testPatientAISummary, testChatbotQuestion, checkServiceHealth };