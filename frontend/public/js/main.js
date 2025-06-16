/**
 * Script principal de l'interface FHIRHub
 * Gère les interactions de l'interface utilisateur
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialisation
  console.log('FHIRHub Interface initialisée');
  
  // Éléments DOM
  const convertButton = document.getElementById('convertButton');
  const copyButton = document.getElementById('copyButton');
  const downloadButton = document.getElementById('downloadButton');
  const fileInput = document.getElementById('fileInput');
  const hl7Input = document.getElementById('hl7Input');
  const fhirOutput = document.getElementById('fhirOutput');
  const conversionLogs = document.getElementById('conversionLogs');
  const tabs = document.querySelectorAll('li[data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Navigation entre les onglets
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Désactiver tous les onglets
      tabs.forEach(t => t.classList.remove('tab-active'));
      tabs.forEach(t => t.classList.add('border-transparent'));
      
      // Activer l'onglet cliqué
      tab.classList.add('tab-active');
      tab.classList.remove('border-transparent');
      
      // Masquer tous les contenus d'onglet
      tabContents.forEach(content => content.classList.add('hidden'));
      
      // Afficher le contenu de l'onglet sélectionné
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.remove('hidden');
    });
  });
  
  // Appliquer un correctif pour éviter la perte de focus des champs texte
  // (Problème identifié dans les tests précédents)
  function applyInputFieldsFix() {
    console.log('Application du correctif pour les champs texte');
    const textareas = document.querySelectorAll('textarea');
    const inputs = document.querySelectorAll('input[type="text"]');
    
    const elements = [...textareas, ...inputs];
    let fixedCount = 0;
    
    elements.forEach(element => {
      // Sauvegarder la position du curseur avant le clic
      element.addEventListener('mousedown', function(e) {
        if (this === document.activeElement) {
          e.stopPropagation();
        }
      });
      
      // Éviter la perte de focus sur les clics dans le champ
      element.addEventListener('click', function(e) {
        if (this === document.activeElement) {
          e.stopPropagation();
        }
      });
      
      fixedCount++;
    });
    
    console.log('Correctif appliqué à ' + fixedCount + ' champs de saisie');
  }
  
  // Correctif de navigation pour les onglets
  function applyTabNavigationFix() {
    console.log('Application du correctif de navigation des onglets');
    tabs.forEach(tab => {
      tab.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tab.click();
        }
      });
      
      // Ajouter des attributs d'accessibilité
      tab.setAttribute('role', 'tab');
      tab.setAttribute('tabindex', '0');
    });
  }
  
  // Gérer la conversion via l'API
  async function convertHL7ToFHIR(hl7Content) {
    updateLogs('Début de la conversion...');
    
    try {
      // Afficher un aperçu du contenu HL7
      const preview = hl7Content.length > 100 
        ? hl7Content.substring(0, 100) + '...' 
        : hl7Content;
      updateLogs(`Contenu HL7 à convertir (aperçu): ${preview}`);
      
      // Préparer les données pour l'API
      const data = {
        content: hl7Content,
        options: {
          validate: true
        }
      };
      
      // Appeler l'API de conversion
      updateLogs('Appel de l\'API de conversion...');
      const result = await apiRequest('convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      // Afficher le résultat
      if (result.success) {
        updateLogs(`Conversion réussie en ${result.processingTime || 'N/A'} ms`);
        fhirOutput.value = JSON.stringify(result.data, null, 2);
        return result.data;
      } else {
        updateLogs(`Erreur de conversion: ${result.message || 'Erreur inconnue'}`);
        fhirOutput.value = JSON.stringify(result, null, 2);
        return null;
      }
    } catch (error) {
      updateLogs(`Erreur lors de la conversion: ${error.message}`);
      fhirOutput.value = `Erreur: ${error.message}`;
      return null;
    }
  }
  
  // Mettre à jour les logs de conversion
  function updateLogs(message) {
    const timestamp = new Date().toLocaleTimeString();
    conversionLogs.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    conversionLogs.scrollTop = conversionLogs.scrollHeight;
  }
  
  // Charger le contenu d'un fichier
  function loadFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      
      reader.onerror = (e) => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };
      
      reader.readAsText(file);
    });
  }
  
  // Télécharger le résultat FHIR
  function downloadFHIR() {
    const content = fhirOutput.value;
    
    if (!content) {
      updateLogs('Rien à télécharger');
      return;
    }
    
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `conversion_fhir_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyer
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    
    updateLogs('Téléchargement du fichier FHIR');
  }
  
  // Copier le résultat FHIR dans le presse-papier
  function copyFHIR() {
    const content = fhirOutput.value;
    
    if (!content) {
      updateLogs('Rien à copier');
      return;
    }
    
    navigator.clipboard.writeText(content)
      .then(() => {
        updateLogs('Contenu FHIR copié dans le presse-papier');
      })
      .catch(err => {
        updateLogs(`Erreur lors de la copie: ${err.message}`);
      });
  }
  
  // Event listeners
  convertButton.addEventListener('click', async () => {
    const content = hl7Input.value.trim();
    
    if (!content) {
      updateLogs('Veuillez entrer un message HL7');
      return;
    }
    
    await convertHL7ToFHIR(content);
  });
  
  copyButton.addEventListener('click', copyFHIR);
  downloadButton.addEventListener('click', downloadFHIR);
  
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    updateLogs(`Fichier sélectionné: ${file.name} (${(file.size / 1024).toFixed(2)} Ko)`);
    
    try {
      const content = await loadFile(file);
      hl7Input.value = content;
      updateLogs('Fichier chargé avec succès');
    } catch (error) {
      updateLogs(`Erreur lors du chargement du fichier: ${error.message}`);
    }
  });
  
  // Appliquer les correctifs
  applyInputFieldsFix();
  applyTabNavigationFix();
  
  // Charger les statistiques pour le dashboard
  async function loadStats() {
    try {
      const stats = await apiRequest('stats');
      console.log('Statistiques chargées:', stats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }
  
  // Charger l'historique des conversions
  async function loadHistory() {
    try {
      const history = await apiRequest('conversions');
      console.log('Historique chargé:', history);
    } catch (error) {
      console.error('Error fetching conversion history:', error);
    }
  }
  
  // Charger les données initiales
  loadStats();
  loadHistory();
  
  // Vérifier la santé de l'API
  apiRequest('health')
    .then(response => {
      console.log('API health check:', response);
    })
    .catch(error => {
      console.error('API request failed:', error.message);
    });
  
  // Définir un exemple HL7 pour faciliter les tests
  const exampleHL7 = `MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230815131519||ADT^A01|MSG00001|P|2.5.1
EVN|A01|20230815131519
PID|1||123456789^^^^PI||DUPONT^JEAN PIERRE MARIE^JEAN PIERRE MARIE^^^^L||19800101|M|||1 RUE DE LA PAIX^^PARIS^^75001^FRA^H||^PRN^PH^^^33^0123456789|||M|||||||||||
NK1|1|DUPONT^MARIE^^^^^L|ÉPOUSE|1 RUE DE LA PAIX^^PARIS^^75001^FRA^H|^PRN^PH^^^33^0123456789
PV1|1|I|MED^1001^01||||002^MARTIN^SOPHIE^^^^MD^^^DRSN||||||||||||V100|||||||||||||||||||||||20230815131519
OBR|1|12345|67890|80048^BASIC METABOLIC PANEL^CPT4|||20230815131519||||||||002^MARTIN^SOPHIE^^^^MD^^^DRSN||||||||LAB||||F
OBX|1|NM|2160-0^CREATININE^LN||1.2|mg/dL|0.7-1.5|N|||F|||20230815131519
OBX|2|NM|2951-2^SODIUM^LN||140|mmol/L|135-145|N|||F|||20230815131519
OBX|3|NM|3094-0^UREA NITROGEN^LN||18|mg/dL|8-25|N|||F|||20230815131519`;
  
  // Ajouter un exemple HL7 par défaut si le champ est vide
  if (!hl7Input.value) {
    hl7Input.value = exampleHL7;
    updateLogs('Exemple HL7 chargé pour faciliter les tests');
  }
  
  // Activer la validation des formulaires
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      if (!form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      form.classList.add('was-validated');
    });
  });
  
  // Mettre à jour les logs périodiquement pour montrer que l'interface est fonctionnelle
  setInterval(() => {
    applyTabNavigationFix();
    applyInputFieldsFix();
  }, 2000);
});