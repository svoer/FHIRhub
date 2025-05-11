/**
 * Correctif pour la gestion des applications dans le testeur d'API
 * Ce script corrige spécifiquement l'erreur "Cannot set properties of undefined (setting 'innerHTML')"
 */

(function() {
  'use strict';
  
  // Configuration
  const config = {
    selectors: {
      appSelect: 'test-app-select',
      keySelect: 'test-key-select',
      apiKeyHeader: 'api-key-header',
      sendButton: 'send-request'
    },
    apiEndpoints: {
      applications: '/api/applications',
      keys: '/api/keys'
    },
    delay: 1000 // Délai avant initialisation
  };
  
  // État
  let isInitialized = false;
  let currentAppId = null;
  let currentApiKey = localStorage.getItem('apiKey') || 'dev-key';
  
  // Journalisation
  function log(message, data) {
    console.log(`[API-APPS-FIX] ${message}`, data || '');
  }
  
  function error(message, data) {
    console.error(`[API-APPS-FIX] ${message}`, data || '');
  }
  
  // Fonction sécurisée pour récupérer un élément DOM
  function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      error(`Élément #${id} non trouvé`);
      return {
        innerHTML: '',
        appendChild: () => {},
        addEventListener: () => {},
        value: '',
        disabled: false
      };
    }
    return element;
  }
  
  // Fonction pour effectuer une requête API
  async function makeApiRequest(endpoint, options = {}) {
    options.headers = options.headers || {};
    options.headers['x-api-key'] = currentApiKey;
    
    log(`Requête API au endpoint: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (err) {
      error(`Erreur lors de la requête à ${endpoint}:`, err);
      throw err;
    }
  }
  
  // Fonction pour charger la liste des applications
  async function loadApplications() {
    log('Chargement des applications...');
    
    const appSelect = safeGetElement(config.selectors.appSelect);
    
    // Afficher un message de chargement
    appSelect.innerHTML = '<option value="">Chargement...</option>';
    appSelect.disabled = true;
    
    try {
      const result = await makeApiRequest(config.apiEndpoints.applications);
      
      // Réinitialiser le sélecteur
      appSelect.innerHTML = '<option value="">Sélectionnez une application</option>';
      appSelect.disabled = false;
      
      if (!result || !result.data) {
        error('Données invalides reçues:', result);
        appSelect.innerHTML = '<option value="">Erreur: Données invalides</option>';
        return;
      }
      
      // S'assurer que nous avons un tableau
      const applications = Array.isArray(result.data) ? result.data : [result.data];
      
      if (applications.length === 0) {
        log('Aucune application disponible');
        appSelect.innerHTML = '<option value="">Aucune application disponible</option>';
        return;
      }
      
      // Trier les applications par nom
      applications.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      // Ajouter les options
      applications.forEach(app => {
        if (!app || !app.id) return;
        
        const option = document.createElement('option');
        option.value = app.id;
        option.textContent = app.name || `Application #${app.id}`;
        appSelect.appendChild(option);
      });
      
      log(`${applications.length} application(s) chargée(s) avec succès`);
      
      // Démonstration - sélectionner la première application si disponible
      if (applications.length > 0 && applications[0].id) {
        appSelect.value = applications[0].id;
        currentAppId = applications[0].id;
        loadApiKeys(currentAppId);
      }
    } catch (err) {
      error('Erreur lors du chargement des applications:', err);
      appSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      appSelect.disabled = false;
    }
  }
  
  // Fonction pour charger les clés API d'une application
  async function loadApiKeys(appId) {
    log(`Chargement des clés API pour l'application ${appId}...`);
    
    if (!appId) {
      error('ID d\'application invalide');
      return;
    }
    
    const keySelect = safeGetElement(config.selectors.keySelect);
    
    // Afficher un message de chargement
    keySelect.innerHTML = '<option value="">Chargement...</option>';
    keySelect.disabled = true;
    
    try {
      const result = await makeApiRequest(`${config.apiEndpoints.keys}?appId=${appId}`);
      
      // Réinitialiser le sélecteur
      keySelect.innerHTML = '<option value="">Sélectionnez une clé API</option>';
      keySelect.disabled = false;
      
      if (!result || !result.data) {
        error('Données de clés API invalides:', result);
        keySelect.innerHTML = '<option value="">Erreur: Données invalides</option>';
        return;
      }
      
      // S'assurer que nous avons un tableau
      const keys = Array.isArray(result.data) ? result.data : [result.data];
      
      if (keys.length === 0) {
        log('Aucune clé API disponible pour cette application');
        keySelect.innerHTML = '<option value="">Aucune clé disponible</option>';
        
        // Par défaut, utiliser dev-key comme fallback
        const apiKeyHeader = safeGetElement(config.selectors.apiKeyHeader);
        apiKeyHeader.value = 'dev-key';
        currentApiKey = 'dev-key';
        
        return;
      }
      
      // Ajouter les options
      keys.forEach(key => {
        if (!key) return;
        
        const keyValue = key.api_key || key.key || key.value;
        if (!keyValue) return;
        
        const option = document.createElement('option');
        option.value = keyValue;
        option.textContent = key.name || key.description || 'Clé API';
        keySelect.appendChild(option);
      });
      
      log(`${keys.length} clé(s) API chargée(s) pour l'application ${appId}`);
      
      // Sélectionner la première clé automatiquement
      if (keys.length > 0) {
        const firstKey = keys[0].api_key || keys[0].key || keys[0].value;
        if (firstKey) {
          keySelect.value = firstKey;
          currentApiKey = firstKey;
          
          // Mettre à jour l'en-tête
          const apiKeyHeader = safeGetElement(config.selectors.apiKeyHeader);
          apiKeyHeader.value = firstKey;
        }
      }
    } catch (err) {
      error(`Erreur lors du chargement des clés API pour l'application ${appId}:`, err);
      keySelect.innerHTML = '<option value="">Erreur de chargement</option>';
      keySelect.disabled = false;
    }
  }
  
  // Fonction pour initialiser les gestionnaires d'événements
  function initEvents() {
    log('Initialisation des gestionnaires d\'événements...');
    
    const appSelect = safeGetElement(config.selectors.appSelect);
    const keySelect = safeGetElement(config.selectors.keySelect);
    
    // Événement de changement d'application
    appSelect.addEventListener('change', () => {
      currentAppId = appSelect.value;
      if (currentAppId) {
        loadApiKeys(currentAppId);
      } else {
        keySelect.innerHTML = '<option value="">Sélectionnez une application d\'abord</option>';
        keySelect.disabled = true;
      }
    });
    
    // Événement de changement de clé API
    keySelect.addEventListener('change', () => {
      if (keySelect.value) {
        currentApiKey = keySelect.value;
        
        // Mettre à jour l'en-tête
        const apiKeyHeader = safeGetElement(config.selectors.apiKeyHeader);
        apiKeyHeader.value = currentApiKey;
      }
    });
    
    log('Gestionnaires d\'événements initialisés avec succès');
  }
  
  // Fonction principale d'initialisation
  function initialize() {
    if (isInitialized) {
      log('Déjà initialisé, pas besoin de réinitialiser');
      return;
    }
    
    log('Initialisation du correctif pour les applications...');
    
    setTimeout(() => {
      // Charger les applications
      loadApplications()
        .then(() => {
          // Initialiser les événements
          initEvents();
          isInitialized = true;
          log('Initialisation terminée avec succès');
        })
        .catch(err => {
          error('Erreur lors de l\'initialisation:', err);
        });
    }, config.delay);
  }
  
  // Initialiser lorsque l'onglet de test d'API devient visible
  function checkAndInitialize() {
    const testApiTab = document.getElementById('test-api-tab');
    if (testApiTab && testApiTab.classList.contains('active')) {
      log('Onglet test API détecté comme actif, initialisation...');
      initialize();
    }
  }
  
  // Initialisation au chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInitialize);
  } else {
    checkAndInitialize();
  }
  
  // Exposer la fonction d'initialisation pour une utilisation externe
  window.initApiApplications = initialize;
})();