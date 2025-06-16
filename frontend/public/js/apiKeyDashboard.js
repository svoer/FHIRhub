/**
 * Tableau de bord intelligent de gestion des clés API
 * Permet de créer, gérer et analyser les clés API
 */

// Configuration
const config = {
  apiBaseUrl: '/api',
  chartColors: {
    primary: 'rgba(255, 99, 132, 0.6)',
    secondary: 'rgba(54, 162, 235, 0.6)',
    success: 'rgba(75, 192, 192, 0.6)',
    warning: 'rgba(255, 159, 64, 0.6)',
    danger: 'rgba(255, 99, 132, 0.6)',
    info: 'rgba(54, 162, 235, 0.6)',
    background: 'rgba(255, 255, 255, 0.1)'
  }
};

// État global de l'application
const state = {
  applications: [],
  selectedApplication: null,
  apiKeys: [],
  selectedApiKey: null,
  apiKeyStats: null,
  charts: {}
};

/**
 * Initialiser le tableau de bord
 */
async function initDashboard() {
  try {
    console.log('Initialisation du tableau de bord des clés API');
    
    // Initialiser les éléments d'UI
    setupEventListeners();
    
    // Charger les applications
    await loadApplications();
    
    // Si au moins une application existe, la sélectionner
    if (state.applications.length > 0) {
      await selectApplication(state.applications[0].id);
    }
    
    console.log('Tableau de bord des clés API initialisé');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du tableau de bord:', error);
    showNotification('Erreur', 'Impossible de charger le tableau de bord', 'error');
  }
}

/**
 * Configurer les écouteurs d'événements
 */
function setupEventListeners() {
  // Bouton de création d'application
  document.getElementById('createApplicationBtn')?.addEventListener('click', () => showCreateApplicationModal());
  
  // Bouton de création de clé API
  document.getElementById('createApiKeyBtn')?.addEventListener('click', () => showCreateApiKeyModal());
  
  // Formulaire de création d'application
  document.getElementById('createApplicationForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    createApplication();
  });
  
  // Formulaire de création de clé API
  document.getElementById('createApiKeyForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    createApiKey();
  });
  
  // Sélecteur d'application
  document.getElementById('applicationSelect')?.addEventListener('change', (e) => {
    const applicationId = parseInt(e.target.value);
    if (applicationId) {
      selectApplication(applicationId);
    }
  });
}

/**
 * Charger les applications de l'utilisateur
 */
async function loadApplications() {
  try {
    const response = await fetch(`${config.apiBaseUrl}/applications`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors du chargement des applications');
    }
    
    state.applications = data.data;
    renderApplicationSelector();
  } catch (error) {
    console.error('Erreur lors du chargement des applications:', error);
    showNotification('Erreur', 'Impossible de charger les applications', 'error');
  }
}

/**
 * Afficher le sélecteur d'applications
 */
function renderApplicationSelector() {
  const selectElement = document.getElementById('applicationSelect');
  if (!selectElement) return;
  
  // Vider le sélecteur
  selectElement.innerHTML = '';
  
  // Ajouter l'option par défaut
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Sélectionner une application';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  selectElement.appendChild(defaultOption);
  
  // Ajouter les applications
  state.applications.forEach(app => {
    const option = document.createElement('option');
    option.value = app.id;
    option.textContent = app.name;
    selectElement.appendChild(option);
  });
}

/**
 * Sélectionner une application
 * @param {number} applicationId - ID de l'application
 */
async function selectApplication(applicationId) {
  try {
    state.selectedApplication = state.applications.find(app => app.id === applicationId);
    
    if (!state.selectedApplication) {
      throw new Error(`Application avec l'ID ${applicationId} non trouvée`);
    }
    
    // Mettre à jour le sélecteur
    const selectElement = document.getElementById('applicationSelect');
    if (selectElement) {
      selectElement.value = applicationId;
    }
    
    // Mettre à jour le titre de l'application
    const titleElement = document.getElementById('applicationTitle');
    if (titleElement) {
      titleElement.textContent = state.selectedApplication.name;
    }
    
    // Charger les clés API de l'application
    await loadApiKeys(applicationId);
    
    // Charger les statistiques de l'application
    await loadApplicationStats(applicationId);
  } catch (error) {
    console.error('Erreur lors de la sélection de l\'application:', error);
    showNotification('Erreur', 'Impossible de charger les détails de l\'application', 'error');
  }
}

/**
 * Charger les clés API d'une application
 * @param {number} applicationId - ID de l'application
 */
async function loadApiKeys(applicationId) {
  try {
    const response = await fetch(`${config.apiBaseUrl}/keys?application_id=${applicationId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors du chargement des clés API');
    }
    
    state.apiKeys = data.data;
    renderApiKeysList();
  } catch (error) {
    console.error('Erreur lors du chargement des clés API:', error);
    showNotification('Erreur', 'Impossible de charger les clés API', 'error');
  }
}

/**
 * Afficher la liste des clés API
 */
function renderApiKeysList() {
  const listElement = document.getElementById('apiKeysList');
  if (!listElement) return;
  
  // Vider la liste
  listElement.innerHTML = '';
  
  if (state.apiKeys.length === 0) {
    listElement.innerHTML = `
      <div class="no-data-message">
        <p>Aucune clé API pour cette application.</p>
        <button class="btn btn-primary" onclick="showCreateApiKeyModal()">
          <i class="fas fa-plus"></i> Créer une clé API
        </button>
      </div>
    `;
    return;
  }
  
  // Créer le tableau
  const table = document.createElement('table');
  table.className = 'table table-striped table-hover';
  
  // Créer l'en-tête du tableau
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Nom</th>
      <th>Clé</th>
      <th>Environnement</th>
      <th>Statut</th>
      <th>Utilisation</th>
      <th>Actions</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Créer le corps du tableau
  const tbody = document.createElement('tbody');
  
  state.apiKeys.forEach(key => {
    const tr = document.createElement('tr');
    
    // Déterminer la classe CSS pour le statut
    const statusClass = key.active === 1 ? 'success' : 'danger';
    const statusText = key.active === 1 ? 'Active' : 'Inactive';
    
    // Déterminer la classe CSS pour l'environnement
    const envClass = key.environment === 'production' ? 'danger' : 'info';
    
    tr.innerHTML = `
      <td>${key.name}</td>
      <td>
        <div class="api-key-container">
          <code class="api-key">${key.key}</code>
          <button class="btn btn-sm btn-outline-secondary copy-btn" data-key="${key.key}" title="Copier la clé">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </td>
      <td><span class="badge bg-${envClass}">${key.environment}</span></td>
      <td><span class="badge bg-${statusClass}">${statusText}</span></td>
      <td>
        <div class="usage-info">
          <span>${key.usage_count || 0} requêtes</span>
          <div class="progress" style="height: 6px;">
            <div class="progress-bar bg-success" role="progressbar" style="width: ${Math.min((key.usage_count || 0) / 100 * 100, 100)}%"></div>
          </div>
        </div>
      </td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-info view-stats-btn" data-id="${key.id}" title="Statistiques">
            <i class="fas fa-chart-bar"></i>
          </button>
          <button class="btn btn-sm btn-primary edit-key-btn" data-id="${key.id}" title="Modifier">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-warning regenerate-key-btn" data-id="${key.id}" title="Régénérer">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button class="btn btn-sm btn-danger delete-key-btn" data-id="${key.id}" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  listElement.appendChild(table);
  
  // Ajouter les écouteurs d'événements
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.target.closest('.copy-btn').dataset.key;
      copyToClipboard(key);
    });
  });
  
  document.querySelectorAll('.view-stats-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const keyId = parseInt(e.target.closest('.view-stats-btn').dataset.id);
      viewApiKeyStats(keyId);
    });
  });
  
  document.querySelectorAll('.edit-key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const keyId = parseInt(e.target.closest('.edit-key-btn').dataset.id);
      editApiKey(keyId);
    });
  });
  
  document.querySelectorAll('.regenerate-key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const keyId = parseInt(e.target.closest('.regenerate-key-btn').dataset.id);
      regenerateApiKey(keyId);
    });
  });
  
  document.querySelectorAll('.delete-key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const keyId = parseInt(e.target.closest('.delete-key-btn').dataset.id);
      confirmDeleteApiKey(keyId);
    });
  });
}

/**
 * Copier une clé API dans le presse-papier
 * @param {string} key - Clé API à copier
 */
function copyToClipboard(key) {
  navigator.clipboard.writeText(key)
    .then(() => {
      showNotification('Succès', 'Clé API copiée dans le presse-papier', 'success');
    })
    .catch(err => {
      console.error('Erreur lors de la copie de la clé API:', err);
      showNotification('Erreur', 'Impossible de copier la clé API', 'error');
    });
}

/**
 * Afficher le modal de création d'application
 */
function showCreateApplicationModal() {
  // Obtenir le modal
  const modal = document.getElementById('createApplicationModal');
  if (!modal) return;
  
  // Réinitialiser le formulaire
  document.getElementById('createApplicationForm')?.reset();
  
  // Afficher le modal
  const modalInstance = new bootstrap.Modal(modal);
  modalInstance.show();
}

/**
 * Afficher le modal de création de clé API
 */
function showCreateApiKeyModal() {
  // Vérifier si une application est sélectionnée
  if (!state.selectedApplication) {
    showNotification('Erreur', 'Veuillez sélectionner une application', 'error');
    return;
  }
  
  // Obtenir le modal
  const modal = document.getElementById('createApiKeyModal');
  if (!modal) return;
  
  // Réinitialiser le formulaire
  document.getElementById('createApiKeyForm')?.reset();
  
  // Remplir le champ application_id
  const applicationIdInput = document.getElementById('apiKeyApplicationId');
  if (applicationIdInput) {
    applicationIdInput.value = state.selectedApplication.id;
  }
  
  // Afficher le modal
  const modalInstance = new bootstrap.Modal(modal);
  modalInstance.show();
}

/**
 * Créer une nouvelle application
 */
async function createApplication() {
  try {
    const nameInput = document.getElementById('applicationName');
    const descriptionInput = document.getElementById('applicationDescription');
    
    if (!nameInput) {
      throw new Error('Formulaire incomplet');
    }
    
    const name = nameInput.value.trim();
    const description = descriptionInput ? descriptionInput.value.trim() : '';
    
    if (!name) {
      throw new Error('Le nom de l\'application est requis');
    }
    
    const response = await fetch(`${config.apiBaseUrl}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors de la création de l\'application');
    }
    
    // Fermer le modal
    const modal = document.getElementById('createApplicationModal');
    if (modal) {
      const modalInstance = bootstrap.Modal.getInstance(modal);
      modalInstance.hide();
    }
    
    // Recharger les applications
    await loadApplications();
    
    // Sélectionner la nouvelle application
    await selectApplication(data.data.id);
    
    showNotification('Succès', 'Application créée avec succès', 'success');
  } catch (error) {
    console.error('Erreur lors de la création de l\'application:', error);
    showNotification('Erreur', error.message || 'Impossible de créer l\'application', 'error');
  }
}

/**
 * Créer une nouvelle clé API
 */
async function createApiKey() {
  try {
    const applicationIdInput = document.getElementById('apiKeyApplicationId');
    const nameInput = document.getElementById('apiKeyName');
    const environmentInput = document.getElementById('apiKeyEnvironment');
    const expiresAtInput = document.getElementById('apiKeyExpiresAt');
    const rateLimitInput = document.getElementById('apiKeyRateLimit');
    const dailyLimitInput = document.getElementById('apiKeyDailyLimit');
    const monthlyLimitInput = document.getElementById('apiKeyMonthlyLimit');
    
    if (!applicationIdInput || !nameInput || !environmentInput) {
      throw new Error('Formulaire incomplet');
    }
    
    const application_id = parseInt(applicationIdInput.value);
    const name = nameInput.value.trim();
    const environment = environmentInput.value;
    const expires_at = expiresAtInput && expiresAtInput.value ? expiresAtInput.value : null;
    const rate_limit = rateLimitInput && rateLimitInput.value ? parseInt(rateLimitInput.value) : 100;
    const daily_limit = dailyLimitInput && dailyLimitInput.value ? parseInt(dailyLimitInput.value) : 1000;
    const monthly_limit = monthlyLimitInput && monthlyLimitInput.value ? parseInt(monthlyLimitInput.value) : 10000;
    
    if (!name) {
      throw new Error('Le nom de la clé API est requis');
    }
    
    const response = await fetch(`${config.apiBaseUrl}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        application_id,
        name,
        environment,
        expires_at,
        rate_limit,
        daily_limit,
        monthly_limit
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors de la création de la clé API');
    }
    
    // Fermer le modal
    const modal = document.getElementById('createApiKeyModal');
    if (modal) {
      const modalInstance = bootstrap.Modal.getInstance(modal);
      modalInstance.hide();
    }
    
    // Recharger les clés API
    await loadApiKeys(application_id);
    
    showNotification('Succès', 'Clé API créée avec succès', 'success');
    
    // Afficher un modal avec la clé API
    showApiKeyModal(data.data);
  } catch (error) {
    console.error('Erreur lors de la création de la clé API:', error);
    showNotification('Erreur', error.message || 'Impossible de créer la clé API', 'error');
  }
}

/**
 * Afficher un modal avec les détails d'une clé API
 * @param {Object} apiKey - Clé API à afficher
 */
function showApiKeyModal(apiKey) {
  // Créer le contenu du modal
  const modalContent = `
    <div class="modal fade" id="apiKeyDetailsModal" tabindex="-1" aria-labelledby="apiKeyDetailsModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="apiKeyDetailsModalLabel">Détails de la clé API</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              <i class="fas fa-exclamation-triangle"></i> Attention: Votre clé API n'est affichée qu'une seule fois. Copiez-la maintenant.
            </div>
            <div class="mb-3">
              <label class="form-label">Nom:</label>
              <p><strong>${apiKey.name}</strong></p>
            </div>
            <div class="mb-3">
              <label class="form-label">Clé API:</label>
              <div class="input-group">
                <input type="text" class="form-control" value="${apiKey.key}" readonly id="apiKeyValue">
                <button class="btn btn-outline-secondary" type="button" onclick="copyApiKeyToClipboard()">
                  <i class="fas fa-copy"></i> Copier
                </button>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Environnement:</label>
              <p><span class="badge bg-${apiKey.environment === 'production' ? 'danger' : 'info'}">${apiKey.environment}</span></p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Ajouter le modal à la page
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalContent;
  document.body.appendChild(modalContainer);
  
  // Afficher le modal
  const modal = document.getElementById('apiKeyDetailsModal');
  const modalInstance = new bootstrap.Modal(modal);
  modalInstance.show();
  
  // Ajouter un écouteur d'événement pour supprimer le modal une fois fermé
  modal.addEventListener('hidden.bs.modal', () => {
    document.body.removeChild(modalContainer);
  });
}

/**
 * Copier la clé API du modal dans le presse-papier
 */
function copyApiKeyToClipboard() {
  const apiKeyInput = document.getElementById('apiKeyValue');
  if (apiKeyInput) {
    apiKeyInput.select();
    navigator.clipboard.writeText(apiKeyInput.value)
      .then(() => {
        showNotification('Succès', 'Clé API copiée dans le presse-papier', 'success');
      })
      .catch(err => {
        console.error('Erreur lors de la copie de la clé API:', err);
        showNotification('Erreur', 'Impossible de copier la clé API', 'error');
      });
  }
}

/**
 * Afficher les statistiques d'une clé API
 * @param {number} keyId - ID de la clé API
 */
async function viewApiKeyStats(keyId) {
  try {
    // Récupérer les statistiques de la clé API
    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}/stats`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors du chargement des statistiques');
    }
    
    state.selectedApiKey = state.apiKeys.find(key => key.id === keyId);
    state.apiKeyStats = data.data;
    
    // Afficher les statistiques
    renderApiKeyStats();
    
    // Faire défiler la page vers la section des statistiques
    document.getElementById('apiKeyStatsSection')?.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error);
    showNotification('Erreur', 'Impossible de charger les statistiques', 'error');
  }
}

/**
 * Afficher les statistiques d'une clé API
 */
function renderApiKeyStats() {
  const statsSection = document.getElementById('apiKeyStatsSection');
  if (!statsSection) return;
  
  // Afficher la section des statistiques
  statsSection.style.display = 'block';
  
  // Mettre à jour le titre
  const titleElement = document.getElementById('apiKeyStatsTitle');
  if (titleElement && state.selectedApiKey) {
    titleElement.textContent = `Statistiques de la clé: ${state.selectedApiKey.name}`;
  }
  
  if (!state.apiKeyStats) {
    statsSection.innerHTML = '<p>Données statistiques non disponibles</p>';
    return;
  }
  
  // Mettre à jour les indicateurs clés
  updateKeyMetrics();
  
  // Mettre à jour les graphiques
  updateCharts();
}

/**
 * Mettre à jour les indicateurs clés
 */
function updateKeyMetrics() {
  if (!state.apiKeyStats) return;
  
  const keyMetrics = [
    {
      id: 'totalRequestsValue',
      value: state.apiKeyStats.apiKey.usage_count || 0,
      label: 'Requêtes totales'
    },
    {
      id: 'dailyUsageValue',
      value: state.apiKeyStats.limits.current_daily_usage || 0,
      max: state.apiKeyStats.limits.daily_limit || 1000,
      label: 'Utilisation quotidienne'
    },
    {
      id: 'monthlyUsageValue',
      value: state.apiKeyStats.limits.current_monthly_usage || 0,
      max: state.apiKeyStats.limits.monthly_limit || 10000,
      label: 'Utilisation mensuelle'
    }
  ];
  
  keyMetrics.forEach(metric => {
    const element = document.getElementById(metric.id);
    if (element) {
      // Mettre à jour la valeur
      element.textContent = metric.value;
      
      // Mettre à jour la progression si nécessaire
      if (metric.max) {
        const progressId = metric.id.replace('Value', 'Progress');
        const progressElement = document.getElementById(progressId);
        if (progressElement) {
          const percentage = Math.min((metric.value / metric.max) * 100, 100);
          progressElement.style.width = `${percentage}%`;
          
          // Mettre à jour la couleur de la barre de progression
          if (percentage > 90) {
            progressElement.className = 'progress-bar bg-danger';
          } else if (percentage > 70) {
            progressElement.className = 'progress-bar bg-warning';
          } else {
            progressElement.className = 'progress-bar bg-success';
          }
        }
        
        // Mettre à jour le texte du maximum
        const maxId = metric.id.replace('Value', 'Max');
        const maxElement = document.getElementById(maxId);
        if (maxElement) {
          maxElement.textContent = metric.max;
        }
      }
    }
  });
}

/**
 * Mettre à jour les graphiques
 */
function updateCharts() {
  if (!state.apiKeyStats) return;
  
  // Mise à jour du graphique d'utilisation quotidienne
  updateDailyUsageChart();
  
  // Mise à jour du graphique d'erreurs
  updateErrorsChart();
  
  // Mise à jour du graphique de temps de réponse
  updateResponseTimeChart();
}

/**
 * Mettre à jour le graphique d'utilisation quotidienne
 */
function updateDailyUsageChart() {
  const chartCanvas = document.getElementById('dailyUsageChart');
  if (!chartCanvas) return;
  
  // Obtenir les données d'utilisation quotidienne
  const dailyUsage = state.apiKeyStats.usage.daily || [];
  
  // Préparer les données pour le graphique
  const labels = dailyUsage.map(item => {
    const date = new Date(item.date);
    return date.toLocaleDateString();
  });
  
  const data = dailyUsage.map(item => item.count);
  
  // Détruire le graphique existant s'il existe
  if (state.charts.dailyUsage) {
    state.charts.dailyUsage.destroy();
  }
  
  // Créer le nouveau graphique
  state.charts.dailyUsage = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Nombre de requêtes',
        data: data,
        backgroundColor: config.chartColors.primary,
        borderColor: config.chartColors.primary,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Utilisation quotidienne'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

/**
 * Mettre à jour le graphique d'erreurs
 */
function updateErrorsChart() {
  const chartCanvas = document.getElementById('errorsChart');
  if (!chartCanvas) return;
  
  // Obtenir les données d'erreurs
  const errors = state.apiKeyStats.usage.errors || [];
  
  // Préparer les données pour le graphique
  const labels = errors.map(item => `Erreur ${item.status_code}`);
  const data = errors.map(item => item.count);
  
  // Détruire le graphique existant s'il existe
  if (state.charts.errors) {
    state.charts.errors.destroy();
  }
  
  // Créer le nouveau graphique
  state.charts.errors = new Chart(chartCanvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Erreurs',
        data: data,
        backgroundColor: [
          config.chartColors.danger,
          config.chartColors.warning,
          config.chartColors.info,
          config.chartColors.success,
          config.chartColors.secondary
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Distribution des erreurs'
        }
      }
    }
  });
}

/**
 * Mettre à jour le graphique de temps de réponse
 */
function updateResponseTimeChart() {
  const chartCanvas = document.getElementById('responseTimeChart');
  if (!chartCanvas) return;
  
  // Obtenir les données de temps de réponse par endpoint
  const endpoints = state.apiKeyStats.usage.endpoints || [];
  
  // Préparer les données pour le graphique
  const labels = endpoints.map(item => item.endpoint);
  const data = endpoints.map(item => item.avg_response_time);
  
  // Détruire le graphique existant s'il existe
  if (state.charts.responseTime) {
    state.charts.responseTime.destroy();
  }
  
  // Créer le nouveau graphique
  state.charts.responseTime = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Temps de réponse moyen (ms)',
        data: data,
        backgroundColor: config.chartColors.info,
        borderColor: config.chartColors.info,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Temps de réponse par endpoint'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Charger les statistiques d'une application
 * @param {number} applicationId - ID de l'application
 */
async function loadApplicationStats(applicationId) {
  try {
    const response = await fetch(`${config.apiBaseUrl}/applications/${applicationId}/stats`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors du chargement des statistiques');
    }
    
    renderApplicationStats(data.data);
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques de l\'application:', error);
  }
}

/**
 * Afficher les statistiques d'une application
 * @param {Object} stats - Statistiques de l'application
 */
function renderApplicationStats(stats) {
  if (!stats) return;
  
  // Mettre à jour le nombre de clés API
  const keysCountElement = document.getElementById('applicationKeysCount');
  if (keysCountElement) {
    keysCountElement.textContent = stats.stats.keys_count;
  }
  
  // Mettre à jour le nombre de conversions
  const conversionsCountElement = document.getElementById('applicationConversionsCount');
  if (conversionsCountElement) {
    conversionsCountElement.textContent = stats.stats.conversions_count;
  }
}

/**
 * Modifier une clé API
 * @param {number} keyId - ID de la clé API
 */
async function editApiKey(keyId) {
  try {
    // Récupérer la clé API
    const apiKey = state.apiKeys.find(key => key.id === keyId);
    
    if (!apiKey) {
      throw new Error(`Clé API avec l'ID ${keyId} non trouvée`);
    }
    
    // Créer le contenu du modal
    const modalContent = `
      <div class="modal fade" id="editApiKeyModal" tabindex="-1" aria-labelledby="editApiKeyModalLabel" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="editApiKeyModalLabel">Modifier la clé API</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              <form id="editApiKeyForm">
                <input type="hidden" id="editApiKeyId" value="${apiKey.id}">
                
                <div class="mb-3">
                  <label for="editApiKeyName" class="form-label">Nom</label>
                  <input type="text" class="form-control" id="editApiKeyName" value="${apiKey.name}" required>
                </div>
                
                <div class="mb-3">
                  <label for="editApiKeyActive" class="form-label">Statut</label>
                  <select class="form-select" id="editApiKeyActive">
                    <option value="1" ${apiKey.active === 1 ? 'selected' : ''}>Active</option>
                    <option value="0" ${apiKey.active !== 1 ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
                
                <div class="mb-3">
                  <label for="editApiKeyExpiresAt" class="form-label">Date d'expiration</label>
                  <input type="date" class="form-control" id="editApiKeyExpiresAt" value="${apiKey.expires_at ? apiKey.expires_at.substring(0, 10) : ''}">
                  <div class="form-text">Laissez vide pour une clé sans date d'expiration</div>
                </div>
                
                <div class="mb-3">
                  <label for="editApiKeyRateLimit" class="form-label">Limite de requêtes par seconde</label>
                  <input type="number" class="form-control" id="editApiKeyRateLimit" value="${apiKey.rate_limit || 100}" min="1">
                </div>
                
                <div class="mb-3">
                  <label for="editApiKeyDailyLimit" class="form-label">Limite quotidienne</label>
                  <input type="number" class="form-control" id="editApiKeyDailyLimit" value="1000" min="1">
                </div>
                
                <div class="mb-3">
                  <label for="editApiKeyMonthlyLimit" class="form-label">Limite mensuelle</label>
                  <input type="number" class="form-control" id="editApiKeyMonthlyLimit" value="10000" min="1">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
              <button type="button" class="btn btn-primary" id="saveApiKeyBtn">Enregistrer</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Ajouter le modal à la page
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalContent;
    document.body.appendChild(modalContainer);
    
    // Afficher le modal
    const modal = document.getElementById('editApiKeyModal');
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    
    // Ajouter un écouteur d'événement pour le bouton d'enregistrement
    document.getElementById('saveApiKeyBtn')?.addEventListener('click', async () => {
      await saveApiKeyChanges();
      modalInstance.hide();
    });
    
    // Ajouter un écouteur d'événement pour supprimer le modal une fois fermé
    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modalContainer);
    });
  } catch (error) {
    console.error('Erreur lors de la modification de la clé API:', error);
    showNotification('Erreur', error.message || 'Impossible de modifier la clé API', 'error');
  }
}

/**
 * Enregistrer les modifications d'une clé API
 */
async function saveApiKeyChanges() {
  try {
    const keyId = parseInt(document.getElementById('editApiKeyId')?.value);
    const name = document.getElementById('editApiKeyName')?.value.trim();
    const active = document.getElementById('editApiKeyActive')?.value === '1';
    const expires_at = document.getElementById('editApiKeyExpiresAt')?.value || null;
    const rate_limit = parseInt(document.getElementById('editApiKeyRateLimit')?.value || '100');
    const daily_limit = parseInt(document.getElementById('editApiKeyDailyLimit')?.value || '1000');
    const monthly_limit = parseInt(document.getElementById('editApiKeyMonthlyLimit')?.value || '10000');
    
    if (!keyId || !name) {
      throw new Error('Formulaire incomplet');
    }
    
    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        active,
        expires_at,
        rate_limit,
        daily_limit,
        monthly_limit
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors de la mise à jour de la clé API');
    }
    
    // Recharger les clés API
    await loadApiKeys(state.selectedApplication.id);
    
    showNotification('Succès', 'Clé API mise à jour avec succès', 'success');
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la clé API:', error);
    showNotification('Erreur', error.message || 'Impossible de mettre à jour la clé API', 'error');
  }
}

/**
 * Régénérer une clé API
 * @param {number} keyId - ID de la clé API
 */
async function regenerateApiKey(keyId) {
  try {
    // Demander confirmation
    if (!confirm('Êtes-vous sûr de vouloir régénérer cette clé API ? Cette action est irréversible et la clé actuelle ne fonctionnera plus.')) {
      return;
    }
    
    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}/regenerate`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors de la régénération de la clé API');
    }
    
    // Recharger les clés API
    await loadApiKeys(state.selectedApplication.id);
    
    showNotification('Succès', 'Clé API régénérée avec succès', 'success');
    
    // Afficher un modal avec la nouvelle clé API
    showApiKeyModal(data.data);
  } catch (error) {
    console.error('Erreur lors de la régénération de la clé API:', error);
    showNotification('Erreur', error.message || 'Impossible de régénérer la clé API', 'error');
  }
}

/**
 * Confirmer la suppression d'une clé API
 * @param {number} keyId - ID de la clé API
 */
function confirmDeleteApiKey(keyId) {
  try {
    // Récupérer la clé API
    const apiKey = state.apiKeys.find(key => key.id === keyId);
    
    if (!apiKey) {
      throw new Error(`Clé API avec l'ID ${keyId} non trouvée`);
    }
    
    // Créer le contenu du modal
    const modalContent = `
      <div class="modal fade" id="deleteApiKeyModal" tabindex="-1" aria-labelledby="deleteApiKeyModalLabel" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="deleteApiKeyModalLabel">Confirmer la suppression</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i> Attention: Cette action est irréversible.
              </div>
              <p>Êtes-vous sûr de vouloir supprimer la clé API <strong>"${apiKey.name}"</strong> ?</p>
              <p>Cette clé est utilisée pour l'environnement <span class="badge bg-${apiKey.environment === 'production' ? 'danger' : 'info'}">${apiKey.environment}</span>.</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
              <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Supprimer</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Ajouter le modal à la page
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalContent;
    document.body.appendChild(modalContainer);
    
    // Afficher le modal
    const modal = document.getElementById('deleteApiKeyModal');
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    
    // Ajouter un écouteur d'événement pour le bouton de confirmation
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
      await deleteApiKey(keyId);
      modalInstance.hide();
    });
    
    // Ajouter un écouteur d'événement pour supprimer le modal une fois fermé
    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modalContainer);
    });
  } catch (error) {
    console.error('Erreur lors de la confirmation de suppression:', error);
    showNotification('Erreur', error.message || 'Impossible de préparer la suppression', 'error');
  }
}

/**
 * Supprimer une clé API
 * @param {number} keyId - ID de la clé API
 */
async function deleteApiKey(keyId) {
  try {
    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors de la suppression de la clé API');
    }
    
    // Recharger les clés API
    await loadApiKeys(state.selectedApplication.id);
    
    showNotification('Succès', 'Clé API supprimée avec succès', 'success');
  } catch (error) {
    console.error('Erreur lors de la suppression de la clé API:', error);
    showNotification('Erreur', error.message || 'Impossible de supprimer la clé API', 'error');
  }
}

/**
 * Afficher une notification
 * @param {string} title - Titre de la notification
 * @param {string} message - Message de la notification
 * @param {string} type - Type de la notification (success, error, warning, info)
 */
function showNotification(title, message, type = 'info') {
  // Utiliser toastr si disponible
  if (typeof toastr !== 'undefined') {
    toastr[type](message, title);
    return;
  }
  
  // Fallback vers une alerte simple
  alert(`${title}: ${message}`);
}

// Initialiser le tableau de bord quand la page est chargée
document.addEventListener('DOMContentLoaded', initDashboard);