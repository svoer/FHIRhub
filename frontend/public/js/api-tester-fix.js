/**
 * Script de correctif pour le chargement des applications et clés API dans le testeur d'API
 * Ce script est complètement indépendant des autres scripts pour éviter les conflits
 */

(function() {
  'use strict';
  
  // Configuration et état
  const config = {
    apiBaseUrl: '/api',
    selectors: {
      appSelect: 'test-app-select',
      keySelect: 'test-key-select',
      apiKeyHeader: 'api-key-header',
      apiTesterTab: '.tab[data-tab="test-api"]'
    },
    delay: 1000 // Délai avant le chargement initial
  };
  
  // État
  let currentAppId = null;
  let currentApiKey = localStorage.getItem('apiKey') || 'dev-key';
  let isInitialized = false;
  
  // Fonctions utilitaires
  function log(message, data) {
    console.log(`[API-TESTER-FIX] ${message}`, data || '');
  }
  
  function error(message, data) {
    console.error(`[API-TESTER-FIX] ${message}`, data || '');
  }
  
  // Fonction pour charger les applications
  async function loadApplications() {
    log('Chargement des applications...');
    
    const appSelect = document.getElementById(config.selectors.appSelect);
    if (!appSelect) {
      error(`Sélecteur d'applications non trouvé: #${config.selectors.appSelect}`);
      return;
    }
    
    // Message de chargement
    appSelect.innerHTML = '<option value="">Chargement...</option>';
    appSelect.disabled = true;
    
    try {
      // Appel API direct
      const response = await fetch(`${config.apiBaseUrl}/applications`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      log('Applications reçues:', result);
      
      // Réinitialiser le sélecteur
      appSelect.innerHTML = '<option value="">Sélectionnez une application</option>';
      appSelect.disabled = false;
      
      if (!result || !result.data || !Array.isArray(result.data)) {
        error('Format de données invalide:', result);
        appSelect.innerHTML = '<option value="">Erreur: Format de données invalide</option>';
        return;
      }
      
      const apps = result.data;
      
      if (apps.length === 0) {
        appSelect.innerHTML = '<option value="">Aucune application disponible</option>';
        return;
      }
      
      // Tri par nom
      apps.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      // Ajouter les options
      apps.forEach(app => {
        if (!app || !app.id) return;
        
        const option = document.createElement('option');
        option.value = app.id;
        option.textContent = app.name || `Application #${app.id}`;
        appSelect.appendChild(option);
      });
      
      log(`${apps.length} applications chargées`);
      
      // Ajouter l'événement de changement (une seule fois)
      if (!appSelect.getAttribute('data-has-event')) {
        appSelect.addEventListener('change', function() {
          const appId = this.value;
          if (appId) {
            currentAppId = appId;
            loadApiKeys(appId);
          }
        });
        appSelect.setAttribute('data-has-event', 'true');
      }
    } catch (err) {
      error('Erreur lors du chargement des applications:', err);
      appSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      appSelect.disabled = false;
    }
  }
  
  // Fonction pour charger les clés API
  async function loadApiKeys(appId) {
    if (!appId) return;
    
    log(`Chargement des clés API pour l'application ${appId}...`);
    
    const keySelect = document.getElementById(config.selectors.keySelect);
    if (!keySelect) {
      error(`Sélecteur de clés API non trouvé: #${config.selectors.keySelect}`);
      return;
    }
    
    // Message de chargement
    keySelect.innerHTML = '<option value="">Chargement...</option>';
    keySelect.disabled = true;
    
    try {
      // Appel API direct
      const response = await fetch(`${config.apiBaseUrl}/keys?appId=${appId}`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      log('Clés API reçues:', result);
      
      // Réinitialiser le sélecteur
      keySelect.innerHTML = '<option value="">Sélectionnez une clé API</option>';
      keySelect.disabled = false;
      
      if (!result || !result.data || !Array.isArray(result.data)) {
        error('Format de données de clés API invalide:', result);
        keySelect.innerHTML = '<option value="">Erreur: Format de données invalide</option>';
        return;
      }
      
      const keys = result.data;
      
      if (keys.length === 0) {
        keySelect.innerHTML = '<option value="">Aucune clé disponible</option>';
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
      
      log(`${keys.length} clés API chargées`);
      
      // Ajouter l'événement de changement (une seule fois)
      if (!keySelect.getAttribute('data-has-event')) {
        keySelect.addEventListener('change', function() {
          const selectedKey = this.value;
          if (selectedKey) {
            currentApiKey = selectedKey;
            
            // Mettre à jour l'en-tête API key
            const apiKeyHeader = document.getElementById(config.selectors.apiKeyHeader);
            if (apiKeyHeader) {
              apiKeyHeader.value = selectedKey;
            }
          }
        });
        keySelect.setAttribute('data-has-event', 'true');
      }
    } catch (err) {
      error('Erreur lors du chargement des clés API:', err);
      keySelect.innerHTML = '<option value="">Erreur de chargement</option>';
      keySelect.disabled = false;
    }
  }
  
  // Fonction d'initialisation
  function initialize() {
    if (isInitialized) return;
    
    log('Initialisation du correctif pour le testeur d\'API...');
    
    // Attacher l'événement à l'onglet API Tester
    const apiTesterTab = document.querySelector(config.selectors.apiTesterTab);
    if (apiTesterTab) {
      apiTesterTab.addEventListener('click', function() {
        setTimeout(loadApplications, 300);
      });
      log('Événement attaché à l\'onglet API Tester');
    } else {
      error('Onglet API Tester non trouvé');
    }
    
    // Charger les applications si on est déjà sur l'onglet
    if (apiTesterTab && apiTesterTab.classList.contains('active')) {
      setTimeout(loadApplications, 300);
    }
    
    isInitialized = true;
  }
  
  // Charger le script après que tout le DOM soit chargé
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(() => {
        initialize();
        // Essayer de charger immédiatement les applications
        setTimeout(loadApplications, 500);
      }, config.delay);
    });
  } else {
    setTimeout(() => {
      initialize();
      // Essayer de charger immédiatement les applications
      setTimeout(loadApplications, 500);
    }, config.delay);
  }
  
  // Ajouter un bouton de secours pour recharger les applications
  setTimeout(() => {
    const appSelect = document.getElementById(config.selectors.appSelect);
    if (appSelect && appSelect.innerHTML === '') {
      // Si le sélecteur est vide après 5 secondes, ajouter un bouton de secours
      const container = appSelect.parentElement;
      if (container) {
        const button = document.createElement('button');
        button.className = 'refresh-button';
        button.textContent = 'Rafraîchir les applications';
        button.style.marginLeft = '10px';
        button.addEventListener('click', loadApplications);
        container.appendChild(button);
      }
    }
  }, 5000);
  
  // Exposer quelques fonctions pour le débogage et l'accès direct
  window.apiTesterFix = {
    loadApplications,
    loadApiKeys,
    init: initialize,
    reloadApps: loadApplications
  };
})();