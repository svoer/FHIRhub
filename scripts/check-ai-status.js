#!/usr/bin/env node

/**
 * Script pour vérifier l'état des fournisseurs IA et diagnostiquer les problèmes
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';

async function checkAIStatus() {
    console.log('🔍 DIAGNOSTIC DES FOURNISSEURS IA');
    console.log('==================================');
    
    try {
        // 1. Vérifier les fournisseurs configurés
        console.log('\n📋 Fournisseurs configurés:');
        const providersResponse = await axios.get(`${BASE_URL}/api/ai-providers/`, {
            timeout: 5000
        });
        
        if (providersResponse.data.success && providersResponse.data.data) {
            const providers = providersResponse.data.data;
            console.log(`Nombre de fournisseurs: ${providers.length}`);
            
            providers.forEach(provider => {
                const status = provider.is_active || provider.enabled ? '✅ Actif' : '❌ Inactif';
                const hasKey = provider.api_key && provider.api_key.trim() !== '' ? '🔑 Oui' : '❌ Non';
                console.log(`\n  ${provider.provider_type || provider.name}:`);
                console.log(`    Statut: ${status}`);
                console.log(`    Modèle: ${provider.model_name || provider.models || 'Non spécifié'}`);
                console.log(`    Clé API: ${hasKey}`);
                console.log(`    URL: ${provider.api_url || provider.endpoint || 'Défaut'}`);
            });
        } else {
            console.log('❌ Aucun fournisseur configuré');
        }
        
        // 2. Vérifier le fournisseur actif
        console.log('\n🎯 Fournisseur actif:');
        try {
            const activeResponse = await axios.get(`${BASE_URL}/api/ai-providers/active`, {
                timeout: 5000
            });
            
            if (activeResponse.data.success && activeResponse.data.data) {
                const active = activeResponse.data.data;
                console.log(`✅ ${active.provider_type} (${active.model_name})`);
                
                // Tester la connectivité
                console.log('\n🔗 Test de connectivité:');
                try {
                    const testResponse = await axios.post(`${BASE_URL}/api/ai/analyze-patient`, {
                        patientId: 'test',
                        serverUrl: 'https://hapi.fhir.org/baseR4',
                        patientData: {
                            patient: { id: 'test', name: [{ family: 'Test' }] },
                            conditions: [],
                            observations: [],
                            medications: [],
                            encounters: []
                        }
                    }, {
                        timeout: 30000
                    });
                    
                    if (testResponse.data.success) {
                        if (testResponse.data.analysis.includes('📋 Résumé Médical de Base')) {
                            console.log('⚠️ Utilise le fallback (IA non accessible)');
                        } else {
                            console.log('✅ Fournisseur IA répond correctement');
                        }
                    } else {
                        console.log('❌ Erreur:', testResponse.data.message);
                    }
                } catch (testError) {
                    console.log('❌ Erreur de test:', testError.message);
                }
                
            } else {
                console.log('❌ Aucun fournisseur actif');
            }
        } catch (activeError) {
            console.log('❌ Impossible de vérifier le fournisseur actif:', activeError.message);
        }
        
        // 3. Recommandations
        console.log('\n💡 Recommandations:');
        
        if (!providersResponse.data.success || !providersResponse.data.data || providersResponse.data.data.length === 0) {
            console.log('1. Configurer au moins un fournisseur IA dans les paramètres');
            console.log('   → Accéder à: http://localhost:5000/ai-providers.html');
        } else {
            const activeProviders = providersResponse.data.data.filter(p => p.is_active || p.enabled);
            if (activeProviders.length === 0) {
                console.log('1. Activer au moins un fournisseur IA');
            }
            
            const providersWithoutKey = activeProviders.filter(p => !p.api_key || p.api_key.trim() === '');
            if (providersWithoutKey.length > 0) {
                console.log('2. Configurer les clés API pour les fournisseurs actifs:');
                providersWithoutKey.forEach(p => {
                    console.log(`   → ${p.provider_type}: Ajouter une clé API valide`);
                });
            }
        }
        
        console.log('\n📚 Guide de configuration:');
        console.log('• Mistral AI: Obtenir une clé sur https://console.mistral.ai/');
        console.log('• OpenAI: Obtenir une clé sur https://platform.openai.com/');
        console.log('• Ollama: Installer localement et utiliser http://localhost:11434');
        
    } catch (error) {
        console.error('❌ Erreur lors du diagnostic:', error.message);
        console.log('\nVérifiez que FHIRHub est démarré sur', BASE_URL);
    }
}

// Exécuter le diagnostic
if (require.main === module) {
    checkAIStatus().catch(error => {
        console.error('Erreur fatale:', error);
        process.exit(1);
    });
}

module.exports = { checkAIStatus };