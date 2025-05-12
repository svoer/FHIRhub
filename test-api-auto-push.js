/**
 * Script de test pour la fonctionnalité d'auto-push des API FHIR
 * Ce script permet de vérifier que l'auto-push fonctionne correctement
 * avec différentes méthodes (paramètre URL vs API key)
 */

const axios = require('axios');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require('./src/database');
const { hashValue } = require('./utils/crypto');

// Configuration du test
const config = {
  baseUrl: 'http://localhost:5000',
  apiEndpoint: '/api/convert/raw',
  sampleHl7Path: './samples/hl7/sample-adt-a01.hl7',
  logResults: true,
  apiKeys: []
};

// Charger le message HL7 d'exemple
function loadSampleHl7Message() {
  try {
    if (fs.existsSync(config.sampleHl7Path)) {
      return fs.readFileSync(config.sampleHl7Path, 'utf8');
    } else {
      console.error(`Fichier d'exemple HL7 non trouvé: ${config.sampleHl7Path}`);
      // Message HL7 minimal pour le test si l'exemple n'est pas disponible
      return 'MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230101120000||ADT^A01|MSG00001|P|2.5.1\r' +
             'PID|||12345^^^MRN||DOE^JOHN^||19800101|M|||\r' +
             'PV1||O|||||||||||||||||12345|||||||||||||||||||||||||20230101120000|';
    }
  } catch (error) {
    console.error('Erreur lors du chargement du message HL7:', error);
    process.exit(1);
  }
}

// Récupérer les clés API depuis la base de données
function loadApiKeys() {
  try {
    const keys = db.prepare(`
      SELECT ak.*, a.name as application_name 
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      WHERE ak.status = 'active'
    `).all();
    
    if (keys && keys.length > 0) {
      return keys.map(key => ({
        id: key.id,
        key: key.key_value,
        app: key.application_name,
        autoPush: key.auto_push === 1
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Erreur lors de la récupération des clés API:', error);
    return [];
  }
}

// Créer une clé API de test avec auto-push activé si nécessaire
async function createTestApiKey(autoPush = true) {
  try {
    // Vérifier si une application de test existe déjà
    let app = db.prepare(`
      SELECT * FROM applications WHERE name = 'Test Auto-Push'
    `).get();
    
    // Créer l'application si elle n'existe pas
    if (!app) {
      const result = db.prepare(`
        INSERT INTO applications (name, description, status, created_at)
        VALUES ('Test Auto-Push', 'Application de test pour auto-push API', 'active', datetime('now'))
      `).run();
      
      app = { id: result.lastInsertRowid };
    }
    
    // Générer une nouvelle clé API
    const keyValue = uuidv4();
    const hashedKey = hashValue(keyValue);
    
    // Insérer la clé API dans la base de données
    db.prepare(`
      INSERT INTO api_keys (
        application_id, key_value, hashed_key, description, 
        status, auto_push, usage_count, created_at, last_used_at
      )
      VALUES (?, ?, ?, ?, 'active', ?, 0, datetime('now'), NULL)
    `).run(
      app.id, 
      keyValue,
      hashedKey,
      'Clé de test pour auto-push API',
      autoPush ? 1 : 0
    );
    
    console.log(`Clé API de test créée: ${keyValue}`);
    return keyValue;
  } catch (error) {
    console.error('Erreur lors de la création de la clé API de test:', error);
    return null;
  }
}

// Tester l'auto-push avec un paramètre URL
async function testAutoPushWithUrlParam() {
  const hl7Message = loadSampleHl7Message();
  console.log('Test de l\'auto-push avec paramètre URL (autoPush=true)...');
  
  try {
    const response = await axios({
      method: 'post',
      url: `${config.baseUrl}${config.apiEndpoint}?autoPush=true`,
      data: hl7Message,
      headers: { 'Content-Type': 'text/plain' }
    });
    
    if (response.status === 200) {
      console.log('✅ Requête réussie');
      
      if (response.headers['x-fhir-push-status']) {
        console.log(`✅ Statut de l'auto-push: ${response.headers['x-fhir-push-status']}`);
        return true;
      } else {
        console.log('❌ Aucun en-tête de statut d\'auto-push trouvé');
        return false;
      }
    } else {
      console.error(`❌ Échec de la requête: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur lors du test avec paramètre URL:', error.message);
    return false;
  }
}

// Tester l'auto-push avec une clé API
async function testAutoPushWithApiKey(apiKey) {
  const hl7Message = loadSampleHl7Message();
  console.log(`Test de l'auto-push avec clé API: ${apiKey.substring(0, 8)}...`);
  
  try {
    const response = await axios({
      method: 'post',
      url: `${config.baseUrl}${config.apiEndpoint}`,
      data: hl7Message,
      headers: { 
        'Content-Type': 'text/plain',
        'X-API-Key': apiKey
      }
    });
    
    if (response.status === 200) {
      console.log('✅ Requête réussie');
      
      if (response.headers['x-fhir-push-status']) {
        console.log(`✅ Statut de l'auto-push: ${response.headers['x-fhir-push-status']}`);
        return true;
      } else {
        console.log('❌ Aucun en-tête de statut d\'auto-push trouvé');
        return false;
      }
    } else {
      console.error(`❌ Échec de la requête: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur lors du test avec clé API:', error.message);
    return false;
  }
}

// Fonction principale
async function main() {
  console.log('=== Test de la fonctionnalité d\'auto-push API ===');
  
  // Récupérer les clés API existantes
  console.log('1. Vérification des clés API existantes...');
  config.apiKeys = loadApiKeys();
  
  if (config.apiKeys.length > 0) {
    console.log(`${config.apiKeys.length} clé(s) API trouvée(s)`);
  } else {
    console.log('Aucune clé API trouvée, création d\'une clé de test...');
    const testKey = await createTestApiKey(true);
    if (testKey) {
      config.apiKeys.push({
        key: testKey,
        app: 'Test Auto-Push',
        autoPush: true
      });
    }
  }
  
  // Tester l'auto-push avec paramètre URL
  console.log('\n2. Test de l\'auto-push avec paramètre URL...');
  const urlParamResult = await testAutoPushWithUrlParam();
  
  // Tester l'auto-push avec clé API
  console.log('\n3. Test de l\'auto-push avec clé API...');
  
  let apiKeyResults = [];
  
  for (const apiKey of config.apiKeys) {
    if (apiKey.autoPush) {
      const result = await testAutoPushWithApiKey(apiKey.key);
      apiKeyResults.push({
        key: apiKey.key.substring(0, 8) + '...',
        app: apiKey.app,
        success: result
      });
    } else {
      console.log(`Clé API ${apiKey.key.substring(0, 8)}... ignorée (auto-push désactivé)`);
    }
  }
  
  // Afficher le résumé des tests
  console.log('\n=== Résumé des tests ===');
  console.log(`Auto-push avec paramètre URL: ${urlParamResult ? '✅ Succès' : '❌ Échec'}`);
  
  if (apiKeyResults.length > 0) {
    console.log('Auto-push avec clé API:');
    for (const result of apiKeyResults) {
      console.log(`- ${result.app} (${result.key}): ${result.success ? '✅ Succès' : '❌ Échec'}`);
    }
  } else {
    console.log('Auto-push avec clé API: ❓ Non testé (aucune clé compatible)');
  }
  
  console.log('\nNotes:');
  console.log('- Si les tests échouent, vérifier que le serveur HAPI FHIR est démarré.');
  console.log('- Vérifier la configuration des API keys dans la base de données.');
}

// Exécuter le script
main();