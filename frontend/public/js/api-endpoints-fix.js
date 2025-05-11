/**
 * Correctif pour les endpoints dans le testeur d'API
 * Fixe les problèmes liés aux endpoints prédéfinis
 */

(function() {
  'use strict';
  
  // Configuration
  const config = {
    selectors: {
      endpointsList: '.endpoints-list',
      endpointInput: '#endpoint-input',
      methodSelect: '#request-method',
      requestBody: '#request-body'
    },
    delay: 1000 // Délai avant initialisation
  };
  
  // État
  let isInitialized = false;
  
  // Journalisation
  function log(message, data) {
    console.log(`[API-ENDPOINTS-FIX] ${message}`, data || '');
  }
  
  function error(message, data) {
    console.error(`[API-ENDPOINTS-FIX] ${message}`, data || '');
  }
  
  // Fonction d'initialisation des gestionnaires d'événements pour les endpoints
  function initEndpointEvents() {
    log('Initialisation des gestionnaires d\'événements pour les endpoints...');
    
    const endpointsList = document.querySelector(config.selectors.endpointsList);
    
    if (!endpointsList) {
      error('Liste des endpoints non trouvée');
      return;
    }
    
    const endpointItems = endpointsList.querySelectorAll('.endpoint-item');
    
    if (!endpointItems || endpointItems.length === 0) {
      error('Aucun endpoint trouvé dans la liste');
      return;
    }
    
    log(`${endpointItems.length} boutons d'endpoint trouvés`);
    
    endpointItems.forEach(item => {
      // Remplacer le gestionnaire d'événement onclick
      item.removeAttribute('onclick');
      
      item.addEventListener('click', function() {
        const method = this.getAttribute('data-method');
        const endpoint = this.getAttribute('data-endpoint');
        
        if (!method || !endpoint) {
          error('Données d\'endpoint manquantes');
          return;
        }
        
        log(`Endpoint sélectionné: ${method} ${endpoint}`);
        
        // Définir la méthode
        const methodSelect = document.querySelector(config.selectors.methodSelect);
        if (methodSelect) {
          methodSelect.value = method;
        }
        
        // Définir l'URL - importante: ne pas préfixer avec /api/
        const endpointInput = document.querySelector(config.selectors.endpointInput);
        if (endpointInput) {
          endpointInput.value = endpoint;
          
          // Déclencher un événement input pour les autres scripts qui écoutent
          const inputEvent = new Event('input', { bubbles: true });
          endpointInput.dispatchEvent(inputEvent);
          log('Événement input déclenché sur le champ URL');
        }
        
        // Si c'est un POST ou PUT, préremplir le corps et activer l'onglet de corps
        if (method === 'POST' || method === 'PUT') {
          // Activer l'onglet de corps
          const bodyTab = document.querySelector('.tab[data-tab="body"]');
          if (bodyTab) {
            bodyTab.click();
          }
          
          // Préremplir le corps en fonction de l'endpoint
          const requestBody = document.querySelector(config.selectors.requestBody);
          
          if (requestBody) {
            if (endpoint === 'convert') {
              requestBody.value = JSON.stringify({
                content: 'MSH|^~\\&|SENDING_APPLICATION|SENDING_FACILITY|RECEIVING_APPLICATION|RECEIVING_FACILITY|20230816084700||ADT^A01|MSG000001|P|2.5',
                options: {
                  validate: true
                }
              }, null, 2);
            } else if (endpoint === 'keys') {
              requestBody.value = JSON.stringify({
                name: "Nouvelle clé",
                appId: 1,
                description: "Clé créée depuis le testeur d'API"
              }, null, 2);
            } else {
              requestBody.value = JSON.stringify({
                // Corps par défaut
              }, null, 2);
            }
          }
        }
      });
    });
    
    log('Gestionnaires d\'événements pour les endpoints initialisés avec succès');
  }
  
  // Fonction principale d'initialisation
  function initialize() {
    if (isInitialized) {
      log('Déjà initialisé');
      return;
    }
    
    log('Initialisation du correctif pour les endpoints d\'API...');
    
    // Initialiser les événements des endpoints
    initEndpointEvents();
    
    isInitialized = true;
  }
  
  // Initialisation au chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initialize, config.delay);
    });
  } else {
    setTimeout(initialize, config.delay);
  }
  
  // Ré-initialisation toutes les 5 secondes pour s'assurer que tout est bien en place
  setInterval(function() {
    isInitialized = false;
    initialize();
  }, 5000);
  
  // Exposition pour l'utilisation externe
  window.apiEndpointsFix = {
    init: initialize
  };
})();