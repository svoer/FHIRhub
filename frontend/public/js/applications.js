/**
 * FHIRHub - Gestion des applications et clés API
 * Ce module gère les fonctionnalités de l'onglet Applications :
 * - Création et modification d'applications
 * - Ajout de paramètres personnalisés
 * - Génération et gestion des clés API
 */

// Variables globales
let currentApplications = [];
let currentApplication = null;
let currentAppId = null;
let newKeyGenerated = null;

// Références aux éléments DOM
const applicationsListEl = document.getElementById('applications-list');
const createAppBtn = document.getElementById('create-app-btn');
const refreshAppsBtn = document.getElementById('refresh-apps-btn');

// Références aux modales
const createAppModal = document.getElementById('create-app-modal');
const appDetailsModal = document.getElementById('app-details-modal');
const confirmDeleteModal = document.getElementById('confirm-delete-modal');
const generateKeyModal = document.getElementById('generate-key-modal');

// Éléments du formulaire de création d'application
const appNameInput = document.getElementById('app-name');
const appDescriptionInput = document.getElementById('app-description');
const customParamsContainer = document.getElementById('custom-params');
const addParamBtn = document.getElementById('add-param-btn');
const saveAppBtn = document.getElementById('save-app-btn');

// Éléments du modal de détails d'application
const appDetailsTitle = document.getElementById('app-details-title');
const appDetailsId = document.getElementById('app-details-id');
const appDetailsName = document.getElementById('app-details-name');
const appDetailsDescription = document.getElementById('app-details-description');
const appDetailsCreated = document.getElementById('app-details-created');
const appDetailsParams = document.getElementById('app-details-params');
const addParamDetailsBtn = document.getElementById('add-param-details-btn');
const appApiKeys = document.getElementById('app-api-keys');
const generateKeyBtn = document.getElementById('generate-key-btn');
const appStatsTotal = document.getElementById('app-stats-total');
const appStatsSuccess = document.getElementById('app-stats-success');
const appStatsFailed = document.getElementById('app-stats-failed');
const appStatsLast = document.getElementById('app-stats-last');
const updateAppBtn = document.getElementById('update-app-btn');
const deleteAppBtn = document.getElementById('delete-app-btn');

// Éléments du modal de génération de clé API
const keyNameInput = document.getElementById('key-name');
const keyExpiryInput = document.getElementById('key-expiry');
const saveKeyBtn = document.getElementById('save-key-btn');

// Éléments du modal de confirmation de suppression
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// Initialisation de l'onglet Applications
function initApplicationsTab() {
    // Charger les applications au chargement initial
    loadApplications();
    
    // Gestionnaires d'événements pour les boutons principaux
    createAppBtn.addEventListener('click', openCreateAppModal);
    refreshAppsBtn.addEventListener('click', loadApplications);
    
    // Gestionnaires d'événements pour le modal de création d'application
    addParamBtn.addEventListener('click', addCustomParam);
    saveAppBtn.addEventListener('click', saveApplication);
    
    // Gestionnaires d'événements pour le modal de détails d'application
    addParamDetailsBtn.addEventListener('click', addParamToDetails);
    generateKeyBtn.addEventListener('click', openGenerateKeyModal);
    updateAppBtn.addEventListener('click', updateApplication);
    deleteAppBtn.addEventListener('click', confirmDeleteApplication);
    
    // Gestionnaires d'événements pour le modal de génération de clé API
    saveKeyBtn.addEventListener('click', generateApiKey);
    
    // Gestionnaires d'événements pour le modal de confirmation de suppression
    confirmDeleteBtn.addEventListener('click', deleteApplication);
    
    // Fermer les modales quand on clique sur la croix ou sur "Annuler"
    document.querySelectorAll('.close, .cancel-btn').forEach(el => {
        el.addEventListener('click', closeAllModals);
    });
}

// Charger les applications depuis l'API
async function loadApplications() {
    applicationsListEl.innerHTML = '<p>Chargement des applications...</p>';
    
    try {
        const result = await apiRequest('applications');
        currentApplications = result.data || [];
        
        if (currentApplications.length === 0) {
            applicationsListEl.innerHTML = '<p>Aucune application trouvée. Cliquez sur "Créer une application" pour commencer.</p>';
            return;
        }
        
        renderApplicationsList();
    } catch (error) {
        applicationsListEl.innerHTML = `<p class="status-error">Erreur: ${error.message}</p>`;
    }
}

// Afficher la liste des applications
function renderApplicationsList() {
    applicationsListEl.innerHTML = '';
    
    currentApplications.forEach(app => {
        const appCard = document.createElement('div');
        appCard.className = 'app-card';
        appCard.dataset.id = app.id;
        
        const keyCount = app.apiKeys ? app.apiKeys.length : 0;
        
        appCard.innerHTML = `
            <h3>${escapeHtml(app.name)}</h3>
            <p>${escapeHtml(app.description || 'Aucune description')}</p>
            <div class="app-meta">
                <span class="app-created">Créée le ${formatDate(app.createdAt)}</span>
                <span class="app-keys">${keyCount} clé${keyCount !== 1 ? 's' : ''}</span>
            </div>
        `;
        
        appCard.addEventListener('click', () => openAppDetails(app.id));
        applicationsListEl.appendChild(appCard);
    });
}

// Ajouter un champ de paramètre personnalisé
function addCustomParam() {
    const paramContainer = document.createElement('div');
    paramContainer.className = 'custom-param';
    
    paramContainer.innerHTML = `
        <input type="text" class="param-name-input" placeholder="Nom (ex: FINESS)">
        <input type="text" class="param-value-input" placeholder="Valeur">
        <button class="remove-param-btn">Supprimer</button>
    `;
    
    const removeBtn = paramContainer.querySelector('.remove-param-btn');
    removeBtn.addEventListener('click', () => paramContainer.remove());
    
    customParamsContainer.appendChild(paramContainer);
}

// Ajouter un paramètre dans le modal de détails
function addParamToDetails() {
    const paramContainer = document.createElement('div');
    paramContainer.className = 'app-param-item';
    
    paramContainer.innerHTML = `
        <div class="param-name">
            <input type="text" class="param-name-input" placeholder="Nom (ex: FINESS)">
        </div>
        <div class="param-value">
            <input type="text" class="param-value-input" placeholder="Valeur">
        </div>
        <button class="remove-param-btn">Supprimer</button>
    `;
    
    const removeBtn = paramContainer.querySelector('.remove-param-btn');
    removeBtn.addEventListener('click', () => paramContainer.remove());
    
    appDetailsParams.appendChild(paramContainer);
}

// Ouvrir le modal de création d'application
function openCreateAppModal() {
    // Réinitialiser le formulaire
    appNameInput.value = '';
    appDescriptionInput.value = '';
    customParamsContainer.innerHTML = '';
    
    // Afficher le modal
    createAppModal.style.display = 'block';
}

// Ouvrir le modal de détails d'une application
async function openAppDetails(appId) {
    try {
        const result = await apiRequest(`applications/${appId}`);
        currentApplication = result.data;
        currentAppId = appId;
        
        // Remplir les détails de l'application
        appDetailsTitle.textContent = currentApplication.name;
        appDetailsId.textContent = currentApplication.id;
        appDetailsName.textContent = currentApplication.name;
        appDetailsDescription.textContent = currentApplication.description || 'Aucune description';
        appDetailsCreated.textContent = formatDate(currentApplication.createdAt);
        
        // Charger les paramètres personnalisés
        appDetailsParams.innerHTML = '';
        if (currentApplication.parameters && Object.keys(currentApplication.parameters).length > 0) {
            for (const [key, value] of Object.entries(currentApplication.parameters)) {
                const paramItem = document.createElement('div');
                paramItem.className = 'app-param-item';
                paramItem.innerHTML = `
                    <span class="param-name">${escapeHtml(key)}</span>
                    <span class="param-value">${escapeHtml(value)}</span>
                    <button class="remove-param-btn" data-param="${escapeHtml(key)}">Supprimer</button>
                `;
                
                const removeBtn = paramItem.querySelector('.remove-param-btn');
                removeBtn.addEventListener('click', () => removeParam(key, paramItem));
                
                appDetailsParams.appendChild(paramItem);
            }
        } else {
            appDetailsParams.innerHTML = '<p>Aucun paramètre personnalisé</p>';
        }
        
        // Charger les clés API
        await loadApiKeys(appId);
        
        // Charger les statistiques de l'application
        await loadAppStats(appId);
        
        // Afficher le modal
        appDetailsModal.style.display = 'block';
    } catch (error) {
        alert(`Erreur lors du chargement des détails de l'application: ${error.message}`);
    }
}

// Charger les clés API pour une application
async function loadApiKeys(appId) {
    try {
        const result = await apiRequest(`keys?appId=${appId}`);
        const apiKeys = result.data || [];
        
        appApiKeys.innerHTML = '';
        
        if (apiKeys.length === 0) {
            appApiKeys.innerHTML = '<p>Aucune clé API. Cliquez sur "Générer une nouvelle clé" pour commencer.</p>';
            return;
        }
        
        console.log("Clés API reçues:", apiKeys);
        
        apiKeys.forEach(key => {
            // Standardiser les champs
            const keyData = {
                name: key.name || key.description || 'Clé API',
                key: key.api_key || key.key || key.value || 'CLEF_INCONNUE',
                createdAt: key.created_at || key.createdAt || new Date().toISOString(),
                expiresAt: key.expires_at || key.expiresAt || null
            };
            
            const isExpired = keyData.expiresAt && new Date(keyData.expiresAt) < new Date();
            const keyItem = document.createElement('div');
            keyItem.className = 'api-key-item';
            
            keyItem.innerHTML = `
                <div class="key-header">
                    <span class="key-name">${escapeHtml(keyData.name)}</span>
                    <span class="key-status ${isExpired ? 'expired' : ''}">${isExpired ? 'Expirée' : 'Active'}</span>
                </div>
                <div class="key-value">
                    ${escapeHtml(keyData.key)}
                    <button class="copy-key-btn" data-key="${escapeHtml(keyData.key)}">
                        <i class="fa fa-copy"></i>
                    </button>
                </div>
                <div class="key-meta">
                    <span>Créée le ${formatDate(keyData.createdAt)}</span>
                    ${keyData.expiresAt ? `<span>Expire le ${formatDate(keyData.expiresAt)}</span>` : '<span>Sans expiration</span>'}
                </div>
            `;
            
            const copyBtn = keyItem.querySelector('.copy-key-btn');
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(keyData.key);
            });
            
            appApiKeys.appendChild(keyItem);
        });
        
        // Ajouter une nouvelle section pour la clé nouvellement générée
        if (newKeyGenerated) {
            const newKeySection = document.createElement('div');
            newKeySection.className = 'new-key-section';
            
            newKeySection.innerHTML = `
                <h4 class="new-key-title">
                    Nouvelle clé générée
                    <button class="close-new-key">×</button>
                </h4>
                <p class="new-key-warning">
                    <i class="fa fa-exclamation-triangle"></i>
                    Cette clé ne sera plus affichée. Assurez-vous de la copier maintenant!
                </p>
                <div class="new-key-value">
                    ${escapeHtml(newKeyGenerated.key)}
                    <button class="copy-key-btn" data-key="${escapeHtml(newKeyGenerated.key)}">
                        <i class="fa fa-copy"></i>
                    </button>
                </div>
            `;
            
            const closeBtn = newKeySection.querySelector('.close-new-key');
            closeBtn.addEventListener('click', () => {
                newKeySection.remove();
                newKeyGenerated = null;
            });
            
            const copyBtn = newKeySection.querySelector('.copy-key-btn');
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(newKeyGenerated.key);
            });
            
            appApiKeys.insertBefore(newKeySection, appApiKeys.firstChild);
        }
        
    } catch (error) {
        appApiKeys.innerHTML = `<p class="status-error">Erreur lors du chargement des clés API: ${error.message}</p>`;
    }
}

// Charger les statistiques d'une application
async function loadAppStats(appId) {
    try {
        console.log("Demande des statistiques pour l'appId:", appId);
        const result = await apiRequest(`stats?appId=${appId}`);
        console.log("Statistiques reçues:", result);
        
        // Standardiser les champs pour gérer les différents formats de réponse
        const stats = result.data || { total: 0, success: 0, failed: 0, error: 0, lastConversion: null };
        
        // Afficher les statistiques dans l'UI
        appStatsTotal.textContent = stats.total || 0;
        appStatsSuccess.textContent = stats.success || 0;
        appStatsFailed.textContent = stats.failed || stats.error || 0;
        appStatsLast.textContent = stats.lastConversion ? formatDate(stats.lastConversion) : '-';
    } catch (error) {
        console.error("Erreur lors de la récupération des statistiques:", error);
        
        // En cas d'erreur, afficher des points d'interrogation
        appStatsTotal.textContent = '0';
        appStatsSuccess.textContent = '0';
        appStatsFailed.textContent = '0';
        appStatsLast.textContent = '-';
        
        // Ne pas afficher l'alerte à l'utilisateur
        // alert(`Erreur lors de la récupération des statistiques: ${error.message}`);
    }
}

// Supprimer un paramètre
async function removeParam(paramName, paramElement) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le paramètre "${paramName}"?`)) {
        return;
    }
    
    try {
        await apiRequest(`applications/${currentAppId}/parameters/${paramName}`, {
            method: 'DELETE'
        });
        
        paramElement.remove();
        
        // Mettre à jour l'application courante
        const result = await apiRequest(`applications/${currentAppId}`);
        currentApplication = result.data;
    } catch (error) {
        alert(`Erreur lors de la suppression du paramètre: ${error.message}`);
    }
}

// Ouvrir le modal de génération de clé API
function openGenerateKeyModal() {
    // Réinitialiser le formulaire
    keyNameInput.value = '';
    keyExpiryInput.value = '';
    
    // Afficher le modal
    generateKeyModal.style.display = 'block';
}

// Confirmer la suppression d'une application
function confirmDeleteApplication() {
    confirmDeleteModal.style.display = 'block';
}

// Sauvegarder une nouvelle application
async function saveApplication() {
    // Valider le formulaire
    const name = appNameInput.value.trim();
    if (!name) {
        alert('Le nom de l\'application est obligatoire');
        return;
    }
    
    // Récupérer les paramètres personnalisés
    const parameters = {};
    const paramElements = customParamsContainer.querySelectorAll('.custom-param');
    
    for (const paramEl of paramElements) {
        const nameInput = paramEl.querySelector('.param-name-input');
        const valueInput = paramEl.querySelector('.param-value-input');
        
        const paramName = nameInput.value.trim();
        const paramValue = valueInput.value.trim();
        
        if (paramName) {
            parameters[paramName] = paramValue;
        }
    }
    
    // Préparer les données
    const appData = {
        name,
        description: appDescriptionInput.value.trim(),
        parameters
    };
    
    try {
        // Envoyer la requête
        const result = await apiRequest('applications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(appData)
        });
        
        // Fermer le modal et rafraîchir la liste
        closeAllModals();
        loadApplications();
    } catch (error) {
        alert(`Erreur lors de la création de l'application: ${error.message}`);
    }
}

// Mettre à jour une application existante
async function updateApplication() {
    if (!currentApplication) return;
    
    // Récupérer les nouveaux paramètres
    const parameters = { ...currentApplication.parameters };
    const paramElements = appDetailsParams.querySelectorAll('.app-param-item');
    
    // Traiter les nouveaux paramètres qui ont des champs d'entrée
    for (const paramEl of paramElements) {
        const nameInput = paramEl.querySelector('.param-name-input');
        const valueInput = paramEl.querySelector('.param-value-input');
        
        if (nameInput && valueInput) {
            const paramName = nameInput.value.trim();
            const paramValue = valueInput.value.trim();
            
            if (paramName) {
                parameters[paramName] = paramValue;
            }
        }
    }
    
    // Envoyer la requête pour mettre à jour les paramètres
    try {
        await apiRequest(`applications/${currentAppId}/parameters`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(parameters)
        });
        
        // Mettre à jour l'application courante
        await openAppDetails(currentAppId);
    } catch (error) {
        alert(`Erreur lors de la mise à jour des paramètres: ${error.message}`);
    }
}

// Générer une nouvelle clé API
async function generateApiKey() {
    const name = keyNameInput.value.trim();
    if (!name) {
        alert('Le nom de la clé est obligatoire');
        return;
    }
    
    // Préparer les données
    const keyData = {
        name,
        appId: currentAppId,
        description: name // Ajouter la description qui correspond au nom de la clé
    };
    
    // Ajouter la date d'expiration si fournie
    if (keyExpiryInput.value) {
        keyData.expiresAt = new Date(keyExpiryInput.value).toISOString();
    }
    
    try {
        // Générer la clé
        const result = await apiRequest('keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(keyData)
        });
        
        console.log("Réponse de création de clé:", result);
        
        // Stocker la nouvelle clé pour l'afficher correctement
        if (result.data && result.data.api_key) {
            newKeyGenerated = {
                key: result.data.api_key,
                name: name,
                createdAt: result.data.created_at || new Date().toISOString(),
                expiresAt: result.data.expires_at || null
            };
        } else {
            console.error("Format de réponse API inattendu:", result);
            alert("Erreur: La clé API a été créée mais ne peut pas être affichée correctement");
        }
        
        // Fermer le modal de génération et rafraîchir les clés
        generateKeyModal.style.display = 'none';
        await loadApiKeys(currentAppId);
    } catch (error) {
        alert(`Erreur lors de la génération de la clé API: ${error.message}`);
    }
}

// Supprimer une application
async function deleteApplication() {
    if (!currentAppId) return;
    
    try {
        await apiRequest(`applications/${currentAppId}`, {
            method: 'DELETE'
        });
        
        // Fermer tous les modals et rafraîchir la liste
        closeAllModals();
        loadApplications();
    } catch (error) {
        alert(`Erreur lors de la suppression de l'application: ${error.message}`);
    }
}

// Fermer tous les modaux
function closeAllModals() {
    createAppModal.style.display = 'none';
    appDetailsModal.style.display = 'none';
    confirmDeleteModal.style.display = 'none';
    generateKeyModal.style.display = 'none';
}

// Formater une date
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return new Date(dateString).toLocaleDateString('fr-FR', options);
}

// Échapper les caractères HTML
function escapeHtml(text) {
    if (!text) return '';
    
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Copier un texte dans le presse-papier
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    // Afficher une notification
    alert('Clé API copiée dans le presse-papier');
}

// Initialiser le module quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser l'onglet Applications
    if (document.getElementById('applications-tab')) {
        initApplicationsTab();
    }
});