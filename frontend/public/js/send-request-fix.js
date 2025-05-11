/**
 * Script de correctif pour les fonctionnalités de test d'API
 * Corrige les problèmes de navigation et d'envoi de requête
 */

(function() {
  'use strict';
  
  // Configuration
  const config = {
    selectors: {
      methodSelect: 'request-method',
      endpointInput: 'endpoint-input',
      sendButton: 'send-request',
      requestBody: 'request-body',
      responseBody: 'response-body',
      responseStatus: 'response-status',
      responseTime: 'response-time',
      requestTabs: '.request-tabs .tab',
      paramsContainer: '.params-container',
      headersContainer: '.headers-container'
    },
    delay: 500 // Délai d'initialisation
  };
  
  // État
  let currentApiKey = localStorage.getItem('apiKey') || 'dev-key';
  let isInitialized = false;
  
  // Fonctions utilitaires
  function log(message, data) {
    console.log(`[SEND-REQUEST-FIX] ${message}`, data || '');
  }
  
  function error(message, data) {
    console.error(`[SEND-REQUEST-FIX] ${message}`, data || '');
  }
  
  // Fonction pour initialiser les onglets de requête
  function initRequestTabs() {
    log('Initialisation des onglets de requête...');
    
    // Sélectionner tous les onglets
    const tabs = document.querySelectorAll(config.selectors.requestTabs);
    
    if (!tabs || tabs.length === 0) {
      error('Aucun onglet de requête trouvé');
      return;
    }
    
    log(`${tabs.length} onglets de requête trouvés`);
    
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Désactiver tous les onglets
        tabs.forEach(t => t.classList.remove('active'));
        
        // Désactiver tous les contenus d'onglets
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Activer l'onglet cliqué
        this.classList.add('active');
        
        // Activer le contenu correspondant
        const tabContent = document.getElementById(`${this.dataset.tab}-tab`);
        if (tabContent) {
          tabContent.classList.add('active');
          log(`Onglet ${this.dataset.tab} activé`);
        } else {
          error(`Contenu d'onglet #${this.dataset.tab}-tab non trouvé`);
        }
      });
      
      log(`Gestionnaire d'événement ajouté à l'onglet ${tab.dataset.tab}`);
    });
  }
  
  // Fonction pour initialiser le bouton d'envoi
  function initSendButton() {
    log('Initialisation du bouton d\'envoi...');
    
    const sendButton = document.getElementById(config.selectors.sendButton);
    
    if (!sendButton) {
      error('Bouton d\'envoi non trouvé');
      return;
    }
    
    // Remplacer complètement les événements existants
    sendButton.replaceWith(sendButton.cloneNode(true));
    
    // Récupérer le nouveau bouton
    const newSendButton = document.getElementById(config.selectors.sendButton);
    
    // Ajouter le nouvel événement
    newSendButton.addEventListener('click', function() {
      sendApiRequest();
    });
    
    log('Gestionnaire d\'événement ajouté au bouton d\'envoi');
  }
  
  // Fonction pour envoyer une requête API
  async function sendApiRequest() {
    log('Envoi d\'une requête API...');
    
    // Récupérer les éléments nécessaires
    const methodSelect = document.getElementById(config.selectors.methodSelect);
    const endpointInput = document.getElementById(config.selectors.endpointInput);
    const requestBody = document.getElementById(config.selectors.requestBody);
    const responseBody = document.getElementById(config.selectors.responseBody);
    const responseStatus = document.getElementById(config.selectors.responseStatus);
    const responseTime = document.getElementById(config.selectors.responseTime);
    
    if (!methodSelect || !endpointInput || !responseBody) {
      error('Éléments requis manquants');
      return;
    }
    
    // Récupérer les valeurs
    const method = methodSelect.value;
    const endpoint = endpointInput.value;
    
    // Construire les options de la requête
    const options = {
      method,
      headers: {
        'x-api-key': currentApiKey,
        'Content-Type': 'application/json'
      }
    };
    
    // Ajouter les paramètres de requête si nécessaire
    const params = {};
    const paramsContainer = document.querySelector(config.selectors.paramsContainer);
    
    if (paramsContainer) {
      paramsContainer.querySelectorAll('.param-row').forEach(row => {
        const nameInput = row.querySelector('.param-name');
        const valueInput = row.querySelector('.param-value');
        
        if (nameInput && valueInput && nameInput.value) {
          params[nameInput.value] = valueInput.value;
        }
      });
    }
    
    // Construire l'URL avec les paramètres
    // Assurer que l'endpoint ne commence pas déjà par /api/ pour éviter les doublons
    let url = endpoint.startsWith('/api/') ? endpoint : '/api/' + endpoint;
    
    // Mais si l'URL est simplement "/api/", on la normalise pour éviter un slash final en trop
    if (url === '/api/') {
      url = '/api';
    }
    
    const queryParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      queryParams.append(key, value);
    }
    
    if (queryParams.toString()) {
      url += '?' + queryParams.toString();
    }
    
    // Ajouter les en-têtes personnalisés
    const headersContainer = document.querySelector(config.selectors.headersContainer);
    
    if (headersContainer) {
      headersContainer.querySelectorAll('.header-row').forEach(row => {
        const nameInput = row.querySelector('.header-name');
        const valueInput = row.querySelector('.header-value');
        
        if (nameInput && valueInput && nameInput.value && !nameInput.disabled) {
          options.headers[nameInput.value] = valueInput.value;
        }
      });
    }
    
    // Ajouter le corps pour les méthodes non-GET
    if (method !== 'GET' && requestBody && requestBody.value) {
      try {
        const bodyObj = JSON.parse(requestBody.value);
        options.body = JSON.stringify(bodyObj);
      } catch (e) {
        options.body = requestBody.value;
      }
    }
    
    // Afficher l'état de la requête
    if (responseStatus) {
      responseStatus.textContent = 'Envoi en cours...';
      responseStatus.className = 'status-pending';
    }
    
    if (responseBody) {
      responseBody.textContent = 'Attente de la réponse...';
    }
    
    // Chronométrer la requête
    const startTime = Date.now();
    
    try {
      log(`Envoi de la requête à ${url}`, options);
      
      // Envoyer la requête
      const response = await fetch(url, options);
      
      // Calculer le temps de réponse
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (responseTime) {
        responseTime.textContent = `${duration}ms`;
      }
      
      // Afficher le statut
      if (responseStatus) {
        responseStatus.textContent = `${response.status} ${response.statusText}`;
        responseStatus.className = response.ok ? 'status-success' : 'status-error';
      }
      
      // Récupérer et afficher la réponse
      try {
        const contentType = response.headers.get('Content-Type');
        
        if (contentType && contentType.includes('application/json')) {
          const jsonResponse = await response.json();
          
          if (responseBody) {
            responseBody.textContent = JSON.stringify(jsonResponse, null, 2);
          }
          
          log('Réponse JSON reçue:', jsonResponse);
          return jsonResponse;
        } else {
          const textResponse = await response.text();
          
          if (responseBody) {
            responseBody.textContent = textResponse;
          }
          
          log('Réponse texte reçue:', textResponse);
          return textResponse;
        }
      } catch (e) {
        error('Erreur lors du traitement de la réponse:', e);
        
        if (responseBody) {
          responseBody.textContent = `Erreur lors du traitement de la réponse: ${e.message}`;
        }
      }
    } catch (e) {
      error('Erreur lors de l\'envoi de la requête:', e);
      
      // Afficher l'erreur
      if (responseStatus) {
        responseStatus.textContent = 'Erreur de connexion';
        responseStatus.className = 'status-error';
      }
      
      if (responseBody) {
        responseBody.textContent = `Erreur lors de l'envoi de la requête: ${e.message}`;
      }
      
      if (responseTime) {
        const duration = Date.now() - startTime;
        responseTime.textContent = `${duration}ms`;
      }
    }
  }
  
  // Fonction d'initialisation
  function initialize() {
    if (isInitialized) return;
    
    log('Initialisation du correctif pour l\'envoi de requêtes...');
    
    // Initialiser les onglets
    initRequestTabs();
    
    // Initialiser le bouton d'envoi
    initSendButton();
    
    isInitialized = true;
  }
  
  // Initialisation après chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initialize, config.delay);
    });
  } else {
    setTimeout(initialize, config.delay);
  }
  
  // Exposer des fonctions pour le débogage
  window.sendRequestFix = {
    init: initialize,
    send: sendApiRequest
  };
})();