/**
 * JavaScript pour le tableau de bord FHIRHub
 * Gère l'interaction avec l'API et la mise à jour de l'interface
 */

// Configuration
const API_KEY = 'dev-key';
const API_BASE_URL = '/api';

// Variables globales
let currentSection = 'system-stats';
let applications = [];
let apiKeys = [];
let conversionLogs = [];

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
    setupEventListeners();
});

/**
 * Initialiser le tableau de bord
 */
async function initializeDashboard() {
    try {
        // Charger les données initiales
        await Promise.all([
            loadSystemStats(),
            loadApplications(),
            loadApiKeys(),
            loadConversionLogs()
        ]);

        // Mettre à jour l'interface
        updateSystemStatusBars();
        
        // Rafraîchir les statistiques périodiquement
        setInterval(loadSystemStats, 30000);
        
        console.log('Tableau de bord initialisé avec succès');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation du tableau de bord:', error);
        showErrorNotification('Erreur lors de l\'initialisation du tableau de bord');
    }
}

/**
 * Configurer les écouteurs d'événements
 */
function setupEventListeners() {
    // Navigation du menu latéral
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.target.getAttribute('data-section');
            changeSection(section);
        });
    });

    // Boutons pour les nouvelles entités
    document.getElementById('create-app-btn')?.addEventListener('click', () => showModal('create-app-modal'));
    document.getElementById('create-key-btn')?.addEventListener('click', () => showModal('create-key-modal'));
    document.getElementById('add-user-btn')?.addEventListener('click', () => showModal('add-user-modal'));
    
    // Boutons pour fermer les modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeAllModals());
    });
    
    // Soumission des formulaires
    document.getElementById('save-new-app-btn')?.addEventListener('click', createNewApplication);
    document.getElementById('save-new-key-btn')?.addEventListener('click', createNewApiKey);
    document.getElementById('save-new-user-btn')?.addEventListener('click', createNewUser);
    
    // Bouton de copie de la clé API
    document.getElementById('copy-api-key-btn')?.addEventListener('click', copyApiKey);
    
    // Boutons d'export et nettoyage des logs
    document.getElementById('export-logs-btn')?.addEventListener('click', exportLogs);
    document.getElementById('clear-logs-btn')?.addEventListener('click', confirmClearLogs);
    
    // Filtres de recherche
    setupSearchFilters();
    
    // Pagination
    setupPaginationControls();
    
    // Déconnexion
    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

/**
 * Configurer les filtres de recherche
 */
function setupSearchFilters() {
    // Applications
    document.getElementById('app-search')?.addEventListener('input', filterApplications);
    document.getElementById('app-status-filter')?.addEventListener('change', filterApplications);
    
    // Clés API
    document.getElementById('key-search')?.addEventListener('input', filterApiKeys);
    document.getElementById('key-app-filter')?.addEventListener('change', filterApiKeys);
    document.getElementById('key-env-filter')?.addEventListener('change', filterApiKeys);
    document.getElementById('key-status-filter')?.addEventListener('change', filterApiKeys);
    
    // Logs
    document.getElementById('log-search')?.addEventListener('input', filterLogs);
    document.getElementById('log-app-filter')?.addEventListener('change', filterLogs);
    document.getElementById('log-status-filter')?.addEventListener('change', filterLogs);
    document.getElementById('log-period-filter')?.addEventListener('change', filterLogs);
}

/**
 * Configurer les contrôles de pagination
 */
function setupPaginationControls() {
    // Applications
    document.getElementById('prev-apps-page')?.addEventListener('click', () => changePage('applications', -1));
    document.getElementById('next-apps-page')?.addEventListener('click', () => changePage('applications', 1));
    
    // Clés API
    document.getElementById('prev-keys-page')?.addEventListener('click', () => changePage('api-keys', -1));
    document.getElementById('next-keys-page')?.addEventListener('click', () => changePage('api-keys', 1));
    
    // Logs
    document.getElementById('prev-logs-page')?.addEventListener('click', () => changePage('logs', -1));
    document.getElementById('next-logs-page')?.addEventListener('click', () => changePage('logs', 1));
}

/**
 * Charger les statistiques système
 */
async function loadSystemStats() {
    try {
        const response = await fetchWithApiKey(`${API_BASE_URL}/stats`);
        
        if (response.success) {
            const { system, activity } = response.data;
            
            // Mettre à jour les métriques système
            document.getElementById('cpu-value').textContent = `${system.cpu}%`;
            document.getElementById('cpu-usage').style.width = `${system.cpu}%`;
            
            document.getElementById('ram-value').textContent = `${system.memory}%`;
            document.getElementById('ram-usage').style.width = `${system.memory}%`;
            
            document.getElementById('disk-value').textContent = `${system.disk}%`;
            document.getElementById('disk-usage').style.width = `${system.disk}%`;
            
            // Mettre à jour les statistiques d'activité
            document.getElementById('total-conversions').textContent = activity.totalConversions;
            document.getElementById('active-keys').textContent = activity.activeApiKeys;
            document.getElementById('total-applications').textContent = activity.totalApplications;
            document.getElementById('success-rate').textContent = `${activity.successRate}%`;
            
            console.log('Statistiques système mises à jour');
        } else {
            console.error('Erreur lors du chargement des statistiques:', response);
        }
    } catch (error) {
        console.error('Error fetching statistics:', error);
    }
}

/**
 * Mettre à jour les barres de statut système
 */
function updateSystemStatusBars() {
    // Obtenir les valeurs actuelles
    const cpuValue = parseInt(document.getElementById('cpu-value').textContent);
    const ramValue = parseInt(document.getElementById('ram-value').textContent);
    const diskValue = parseInt(document.getElementById('disk-value').textContent);
    
    // Mettre à jour les classes CSS en fonction des seuils
    updateStatusBarClass('cpu-usage', cpuValue);
    updateStatusBarClass('ram-usage', ramValue);
    updateStatusBarClass('disk-usage', diskValue);
}

/**
 * Mettre à jour la classe CSS d'une barre de statut
 */
function updateStatusBarClass(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Supprimer les classes existantes
    element.classList.remove('warning', 'critical');
    
    // Ajouter la classe appropriée
    if (value >= 80) {
        element.classList.add('critical');
    } else if (value >= 60) {
        element.classList.add('warning');
    }
}

/**
 * Charger la liste des applications
 */
async function loadApplications() {
    try {
        const response = await fetchWithApiKey(`${API_BASE_URL}/applications`);
        
        if (response.success) {
            applications = response.data;
            renderApplicationsTable(applications);
            populateApplicationDropdowns();
            console.log('Applications chargées:', applications.length);
        } else {
            console.error('Erreur lors du chargement des applications:', response);
        }
    } catch (error) {
        console.error('Error fetching applications:', error);
    }
}

/**
 * Charger la liste des clés API
 */
async function loadApiKeys() {
    try {
        const response = await fetchWithApiKey(`${API_BASE_URL}/api-keys`);
        
        if (response.success) {
            apiKeys = response.data;
            renderApiKeysTable(apiKeys);
            console.log('Clés API chargées:', apiKeys.length);
        } else {
            console.error('Erreur lors du chargement des clés API:', response);
        }
    } catch (error) {
        console.error('Error fetching API keys:', error);
    }
}

/**
 * Charger l'historique des conversions
 */
async function loadConversionLogs() {
    try {
        const response = await fetchWithApiKey(`${API_BASE_URL}/conversions`);
        
        if (response.success) {
            conversionLogs = response.data;
            renderLogsTable(conversionLogs);
            console.log('Journaux de conversion chargés:', conversionLogs.length);
        } else {
            console.error('Erreur lors du chargement des journaux de conversion:', response);
        }
    } catch (error) {
        console.error('Error fetching conversion history:', error);
    }
}

/**
 * Effectuer une requête API avec la clé API
 */
async function fetchWithApiKey(url) {
    try {
        // Ajouter la clé API à l'URL
        const urlWithKey = `${url}${url.includes('?') ? '&' : '?'}apiKey=${API_KEY}`;
        
        const response = await fetch(urlWithKey);
        
        // Vérifier si la réponse est JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            return data;
        } else {
            // Si la réponse n'est pas JSON, afficher une erreur
            const text = await response.text();
            console.error('Début de la réponse:', text.substring(0, 500));
            throw new Error('Réponse HTML reçue au lieu de JSON. Problème de routage API probable.');
        }
    } catch (error) {
        console.error('Erreur lors de la requête API:', error);
        throw error;
    }
}

/**
 * Afficher une notification d'erreur
 */
function showErrorNotification(message) {
    // Créer un élément de notification
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <span class="message">${message}</span>
        <button class="close-notification">&times;</button>
    `;
    
    // Ajouter au DOM
    document.body.appendChild(notification);
    
    // Ajouter la classe active après un court délai pour l'animation
    setTimeout(() => {
        notification.classList.add('active');
    }, 10);
    
    // Configurer la fermeture
    const closeBtn = notification.querySelector('.close-notification');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('active');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
    
    // Fermer automatiquement après 5 secondes
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.classList.remove('active');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }, 5000);
}

/**
 * Afficher une notification de succès
 */
function showSuccessNotification(message) {
    // Créer un élément de notification
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
        <span class="message">${message}</span>
        <button class="close-notification">&times;</button>
    `;
    
    // Ajouter au DOM
    document.body.appendChild(notification);
    
    // Ajouter la classe active après un court délai pour l'animation
    setTimeout(() => {
        notification.classList.add('active');
    }, 10);
    
    // Configurer la fermeture
    const closeBtn = notification.querySelector('.close-notification');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('active');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
    
    // Fermer automatiquement après 3 secondes
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.classList.remove('active');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }, 3000);
}

/**
 * Changer de section
 */
function changeSection(sectionId) {
    // Masquer toutes les sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Afficher la section sélectionnée
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Mettre à jour la navigation
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
        }
    });
    
    // Mettre à jour la section actuelle
    currentSection = sectionId;
    
    console.log('Section changée:', sectionId);
}

/**
 * Afficher une modale
 */
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Fermer toutes les modales
 */
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

/**
 * Créer une nouvelle application
 */
async function createNewApplication() {
    const name = document.getElementById('new-app-name')?.value;
    const description = document.getElementById('new-app-description')?.value;
    const status = document.getElementById('new-app-status')?.value;
    
    if (!name) {
        showErrorNotification('Veuillez saisir un nom pour l\'application');
        return;
    }
    
    try {
        // TODO: Implémenter l'appel API pour créer une application
        console.log('Création d\'une nouvelle application:', { name, description, status });
        
        // Simuler une création réussie
        const newApp = {
            id: applications.length + 1,
            name,
            description,
            owner: 'admin',
            status,
            apiKeyCount: 0,
            totalUsage: 0,
            createdAt: new Date().toISOString()
        };
        
        applications.push(newApp);
        renderApplicationsTable(applications);
        populateApplicationDropdowns();
        
        closeAllModals();
        showSuccessNotification('Application créée avec succès');
    } catch (error) {
        console.error('Erreur lors de la création de l\'application:', error);
        showErrorNotification('Erreur lors de la création de l\'application');
    }
}

/**
 * Créer une nouvelle clé API
 */
async function createNewApiKey() {
    const name = document.getElementById('new-key-name')?.value;
    const applicationId = document.getElementById('new-key-app')?.value;
    const environment = document.getElementById('new-key-env')?.value;
    const expiresStr = document.getElementById('new-key-expires')?.value;
    const rateLimit = document.getElementById('new-key-rate-limit')?.value;
    const ipRestrictions = document.getElementById('new-key-ip')?.value;
    
    if (!name || !applicationId) {
        showErrorNotification('Veuillez remplir tous les champs obligatoires');
        return;
    }
    
    try {
        // TODO: Implémenter l'appel API pour créer une clé API
        console.log('Création d\'une nouvelle clé API:', { 
            name, applicationId, environment, expiresStr, rateLimit, ipRestrictions 
        });
        
        // Simuler une création réussie
        const newKey = `fhir_${Math.random().toString(36).substring(2, 12)}`;
        
        // Afficher la modale avec la nouvelle clé
        document.getElementById('new-api-key-display').textContent = newKey;
        closeAllModals();
        showModal('key-created-modal');
        
        // Ajouter à la liste
        const app = applications.find(a => a.id.toString() === applicationId.toString());
        const newApiKey = {
            id: apiKeys.length + 1,
            name,
            key: newKey,
            applicationId: parseInt(applicationId),
            applicationName: app ? app.name : 'Application inconnue',
            environment,
            status: 'active',
            usage: 0,
            expiresAt: expiresStr ? new Date(expiresStr).toISOString() : null
        };
        
        apiKeys.push(newApiKey);
        renderApiKeysTable(apiKeys);
    } catch (error) {
        console.error('Erreur lors de la création de la clé API:', error);
        showErrorNotification('Erreur lors de la création de la clé API');
    }
}

/**
 * Créer un nouvel utilisateur
 */
async function createNewUser() {
    const username = document.getElementById('new-username')?.value;
    const email = document.getElementById('new-email')?.value;
    const password = document.getElementById('new-password')?.value;
    const role = document.getElementById('new-user-role')?.value;
    
    if (!username || !email || !password) {
        showErrorNotification('Veuillez remplir tous les champs obligatoires');
        return;
    }
    
    try {
        // TODO: Implémenter l'appel API pour créer un utilisateur
        console.log('Création d\'un nouvel utilisateur:', { username, email, role });
        
        // Simuler une création réussie
        closeAllModals();
        showSuccessNotification('Utilisateur créé avec succès');
        
        // Recharger la table des utilisateurs
        const usersTableBody = document.getElementById('users-table-body');
        if (usersTableBody) {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${username}</td>
                <td>${email}</td>
                <td><span class="badge ${role}">${role === 'admin' ? 'Administrateur' : 'Utilisateur'}</span></td>
                <td>Jamais</td>
                <td>
                    <button class="action-btn edit-btn">Modifier</button>
                    <button class="action-btn delete-btn">Supprimer</button>
                </td>
            `;
            usersTableBody.appendChild(newRow);
        }
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        showErrorNotification('Erreur lors de la création de l\'utilisateur');
    }
}

/**
 * Copier la clé API dans le presse-papiers
 */
function copyApiKey() {
    const keyDisplay = document.getElementById('new-api-key-display');
    if (keyDisplay) {
        const keyText = keyDisplay.textContent;
        
        // Créer un élément temporaire pour la copie
        const tempInput = document.createElement('input');
        tempInput.value = keyText;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        
        showSuccessNotification('Clé API copiée dans le presse-papiers');
    }
}

/**
 * Exporter les logs de conversion
 */
function exportLogs() {
    try {
        // Préparer les données pour l'export
        const data = conversionLogs.map(log => ({
            'Date/Heure': log.timestamp,
            'Application': log.applicationName,
            'Clé API': log.apiKey,
            'Type de source': log.sourceType,
            'Statut': log.status,
            'Temps de traitement (ms)': log.processingTime,
            'Message d\'erreur': log.errorMessage || ''
        }));
        
        // Convertir en CSV
        let csv = Object.keys(data[0]).join(',') + '\n';
        data.forEach(row => {
            csv += Object.values(row).map(value => `"${value}"`).join(',') + '\n';
        });
        
        // Créer un lien de téléchargement
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `conversion_logs_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccessNotification('Logs exportés avec succès');
    } catch (error) {
        console.error('Erreur lors de l\'export des logs:', error);
        showErrorNotification('Erreur lors de l\'export des logs');
    }
}

/**
 * Confirmer le nettoyage des logs
 */
function confirmClearLogs() {
    // Configurer la modale de confirmation
    const titleEl = document.getElementById('confirmation-title');
    const messageEl = document.getElementById('confirmation-message');
    const confirmBtn = document.getElementById('confirm-action-btn');
    
    if (titleEl && messageEl && confirmBtn) {
        titleEl.textContent = 'Confirmer le nettoyage';
        messageEl.textContent = 'Êtes-vous sûr de vouloir supprimer tous les journaux de conversion ? Cette action est irréversible.';
        
        // Configurer le bouton de confirmation
        confirmBtn.onclick = clearLogs;
        
        // Afficher la modale
        showModal('confirmation-modal');
    }
}

/**
 * Nettoyer les logs de conversion
 */
async function clearLogs() {
    try {
        // TODO: Implémenter l'appel API pour nettoyer les logs
        console.log('Nettoyage des journaux de conversion');
        
        // Simuler un nettoyage réussi
        conversionLogs = [];
        renderLogsTable(conversionLogs);
        
        closeAllModals();
        showSuccessNotification('Journaux nettoyés avec succès');
    } catch (error) {
        console.error('Erreur lors du nettoyage des journaux:', error);
        showErrorNotification('Erreur lors du nettoyage des journaux');
    }
}

/**
 * Filtrer la table des applications
 */
function filterApplications() {
    const searchTerm = document.getElementById('app-search')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('app-status-filter')?.value || 'all';
    
    const filtered = applications.filter(app => {
        const matchesSearch = app.name.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    renderApplicationsTable(filtered);
}

/**
 * Filtrer la table des clés API
 */
function filterApiKeys() {
    const searchTerm = document.getElementById('key-search')?.value.toLowerCase() || '';
    const appFilter = document.getElementById('key-app-filter')?.value || 'all';
    const envFilter = document.getElementById('key-env-filter')?.value || 'all';
    const statusFilter = document.getElementById('key-status-filter')?.value || 'all';
    
    const filtered = apiKeys.filter(key => {
        const matchesSearch = key.name.toLowerCase().includes(searchTerm) || 
                             key.key.toLowerCase().includes(searchTerm);
        const matchesApp = appFilter === 'all' || key.applicationId.toString() === appFilter;
        const matchesEnv = envFilter === 'all' || key.environment === envFilter;
        const matchesStatus = statusFilter === 'all' || 
                             (statusFilter === '1' && key.status === 'active') ||
                             (statusFilter === '0' && key.status === 'revoked');
        
        return matchesSearch && matchesApp && matchesEnv && matchesStatus;
    });
    
    renderApiKeysTable(filtered);
}

/**
 * Filtrer la table des logs
 */
function filterLogs() {
    const searchTerm = document.getElementById('log-search')?.value.toLowerCase() || '';
    const appFilter = document.getElementById('log-app-filter')?.value || 'all';
    const statusFilter = document.getElementById('log-status-filter')?.value || 'all';
    const periodFilter = document.getElementById('log-period-filter')?.value || 'all';
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    const filtered = conversionLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        const matchesSearch = log.applicationName.toLowerCase().includes(searchTerm) || 
                             log.apiKey.toLowerCase().includes(searchTerm);
        const matchesApp = appFilter === 'all' || log.applicationName.toLowerCase().includes(appFilter.toLowerCase());
        const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
        
        let matchesPeriod = true;
        if (periodFilter === 'today') {
            matchesPeriod = logDate >= todayStart;
        } else if (periodFilter === 'yesterday') {
            matchesPeriod = logDate >= yesterdayStart && logDate < todayStart;
        } else if (periodFilter === 'week') {
            matchesPeriod = logDate >= weekStart;
        } else if (periodFilter === 'month') {
            matchesPeriod = logDate >= monthStart;
        }
        
        return matchesSearch && matchesApp && matchesStatus && matchesPeriod;
    });
    
    renderLogsTable(filtered);
}

/**
 * Effectuer la pagination
 */
function changePage(type, delta) {
    // TODO: Implémenter la pagination
    console.log(`Changer de page (${type}): ${delta}`);
}

/**
 * Rendre la table des applications
 */
function renderApplicationsTable(apps) {
    const tableBody = document.getElementById('applications-table-body');
    if (!tableBody) return;
    
    if (apps.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-table">
                <td colspan="7">Aucune application trouvée</td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    apps.forEach(app => {
        html += `
            <tr>
                <td>${app.name}</td>
                <td>${app.owner}</td>
                <td>
                    <span class="badge ${app.status}">${app.status === 'active' ? 'Active' : 'Inactive'}</span>
                </td>
                <td>${app.apiKeyCount}</td>
                <td>${app.totalUsage} requêtes</td>
                <td>${formatDate(app.createdAt)}</td>
                <td>
                    <button class="action-btn edit-btn" data-id="${app.id}">Modifier</button>
                    <button class="action-btn delete-btn" data-id="${app.id}">Supprimer</button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // Ajouter les écouteurs d'événements aux boutons d'action
    tableBody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => editApplication(btn.getAttribute('data-id')));
    });
    
    tableBody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteApplication(btn.getAttribute('data-id')));
    });
}

/**
 * Rendre la table des clés API
 */
function renderApiKeysTable(keys) {
    const tableBody = document.getElementById('api-keys-table-body');
    if (!tableBody) return;
    
    if (keys.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-table">
                <td colspan="8">Aucune clé API trouvée</td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    keys.forEach(key => {
        html += `
            <tr>
                <td>${key.name}</td>
                <td>${key.applicationName}</td>
                <td>
                    <div class="api-key-display">
                        <code>${maskApiKey(key.key)}</code>
                        <button class="action-btn copy-btn" data-key="${key.key}">Copier</button>
                    </div>
                </td>
                <td>
                    <span class="env-badge ${key.environment}">${formatEnvironment(key.environment)}</span>
                </td>
                <td>
                    <span class="badge ${key.status === 'active' ? 'active' : 'inactive'}">
                        ${key.status === 'active' ? 'Active' : 'Révoquée'}
                    </span>
                </td>
                <td>${key.usage} requêtes</td>
                <td>${key.expiresAt ? formatDate(key.expiresAt) : 'Jamais'}</td>
                <td>
                    <button class="action-btn edit-btn" data-id="${key.id}">Modifier</button>
                    <button class="action-btn ${key.status === 'active' ? 'revoke-btn' : 'activate-btn'}" data-id="${key.id}">
                        ${key.status === 'active' ? 'Révoquer' : 'Activer'}
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // Ajouter les écouteurs d'événements aux boutons d'action
    tableBody.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => copyToClipboard(btn.getAttribute('data-key')));
    });
    
    tableBody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => editApiKey(btn.getAttribute('data-id')));
    });
    
    tableBody.querySelectorAll('.revoke-btn').forEach(btn => {
        btn.addEventListener('click', () => revokeApiKey(btn.getAttribute('data-id')));
    });
    
    tableBody.querySelectorAll('.activate-btn').forEach(btn => {
        btn.addEventListener('click', () => activateApiKey(btn.getAttribute('data-id')));
    });
}

/**
 * Rendre la table des logs
 */
function renderLogsTable(logs) {
    const tableBody = document.getElementById('logs-table-body');
    if (!tableBody) return;
    
    if (logs.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-table">
                <td colspan="7">Aucun journal de conversion trouvé</td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    logs.forEach(log => {
        html += `
            <tr>
                <td>${formatDateTime(log.timestamp)}</td>
                <td>${log.applicationName}</td>
                <td>${maskApiKey(log.apiKey)}</td>
                <td>${log.sourceType}</td>
                <td>
                    <span class="badge ${log.status === 'success' ? 'success' : 'error'}">
                        ${log.status === 'success' ? 'Succès' : 'Erreur'}
                    </span>
                </td>
                <td>${log.processingTime} ms</td>
                <td>
                    <button class="action-btn view-btn" data-id="${log.id}">Voir</button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // Ajouter les écouteurs d'événements aux boutons d'action
    tableBody.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => viewLogDetails(btn.getAttribute('data-id')));
    });
}

/**
 * Masquer une clé API pour l'affichage
 */
function maskApiKey(key) {
    if (key.length <= 8) return key;
    return key.substring(0, 4) + '•••••••••••' + key.substring(key.length - 4);
}

/**
 * Copier du texte dans le presse-papiers
 */
function copyToClipboard(text) {
    // Créer un élément temporaire pour la copie
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    
    showSuccessNotification('Clé API copiée dans le presse-papiers');
}

/**
 * Peupler les listes déroulantes d'applications
 */
function populateApplicationDropdowns() {
    // Liste déroulante pour les clés API
    const keyAppFilter = document.getElementById('key-app-filter');
    const newKeyApp = document.getElementById('new-key-app');
    
    // Liste déroulante pour les logs
    const logAppFilter = document.getElementById('log-app-filter');
    
    // Fonction pour remplir une liste déroulante
    const fillDropdown = (dropdown, includeAll = true) => {
        if (!dropdown) return;
        
        // Conserver la première option (Toutes les applications)
        const firstOption = includeAll ? dropdown.options[0] : null;
        dropdown.innerHTML = '';
        
        if (firstOption) {
            dropdown.appendChild(firstOption);
        }
        
        // Ajouter les applications
        applications.forEach(app => {
            const option = document.createElement('option');
            option.value = app.id;
            option.textContent = app.name;
            dropdown.appendChild(option);
        });
    };
    
    fillDropdown(keyAppFilter, true);
    fillDropdown(newKeyApp, false);
    fillDropdown(logAppFilter, true);
}

/**
 * Modifier une application
 */
function editApplication(id) {
    console.log('Modifier l\'application:', id);
    // TODO: Implémenter la modification d'application
}

/**
 * Supprimer une application
 */
function deleteApplication(id) {
    console.log('Supprimer l\'application:', id);
    // TODO: Implémenter la suppression d'application
}

/**
 * Modifier une clé API
 */
function editApiKey(id) {
    console.log('Modifier la clé API:', id);
    // TODO: Implémenter la modification de clé API
}

/**
 * Révoquer une clé API
 */
function revokeApiKey(id) {
    console.log('Révoquer la clé API:', id);
    // TODO: Implémenter la révocation de clé API
}

/**
 * Activer une clé API
 */
function activateApiKey(id) {
    console.log('Activer la clé API:', id);
    // TODO: Implémenter l'activation de clé API
}

/**
 * Voir les détails d'un log
 */
function viewLogDetails(id) {
    console.log('Voir les détails du log:', id);
    // TODO: Implémenter l'affichage des détails d'un log
}

/**
 * Se déconnecter
 */
function logout() {
    // TODO: Implémenter la déconnexion
    console.log('Déconnexion');
    window.location.href = '/login.html';
}

/**
 * Formater une date pour l'affichage
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

/**
 * Formater une date et heure pour l'affichage
 */
function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Formater l'environnement pour l'affichage
 */
function formatEnvironment(env) {
    switch (env) {
        case 'production':
            return 'Production';
        case 'qualification':
            return 'Qualification';
        case 'development':
            return 'Développement';
        default:
            return env;
    }
}