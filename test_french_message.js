/**
 * Script de test pour la conversion HL7 vers FHIR d'un message français
 * avec segments Z spécifiques français
 * 
 * Exécuter avec: node test_french_message.js
 */

const fs = require('fs');
const path = require('path');
const hl7Parser = require('./hl7Parser');
const hl7Converter = require('./hl7ToFhirAdvancedConverter');

// Chemin du message HL7 français de test
const TEST_MESSAGE_PATH = path.join(__dirname, 'test_data', 'message_hl7_french_test.txt');

// Fonction principale
async function testFrenchHL7Conversion() {
  console.log('=== Test de conversion d\'un message HL7 français avec segments Z ===');
  
  try {
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
    
  } catch (error) {
    console.error('ERREUR:', error.message);
    console.error(error.stack);
  }
}

// Exécuter le test
testFrenchHL7Conversion();