/**
 * Module de test interactif d'API pour FHIRHub
 * Fournit une interface similaire à Postman pour tester les endpoints de l'API
 */

// Variables globales pour le testeur d'API
// Utilisez la clé de localStorage pour la cohérence avec le reste de l'application
const apiTesterState = {
  currentAppId: null,
  currentApiKey: localStorage.getItem('apiKey') || 'dev-key',
  requestHistory: [],
  applications: [],
  apiKeys: []
};

// Éléments DOM
let elements = {};

// Flag pour éviter les initialisations multiples
let apiTesterInitialized = false;

// Fonction d'initialisation à appeler quand l'onglet devient visible
// Rendue disponible globalement pour main.js
window.initializeApiTesterTab = function() {
  if (apiTesterInitialized) {
    console.log("Le testeur d'API est déjà initialisé, pas besoin de le recharger");
    return;
  }
  
  console.log("Chargement du testeur d'API...");
  if (document.getElementById('test-api-tab')) {
    console.log("L'onglet test-api-tab a été trouvé, initialisation...");
    initApiTester();
    apiTesterInitialized = true;
  } else {
    console.error("L'onglet test-api-tab n'a pas été trouvé");
  }
};

// L'initialisation est maintenant gérée par main.js
// Mais on garde cette partie pour la compatibilité
document.addEventListener('DOMContentLoaded', () => {
  // On initialise seulement si l'onglet est visible au démarrage
  const testApiTab = document.getElementById('test-api-tab');
  if (testApiTab && testApiTab.classList.contains('active')) {
    window.initializeApiTesterTab();
  }
});

// Initialisation du testeur d'API - exportée globalement pour main.js
window.initApiTester = async function() {
  // Initialiser les éléments DOM - avec protection contre les undefined
  elements = {};
  
  // Fonction d'aide pour trouver un élément DOM en toute sécurité
  function safeGetElement(id, fallback = null) {
    const element = document.getElementById(id);
    if (!element) {
      console.error(`Élément DOM non trouvé: #${id}`);
      return fallback || { 
        // Objet fantôme pour éviter les erreurs
        innerHTML: '', 
        appendChild: () => {}, 
        addEventListener: () => {},
        querySelectorAll: () => [],
        classList: { add: () => {}, remove: () => {}, contains: () => false }
      };
    }
    return element;
  }
  
  // Fonction d'aide pour trouver un élément par sélecteur CSS en toute sécurité
  function safeQuerySelector(selector, fallback = null) {
    const element = document.querySelector(selector);
    if (!element) {
      console.error(`Élément DOM non trouvé avec le sélecteur: ${selector}`);
      return fallback || { 
        // Objet fantôme pour éviter les erreurs
        innerHTML: '', 
        appendChild: () => {}, 
        addEventListener: () => {},
        querySelectorAll: () => [],
        classList: { add: () => {}, remove: () => {}, contains: () => false }
      };
    }
    return element;
  }
  
  // Initialiser avec la protection
  elements = {
    appSelect: safeGetElement('test-app-select'),
    keySelect: safeGetElement('test-key-select'),
    methodSelect: safeGetElement('request-method'),
    endpointInput: safeGetElement('endpoint-input'),
    sendButton: safeGetElement('send-request'),
    requestBody: safeGetElement('request-body'),
    responseBody: safeGetElement('response-body'),
    responseHeaders: safeGetElement('response-headers'),
    responseStatus: safeGetElement('response-status'),
    responseTime: safeGetElement('response-time'),
    addParamButton: safeGetElement('add-param'),
    addHeaderButton: safeGetElement('add-header'),
    paramsContainer: safeQuerySelector('.params-container'),
    headersContainer: safeQuerySelector('.headers-container'),
    endpointsList: safeQuerySelector('.endpoints-list'),
    requestHistory: safeGetElement('request-history'),
    apiKeyHeader: safeGetElement('api-key-header')
  };

  // Vérifier si tous les éléments DOM ont été trouvés
  let missingElements = [];
  for (const [key, value] of Object.entries(elements)) {
    if (!value) {
      missingElements.push(key);
      console.error(`Élément DOM manquant: ${key}`);
    }
  }
  
  if (missingElements.length > 0) {
    console.error("Certains éléments DOM n'ont pas été trouvés:", missingElements);
    return;
  }
  
  console.log('Tous les éléments DOM ont été trouvés, initialisation en cours...');
  // Initialiser les événements des onglets
  document.querySelectorAll('.request-tabs .tab, .response-tabs .tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const tabsContainer = this.closest('.tabs');
      const tabContentPrefix = tabsContainer.classList.contains('request-tabs') ? '' : 'headers-';
      
      // Désactiver tous les tabs et contenus de cette section
      tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      
      const tabContents = document.querySelectorAll(`#${this.dataset.tab}-tab, #${tabContentPrefix}${this.dataset.tab}-tab`);
      tabContents.forEach(content => {
        if (content) content.classList.remove('active');
      });
      
      // Activer le tab cliqué
      this.classList.add('active');
      
      // Activer le contenu correspondant
      const tabContent = document.getElementById(`${this.dataset.tab}-tab`);
      if (tabContent) tabContent.classList.add('active');
      
      const headersTabContent = document.getElementById(`${tabContentPrefix}${this.dataset.tab}-tab`);
      if (headersTabContent) headersTabContent.classList.add('active');
    });
  });
  
  // Charger les applications
  await loadApplications();
  
  // Initialiser les événements des endpoints prédéfinis
  initEndpointItems();
  
  // Initialiser les événements des boutons
  elements.sendButton.addEventListener('click', sendRequest);
  elements.addParamButton.addEventListener('click', addParamRow);
  elements.addHeaderButton.addEventListener('click', addHeaderRow);
  
  // Événement de changement d'application
  elements.appSelect.addEventListener('change', async () => {
    apiTesterState.currentAppId = elements.appSelect.value;
    if (apiTesterState.currentAppId) {
      await loadApiKeys(apiTesterState.currentAppId);
      elements.keySelect.disabled = false;
    } else {
      elements.keySelect.innerHTML = '<option value="">Sélectionnez une clé API</option>';
      elements.keySelect.disabled = true;
    }
  });
  
  // Événement de changement de clé API
  elements.keySelect.addEventListener('change', () => {
    const selectedKey = elements.keySelect.value;
    if (selectedKey) {
      apiTesterState.currentApiKey = selectedKey;
      elements.apiKeyHeader.value = selectedKey;
    }
  });
  
  // Initialiser les valeurs par défaut
  elements.endpointInput.value = 'status';
  elements.apiKeyHeader.value = apiTesterState.currentApiKey;
  
  // Pré-remplir le corps de la requête pour les méthodes POST
  elements.methodSelect.addEventListener('change', () => {
    const method = elements.methodSelect.value;
    if (method === 'POST' && elements.endpointInput.value === 'convert') {
      // Template pour la conversion
      elements.requestBody.value = JSON.stringify({
        content: 'MSH|^~\\&|SENDING_APPLICATION|SENDING_FACILITY|RECEIVING_APPLICATION|RECEIVING_FACILITY|20230816084700||ADT^A01|MSG000001|P|2.5',
        options: {
          validate: true
        }
      }, null, 2);
    } else if (method === 'POST' && elements.endpointInput.value === 'keys') {
      // Template pour la création de clé API
      elements.requestBody.value = JSON.stringify({
        name: "Nouvelle clé",
        appId: 1,
        description: "Clé créée depuis le testeur d'API"
      }, null, 2);
    } else if (method === 'POST') {
      // Template générique
      elements.requestBody.value = JSON.stringify({
        // Ajouter des champs ici si nécessaire
      }, null, 2);
    }
  });
}

// Charger les applications
async function loadApplications() {
  try {
    console.log('Chargement des applications depuis l\'API...');
    
    // Afficher un message de chargement dans le sélecteur
    elements.appSelect.innerHTML = '<option value="">Chargement...</option>';
    elements.appSelect.disabled = true;
    
    const result = await apiRequestForTester('applications');
    console.log('Résultat reçu:', result);
    
    // Toujours réinitialiser le sélecteur avant de le remplir
    elements.appSelect.innerHTML = '<option value="">Sélectionnez une application</option>';
    elements.appSelect.disabled = false;
    
    if (!result || typeof result !== 'object') {
      console.error('Format de réponse invalide:', result);
      elements.appSelect.innerHTML = '<option value="">Erreur: Format de réponse invalide</option>';
      return;
    }
    
    if (!result.data) {
      console.error('Données d\'applications non trouvées');
      elements.appSelect.innerHTML = '<option value="">Erreur: Données non trouvées</option>';
      return;
    }
    
    // Force le type tableau même si ce n'est pas le cas
    const appData = Array.isArray(result.data) ? result.data : [result.data];
    apiTesterState.applications = appData;
    
    if (appData.length === 0) {
      console.log('Aucune application disponible');
      const option = document.createElement('option');
      option.value = "";
      option.textContent = "Aucune application disponible";
      option.disabled = true;
      elements.appSelect.appendChild(option);
      return;
    }
    
    // Tri par nom pour une meilleure expérience utilisateur
    appData.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    appData.forEach(app => {
      if (!app || !app.id) return; // Ignore les applications invalides
      
      const option = document.createElement('option');
      option.value = app.id;
      option.textContent = app.name || `Application #${app.id}`;
      elements.appSelect.appendChild(option);
    });
    
    console.log(`${appData.length} applications chargées avec succès`);
  } catch (error) {
    console.error('Erreur lors du chargement des applications:', error);
    
    // Gérer l'erreur dans l'interface
    elements.appSelect.innerHTML = '<option value="">Erreur de chargement</option>';
    elements.appSelect.disabled = false;
  }
}

// Charger les clés API pour une application
async function loadApiKeys(appId) {
  try {
    if (!appId) {
      console.error('Impossible de charger les clés API: ID application non défini');
      elements.keySelect.innerHTML = '<option value="">Veuillez sélectionner une application</option>';
      return;
    }
    
    // Message de chargement
    elements.keySelect.innerHTML = '<option value="">Chargement...</option>';
    elements.keySelect.disabled = true;
    
    console.log(`Chargement des clés API pour l'application ${appId}...`);
    const result = await apiRequestForTester(`keys?appId=${appId}`);
    console.log('Résultat des clés API:', result);
    
    // Réinitialiser le sélecteur
    elements.keySelect.innerHTML = '<option value="">Sélectionnez une clé API</option>';
    elements.keySelect.disabled = false;
    
    if (!result || !result.data) {
      console.error('Données de clés API non disponibles:', result);
      elements.keySelect.innerHTML = '<option value="">Aucune clé disponible</option>';
      return;
    }
    
    // Forcer à un tableau
    const keysData = Array.isArray(result.data) ? result.data : [result.data];
    apiTesterState.apiKeys = keysData;
    
    if (keysData.length === 0) {
      console.log('Aucune clé API disponible pour cette application');
      elements.keySelect.innerHTML = '<option value="">Aucune clé disponible</option>';
      return;
    }
    
    keysData.forEach(key => {
      if (!key) return; // Ignorer les clés invalides
      
      const keyValue = key.api_key || key.key || key.value;
      if (!keyValue) return; // Ignorer les clés sans valeur
      
      const option = document.createElement('option');
      option.value = keyValue;
      option.textContent = key.name || key.description || 'Clé API';
      elements.keySelect.appendChild(option);
    });
    
    console.log(`${keysData.length} clés API chargées pour l'application ${appId}`);
  } catch (error) {
    console.error('Erreur lors du chargement des clés API:', error);
    elements.keySelect.innerHTML = '<option value="">Erreur de chargement</option>';
    elements.keySelect.disabled = false;
  }
}

// Initialiser les événements des endpoints prédéfinis
function initEndpointItems() {
  elements.endpointsList.querySelectorAll('.endpoint-item').forEach(item => {
    item.addEventListener('click', () => {
      const method = item.dataset.method;
      const endpoint = item.dataset.endpoint;
      
      elements.methodSelect.value = method;
      elements.endpointInput.value = endpoint;
      
      // Pré-remplir le corps de la requête si nécessaire
      if (method === 'POST' && endpoint === 'convert') {
        elements.requestBody.value = JSON.stringify({
          content: 'MSH|^~\\&|SENDING_APPLICATION|SENDING_FACILITY|RECEIVING_APPLICATION|RECEIVING_FACILITY|20230816084700||ADT^A01|MSG000001|P|2.5',
          options: {
            validate: true
          }
        }, null, 2);
      }
    });
  });
}

// Ajouter une ligne de paramètre
function addParamRow() {
  const row = document.createElement('div');
  row.className = 'param-row';
  
  row.innerHTML = `
    <input type="text" class="param-name" placeholder="Nom">
    <input type="text" class="param-value" placeholder="Valeur">
    <button class="remove-param">×</button>
  `;
  
  const removeButton = row.querySelector('.remove-param');
  removeButton.addEventListener('click', () => row.remove());
  
  elements.paramsContainer.insertBefore(row, elements.addParamButton);
}

// Ajouter une ligne d'en-tête
function addHeaderRow() {
  const row = document.createElement('div');
  row.className = 'header-row';
  
  row.innerHTML = `
    <input type="text" class="header-name" placeholder="Nom">
    <input type="text" class="header-value" placeholder="Valeur">
    <button class="remove-header">×</button>
  `;
  
  const removeButton = row.querySelector('.remove-header');
  removeButton.addEventListener('click', () => row.remove());
  
  elements.headersContainer.insertBefore(row, elements.addHeaderButton);
}

// Envoyer une requête API
async function sendRequest() {
  // Récupérer les données de la requête
  const method = elements.methodSelect.value;
  const endpoint = elements.endpointInput.value;
  const body = elements.requestBody.value;
  
  // Construire les paramètres de requête
  const params = {};
  elements.paramsContainer.querySelectorAll('.param-row').forEach(row => {
    const nameInput = row.querySelector('.param-name');
    const valueInput = row.querySelector('.param-value');
    
    if (nameInput.value) {
      params[nameInput.value] = valueInput.value;
    }
  });
  
  // Construire l'URL
  let url = endpoint;
  const queryParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    queryParams.append(key, value);
  }
  
  if (queryParams.toString()) {
    url += '?' + queryParams.toString();
  }
  
  // Construire les en-têtes
  const headers = {
    'x-api-key': elements.apiKeyHeader.value || apiTesterState.currentApiKey
  };
  
  elements.headersContainer.querySelectorAll('.header-row').forEach(row => {
    const nameInput = row.querySelector('.header-name');
    const valueInput = row.querySelector('.header-value');
    
    if (nameInput.value && !nameInput.disabled) {
      headers[nameInput.value] = valueInput.value;
    }
  });
  
  // Options de la requête
  const options = {
    method,
    headers
  };
  
  // Ajouter le corps pour les méthodes non-GET
  if (method !== 'GET' && body) {
    try {
      const bodyObj = JSON.parse(body);
      options.body = JSON.stringify(bodyObj);
      options.headers['Content-Type'] = 'application/json';
    } catch (error) {
      options.body = body;
    }
  }
  
  // Afficher l'état de chargement
  elements.responseStatus.textContent = 'Envoi de la requête...';
  elements.responseStatus.className = '';
  elements.responseTime.textContent = '';
  elements.responseBody.textContent = '';
  elements.responseHeaders.textContent = '';
  
  // Enregistrer l'heure de début
  const startTime = performance.now();
  
  try {
    // Envoyer la requête
    const response = await fetch('/api/' + url, options);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    // Afficher les en-têtes de réponse
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    elements.responseHeaders.textContent = JSON.stringify(headers, null, 2);
    
    // Afficher l'état de la réponse
    elements.responseStatus.textContent = `${response.status} ${response.statusText}`;
    elements.responseStatus.className = response.ok ? 'success' : 'error';
    elements.responseTime.textContent = `${duration}ms`;
    
    // Récupérer et afficher le corps de la réponse
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      elements.responseBody.textContent = JSON.stringify(data, null, 2);
    } else {
      const text = await response.text();
      elements.responseBody.textContent = text;
    }
    
    // Ajouter à l'historique
    addToHistory(method, endpoint, response.status);
    
  } catch (error) {
    // Afficher l'erreur
    elements.responseStatus.textContent = 'Erreur';
    elements.responseStatus.className = 'error';
    elements.responseTime.textContent = '';
    elements.responseBody.textContent = error.message;
    
    console.error('Erreur lors de la requête API:', error);
  }
}

// Ajouter une requête à l'historique
function addToHistory(method, endpoint, status) {
  // Créer l'élément d'historique
  const historyItem = document.createElement('div');
  historyItem.className = 'history-item';
  
  // Déterminer la classe en fonction du statut
  const statusClass = status >= 200 && status < 300 ? 'success' : 'error';
  
  historyItem.innerHTML = `
    <span class="history-method ${method.toLowerCase()}">${method}</span>
    <span class="history-endpoint">${endpoint}</span>
    <span class="history-status ${statusClass}">${status}</span>
  `;
  
  // Ajouter l'événement de clic
  historyItem.addEventListener('click', () => {
    elements.methodSelect.value = method;
    elements.endpointInput.value = endpoint;
  });
  
  // Ajouter à l'historique
  if (elements.requestHistory.querySelector('p')) {
    elements.requestHistory.innerHTML = '';
  }
  
  elements.requestHistory.insertBefore(historyItem, elements.requestHistory.firstChild);
  
  // Limiter l'historique à 10 éléments
  if (elements.requestHistory.children.length > 10) {
    elements.requestHistory.removeChild(elements.requestHistory.lastChild);
  }
  
  // Mettre à jour l'historique
  apiTesterState.requestHistory.unshift({ method, endpoint, status });
  if (apiTesterState.requestHistory.length > 10) {
    apiTesterState.requestHistory.pop();
  }
}

// Fonction spéciale pour les requêtes API du testeur
async function apiRequestForTester(endpoint, options = {}) {
  options.headers = options.headers || {};
  options.headers['x-api-key'] = apiTesterState.currentApiKey;
  
  console.log(`Requête API au endpoint: /api/${endpoint}`);
  
  try {
    const response = await fetch('/api/' + endpoint, options);
    console.log(`Réponse reçue: ${response.status} ${response.statusText}`);
    
    // Même en cas d'erreur HTTP, continuer à traiter la réponse
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Erreur de parse JSON:', jsonError);
        return { success: false, error: 'Format JSON invalide', data: [] };
      }
    } else {
      const text = await response.text();
      // Essayer de parser le texte en JSON si possible
      try {
        result = JSON.parse(text);
      } catch (e) {
        result = { data: text, success: response.ok };
      }
    }
    
    if (!response.ok) {
      console.error('Erreur API:', result);
      return { success: false, error: result.message || result.error || 'Erreur lors de la requête API', data: [] };
    }
    
    if (!result) {
      console.error('Réponse vide ou invalide');
      return { success: false, error: 'Réponse vide ou invalide', data: [] };
    }
    
    return result;
  } catch (error) {
    console.error('API request failed:', error);
    // Crée un objet de résultat vide pour éviter les erreurs en cascade
    return { success: false, error: error.message || 'Erreur inconnue', data: [] };
  }
}