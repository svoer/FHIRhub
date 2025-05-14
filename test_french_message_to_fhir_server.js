/**
 * Script pour tester la conversion d'un message HL7 français en FHIR
 * et l'envoi du bundle résultant au serveur HAPI FHIR public
 * 
 * Exécuter avec: node test_french_message_to_fhir_server.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const hl7Parser = require('./hl7Parser');
const hl7Converter = require('./hl7ToFhirAdvancedConverter');

// Chemin du message HL7 français de test
const TEST_MESSAGE_PATH = path.join(__dirname, 'test_data', 'message_hl7_french_test.txt');

// Configuration du serveur FHIR
const FHIR_SERVER_URL = 'https://hapi.fhir.org/baseR4';

// Modifier les bundles pour qu'ils utilisent transaction au lieu de collection
function prepareBundleForTransaction(bundle) {
  // Copier le bundle pour éviter de modifier l'original
  const transactionBundle = JSON.parse(JSON.stringify(bundle));
  
  // Transformer en bundle de type transaction
  transactionBundle.type = 'transaction';
  
  // S'assurer que chaque entrée a une section "request" appropriée
  transactionBundle.entry.forEach(entry => {
    if (!entry.request) {
      entry.request = {
        method: 'POST',
        url: entry.resource.resourceType
      };
    }
  });
  
  return transactionBundle;
}

// Fonction pour envoyer un bundle au serveur FHIR
async function sendBundleToFhirServer(bundle) {
  try {
    console.log(`Envoi d'un bundle contenant ${bundle.entry.length} ressources au serveur FHIR...`);
    
    const response = await axios.post(FHIR_SERVER_URL, bundle, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      },
      timeout: 30000 // Timeout plus long pour les gros bundles
    });
    
    console.log(`Bundle envoyé avec succès! Statut: ${response.status}`);
    
    // Vérifier la réponse
    if (response.data && response.data.resourceType === 'Bundle') {
      console.log('Réponse du serveur FHIR:');
      console.log(`- Type de réponse: ${response.data.type}`);
      console.log(`- Nombre d'entrées: ${response.data.entry ? response.data.entry.length : 0}`);
      
      // Vérifier les statuts de création des ressources
      if (response.data.entry && response.data.entry.length > 0) {
        const statusCounts = {};
        
        response.data.entry.forEach(entry => {
          if (entry.response && entry.response.status) {
            const status = entry.response.status.split(' ')[0]; // Prendre juste le code numérique
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          }
        });
        
        console.log('Statuts des ressources créées:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`- ${status}: ${count}`);
        });
      }
      
      // Enregistrer la réponse pour inspection
      const outputPath = path.join(__dirname, 'test_data', 'french_fhir_response.json');
      fs.writeFileSync(outputPath, JSON.stringify(response.data, null, 2));
      console.log(`Réponse complète enregistrée dans ${outputPath}`);
      
      return true;
    } else {
      console.error('Format de réponse inattendu:', response.data);
      return false;
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi au serveur FHIR:', error.message);
    
    if (error.response) {
      console.error('Détails de l\'erreur:', error.response.data);
      
      // Enregistrer l'erreur pour analyse
      const errorPath = path.join(__dirname, 'test_data', 'french_fhir_error.json');
      fs.writeFileSync(errorPath, JSON.stringify(error.response.data, null, 2));
      console.log(`Détails de l'erreur enregistrés dans ${errorPath}`);
    }
    
    return false;
  }
}

// Fonction principale
async function convertAndSendFrenchHL7() {
  console.log('=== Test de conversion et envoi d\'un message HL7 français ===');
  
  try {
    // Vérifier si le répertoire test_data existe, sinon le créer
    const testDataDir = path.join(__dirname, 'test_data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    // Écrire le message HL7 de test s'il n'existe pas
    // Utiliser le message stocké dans tes assets
    const sampleMessagePath = path.join(__dirname, 'attached_assets', 'Pasted-MSH-MEDSPHERE-MEDSPHERE-ATHENEA-ATHENEA-202407311016-ADT-A01-ADT-A01-20240731101609948-P-2-5-F-1747233930413.txt');
    
    if (fs.existsSync(sampleMessagePath) && !fs.existsSync(TEST_MESSAGE_PATH)) {
      fs.copyFileSync(sampleMessagePath, TEST_MESSAGE_PATH);
      console.log('Message HL7 de test copié depuis les assets');
    }
    
    // S'assurer que le fichier existe
    if (!fs.existsSync(TEST_MESSAGE_PATH)) {
      throw new Error(`Fichier de message HL7 introuvable: ${TEST_MESSAGE_PATH}`);
    }
    
    // Lire le fichier du message HL7
    const hl7Message = fs.readFileSync(TEST_MESSAGE_PATH, 'utf8');
    console.log('Message HL7 chargé, longueur:', hl7Message.length, 'caractères');
    
    // Segmentation basique
    const segments = hl7Message.split('\n').filter(s => s.trim());
    console.log('Nombre de segments dans le message:', segments.length);
    
    // Vérifier les segments Z (français)
    const zSegments = segments.filter(s => s.startsWith('Z'));
    console.log('Segments Z détectés:', zSegments.length);
    console.log('Types de segments Z:', zSegments.map(s => s.split('|')[0]).join(', '));
    
    // Parser le message HL7 avec notre parser amélioré
    console.log('\n=== Analyse du message HL7 français ===');
    const parsedMessage = hl7Parser.parseHL7Message(hl7Message);
    console.log('Encodage du message:', parsedMessage.isFrencHL7 ? 'Français' : 'Standard');
    
    // Convertir le message HL7 en FHIR
    console.log('\n=== Conversion du message HL7 en FHIR ===');
    const startTime = Date.now();
    const fhirBundle = hl7Converter.convertHL7ToFHIR(hl7Message);
    const endTime = Date.now();
    
    console.log('Conversion terminée en', (endTime - startTime), 'ms');
    console.log('Nombre de ressources dans le bundle FHIR:', fhirBundle.entry.length);
    
    // Afficher la liste des types de ressources générés
    const resourceTypes = fhirBundle.entry.map(e => e.resource.resourceType);
    const resourceTypeCount = {};
    resourceTypes.forEach(type => {
      resourceTypeCount[type] = (resourceTypeCount[type] || 0) + 1;
    });
    
    console.log('\n=== Types de ressources générées ===');
    Object.entries(resourceTypeCount).forEach(([type, count]) => {
      console.log(`- ${type}: ${count}`);
    });
    
    // Sauvegarder le bundle FHIR généré pour inspection
    const outputPath = path.join(__dirname, 'test_data', 'french_fhir_output.json');
    fs.writeFileSync(outputPath, JSON.stringify(fhirBundle, null, 2));
    console.log('\nBundle FHIR sauvegardé dans', outputPath);
    
    // Préparer le bundle pour l'envoi
    const transactionBundle = prepareBundleForTransaction(fhirBundle);
    console.log('\n=== Préparation du bundle pour envoi ===');
    console.log('Type original du bundle:', fhirBundle.type);
    console.log('Type du bundle pour transaction:', transactionBundle.type);
    
    // Sauvegarder le bundle préparé
    const transactionPath = path.join(__dirname, 'test_data', 'french_fhir_transaction.json');
    fs.writeFileSync(transactionPath, JSON.stringify(transactionBundle, null, 2));
    console.log('Bundle préparé sauvegardé dans', transactionPath);
    
    // Envoyer le bundle au serveur FHIR
    console.log('\n=== Envoi du bundle au serveur FHIR ===');
    const success = await sendBundleToFhirServer(transactionBundle);
    
    if (success) {
      console.log('\n✅ Le bundle a été envoyé avec succès au serveur FHIR');
    } else {
      console.log('\n❌ Échec de l\'envoi du bundle au serveur FHIR');
    }
    
  } catch (error) {
    console.error('ERREUR:', error.message);
    console.error(error.stack);
  }
}

// Exécuter la fonction principale
convertAndSendFrenchHL7();