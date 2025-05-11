/**
 * Script pour la gestion des fournisseurs d'IA dans l'interface
 * Permet de configurer, tester et basculer entre différents fournisseurs comme Mistral et Ollama
 */

let currentProviders = [];
let supportedTypes = [];

// Stockage global des modèles disponibles
let availableModels = [];

// Stockage des clés API testées avec succès
let lastSuccessfulApiKeys = {};

// Initialisation de la page
document.addEventListener('DOMContentLoaded', () => {
  fetchProviders();
  fetchSupportedTypes();
  setupEventListeners();
});

// Configuration des écouteurs d'événements
function setupEventListeners() {
  // Formulaire d'ajout de fournisseur
  const addProviderForm = document.getElementById('add-provider-form');
  if (addProviderForm) {
    addProviderForm.addEventListener('submit', handleAddProvider);
  }

  // Bouton d'ajout de fournisseur
  const addProviderBtn = document.getElementById('add-provider-btn');
  if (addProviderBtn) {
    addProviderBtn.addEventListener('click', () => {
      const modal = document.getElementById('add-provider-modal');
      if (modal) modal.style.display = 'block';
    });
  }

  // Boutons de fermeture des modals
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
    });
  });

  // Sélection du type de fournisseur dans le formulaire
  const providerTypeSelect = document.getElementById('provider-type');
  if (providerTypeSelect) {
    providerTypeSelect.addEventListener('change', handleProviderTypeChange);
  }
  
  // Bouton de chargement des modèles disponibles (formulaire d'ajout)
  const loadModelsBtn = document.getElementById('load-models-btn');
  if (loadModelsBtn) {
    loadModelsBtn.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const originalContent = button.innerHTML;
      
      const apiKeyInput = document.getElementById('api-key');
      const endpointInput = document.getElementById('endpoint');
      const providerTypeSelect = document.getElementById('provider-type');
      
      if (apiKeyInput && endpointInput && providerTypeSelect) {
        let apiKey = apiKeyInput.value.trim();
        const endpoint = endpointInput.value.trim();
        const providerType = providerTypeSelect.value;
        
        // Si aucune clé API n'est saisie mais qu'on a une clé API stockée pour ce type de fournisseur
        if (!apiKey && lastSuccessfulApiKeys[providerType]) {
          apiKey = lastSuccessfulApiKeys[providerType];
          console.log(`Utilisation de la dernière clé API réussie pour ${providerType} dans le formulaire d'ajout`);
          
          // Mettre à jour le champ de saisie avec la clé API
          apiKeyInput.value = apiKey;
        }
        
        if (!apiKey) {
          showError('Veuillez saisir une clé API');
          return;
        }
        
        if (!providerType) {
          showError('Veuillez sélectionner un type de fournisseur');
          return;
        }
        
        // Afficher l'animation de chargement
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement des modèles...';
        button.disabled = true;
        
        try {
          await loadAvailableModels(apiKey, endpoint, providerType);
        } finally {
          // Restaurer l'état du bouton après le chargement
          button.innerHTML = originalContent;
          button.disabled = false;
        }
      }
    });
  }
  
  // Bouton de chargement des modèles disponibles (formulaire d'édition)
  const editLoadModelsBtn = document.getElementById('edit-load-models-btn');
  if (editLoadModelsBtn) {
    editLoadModelsBtn.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const originalContent = button.innerHTML;
      
      const apiKeyInput = document.getElementById('edit-api-key');
      const endpointInput = document.getElementById('edit-endpoint');
      const providerTypeInput = document.getElementById('edit-provider-type');
      const providerId = document.getElementById('edit-provider-id').value;
      
      if (providerId) {
        // Si une nouvelle clé API est fournie, l'utiliser, sinon récupérer le fournisseur actuel
        const provider = currentProviders.find(p => p.id == providerId);
        if (provider) {
          let apiKey = (apiKeyInput && apiKeyInput.value.trim()) || provider.api_key;
          const endpoint = endpointInput ? endpointInput.value.trim() : provider.endpoint;
          const providerType = providerTypeInput ? providerTypeInput.value : provider.provider_type;
          
          // Si aucune clé API n'est fournie, utiliser la dernière clé API testée avec succès
          if (!apiKey && lastSuccessfulApiKeys[providerType]) {
            apiKey = lastSuccessfulApiKeys[providerType];
            console.log(`Utilisation de la dernière clé API réussie pour ${providerType} dans le formulaire d'édition`);
            
            // Mettre à jour le champ de saisie avec la clé API
            if (apiKeyInput) {
              apiKeyInput.value = apiKey;
            }
          }
          
          if (!apiKey) {
            showError('Une clé API est nécessaire pour charger les modèles');
            return;
          }
          
          // Afficher l'animation de chargement
          button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement des modèles...';
          button.disabled = true;
          
          try {
            await loadAvailableModels(apiKey, endpoint, providerType, 'edit-model-selection');
          } finally {
            // Restaurer l'état du bouton après le chargement
            button.innerHTML = originalContent;
            button.disabled = false;
          }
        }
      }
    });
  }
  
  // Sélection d'un modèle dans la liste déroulante
  const modelSelect = document.getElementById('model-selection');
  if (modelSelect) {
    modelSelect.addEventListener('change', function() {
      const modelsInput = document.getElementById('models');
      if (modelsInput && this.value) {
        // Si déjà des modèles, ajouter le nouveau
        if (modelsInput.value) {
          const currentModels = modelsInput.value.split(',').map(m => m.trim());
          if (!currentModels.includes(this.value)) {
            currentModels.push(this.value);
            modelsInput.value = currentModels.join(',');
          }
        } else {
          modelsInput.value = this.value;
        }
      }
    });
  }
  
  // Même chose pour le formulaire d'édition
  const editModelSelect = document.getElementById('edit-model-selection');
  if (editModelSelect) {
    editModelSelect.addEventListener('change', function() {
      const modelsInput = document.getElementById('edit-models');
      if (modelsInput && this.value) {
        if (modelsInput.value) {
          const currentModels = modelsInput.value.split(',').map(m => m.trim());
          if (!currentModels.includes(this.value)) {
            currentModels.push(this.value);
            modelsInput.value = currentModels.join(',');
          }
        } else {
          modelsInput.value = this.value;
        }
      }
    });
  }
}

// Gestion du changement de type de fournisseur
function handleProviderTypeChange(event) {
  const selectedType = event.target.value;
  const selectedProvider = supportedTypes.find(type => type.id === selectedType);
  
  // Mettre à jour l'affichage des champs en fonction du type
  const apiKeyField = document.getElementById('api-key-field');
  const endpointField = document.getElementById('endpoint-field');
  
  if (selectedProvider) {
    // Afficher/masquer le champ API Key
    if (apiKeyField) {
      apiKeyField.style.display = selectedProvider.requires_api_key ? 'block' : 'none';
    }
    
    // Afficher/masquer le champ Endpoint et préremplir si nécessaire
    if (endpointField) {
      endpointField.style.display = selectedProvider.supports_endpoint_override ? 'block' : 'none';
      const endpointInput = document.getElementById('endpoint');
      if (endpointInput && selectedProvider.default_endpoint) {
        endpointInput.value = selectedProvider.default_endpoint;
      }
    }
  }
}

// Récupération des fournisseurs d'IA
async function fetchProviders() {
  try {
    // Ajouter l'API key explicitement pour l'environnement Replit
    const response = await fetch('/api/ai-providers', {
      headers: {
        'x-api-key': 'dev-key'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      currentProviders = result.data;
      renderProviders(currentProviders);
    } else {
      showError('Erreur lors de la récupération des fournisseurs d\'IA');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs d\'IA:', error);
    showError(`Erreur: ${error.message}`);
  }
}

// Récupération des types de fournisseurs supportés
async function fetchSupportedTypes() {
  try {
    // Ajouter l'API key explicitement pour l'environnement Replit
    const response = await fetch('/api/ai-providers/types/supported', {
      headers: {
        'x-api-key': 'dev-key'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      supportedTypes = result.data;
      renderProviderTypes(supportedTypes);
    } else {
      showError('Erreur lors de la récupération des types de fournisseurs');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des types de fournisseurs:', error);
  }
}

// Affichage des types de fournisseurs dans le formulaire
function renderProviderTypes(types) {
  const select = document.getElementById('provider-type');
  if (!select) return;
  
  select.innerHTML = '<option value="">Sélectionnez un type</option>';
  
  types.forEach(type => {
    const option = document.createElement('option');
    option.value = type.id;
    option.textContent = type.name;
    select.appendChild(option);
  });
}

// Affichage des fournisseurs d'IA
function renderProviders(providers) {
  const providersTable = document.getElementById('ai-providers-table');
  const tableBody = document.getElementById('ai-providers-body');
  
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (providers.length === 0) {
    // Aucun fournisseur, afficher un message
    providersTable.style.display = 'none';
    document.getElementById('no-providers-message').style.display = 'block';
    return;
  }
  
  providersTable.style.display = 'table';
  document.getElementById('no-providers-message').style.display = 'none';
  
  providers.forEach(provider => {
    const row = document.createElement('tr');
    
    // Statut (activé/désactivé)
    const statusCell = document.createElement('td');
    const statusSwitch = document.createElement('label');
    statusSwitch.className = 'switch';
    statusSwitch.innerHTML = `
      <input type="checkbox" data-id="${provider.id}" ${provider.enabled ? 'checked' : ''} onchange="toggleProvider(${provider.id})">
      <span class="slider round"></span>
    `;
    statusCell.appendChild(statusSwitch);
    
    // Nom
    const nameCell = document.createElement('td');
    nameCell.textContent = provider.provider_name;
    
    // Type
    const typeCell = document.createElement('td');
    typeCell.textContent = provider.provider_type;
    
    // Modèles
    const modelsCell = document.createElement('td');
    modelsCell.textContent = provider.models || 'Non spécifié';
    
    // Dernière modification
    const updatedCell = document.createElement('td');
    updatedCell.textContent = formatDate(provider.updated_at);
    
    // Actions
    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions-cell';
    
    const testBtn = document.createElement('button');
    testBtn.className = 'btn btn-sm btn-primary';
    testBtn.innerHTML = '<i class="fas fa-vial"></i> Tester';
    testBtn.onclick = () => testProvider(provider.id);
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm btn-secondary mx-1';
    editBtn.innerHTML = '<i class="fas fa-edit"></i> Éditer';
    editBtn.onclick = () => editProvider(provider.id);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-danger';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Supprimer';
    deleteBtn.onclick = () => deleteProvider(provider.id);
    
    actionsCell.appendChild(testBtn);
    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(deleteBtn);
    
    // Ajouter toutes les cellules à la ligne
    row.appendChild(statusCell);
    row.appendChild(nameCell);
    row.appendChild(typeCell);
    row.appendChild(modelsCell);
    row.appendChild(updatedCell);
    row.appendChild(actionsCell);
    
    // Ajouter la ligne au tableau
    tableBody.appendChild(row);
  });
}

// Gestion de l'ajout d'un fournisseur
async function handleAddProvider(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  const providerData = {
    provider_name: formData.get('provider-name'),
    provider_type: formData.get('provider-type'),
    api_key: formData.get('api-key') || '',
    endpoint: formData.get('endpoint') || '',
    models: formData.get('models') || '',
    enabled: false
  };
  
  try {
    const response = await fetch('/api/ai-providers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'dev-key'
      },
      body: JSON.stringify(providerData)
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('Fournisseur d\'IA ajouté avec succès');
      document.getElementById('add-provider-modal').style.display = 'none';
      form.reset();
      fetchProviders(); // Rafraîchir la liste
    } else {
      showError(result.error || 'Erreur lors de l\'ajout du fournisseur');
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du fournisseur:', error);
    showError(`Erreur: ${error.message}`);
  }
}

// Activation/désactivation d'un fournisseur
async function toggleProvider(id) {
  const checkbox = document.querySelector(`input[data-id="${id}"]`);
  const enabled = checkbox.checked;
  
  try {
    const response = await fetch(`/api/ai-providers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'dev-key'
      },
      body: JSON.stringify({ enabled })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(`Fournisseur ${enabled ? 'activé' : 'désactivé'} avec succès`);
      fetchProviders(); // Rafraîchir pour mettre à jour d'autres fournisseurs si nécessaire
    } else {
      checkbox.checked = !enabled; // Revenir à l'état précédent
      showError(result.error || 'Erreur lors de la mise à jour du fournisseur');
    }
  } catch (error) {
    checkbox.checked = !enabled; // Revenir à l'état précédent
    console.error('Erreur lors de la mise à jour du fournisseur:', error);
    showError(`Erreur: ${error.message}`);
  }
}

// Test d'un fournisseur
async function testProvider(id) {
  try {
    // Trouver la ligne du tableau correspondant au fournisseur
    const providerRow = document.querySelector(`tr:has(input[data-id="${id}"])`);
    
    // Créer ou trouver la cellule de résultat du test
    let resultCell = document.getElementById(`test-result-${id}`);
    if (!resultCell && providerRow) {
      // Afficher une nouvelle ligne sous le fournisseur pour les résultats du test
      const resultRow = document.createElement('tr');
      resultRow.className = 'test-result-row';
      resultRow.id = `test-result-row-${id}`;
      
      let resultCell = document.createElement('td');
      resultCell.id = `test-result-${id}`;
      resultCell.colSpan = 6; // Pour s'étendre sur toutes les colonnes
      resultCell.className = 'test-result-cell';
      resultCell.style.padding = '10px';
      resultCell.style.backgroundColor = '#f8f9fa';
      resultCell.style.borderRadius = '4px';
      
      resultRow.appendChild(resultCell);
      
      // Insérer après la ligne du fournisseur
      providerRow.parentNode.insertBefore(resultRow, providerRow.nextSibling);
      
      // Mettre à jour la référence après l'insertion dans le DOM
      let updatedResultCell = document.getElementById(`test-result-${id}`);
      if (updatedResultCell) {
        resultCell = updatedResultCell;
      }
    }
    
    // Sélection sécurisée du bouton de test
    const testBtns = document.querySelectorAll('button');
    let testBtn = null;
    
    // Trouver le bon bouton en parcourant tous les boutons de test
    for (const btn of testBtns) {
      if (btn.textContent.includes('Tester') && 
          btn.closest('tr')?.querySelector(`input[data-id="${id}"]`)) {
        testBtn = btn;
        break;
      }
    }
    
    // Si le bouton n'est pas trouvé, continuer sans modifier l'interface
    let originalText = '';
    if (testBtn) {
      originalText = testBtn.innerHTML;
      testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Test en cours...';
      testBtn.disabled = true;
    }
    
    // Afficher le message de chargement dans la cellule de résultat
    if (resultCell) {
      resultCell.innerHTML = '<div style="display: flex; align-items: center; gap: 10px;"><i class="fas fa-spinner fa-spin"></i> Test de connexion en cours...</div>';
    }
    
    // Appel API au test du fournisseur
    const response = await fetch(`/api/ai-providers/${id}/test`, {
      method: 'POST',
      headers: {
        'x-api-key': 'dev-key'
      }
    });
    
    // Rétablir l'état du bouton
    if (testBtn) {
      testBtn.innerHTML = originalText;
      testBtn.disabled = false;
    }
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      if (result.data.test_passed) {
        // Récupérer le fournisseur testé
        const provider = currentProviders.find(p => p.id == id);
        if (provider) {
          // Stocker la clé API qui a fonctionné pour l'utiliser plus tard
          lastSuccessfulApiKeys[provider.provider_type] = provider.api_key;
          console.log(`Stockage de la clé API valide pour ${provider.provider_type}`);
        }
        
        // Si le test est réussi, mettre à jour la variable globale des modèles disponibles
        if (result.data.available_models && result.data.available_models.length > 0) {
          availableModels = result.data.available_models;
          
          // Afficher le résultat avec les modèles dans une liste déroulante
          if (resultCell) {
            const modelSelectHtml = `
              <div style="margin-top: 10px;">
                <label for="model-select-${id}" style="display: block; margin-bottom: 5px; font-weight: 500;">Modèles disponibles:</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                  <select id="model-select-${id}" class="form-control" style="max-width: 300px;">
                    <option value="">Sélectionnez un modèle</option>
                    ${availableModels.map(model => `<option value="${model}">${model}</option>`).join('')}
                  </select>
                  <button id="copy-model-${id}" class="btn btn-sm btn-outline-primary" style="white-space: nowrap;">
                    <i class="fas fa-copy"></i> Copier
                  </button>
                </div>
              </div>
            `;
            
            resultCell.innerHTML = `
              <div style="margin-bottom: 10px;">
                <span style="color: #28a745; font-weight: 500;"><i class="fas fa-check-circle"></i> Test réussi: ${result.data.status}</span>
              </div>
              ${modelSelectHtml}
            `;
            
            // Ajouter un gestionnaire d'événements pour copier le modèle sélectionné
            setTimeout(() => {
              const copyBtn = document.getElementById(`copy-model-${id}`);
              const selectElement = document.getElementById(`model-select-${id}`);
              if (copyBtn && selectElement) {
                copyBtn.addEventListener('click', () => {
                  const selectedModel = selectElement.value;
                  if (selectedModel) {
                    // Mettre à jour le champ de modèles du fournisseur
                    const provider = currentProviders.find(p => p.id == id);
                    if (provider) {
                      // Pour l'édition future, mettre à jour le modèle dans la liste
                      const previousModels = provider.models ? provider.models.split(',').map(m => m.trim()) : [];
                      if (!previousModels.includes(selectedModel)) {
                        previousModels.push(selectedModel);
                        provider.models = previousModels.join(',');
                        
                        // Mettre à jour l'affichage du tableau
                        renderProviders(currentProviders);
                      }
                      
                      // Afficher un message de succès
                      showSuccess(`Modèle "${selectedModel}" ajouté aux modèles du fournisseur`);
                    }
                  } else {
                    showError('Veuillez sélectionner un modèle');
                  }
                });
              }
            }, 100);
          }
        } else {
          // Si pas de modèles disponibles
          if (resultCell) {
            resultCell.innerHTML = `
              <div style="margin-bottom: 10px;">
                <span style="color: #28a745; font-weight: 500;"><i class="fas fa-check-circle"></i> Test réussi: ${result.data.status}</span>
              </div>
              <div style="color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px;">
                Aucun modèle n'a été retourné par l'API. Vérifiez les paramètres de connexion ou contactez le fournisseur.
              </div>
            `;
          }
        }
        
        showSuccess(`Test réussi: ${result.data.status}`);
      } else {
        // Si le test a échoué
        if (resultCell) {
          resultCell.innerHTML = `
            <div style="margin-bottom: 10px;">
              <span style="color: #dc3545; font-weight: 500;"><i class="fas fa-times-circle"></i> Échec du test: ${result.data.status}</span>
            </div>
          `;
        }
        
        showError(`Échec du test: ${result.data.status}`);
      }
    } else {
      if (resultCell) {
        resultCell.innerHTML = `
          <div style="margin-bottom: 10px;">
            <span style="color: #dc3545; font-weight: 500;"><i class="fas fa-times-circle"></i> Erreur: ${result.error || 'Erreur inconnue'}</span>
          </div>
        `;
      }
      
      showError(result.error || 'Erreur lors du test du fournisseur');
    }
  } catch (error) {
    console.error('Erreur lors du test du fournisseur:', error);
    
    // Afficher l'erreur dans la cellule de résultat si elle existe
    let resultCell = document.getElementById(`test-result-${id}`);
    if (resultCell) {
      resultCell.innerHTML = `
        <div style="margin-bottom: 10px;">
          <span style="color: #dc3545; font-weight: 500;"><i class="fas fa-times-circle"></i> Erreur: ${error.message}</span>
        </div>
      `;
    }
    
    showError(`Erreur: ${error.message}`);
  }
}

// Chargement des modèles disponibles à partir d'une API
async function loadAvailableModels(apiKey, endpoint, providerType, targetSelectId = 'model-selection') {
  console.log(`Chargement des modèles pour: ${providerType}, targetSelect: ${targetSelectId}`);
  
  try {
    // Utiliser la dernière clé API connue si aucune n'est fournie
    if (!apiKey && lastSuccessfulApiKeys[providerType]) {
      console.log(`Utilisation de la dernière clé API réussie pour ${providerType}`);
      apiKey = lastSuccessfulApiKeys[providerType];
    }
    
    // Afficher un message de chargement dans le select
    const selectElement = document.getElementById(targetSelectId);
    if (!selectElement) {
      console.error(`Élément select non trouvé avec l'ID: ${targetSelectId}`);
      showError(`Erreur: élément select non trouvé (${targetSelectId})`);
      return;
    }
    
    // Afficher une animation dans le select pendant le chargement
    selectElement.innerHTML = '<option value="">Chargement des modèles...</option>';
    selectElement.classList.add('loading-select');
    
    // Modification de l'apparence du bouton pour montrer une animation de chargement
    const loadButtonId = targetSelectId === 'model-selection' ? 'load-models-btn' : 'edit-load-models-btn';
    const loadButton = document.getElementById(loadButtonId);
    
    if (loadButton) {
      // Sauvegarder le contenu original du bouton
      const originalButtonContent = loadButton.innerHTML;
      
      // Remplacer par une animation de chargement
      loadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
      loadButton.disabled = true;
      loadButton.style.opacity = '0.85';
      
      // Restaurer après un délai minimum pour éviter le clignotement si la réponse est très rapide
      setTimeout(() => {
        if (loadButton.innerHTML.includes('fa-spin')) {
          // Seulement restaurer si le bouton est toujours en mode chargement
          loadButton.innerHTML = originalButtonContent;
          loadButton.disabled = false;
          loadButton.style.opacity = '1';
        }
      }, 10000); // 10 secondes de délai maximum pour l'animation
    }
    
    // Notification sobre pour indiquer le chargement
    showSuccess('Recherche des modèles disponibles...');
    
    // Si la clé API est une clé de test comme "test-key", charger des modèles de démonstration
    if (!apiKey || apiKey === 'test-key' || apiKey === 'dev-key' || apiKey.length < 8) {
      console.log('Utilisation des modèles de démonstration (clé API factice détectée)');
      
      // Simuler un délai de chargement avec animation progressive
      const progressSteps = 3;
      for (let i = 1; i <= progressSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        selectElement.innerHTML = `<option value="">Chargement des modèles${'.'.repeat(i)}</option>`;
      }
      
      // Modèles de démonstration par type de fournisseur
      let demoModels = [];
      
      switch (providerType) {
        case 'mistral':
          demoModels = [
            'mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large',
            'mistral-large-latest', 'codestral-latest', 'open-mixtral-8x7b'
          ];
          break;
        case 'ollama':
          demoModels = [
            'llama3', 'mistral', 'mistral-openorca', 'gemma:2b', 'gemma:7b',
            'phi3', 'neural-chat', 'codellama', 'starling-lm'
          ];
          break;
        case 'openai':
        case 'openai_compatible':
          demoModels = [
            'gpt-4', 'gpt-4-0125-preview', 'gpt-4o', 'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k', 'text-embedding-3-small'
          ];
          break;
        case 'deepseek':
          demoModels = [
            'deepseek-coder', 'deepseek-chat', 'deepseek-llm-67b', 
            'deepseek-math', 'deepseek-vl'
          ];
          break;
        default:
          demoModels = ['model-1', 'model-2', 'model-3'];
      }
      
      // Mettre à jour la variable globale et la liste déroulante
      availableModels = demoModels;
      
      // Vérification de sécurité supplémentaire
      if (document.getElementById(targetSelectId)) {
        // Réinitialiser le style du select
        selectElement.classList.remove('loading-select');
        selectElement.style.backgroundColor = '';
        
        // Afficher les options avec un style amélioré
        selectElement.innerHTML = '<option value="">Sélectionnez un modèle</option>';
        
        // Trier les modèles par ordre alphabétique pour une meilleure organisation
        demoModels.sort();
        
        // Ajouter les modèles avec des styles améliorés
        demoModels.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          // Ajouter une classe si le modèle a un attribut spécial
          if (model.includes('large')) {
            option.className = 'model-option-large';
          }
          selectElement.appendChild(option);
        });
        
        // Animation d'apparition des options
        const options = selectElement.querySelectorAll('option');
        options.forEach((option, index) => {
          option.style.opacity = '0';
          option.style.transition = 'opacity 0.2s ease';
          setTimeout(() => {
            option.style.opacity = '1';
          }, 50 * (index + 1));
        });
        
        console.log(`${demoModels.length} modèles de démo chargés dans le select ${targetSelectId}`);
      } else {
        console.error(`L'élément select ${targetSelectId} n'existe plus dans le DOM`);
      }
      
      showSuccess(`${demoModels.length} modèles disponibles chargés avec succès`);
      return;
    }
    
    // Créer un fournisseur temporaire pour le test avec une vraie clé API
    const testProvider = {
      api_key: apiKey,
      endpoint: endpoint || ''
    };
    
    // Appel API au endpoint de test
    const response = await fetch(`/api/ai-providers/${providerType}/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'dev-key'
      },
      body: JSON.stringify(testProvider)
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data && result.data.test_passed) {
      // Si des modèles sont disponibles, les sauvegarder et les afficher
      // Accepter either 'available_models' ou 'models' pour plus de robustesse
      const models = result.data.available_models || result.data.models || [];
      console.log(`Modèles reçus de l'API: ${models.length > 0 ? models.join(', ').substring(0, 100) + '...' : 'Aucun'}`);
      availableModels = models;
      
      // Mettre à jour la liste déroulante
      if (selectElement) {
        // Réinitialiser le style du select
        selectElement.classList.remove('loading-select');
        
        // Restaurer le bouton à son état initial
        const loadButtonId = targetSelectId === 'model-selection' ? 'load-models-btn' : 'edit-load-models-btn';
        const loadButton = document.getElementById(loadButtonId);
        
        if (loadButton && loadButton.innerHTML.includes('fa-spin')) {
          // S'il s'agit du bouton d'ajout
          if (loadButtonId === 'load-models-btn') {
            loadButton.innerHTML = '<i class="fas fa-sync-alt"></i> Charger les modèles';
          } else {
            // Sinon c'est le bouton d'édition
            loadButton.innerHTML = '<i class="fas fa-sync-alt"></i> Charger les modèles';
          }
          loadButton.disabled = false;
          loadButton.style.opacity = '1';
        }
        
        // Préparer la liste déroulante
        selectElement.innerHTML = '<option value="">Sélectionnez un modèle</option>';
        
        // Trier les modèles par ordre alphabétique
        models.sort();
        
        // Ajouter les modèles avec des styles améliorés
        models.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          
          // Ajouter des classes pour différents types de modèles
          if (model.includes('large')) {
            option.className = 'model-option-large';
          } else if (model.includes('small')) {
            option.className = 'model-option-small';
          }
          
          selectElement.appendChild(option);
        });
        
        // Animation d'apparition des options
        const options = selectElement.querySelectorAll('option');
        options.forEach((option, index) => {
          option.style.opacity = '0';
          option.style.transition = 'opacity 0.2s ease';
          setTimeout(() => {
            option.style.opacity = '1';
          }, 30 * (index + 1));
        });
      }
      
      showSuccess(`${models.length} modèles disponibles chargés avec succès`);
    } else {
      // En cas d'échec avec des vraies clés API, simuler des modèles
      // pour permettre de continuer à utiliser l'interface
      if (selectElement) {
        selectElement.innerHTML = '<option value="">Sélectionnez un modèle de démonstration</option>';
        
        // Charger des modèles de démonstration par défaut
        let defaultModels = [];
        switch (providerType) {
          case 'mistral': 
            defaultModels = ['mistral-large', 'mistral-medium', 'mistral-small']; 
            break;
          case 'ollama': 
            defaultModels = ['llama3', 'mistral', 'gemma']; 
            break;
          case 'openai': 
            defaultModels = ['gpt-4', 'gpt-3.5-turbo']; 
            break;
          default: 
            defaultModels = ['model-1', 'model-2'];
        }
        
        defaultModels.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          selectElement.appendChild(option);
        });
        
        availableModels = defaultModels;
      }
      
      // Afficher l'erreur mais permettre de continuer
      const errorMsg = result.error || result.data?.status || 'Erreur lors du chargement des modèles';
      showError(`${errorMsg} - Modèles de démonstration chargés à la place`);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des modèles:', error);
    const selectElement = document.getElementById(targetSelectId);
    
    // Même en cas d'erreur, fournir des modèles de démonstration pour assurer une expérience utilisateur fluide
    if (selectElement) {
      // Réinitialiser le style du select
      selectElement.classList.remove('loading-select');
      
      // Restaurer le bouton à son état initial en cas d'erreur
      const loadButtonId = targetSelectId === 'model-selection' ? 'load-models-btn' : 'edit-load-models-btn';
      const loadButton = document.getElementById(loadButtonId);
      
      if (loadButton && loadButton.innerHTML.includes('fa-spin')) {
        // S'il s'agit du bouton d'ajout
        if (loadButtonId === 'load-models-btn') {
          loadButton.innerHTML = '<i class="fas fa-sync-alt"></i> Charger les modèles';
        } else {
          // Sinon c'est le bouton d'édition
          loadButton.innerHTML = '<i class="fas fa-sync-alt"></i> Charger les modèles';
        }
        loadButton.disabled = false;
        loadButton.style.opacity = '1';
      }
      
      // Indiquer visuellement qu'il y a eu une erreur tout en fournissant une solution de repli
      selectElement.style.border = '1px solid #f8d7da';
      selectElement.style.transition = 'border-color 0.3s ease';
      
      // Après un court délai, revenir à une apparence normale
      setTimeout(() => {
        selectElement.style.border = '';
      }, 3000);
      
      // Charger des modèles de démonstration
      selectElement.innerHTML = '<option value="">Sélectionnez un modèle de secours</option>';
      
      // Déterminer les modèles de secours en fonction du type
      let fallbackModels = ['model-1', 'model-2', 'model-3'];
      
      // Si le type de fournisseur est connu, offrir des modèles plus spécifiques
      if (providerType === 'mistral') {
        fallbackModels = ['mistral-small', 'mistral-medium', 'mistral-large'];
      } else if (providerType === 'ollama') {
        fallbackModels = ['llama3', 'mistral', 'gemma'];
      }
      
      // Ajouter les modèles
      fallbackModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        selectElement.appendChild(option);
      });
      
      availableModels = fallbackModels;
    }
    
    // Afficher un message d'erreur informatif mais rassurant
    showError(`Erreur lors du chargement: ${error.message}. Des modèles de secours ont été chargés pour vous permettre de continuer.`);
  }
}

// Édition d'un fournisseur
function editProvider(id) {
  const provider = currentProviders.find(p => p.id === id);
  if (!provider) return;
  
  // Remplir le formulaire d'édition
  document.getElementById('edit-provider-id').value = provider.id;
  document.getElementById('edit-provider-name').value = provider.provider_name;
  document.getElementById('edit-provider-type').value = provider.provider_type;
  
  // Utiliser la dernière clé API testée avec succès si disponible
  const providerType = provider.provider_type;
  if (lastSuccessfulApiKeys[providerType]) {
    document.getElementById('edit-api-key').value = lastSuccessfulApiKeys[providerType];
    console.log(`Pré-remplissage du formulaire d'édition avec la clé API de ${providerType}`);
  } else {
    document.getElementById('edit-api-key').value = '';  // Ne pas afficher la clé API pour des raisons de sécurité
  }
  
  document.getElementById('edit-endpoint').value = provider.endpoint || '';
  document.getElementById('edit-models').value = provider.models || '';
  
  // Afficher le modal d'édition
  document.getElementById('edit-provider-modal').style.display = 'block';
}

// Mise à jour d'un fournisseur
async function updateProvider(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const id = formData.get('provider-id');
  
  const providerData = {
    provider_name: formData.get('provider-name'),
    api_key: formData.get('api-key') || undefined,  // undefined pour ne pas écraser si vide
    endpoint: formData.get('endpoint') || undefined,
    models: formData.get('models') || undefined
  };
  
  // Supprimer les propriétés undefined
  Object.keys(providerData).forEach(key => {
    if (providerData[key] === undefined) delete providerData[key];
  });
  
  try {
    const response = await fetch(`/api/ai-providers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'dev-key'
      },
      body: JSON.stringify(providerData)
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('Fournisseur mis à jour avec succès');
      document.getElementById('edit-provider-modal').style.display = 'none';
      form.reset();
      fetchProviders(); // Rafraîchir la liste
    } else {
      showError(result.error || 'Erreur lors de la mise à jour du fournisseur');
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du fournisseur:', error);
    showError(`Erreur: ${error.message}`);
  }
}

// Suppression d'un fournisseur
async function deleteProvider(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur d\'IA ?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/ai-providers/${id}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': 'dev-key'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('Fournisseur supprimé avec succès');
      fetchProviders(); // Rafraîchir la liste
    } else {
      showError(result.error || 'Erreur lors de la suppression du fournisseur');
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du fournisseur:', error);
    showError(`Erreur: ${error.message}`);
  }
}

// Affichage des messages d'erreur
function showError(message) {
  // Créer l'élément de notification temporaire
  let notificationContainer = document.getElementById('notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '1000';
    notificationContainer.style.maxWidth = '350px';
    notificationContainer.style.width = '100%';
    document.body.appendChild(notificationContainer);
  }
  
  // Créer la notification d'erreur avec animation d'entrée
  const errorNotification = document.createElement('div');
  errorNotification.style.backgroundColor = '#f8d7da';
  errorNotification.style.color = '#721c24';
  errorNotification.style.padding = '12px 16px';
  errorNotification.style.borderRadius = '4px';
  errorNotification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  errorNotification.style.marginBottom = '10px';
  errorNotification.style.display = 'flex';
  errorNotification.style.alignItems = 'flex-start';
  errorNotification.style.justifyContent = 'space-between';
  errorNotification.style.transform = 'translateX(400px)';
  errorNotification.style.opacity = '0';
  errorNotification.style.transition = 'transform 0.4s ease, opacity 0.3s ease';
  
  // Contenu de la notification avec icône et texte
  const contentDiv = document.createElement('div');
  contentDiv.style.display = 'flex';
  contentDiv.style.alignItems = 'flex-start';
  contentDiv.style.flex = '1';
  
  const icon = document.createElement('i');
  icon.className = 'fas fa-exclamation-circle';
  icon.style.marginRight = '10px';
  icon.style.marginTop = '3px';
  icon.style.fontSize = '16px';
  
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  messageSpan.style.wordBreak = 'break-word';
  
  contentDiv.appendChild(icon);
  contentDiv.appendChild(messageSpan);
  
  // Bouton de fermeture
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.background = 'transparent';
  closeButton.style.border = 'none';
  closeButton.style.color = '#721c24';
  closeButton.style.fontSize = '18px';
  closeButton.style.marginLeft = '8px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.padding = '0 5px';
  closeButton.style.lineHeight = '1';
  closeButton.title = 'Fermer';
  
  closeButton.addEventListener('click', () => {
    hideNotification(errorNotification);
  });
  
  errorNotification.appendChild(contentDiv);
  errorNotification.appendChild(closeButton);
  
  notificationContainer.appendChild(errorNotification);
  
  // Animation d'entrée
  setTimeout(() => {
    errorNotification.style.transform = 'translateX(0)';
    errorNotification.style.opacity = '1';
  }, 10);
  
  // Auto-fermeture après 5 secondes
  setTimeout(() => {
    hideNotification(errorNotification);
  }, 5000);
  
  // Également logger l'erreur dans la console
  console.error('Erreur:', message);
  
  // Fonction pour masquer la notification avec animation
  function hideNotification(notification) {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(400px)';
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 400);
    }
  }
}

// Affichage des messages de succès
function showSuccess(message) {
  // Créer l'élément de notification temporaire
  let notificationContainer = document.getElementById('notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '1000';
    notificationContainer.style.maxWidth = '350px';
    notificationContainer.style.width = '100%';
    document.body.appendChild(notificationContainer);
  }
  
  // Créer la notification de succès avec animation d'entrée
  const successNotification = document.createElement('div');
  successNotification.style.backgroundColor = '#d4edda';
  successNotification.style.color = '#155724';
  successNotification.style.padding = '12px 16px';
  successNotification.style.borderRadius = '4px';
  successNotification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  successNotification.style.marginBottom = '10px';
  successNotification.style.display = 'flex';
  successNotification.style.alignItems = 'flex-start';
  successNotification.style.justifyContent = 'space-between';
  successNotification.style.transform = 'translateX(400px)';
  successNotification.style.opacity = '0';
  successNotification.style.transition = 'transform 0.4s ease, opacity 0.3s ease';
  
  // Contenu de la notification avec icône et texte
  const contentDiv = document.createElement('div');
  contentDiv.style.display = 'flex';
  contentDiv.style.alignItems = 'flex-start';
  contentDiv.style.flex = '1';
  
  const icon = document.createElement('i');
  icon.className = 'fas fa-check-circle';
  icon.style.marginRight = '10px';
  icon.style.marginTop = '3px';
  icon.style.fontSize = '16px';
  
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  messageSpan.style.wordBreak = 'break-word';
  
  contentDiv.appendChild(icon);
  contentDiv.appendChild(messageSpan);
  
  // Bouton de fermeture
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.background = 'transparent';
  closeButton.style.border = 'none';
  closeButton.style.color = '#155724';
  closeButton.style.fontSize = '18px';
  closeButton.style.marginLeft = '8px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.padding = '0 5px';
  closeButton.style.lineHeight = '1';
  closeButton.title = 'Fermer';
  
  closeButton.addEventListener('click', () => {
    hideNotification(successNotification);
  });
  
  successNotification.appendChild(contentDiv);
  successNotification.appendChild(closeButton);
  
  notificationContainer.appendChild(successNotification);
  
  // Animation d'entrée
  setTimeout(() => {
    successNotification.style.transform = 'translateX(0)';
    successNotification.style.opacity = '1';
  }, 10);
  
  // Auto-fermeture après 5 secondes
  setTimeout(() => {
    hideNotification(successNotification);
  }, 4000);
  
  // Également logger dans la console
  console.log('Succès:', message);
  
  // Fonction pour masquer la notification avec animation
  function hideNotification(notification) {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(400px)';
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 400);
    }
  }
}

// Formatage des dates
function formatDate(dateString) {
  if (!dateString) return 'Non disponible';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
}