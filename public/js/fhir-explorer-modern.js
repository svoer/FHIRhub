/**
 * FHIR Explorer - Modern UX 2025
 * Script amélioré avec animations, feedback instantané et gestion d'erreurs sophistiquée
 */

document.addEventListener('DOMContentLoaded', function() {
  // Éléments DOM
  const serverSelect = document.getElementById('serverSelect');
  const testConnectionBtn = document.getElementById('testConnection');
  const connectionStatus = document.getElementById('connectionStatus');
  const resourceTypeSelect = document.getElementById('resourceType');
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const clearButton = document.getElementById('clearButton');
  const addParamButton = document.getElementById('addParam');
  const searchParams = document.getElementById('searchParams');
  const resourceList = document.getElementById('resourceList');
  const resourceDetail = document.getElementById('resourceDetail');
  const pagination = document.getElementById('pagination');
  const statusBar = document.getElementById('statusBar');
  
  // Variables globales
  let currentPage = 1;
  let totalPages = 1;
  let searchHistory = [];
  let selectedResource = null;
  const pageSize = 50; // Augmentation du nombre de résultats par page pour voir plus de patients
  
  // Onglets
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', function() {
      // Désactiver tous les onglets
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Activer l'onglet cliqué
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
  
  // Serveur Swagger
  const swaggerServerSelect = document.getElementById('swaggerServerSelect');
  const loadSwaggerButton = document.getElementById('loadSwagger');
  const swaggerFrame = document.getElementById('swaggerFrame');
  
  if (loadSwaggerButton && swaggerFrame && swaggerServerSelect) {
    loadSwaggerButton.addEventListener('click', function() {
      swaggerFrame.src = swaggerServerSelect.value;
      updateStatusWithAnimation('Chargement de la documentation Swagger...', 'info');
    });
  }
  
  // Test de connexion au serveur FHIR
  testConnectionBtn.addEventListener('click', function() {
    // Changer l'apparence du bouton pour indiquer le chargement
    testConnectionBtn.innerHTML = '<div class="loader" style="width: 16px; height: 16px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 8px;"></div> Test en cours...';
    testConnectionBtn.disabled = true;
    testConnectionBtn.style.opacity = '0.8';
    
    // Afficher un indicateur de chargement
    connectionStatus.innerHTML = '<div class="loader"></div> Test de connexion en cours...';
    connectionStatus.className = 'connection-status visible';
    
    // URL du serveur sélectionné
    const serverUrl = serverSelect.value;
    
    // Tester la connexion en envoyant une requête simple
    fetch(`${serverUrl}/metadata`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        // Réinitialiser le bouton
        testConnectionBtn.innerHTML = '<i class="fas fa-plug"></i> Tester la connexion';
        testConnectionBtn.disabled = false;
        testConnectionBtn.style.opacity = '1';
        
        // Connexion réussie
        connectionStatus.className = 'connection-status visible success';
        
        // Créer un résumé des fonctionnalités du serveur
        const fhirVersion = data.fhirVersion || 'Inconnu';
        const resourceCount = data.rest && data.rest[0] && data.rest[0].resource ? data.rest[0].resource.length : 0;
        
        // Afficher le résultat avec animation
        connectionStatus.innerHTML = `
          <div class="connection-success-content">
            <h4 style="margin-top: 0; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-check-circle" style="color: #28a745; font-size: 24px;"></i>
              Connexion au serveur réussie !
            </h4>
            <div class="server-details" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 10px;">
              <div class="server-detail-item" style="padding: 10px; background-color: rgba(40, 167, 69, 0.1); border-radius: 8px;">
                <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 5px; color: #28a745;">Version FHIR:</span> 
                <span class="detail-value" style="font-size: 16px;">${fhirVersion}</span>
              </div>
              <div class="server-detail-item" style="padding: 10px; background-color: rgba(40, 167, 69, 0.1); border-radius: 8px;">
                <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 5px; color: #28a745;">Types de ressources:</span> 
                <span class="detail-value" style="font-size: 16px;">${resourceCount}</span>
              </div>
              <div class="server-detail-item" style="padding: 10px; background-color: rgba(40, 167, 69, 0.1); border-radius: 8px;">
                <span class="detail-label" style="display: block; font-weight: 600; margin-bottom: 5px; color: #28a745;">Statut:</span> 
                <span class="detail-value" style="font-size: 16px; display: flex; align-items: center; gap: 5px;">
                  <span class="status-indicator online" style="display: inline-block; width: 8px; height: 8px; background-color: #28a745; border-radius: 50%;"></span>
                  En ligne
                </span>
              </div>
            </div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(40, 167, 69, 0.2);">
              <p style="margin: 0; font-size: 14px; color: #666;">
                Serveur prêt pour la recherche et l'exploration des ressources FHIR. Vous pouvez maintenant 
                utiliser la section de recherche ci-dessous pour requêter les ressources de ce serveur.
              </p>
            </div>
          </div>
        `;
        
        updateStatusWithAnimation('Connexion au serveur FHIR établie avec succès.', 'success');
      })
      .catch(error => {
        // Réinitialiser le bouton
        testConnectionBtn.innerHTML = '<i class="fas fa-plug"></i> Tester la connexion';
        testConnectionBtn.disabled = false;
        testConnectionBtn.style.opacity = '1';
        
        // Erreur de connexion
        connectionStatus.className = 'connection-status visible error';
        connectionStatus.innerHTML = `
          <div class="connection-error-content">
            <h4 style="margin-top: 0; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-exclamation-triangle" style="color: #dc3545; font-size: 24px;"></i>
              Erreur de connexion au serveur
            </h4>
            <p style="padding: 10px; background-color: rgba(220, 53, 69, 0.1); border-radius: 8px; margin-bottom: 15px;">
              ${error.message}
            </p>
            <div class="error-suggestions">
              <p style="margin-bottom: 10px; font-weight: 600;">Suggestions:</p>
              <ul style="margin: 0; padding-left: 20px; color: #666;">
                <li>Vérifiez que le serveur est en ligne et accessible</li>
                <li>Vérifiez que l'URL du serveur est correcte</li>
                <li>Vérifiez que le serveur prend en charge FHIR</li>
                <li>Si vous utilisez le serveur local, assurez-vous qu'il est bien démarré</li>
              </ul>
            </div>
            <div style="margin-top: 15px; text-align: right;">
              <button onclick="document.getElementById('testConnection').click()" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-sync-alt"></i> Réessayer
              </button>
            </div>
          </div>
        `;
        
        updateStatusWithAnimation(`Erreur de connexion: ${error.message}`, 'error');
      });
  });
  
  // Recherche de ressources
  searchButton.addEventListener('click', function() {
    performSearch(1);
  });
  
  // Touche Entrée pour lancer la recherche
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch(1);
    }
  });
  
  // Effacer les résultats
  clearButton.addEventListener('click', function() {
    searchInput.value = '';
    resourceList.innerHTML = '';
    resourceDetail.textContent = 'Sélectionnez une ressource pour voir les détails';
    pagination.innerHTML = '';
    clearParamRows();
    updateStatusWithAnimation('Recherche effacée', 'info');
  });
  
  // Ajouter un paramètre de recherche
  addParamButton.addEventListener('click', function() {
    addParamRow();
  });
  
  // Fonction pour ajouter une ligne de paramètre
  function addParamRow() {
    const paramRow = document.createElement('div');
    paramRow.className = 'param-pair';
    paramRow.innerHTML = `
      <input type="text" placeholder="Paramètre" class="param-name form-control">
      <input type="text" placeholder="Valeur" class="param-value form-control">
      <button class="remove-param"><i class="fas fa-minus"></i></button>
    `;
    
    // Ajouter la gestion d'événement pour le bouton de suppression
    paramRow.querySelector('.remove-param').addEventListener('click', function() {
      paramRow.classList.add('fade-out');
      setTimeout(() => {
        searchParams.removeChild(paramRow);
      }, 300);
    });
    
    // Ajouter la ligne au conteneur
    searchParams.appendChild(paramRow);
    
    // Animation d'apparition
    paramRow.style.opacity = '0';
    paramRow.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      paramRow.style.opacity = '1';
      paramRow.style.transform = 'translateY(0)';
    }, 10);
  }
  
  // Effacer toutes les lignes de paramètres
  function clearParamRows() {
    const paramRows = searchParams.querySelectorAll('.param-pair');
    if (paramRows.length > 1) {
      // Garder la première ligne et effacer les autres
      for (let i = 1; i < paramRows.length; i++) {
        searchParams.removeChild(paramRows[i]);
      }
    }
    
    // Réinitialiser les champs de la première ligne
    if (paramRows.length > 0) {
      paramRows[0].querySelector('.param-name').value = '';
      paramRows[0].querySelector('.param-value').value = '';
    }
  }
  
  // Effectuer une recherche
  function performSearch(page) {
    // Afficher un indicateur de chargement
    resourceList.innerHTML = '<div class="loading-indicator"><div class="loader"></div> Chargement des résultats...</div>';
    resourceDetail.textContent = 'Chargement...';
    
    // URL du serveur sélectionné
    const serverUrl = serverSelect.value;
    
    // Construire l'URL de recherche
    const resourceType = resourceTypeSelect.value;
    let searchUrl = `${serverUrl}/${resourceType}?_format=json&_count=${pageSize}`;
    
    // Ajouter les paramètres de recherche depuis l'entrée principale
    if (searchInput.value.trim()) {
      searchUrl += `&${searchInput.value.trim()}`;
    }
    
    // Ajouter les paramètres de recherche avancés
    const paramRows = searchParams.querySelectorAll('.param-pair');
    paramRows.forEach(row => {
      const paramName = row.querySelector('.param-name').value.trim();
      const paramValue = row.querySelector('.param-value').value.trim();
      
      if (paramName && paramValue) {
        searchUrl += `&${paramName}=${encodeURIComponent(paramValue)}`;
      }
    });
    
    // Ajouter la pagination
    if (page > 1) {
      // Ajouter le paramètre de pagination (_page)
      searchUrl += `&_page=${page}`;
    }
    
    // Sauvegarder la recherche dans l'historique
    searchHistory.push(searchUrl);
    
    // Effectuer la requête
    updateStatusWithAnimation(`Recherche en cours: ${resourceType}...`, 'info');
    
    fetch(searchUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        // Traiter les résultats
        displaySearchResults(data, page);
        updateStatusWithAnimation(`Recherche terminée: ${data.total || '0'} résultat(s) trouvé(s).`, 'success');
      })
      .catch(error => {
        resourceList.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <div class="error-details">
              <h4>Erreur lors de la recherche</h4>
              <p>${error.message}</p>
            </div>
          </div>
        `;
        pagination.innerHTML = '';
        updateStatusWithAnimation(`Erreur de recherche: ${error.message}`, 'error');
      });
  }
  
  // Afficher les résultats de la recherche
  function displaySearchResults(data, currentPage) {
    // Vider la liste des ressources
    resourceList.innerHTML = '';
    
    // Vérifier si la réponse contient des entrées
    const entries = data.entry || [];
    const total = data.total || entries.length;
    
    // Afficher le nombre total de résultats
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
      resultsCount.textContent = `${total} résultat(s) trouvé(s)`;
    }
    
    if (entries.length === 0) {
      resourceList.innerHTML = `
        <div class="no-results" style="text-align: center; padding: 30px;">
          <i class="fas fa-search" style="font-size: 48px; color: #ccc; margin-bottom: 10px;"></i>
          <p style="font-size: 16px; color: #666;">Aucun résultat trouvé</p>
        </div>
      `;
      pagination.innerHTML = '';
      return;
    }
    
    // Créer un élément pour chaque ressource avec animation
    entries.forEach((entry, index) => {
      const resource = entry.resource;
      const resourceType = resource.resourceType;
      
      // Créer l'élément de liste
      const resourceItem = document.createElement('div');
      resourceItem.className = 'resource-item';
      resourceItem.dataset.index = index;
      
      // Ajouter un délai progressif pour l'animation
      resourceItem.style.opacity = '0';
      resourceItem.style.transform = 'translateY(10px)';
      
      // Déterminer le titre et le sous-titre à afficher selon le type de ressource
      let title = '';
      let subtitle = '';
      let badge = '';
      
      switch (resourceType) {
        case 'Patient':
          title = resource.name ? 
            resource.name.map(n => `${n.family || ''}, ${n.given ? n.given.join(' ') : ''}`).join('; ') : 
            'Patient sans nom';
          subtitle = `ID: ${resource.id} | Genre: ${resource.gender || 'Non spécifié'}`;
          
          if (resource.active === true) {
            badge = '<span style="background-color: #4caf50; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 5px;">Actif</span>';
          }
          break;
        case 'Observation':
          title = resource.code ? 
            (resource.code.text || resource.code.coding?.map(c => c.display).join(', ') || 'Observation') : 
            'Observation';
          subtitle = `Date: ${resource.effectiveDateTime || 'Non spécifiée'} | Statut: ${resource.status || ''}`;
          break;
        case 'Condition':
          title = resource.code ? 
            (resource.code.text || resource.code.coding?.map(c => c.display).join(', ') || 'Condition') : 
            'Condition';
          subtitle = `Début: ${resource.onsetDateTime || 'Non spécifié'} | Statut: ${resource.clinicalStatus?.coding?.[0]?.display || ''}`;
          break;
        default:
          title = `${resourceType} ${resource.id}`;
          subtitle = `Dernière mise à jour: ${resource.meta?.lastUpdated || 'Inconnue'}`;
      }
      
      resourceItem.innerHTML = `
        <div class="resource-info">
          <div class="resource-title">${title} ${badge}</div>
          <div class="resource-subtitle">${subtitle}</div>
        </div>
        <div class="resource-tag">${resourceType}</div>
        <div class="resource-action"><i class="fas fa-chevron-right"></i></div>
      `;
      
      // Ajouter un événement pour afficher les détails
      resourceItem.addEventListener('click', function() {
        // Supprimer la classe active de tous les éléments
        document.querySelectorAll('.resource-item').forEach(item => {
          item.classList.remove('active');
        });
        
        // Ajouter la classe active à l'élément cliqué
        this.classList.add('active');
        
        // Afficher les détails de la ressource
        displayResourceDetails(resource);
        
        // Sauvegarder la ressource sélectionnée
        selectedResource = resource;
      });
      
      // Ajouter l'élément à la liste
      resourceList.appendChild(resourceItem);
      
      // Animation d'apparition avec délai progressif
      setTimeout(() => {
        resourceItem.style.opacity = '1';
        resourceItem.style.transform = 'translateY(0)';
        resourceItem.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      }, index * 30); // Délai progressif basé sur l'index
    });
    
    // Créer la pagination
    createPagination(total, currentPage, pageSize);
  }
  
  // Afficher les détails d'une ressource
  function displayResourceDetails(resource) {
    // Formater le JSON pour l'affichage
    const formattedJson = JSON.stringify(resource, null, 2);
    
    // Afficher le JSON formaté
    resourceDetail.innerHTML = `
      <code class="language-json">${escapeHtml(formattedJson)}</code>
    `;
    
    // Highlight.js si disponible
    if (typeof hljs !== 'undefined') {
      hljs.highlightAll();
    }
  }
  
  // Créer la pagination
  function createPagination(total, currentPage, pageSize) {
    // Calculer le nombre total de pages
    totalPages = Math.ceil(total / pageSize);
    
    // Si une seule page, ne pas afficher la pagination
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }
    
    // Créer les boutons de pagination
    const paginationHtml = [];
    
    // Bouton précédent
    paginationHtml.push(`
      <button class="page-item ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
      </button>
    `);
    
    // Afficher un nombre limité de pages avec des ellipses si nécessaire
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    // Ajuster startPage si nécessaire
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    // Première page
    if (startPage > 1) {
      paginationHtml.push(`<button class="page-item" data-page="1">1</button>`);
      if (startPage > 2) {
        paginationHtml.push(`<button class="page-item disabled">...</button>`);
      }
    }
    
    // Pages numérotées
    for (let i = startPage; i <= endPage; i++) {
      paginationHtml.push(`<button class="page-item ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`);
    }
    
    // Dernière page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHtml.push(`<button class="page-item disabled">...</button>`);
      }
      paginationHtml.push(`<button class="page-item" data-page="${totalPages}">${totalPages}</button>`);
    }
    
    // Bouton suivant
    paginationHtml.push(`
      <button class="page-item ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
      </button>
    `);
    
    // Ajouter le HTML à la pagination
    pagination.innerHTML = paginationHtml.join('');
    
    // Ajouter les événements de clic
    pagination.querySelectorAll('.page-item:not(.disabled)').forEach(button => {
      button.addEventListener('click', function() {
        const page = parseInt(this.getAttribute('data-page'));
        if (page !== currentPage) {
          performSearch(page);
        }
      });
    });
  }
  
  // Mettre à jour la barre d'état avec animation
  function updateStatusWithAnimation(message, type) {
    // Types: info, success, error, warning
    statusBar.textContent = message;
    
    // Appliquer la classe de type
    statusBar.className = 'status-section';
    statusBar.classList.add(type);
    
    // Ajouter une animation
    statusBar.style.opacity = '0';
    statusBar.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
      statusBar.style.opacity = '1';
      statusBar.style.transform = 'translateY(0)';
    }, 10);
  }
  
  // Échapper les caractères HTML pour l'affichage sécurisé
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  // Initialisation
  function init() {
    // Ajouter une ligne de paramètre par défaut
    addParamRow();
    
    // Message initial
    updateStatusWithAnimation('Prêt à explorer les données FHIR', 'info');
  }
  
  // Démarrer l'application
  init();
});