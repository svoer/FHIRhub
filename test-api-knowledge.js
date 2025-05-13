/**
 * Test pour vérifier les API d'accès à la base de connaissances
 * Cet outil permet de tester toutes les routes d'API de connaissances utilisées par le chatbot
 */

const axios = require('axios');

// Configuration
const baseUrl = 'http://localhost:5000'; // URL de base
const searchQuery = 'conversion hl7 fhir';

// Fonction utilitaire pour afficher les résultats formatés
function prettyPrint(title, data) {
    console.log('\n===== ' + title + ' =====');
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(title.length + 12) + '\n');
}

// Test 1: Obtenir la liste des FAQ
async function testFaqEndpoint() {
    try {
        console.log('Test 1: Récupération des FAQ...');
        const response = await axios.get(`${baseUrl}/api/ai-knowledge/faq`);
        
        if (response.data && response.data.success) {
            console.log('✅ FAQ récupérées avec succès!');
            console.log(`   ${response.data.faq?.length || 0} FAQ disponibles.`);
            
            // Afficher les 3 premières FAQ pour vérification
            if (response.data.faq && response.data.faq.length > 0) {
                prettyPrint('Échantillon de FAQ', response.data.faq.slice(0, 3));
            }
        } else {
            console.error('❌ Échec de récupération des FAQ:', response.data?.message || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('❌ Erreur lors du test FAQ:', error.message);
        if (error.response) {
            console.error('   Détails:', error.response.data);
        }
    }
}

// Test 2: Obtenir la liste des fonctionnalités
async function testFeaturesEndpoint() {
    try {
        console.log('Test 2: Récupération des fonctionnalités...');
        const response = await axios.get(`${baseUrl}/api/ai-knowledge/features`);
        
        if (response.data && response.data.success) {
            console.log('✅ Fonctionnalités récupérées avec succès!');
            console.log(`   ${response.data.features?.length || 0} fonctionnalités disponibles.`);
            
            // Afficher les 3 premières fonctionnalités pour vérification
            if (response.data.features && response.data.features.length > 0) {
                prettyPrint('Échantillon de fonctionnalités', response.data.features.slice(0, 3));
            }
        } else {
            console.error('❌ Échec de récupération des fonctionnalités:', response.data?.message || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('❌ Erreur lors du test des fonctionnalités:', error.message);
        if (error.response) {
            console.error('   Détails:', error.response.data);
        }
    }
}

// Test 3: Obtenir la liste des commandes
async function testCommandsEndpoint() {
    try {
        console.log('Test 3: Récupération des commandes...');
        const response = await axios.get(`${baseUrl}/api/ai-knowledge/commands`);
        
        if (response.data && response.data.success) {
            console.log('✅ Commandes récupérées avec succès!');
            console.log(`   ${response.data.commands?.length || 0} commandes disponibles.`);
            
            // Afficher les 3 premières commandes pour vérification
            if (response.data.commands && response.data.commands.length > 0) {
                prettyPrint('Échantillon de commandes', response.data.commands.slice(0, 3));
            }
        } else {
            console.error('❌ Échec de récupération des commandes:', response.data?.message || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('❌ Erreur lors du test des commandes:', error.message);
        if (error.response) {
            console.error('   Détails:', error.response.data);
        }
    }
}

// Test 4: Recherche d'informations (GET)
async function testSearchEndpoint() {
    try {
        console.log(`Test 4: Recherche d'informations pour "${searchQuery}"...`);
        const response = await axios.get(`${baseUrl}/api/ai-knowledge/search?query=${encodeURIComponent(searchQuery)}`);
        
        if (response.data && response.data.success) {
            console.log('✅ Recherche effectuée avec succès!');
            console.log(`   ${response.data.results?.length || 0} résultats trouvés.`);
            
            // Afficher les résultats pour vérification
            if (response.data.results && response.data.results.length > 0) {
                prettyPrint('Résultats de recherche', response.data.results);
            }
        } else {
            console.error('❌ Échec de la recherche:', response.data?.message || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('❌ Erreur lors du test de recherche:', error.message);
        if (error.response) {
            console.error('   Détails:', error.response.data);
        }
    }
}

// Test 5: Récupération de la base complète
async function testFullEndpoint() {
    try {
        console.log('Test 5: Récupération de la base de connaissances complète...');
        const response = await axios.get(`${baseUrl}/api/ai-knowledge/full`);
        
        if (response.data && response.data.success) {
            console.log('✅ Base de connaissances récupérée avec succès!');
            const stats = {
                faq: response.data.knowledgeBase?.faq?.length || 0,
                features: response.data.knowledgeBase?.features?.length || 0,
                commands: response.data.knowledgeBase?.commands?.length || 0,
                total: (response.data.knowledgeBase?.faq?.length || 0) + 
                       (response.data.knowledgeBase?.features?.length || 0) + 
                       (response.data.knowledgeBase?.commands?.length || 0)
            };
            console.log(`   Statistiques: ${JSON.stringify(stats)}`);
        } else {
            console.error('❌ Échec de récupération de la base complète:', response.data?.message || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('❌ Erreur lors du test de récupération complète:', error.message);
        if (error.response) {
            console.error('   Détails:', error.response.data);
        }
    }
}

// Exécuter tous les tests
async function runAllTests() {
    console.log('🔍 Démarrage des tests des API de connaissances...\n');
    
    try {
        await testFaqEndpoint();
        await testFeaturesEndpoint();
        await testCommandsEndpoint();
        await testSearchEndpoint();
        await testFullEndpoint();
        
        console.log('\n✨ Tests terminés!');
    } catch (error) {
        console.error('\n❌ Erreur globale lors des tests:', error.message);
    }
}

// Exécuter les tests
runAllTests();