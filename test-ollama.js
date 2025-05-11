/**
 * Script de test pour le client Ollama
 */
const ollamaClient = require('./utils/ollamaClient');

async function testOllamaClient() {
  console.log('Test du client Ollama...');
  
  // Vérifier si Ollama est disponible
  console.log('1. Vérification de la disponibilité d\'Ollama...');
  try {
    const isAvailable = await ollamaClient.isAvailable();
    console.log(`   Ollama disponible: ${isAvailable}`);
    
    if (!isAvailable) {
      console.log('   ⚠️ Ollama n\'est pas disponible. Assurez-vous qu\'il est en cours d\'exécution et accessible.');
      console.log('   Par défaut, Ollama est attendu sur http://localhost:11434');
      console.log('   Vous pouvez modifier cette configuration en définissant la variable d\'environnement OLLAMA_API_ENDPOINT');
      return;
    }
    
    // Récupérer les modèles disponibles
    console.log('\n2. Récupération des modèles disponibles...');
    const models = await ollamaClient.getAvailableModels();
    console.log(`   Modèles disponibles: ${models.length}`);
    models.forEach(model => {
      console.log(`   - ${model.id}: ${model.name}`);
    });
    
    // Test de génération de texte
    console.log('\n3. Test de génération de texte...');
    const testMessages = [
      { role: 'system', content: 'Vous êtes un assistant médical utile et concis.' },
      { role: 'user', content: 'Expliquez brièvement ce qu\'est le standard FHIR.' }
    ];
    
    console.log('   Envoi de la requête à Ollama...');
    console.log('   Messages:', JSON.stringify(testMessages, null, 2));
    console.log('   Patience, la génération peut prendre un moment...');
    
    const completion = await ollamaClient.generateCompletion({
      messages: testMessages,
      model: models.length > 0 ? models[0].id : 'llama3',
      temperature: 0.7,
      maxTokens: 200
    });
    
    console.log('\n   Réponse générée:');
    console.log('   ---------------');
    console.log(`   ${completion.content}`);
    console.log('   ---------------');
    console.log(`   Modèle utilisé: ${completion.model}`);
    
    console.log('\n✅ Test terminé avec succès!');
  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Exécuter le test
testOllamaClient();
