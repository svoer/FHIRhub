/**
 * Script de gestion des paramètres FHIR
 * 
 * Gère l'interface de configuration des serveurs FHIR
 * Permet d'ajouter, modifier, supprimer, tester et définir les serveurs par défaut
 * 
 * @version 1.0.0
 */

document.addEventListener('DOMContentLoaded', function() {
  // Cache des éléments DOM
  const allServersContainer = document.getElementById('all-servers');
  const localServersContainer = document.getElementById('local-servers');
  const publicServersContainer = document.getElementById('public-servers');
  const tabs = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const formOverlay = document.getElementById('formOverlay');
  
  // Nouveau bouton d'ajout principal
  const mainAddServerButton = document.getElementById('mainAddServerButton');
  
  // Boutons d'ajout originaux
  const addServerButton = document.getElementById('addServerButton');
  const addLocalServerButton = document.getElementById('addLocalServerButton');
  const addPublicServerButton = document.getElementById('addPublicServerButton');
  
  const formClose = document.getElementById('formClose');
  const cancelButton = document.getElementById('cancelButton');
  
  // Variables d'état
  let servers = [];
  
  // Fonction pour récupérer les serveurs
  async function fetchServers() {
    try {
      const response = await fetch('/api/fhir-config/servers');
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Vérifier la structure de la réponse
      if (data && data.servers) {
        // La réponse est au format { defaultServer, servers }
        servers = data.servers;
      } else if (Array.isArray(data)) {
        // La réponse est directement un tableau de serveurs
        servers = data;
      } else {
        console.warn('Format de réponse inattendu:', data);
        servers = [];
      }
      
      renderServers();
      
      return servers;
    } catch (error) {
      console.error('Erreur lors de la récupération des serveurs:', error);
      showErrorMessage('Erreur lors de la récupération des serveurs');
      return [];
    }
  }
  
  // Fonction pour afficher les serveurs
  function renderServers() {
    // Vider les conteneurs
    allServersContainer.innerHTML = '';
    localServersContainer.innerHTML = '';
    publicServersContainer.innerHTML = '';
    
    // Si aucun serveur, afficher un message
    if (servers.length === 0) {
      const message = createMessageElement('Aucun serveur configuré', 'Ajoutez un serveur FHIR pour commencer.');
      allServersContainer.appendChild(message);
      localServersContainer.appendChild(createMessageElement('Aucun serveur local configuré', 'Ajoutez un serveur local pour commencer.'));
      publicServersContainer.appendChild(createMessageElement('Aucun serveur public configuré', 'Ajoutez un serveur public pour commencer.'));
      return;
    }
    
    // Récupérer les serveurs locaux et publics
    const localServers = servers.filter(server => server.type === 'local');
    const publicServers = servers.filter(server => server.type === 'public');
    
    // Afficher les serveurs dans chaque conteneur
    servers.forEach(server => createServerCard(server, allServersContainer));
    
    if (localServers.length > 0) {
      localServers.forEach(server => createServerCard(server, localServersContainer));
    } else {
      localServersContainer.appendChild(createMessageElement('Aucun serveur local configuré', 'Ajoutez un serveur local pour commencer.'));
    }
    
    if (publicServers.length > 0) {
      publicServers.forEach(server => createServerCard(server, publicServersContainer));
    } else {
      publicServersContainer.appendChild(createMessageElement('Aucun serveur public configuré', 'Ajoutez un serveur public pour commencer.'));
    }
    
    // Configurer les événements des boutons
    setupButtonEvents();
    
    // Configurer les événements de switch
    setupSwitchEvents();
    
    // Ajouter des classes pour les textes des toggles activés
    updateToggleTextStatus();
  }
  
  // Fonction pour créer un message
  function createMessageElement(title, description) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-box';
    messageDiv.innerHTML = `
      <div class="message-icon"><i class="fas fa-server"></i></div>
      <h3>${title}</h3>
      <p>${description}</p>
    `;
    return messageDiv;
  }
  
  // Fonction pour créer une carte de serveur
  function createServerCard(server, container) {
    const card = document.createElement('div');
    card.className = `server-card ${server.isDefault ? 'default' : ''}`;
    card.dataset.id = server.id;
    
    const statusClass = server.isActive ? 'status-active' : 'status-inactive';
    const statusText = server.isActive ? 'Actif' : 'Inactif';
    const statusIcon = server.isActive ? 'fas fa-check-circle' : 'fas fa-times-circle';
    
    card.innerHTML = `
      <div class="server-name">
        <span>${server.name}</span>
        ${server.isDefault ? '<span class="badge-default">Par défaut</span>' : ''}
      </div>
      <div class="server-url">${server.url}</div>
      <div class="server-info">
        <div class="info-badge">
          <i class="fas fa-code-branch"></i>
          <span>FHIR ${server.version || 'R4'}</span>
        </div>
        <div class="info-badge">
          <i class="fas fa-shield-alt"></i>
          <span>${server.auth === 'none' ? 'Sans authentification' : 'Authentification requise'}</span>
        </div>
        <div class="status-badge ${statusClass}">
          <i class="${statusIcon}"></i>
          <span>${statusText}</span>
        </div>
      </div>
      <div class="server-actions">
        <button class="action-button test-button" data-id="${server.id}">
          <i class="fas fa-vial"></i> Tester
        </button>
        <button class="action-button edit-button" data-id="${server.id}">
          <i class="fas fa-edit"></i> Éditer
        </button>
        <button class="action-button delete-button" data-id="${server.id}">
          <i class="fas fa-trash-alt"></i> Supprimer
        </button>
        <label class="switch-container">
          <div class="switch">
            <input type="checkbox" class="default-toggle" data-id="${server.id}" ${server.isDefault ? 'checked' : ''}>
            <span class="slider"></span>
          </div>
          <span>Par défaut</span>
        </label>
        <label class="switch-container">
          <div class="switch">
            <input type="checkbox" class="active-toggle" data-id="${server.id}" ${server.isActive ? 'checked' : ''}>
            <span class="slider"></span>
          </div>
          <span>Actif</span>
        </label>
      </div>
    `;
    
    container.appendChild(card);
  }
  
  // Fonction pour configurer les événements des boutons
  function updateToggleTextStatus() {
    document.querySelectorAll('.default-toggle, .active-toggle').forEach(toggle => {
      if (toggle.checked) {
        const span = toggle.closest('.switch-container').querySelector('span');
        if (span) {
          span.classList.add('active-text');
        }
      }
    });
  }
  
  function setupSwitchEvents() {
    // Boutons pour définir le serveur par défaut
    document.querySelectorAll('.default-toggle').forEach(toggle => {
      toggle.addEventListener('change', function() {
        const serverId = this.dataset.id;
        if (this.checked) {
          setDefaultServer(serverId);
          
          // Mettre à jour les classes pour les textes des toggles
          document.querySelectorAll('.default-toggle').forEach(t => {
            const span = t.closest('.switch-container').querySelector('span');
            if (t === this) {
              if (span) span.classList.add('active-text');
            } else {
              if (span) span.classList.remove('active-text');
            }
          });
        } else {
          // Si on décoche le toggle du serveur par défaut, on le recoche car il doit toujours y avoir un serveur par défaut
          this.checked = true;
        }
      });
    });
    
    // Boutons pour activer/désactiver le serveur
    document.querySelectorAll('.active-toggle').forEach(toggle => {
      toggle.addEventListener('change', function() {
        const serverId = this.dataset.id;
        toggleServerActive(serverId);
        
        // Mettre à jour la classe pour le texte du toggle
        const span = this.closest('.switch-container').querySelector('span');
        if (this.checked) {
          if (span) span.classList.add('active-text');
        } else {
          if (span) span.classList.remove('active-text');
        }
      });
    });
    
    // Boutons de test
    document.querySelectorAll('.test-button').forEach(button => {
      button.addEventListener('click', function() {
        const serverId = this.dataset.id;
        testServer(serverId);
      });
    });
  }
  
  // Fonction pour définir un serveur par défaut
  async function setDefaultServer(serverId) {
    try {
      const response = await fetch(`/api/fhir-config/servers/default/${serverId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      // Recharger les serveurs
      await fetchServers();
      
      // Afficher un message de succès
      showSuccessMessage('Serveur défini comme serveur par défaut');
    } catch (error) {
      console.error('Erreur lors de la définition du serveur par défaut:', error);
      showErrorMessage('Erreur lors de la définition du serveur par défaut');
      
      // Recharger pour refléter l'état actuel
      await fetchServers();
    }
  }
  
  // Fonction pour activer/désactiver un serveur
  async function toggleServerActive(serverId) {
    try {
      const response = await fetch(`/api/fhir-config/servers/${serverId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      // Recharger les serveurs
      await fetchServers();
      
      // Afficher un message de succès
      const server = servers.find(s => s.id === serverId);
      showSuccessMessage(`Serveur ${server.isActive ? 'activé' : 'désactivé'}`);
    } catch (error) {
      console.error('Erreur lors de la modification de l\'état du serveur:', error);
      showErrorMessage('Erreur lors de la modification de l\'état du serveur');
      
      // Recharger pour refléter l'état actuel
      await fetchServers();
    }
  }
  
  // Fonction pour tester un serveur
  async function testServer(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;
    
    // Trouver le bouton et changer son texte
    const button = document.querySelector(`.test-button[data-id="${serverId}"]`);
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Test en cours...';
    button.disabled = true;
    
    try {
      // Faire une requête simple pour vérifier si le serveur est disponible
      // Utiliser notre API interne de test de serveur FHIR
      const response = await fetch(`/api/fhir/test-server?url=${encodeURIComponent(server.url)}`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        button.innerHTML = '<i class="fas fa-check-circle"></i> Connecté';
        button.classList.add('success');
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('success');
          button.disabled = false;
        }, 3000);
        
        showSuccessMessage(`Serveur "${server.name}" accessible`);
      } else {
        button.innerHTML = '<i class="fas fa-times-circle"></i> Erreur';
        button.classList.add('error');
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('error');
          button.disabled = false;
        }, 3000);
        
        showErrorMessage(`Serveur "${server.name}" inaccessible: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur lors du test du serveur:', error);
      
      button.innerHTML = '<i class="fas fa-times-circle"></i> Erreur';
      button.classList.add('error');
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('error');
        button.disabled = false;
      }, 3000);
      
      showErrorMessage(`Erreur lors du test du serveur: ${error.message}`);
    }
  }
  
  // Fonction pour montrer/cacher le formulaire de serveur
  function toggleServerForm(show, type = null) {
    const formTitle = document.getElementById('formTitle');
    
    if (show) {
      // Réinitialiser le formulaire d'abord
      document.getElementById('serverId').value = ''; // Réinitialiser l'ID caché
      document.getElementById('serverName').value = '';
      document.getElementById('serverUrl').value = '';
      document.getElementById('serverVersion').value = 'R4';
      document.getElementById('serverAuth').value = 'none';
      
      // Modifier le texte du bouton de soumission
      const submitButton = document.getElementById('submitButton');
      if (submitButton) {
        submitButton.textContent = 'Enregistrer';
      }
      
      // Cacher les champs d'authentification
      const authFields = document.getElementById('authFields');
      if (authFields) {
        authFields.style.display = 'none';
      }
      
      // Configurer le type selon le bouton utilisé
      if (type === 'local') {
        formTitle.textContent = 'Ajouter un serveur local';
        document.getElementById('serverType').value = 'local';
        // Préremplir l'URL pour un serveur local
        document.getElementById('serverUrl').value = 'http://localhost:8080/fhir';
      } else if (type === 'public') {
        formTitle.textContent = 'Ajouter un serveur public';
        document.getElementById('serverType').value = 'public';
        // Préremplir l'URL pour un serveur public
        document.getElementById('serverUrl').value = 'https://hapi.fhir.org/baseR4';
      } else {
        formTitle.textContent = 'Ajouter un serveur FHIR';
        document.getElementById('serverType').value = 'local';
      }
      
      // Afficher le formulaire
      formOverlay.classList.add('show');
      
      // Reconfigurer le bouton d'enregistrement pour s'assurer qu'il fonctionne
      setupSaveButton();
    } else {
      // Cacher le formulaire
      formOverlay.classList.remove('show');
    }
  }
  
  // Gérer les événements du formulaire
  if (mainAddServerButton) {
    mainAddServerButton.addEventListener('click', () => toggleServerForm(true));
  }
  
  if (addServerButton) {
    addServerButton.addEventListener('click', () => toggleServerForm(true));
  }
  
  if (addLocalServerButton) {
    addLocalServerButton.addEventListener('click', () => toggleServerForm(true, 'local'));
  }
  
  if (addPublicServerButton) {
    addPublicServerButton.addEventListener('click', () => toggleServerForm(true, 'public'));
  }
  
  if (formClose) {
    formClose.addEventListener('click', () => toggleServerForm(false));
  }
  
  if (cancelButton) {
    cancelButton.addEventListener('click', () => toggleServerForm(false));
  }
  
  // Préparation du bouton d'enregistrement
  function setupSaveButton() {
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
      // Supprimer les anciens écouteurs pour éviter les doublons
      saveButton.removeEventListener('click', addNewServer);
      // Ajouter le nouvel écouteur
      saveButton.addEventListener('click', addNewServer);
    }
  }
  
  // Initialiser le bouton d'enregistrement
  setupSaveButton();
  
  // Fonction pour ajouter/modifier un serveur
  async function addNewServer() {
    console.log('Fonction addNewServer appelée');
    
    const serverId = document.getElementById('serverId')?.value;
    const name = document.getElementById('serverName').value;
    const url = document.getElementById('serverUrl').value;
    const type = document.getElementById('serverType').value;
    const version = document.getElementById('serverVersion').value;
    const auth = document.getElementById('serverAuth').value;
    
    console.log('Données collectées:', { serverId, name, url, type, version, auth });
    
    // Validation simple
    if (!name || !url) {
      showErrorMessage('Le nom et l\'URL du serveur sont requis');
      return;
    }
    
    try {
      // Préparation des données
      const serverData = {
        name,
        url,
        type,
        version,
        auth
      };
      
      // Ajout des informations d'authentification si nécessaire
      if (auth !== 'none') {
        if (auth === 'basic') {
          serverData.username = document.getElementById('serverUsername').value;
          serverData.password = document.getElementById('serverPassword').value;
        } else if (auth === 'token') {
          serverData.token = document.getElementById('serverToken').value;
        } else if (auth === 'oauth') {
          serverData.clientId = document.getElementById('serverClientId').value;
          serverData.clientSecret = document.getElementById('serverClientSecret').value;
          serverData.tokenUrl = document.getElementById('serverTokenUrl').value;
        }
      }
      
      // Déterminer s'il s'agit d'une création ou d'une mise à jour
      let apiUrl = '/api/fhir-config/servers';
      let method = 'POST';
      
      // Si serverId existe, c'est une mise à jour
      if (serverId) {
        apiUrl = `/api/fhir-config/servers/${serverId}`;
        method = 'PUT';
        serverData.id = serverId;
      }
      
      // Envoi au serveur
      const response = await fetch(apiUrl, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(serverData)
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Fermer le formulaire
      toggleServerForm(false);
      
      // Recharger les serveurs
      await fetchServers();
      
      // Afficher un message de succès
      showSuccessMessage('Serveur ajouté avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout du serveur:', error);
      showErrorMessage(`Erreur lors de l'ajout du serveur: ${error.message}`);
    }
  }
  
  // Fonction pour afficher un message d'erreur
  function showErrorMessage(message) {
    // Version simple d'alerte
    const errorNode = document.createElement('div');
    errorNode.className = 'alert alert-danger';
    errorNode.style.position = 'fixed';
    errorNode.style.top = '20px';
    errorNode.style.right = '20px';
    errorNode.style.backgroundColor = '#f44336';
    errorNode.style.color = 'white';
    errorNode.style.padding = '15px';
    errorNode.style.borderRadius = '5px';
    errorNode.style.zIndex = '9999';
    errorNode.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    document.body.appendChild(errorNode);
    
    setTimeout(() => {
      errorNode.style.opacity = '0';
      errorNode.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        document.body.removeChild(errorNode);
      }, 500);
    }, 3000);
  }
  
  // Fonction pour afficher un message de succès
  function showSuccessMessage(message) {
    // Version simple d'alerte
    const successNode = document.createElement('div');
    successNode.className = 'alert alert-success';
    successNode.style.position = 'fixed';
    successNode.style.top = '20px';
    successNode.style.right = '20px';
    successNode.style.backgroundColor = '#4CAF50';
    successNode.style.color = 'white';
    successNode.style.padding = '15px';
    successNode.style.borderRadius = '5px';
    successNode.style.zIndex = '9999';
    successNode.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    
    document.body.appendChild(successNode);
    
    setTimeout(() => {
      successNode.style.opacity = '0';
      successNode.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        document.body.removeChild(successNode);
      }, 500);
    }, 3000);
  }
  
  // Fonction pour configurer les événements des boutons
  function setupButtonEvents() {
    // Gérer les clics sur les boutons de test
    document.querySelectorAll('.test-button').forEach(button => {
      button.addEventListener('click', function() {
        const serverId = this.dataset.id;
        testServer(serverId);
      });
    });
    
    // Gérer les clics sur les boutons d'édition
    document.querySelectorAll('.edit-button').forEach(button => {
      button.addEventListener('click', function() {
        const serverId = this.dataset.id;
        editServer(serverId);
      });
    });
    
    // Gérer les clics sur les boutons de suppression
    document.querySelectorAll('.delete-button').forEach(button => {
      button.addEventListener('click', function() {
        const serverId = this.dataset.id;
        deleteServer(serverId);
      });
    });
  }
  
  // Fonction pour éditer un serveur
  async function editServer(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) {
      showErrorMessage('Serveur non trouvé');
      return;
    }
    
    // Mettre à jour le titre du formulaire
    const formTitle = document.getElementById('formTitle');
    if (formTitle) {
      formTitle.textContent = 'Modifier le serveur FHIR';
    }
    
    // Remplir les champs du formulaire avec les données du serveur
    document.getElementById('serverId').value = server.id;
    document.getElementById('serverName').value = server.name;
    document.getElementById('serverUrl').value = server.url;
    document.getElementById('serverVersion').value = server.version || 'R4';
    document.getElementById('serverType').value = server.type || 'local';
    document.getElementById('serverAuth').value = server.auth || 'none';
    
    // Configurer les champs d'authentification
    handleAuthTypeChange.call(document.getElementById('serverAuth'));
    
    if (server.auth === 'basic') {
      document.getElementById('serverUsername').value = server.username || '';
      document.getElementById('serverPassword').value = server.password || '';
    } else if (server.auth === 'token') {
      document.getElementById('serverToken').value = server.token || '';
    } else if (server.auth === 'oauth') {
      document.getElementById('serverClientId').value = server.clientId || '';
      document.getElementById('serverClientSecret').value = server.clientSecret || '';
      document.getElementById('serverTokenUrl').value = server.tokenUrl || '';
    }
    
    // Modifier le texte du bouton de soumission
    const submitButton = document.getElementById('submitButton');
    if (submitButton) {
      submitButton.textContent = 'Mettre à jour';
    }
    
    // Afficher le formulaire
    toggleServerForm(true);
  }
  
  // Fonction pour supprimer un serveur
  async function deleteServer(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) {
      showErrorMessage('Serveur non trouvé');
      return;
    }
    
    // Demander confirmation
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le serveur "${server.name}" ?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/fhir-config/servers/${serverId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      // Recharger les serveurs
      await fetchServers();
      
      // Afficher un message de succès
      showSuccessMessage(`Serveur "${server.name}" supprimé avec succès`);
    } catch (error) {
      console.error('Erreur lors de la suppression du serveur:', error);
      showErrorMessage(`Erreur lors de la suppression du serveur: ${error.message}`);
    }
  }

  // Fonction d'initialisation
  function init() {
    // Tenter de récupérer les serveurs
    fetchServers();
    
    // Activer les gestionnaires d'onglets
    setupTabHandlers();
    
    // Configurer le changement du type d'authentification
    const authSelect = document.getElementById('serverAuth');
    if (authSelect) {
      authSelect.addEventListener('change', handleAuthTypeChange);
    }
    
    console.log('Initialisation de la page FHIRSettings terminée');
  }
  
  // Configurer le changement du type d'authentification
  function handleAuthTypeChange() {
    const authType = this.value;
    const authFields = document.getElementById('authFields');
    
    if (!authFields) return;
    
    if (authType === 'none') {
      authFields.style.display = 'none';
    } else {
      authFields.style.display = 'block';
      
      // Afficher les champs appropriés
      document.getElementById('basicAuthSection').style.display = authType === 'basic' ? 'block' : 'none';
      document.getElementById('tokenAuthSection').style.display = authType === 'token' ? 'block' : 'none';
      document.getElementById('oauthSection').style.display = authType === 'oauth' ? 'block' : 'none';
    }
  }
  
  // Configurer les gestionnaires d'onglets
  function setupTabHandlers() {
    // Gérer les changements d'onglets
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Retirer la classe active de tous les onglets
        tabs.forEach(t => t.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        
        // Ajouter la classe active à l'onglet cliqué
        this.classList.add('active');
        
        // Activer le panneau correspondant
        const tabId = this.dataset.tab;
        document.getElementById(`${tabId}-tab`).classList.add('active');
      });
    });
  }
  
  // Démarrer l'initialisation
  init();
});