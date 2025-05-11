/**
 * Script pour tester la connexion aux serveurs FHIR
 * Usage: node check-fhir-server.js [url]
 * 
 * Si aucune URL n'est fournie, le script teste la connexion au serveur HAPI FHIR local
 * (http://localhost:8080/fhir) et au serveur HAPI FHIR public (https://hapi.fhir.org/baseR4)
 */

const axios = require('axios');

// Configuration
const DEFAULT_URLS = [
  'http://localhost:8080/fhir',
  'https://hapi.fhir.org/baseR4'
];

// Fonction pour tester un serveur FHIR
async function testFhirServer(url) {
  console.log(`Vérification du serveur FHIR: ${url}`);
  
  try {
    // Récupérer le CapabilityStatement
    const response = await axios.get(`${url}/metadata`, {
      headers: {
        'Accept': 'application/fhir+json'
      },
      timeout: 10000
    });
    
    if (response.status === 200 && response.data && response.data.resourceType === 'CapabilityStatement') {
      console.log(`✅ Serveur ${url} accessible`);
      console.log(`   Version FHIR: ${response.data.fhirVersion}`);
      console.log(`   Logiciel: ${response.data.software?.name || 'Non spécifié'} ${response.data.software?.version || ''}`);
      console.log(`   Types de ressources: ${response.data.rest?.[0]?.resource?.length || 0}`);
      
      // Vérifier la disponibilité de certaines ressources
      const resourceTypes = response.data.rest?.[0]?.resource?.map(r => r.type) || [];
      
      if (resourceTypes.length > 0) {
        const commonTypes = ['Patient', 'Observation', 'Condition', 'MedicationRequest', 'Encounter'];
        
        // Vérifier si les types courants sont supportés
        const supported = commonTypes.filter(type => resourceTypes.includes(type));
        
        if (supported.length > 0) {
          console.log(`   Types communs supportés: ${supported.join(', ')}`);
        }
      }
      
      // Tester une requête simple
      try {
        console.log('\nTest d\'une requête simple pour récupérer des patients:');
        const patientResponse = await axios.get(`${url}/Patient?_count=5`, {
          headers: {
            'Accept': 'application/fhir+json'
          },
          timeout: 10000
        });
        
        if (patientResponse.status === 200 && patientResponse.data && patientResponse.data.resourceType === 'Bundle') {
          const count = patientResponse.data.entry?.length || 0;
          
          console.log(`✅ Requête réussie: ${count} patients récupérés`);
          
          if (count > 0) {
            console.log('   Premier patient:');
            const patient = patientResponse.data.entry[0].resource;
            
            console.log(`   - ID: ${patient.id}`);
            
            if (patient.name && patient.name.length > 0) {
              const name = patient.name[0];
              const nameParts = [];
              
              if (name.prefix) nameParts.push(name.prefix.join(' '));
              if (name.given) nameParts.push(name.given.join(' '));
              if (name.family) nameParts.push(name.family);
              
              console.log(`   - Nom: ${nameParts.join(' ')}`);
            }
            
            console.log(`   - Genre: ${patient.gender || 'Non spécifié'}`);
            console.log(`   - Date de naissance: ${patient.birthDate || 'Non spécifiée'}`);
          }
        } else {
          console.log(`⚠️ La requête a réussi mais avec un format de réponse inattendu: ${patientResponse.data.resourceType || 'Format inconnu'}`);
        }
      } catch (error) {
        console.log(`❌ Erreur lors de la requête Patient: ${error.message}`);
      }
      
      console.log('\nPour explorer davantage ce serveur, vous pouvez:');
      console.log(`1. Accéder à l\'interface Swagger: ${url}/swagger-ui/`);
      console.log(`2. Utiliser l\'explorateur FHIR dans l\'application FHIRHub: http://localhost:5000/direct-fhir.html`);
      
      return true;
    } else {
      console.log(`❌ Serveur ${url} accessible mais réponse invalide (statut ${response.status})`);
      console.log(`   Type de ressource reçu: ${response.data?.resourceType || 'Aucun'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Erreur lors de la connexion au serveur ${url}: ${error.message}`);
    
    if (url.includes('localhost')) {
      console.log('\nSi vous essayez de vous connecter au serveur local, assurez-vous que:');
      console.log('1. Le serveur HAPI FHIR est démarré (utilisez ./start-hapi-fhir.sh)');
      console.log('2. Le port 8080 est bien celui utilisé par votre serveur');
      console.log('3. Aucun pare-feu ne bloque l\'accès au port 8080');
    }
    
    return false;
  }
}

// Programme principal
async function main() {
  const urls = process.argv.length > 2 ? [process.argv[2]] : DEFAULT_URLS;
  let success = false;
  
  console.log('=== Test de connexion aux serveurs FHIR ===\n');
  
  for (const url of urls) {
    const result = await testFhirServer(url);
    success = success || result;
    
    if (urls.length > 1 && url !== urls[urls.length - 1]) {
      console.log('\n---\n');
    }
  }
  
  console.log('\n=== Résumé des tests ===');
  
  if (success) {
    console.log('✅ Au moins un serveur FHIR est accessible');
  } else {
    console.log('❌ Aucun serveur FHIR n\'est accessible');
    
    console.log('\nSi vous avez besoin d\'un serveur FHIR pour tester, vous pouvez:');
    console.log('1. Utiliser le serveur HAPI FHIR public: https://hapi.fhir.org/baseR4');
    console.log('2. Démarrer votre propre serveur HAPI FHIR local: ./start-hapi-fhir.sh');
    console.log('3. Configurer un autre serveur FHIR dans l\'application FHIRHub');
  }
}

main().catch(error => {
  console.error('Erreur non gérée:', error);
  process.exit(1);
});