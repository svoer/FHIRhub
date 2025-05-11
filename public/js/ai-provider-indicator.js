/**
 * Script pour l'indicateur de fournisseur d'IA
 * Affiche le fournisseur d'IA actif et le modèle utilisé dans la barre latérale
 */

// Fonction d'initialisation principale
async function initializeAiProvider() {
  console.log('Initialisation de l\'indicateur de fournisseur d\'IA...');
  
  // Fonction pour s'assurer que l'indicateur d'IA est présent dans le DOM
  function ensureAiIndicatorElements() {
    let aiProviderIndicator = document.querySelector('.ai-provider-indicator');
    
    // Si l'indicateur n'existe pas, le créer et l'insérer dans le header
    if (!aiProviderIndicator) {
      const header = document.querySelector('header .container');
      if (header) {
        aiProviderIndicator = document.createElement('div');
        aiProviderIndicator.className = 'ai-provider-indicator';
        
        // Insérer après le logo s'il existe, sinon au début du header
        const logo = header.querySelector('.logo');
        if (logo && logo.nextElementSibling) {
          header.insertBefore(aiProviderIndicator, logo.nextElementSibling);
        } else {
          header.appendChild(aiProviderIndicator);
        }
      } else {
        // Si pas de header, créer un conteneur dans le body
        aiProviderIndicator = document.createElement('div');
        aiProviderIndicator.className = 'ai-provider-indicator';
        document.body.insertBefore(aiProviderIndicator, document.body.firstChild);
      }
    }
    
    // S'assurer que le badge existe
    let aiProviderBadge = document.getElementById('ai-provider-badge');
    if (!aiProviderBadge) {
      aiProviderBadge = document.createElement('div');
      aiProviderBadge.id = 'ai-provider-badge';
      aiProviderBadge.title = 'Fournisseur d\'IA actif';
      
      // Ajouter l'icône robot
      const robotIcon = document.createElement('i');
      robotIcon.className = 'fas fa-robot';
      aiProviderBadge.appendChild(robotIcon);
      
      aiProviderIndicator.appendChild(aiProviderBadge);
    }
    
    // S'assurer que le span pour le nom existe
    let aiProviderName = document.getElementById('ai-provider-name');
    if (!aiProviderName) {
      aiProviderName = document.createElement('span');
      aiProviderName.id = 'ai-provider-name';
      aiProviderName.textContent = 'Chargement...';
      aiProviderBadge.appendChild(aiProviderName);
    }
    
    return { aiProviderIndicator, aiProviderBadge, aiProviderName };
  }
  
  // S'assurer que tous les éléments nécessaires existent
  const { aiProviderIndicator, aiProviderBadge, aiProviderName } = ensureAiIndicatorElements();
  
  // Ajouter la classe de chargement et mettre à jour le texte
  aiProviderBadge.classList.add('loading');
  
  // Ajouter un élément point indicateur s'il n'existe pas déjà
  if (!aiProviderBadge.querySelector('.dot')) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    aiProviderBadge.insertBefore(dot, aiProviderBadge.firstChild);
  }
  
  // Ajouter un élément pour le nom du modèle s'il n'existe pas déjà
  let aiProviderModel = document.getElementById('ai-provider-model');
  if (!aiProviderModel) {
    aiProviderModel = document.createElement('span');
    aiProviderModel.id = 'ai-provider-model';
    aiProviderBadge.appendChild(aiProviderModel);
  }
  
  // Créer le tooltip s'il n'existe pas déjà
  let tooltip = document.querySelector('.ai-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'ai-tooltip';
    aiProviderIndicator.appendChild(tooltip);
  }
  
  try {
    // Récupérer les données du fournisseur d'IA actif depuis l'API
    const response = await fetch('/api/ai-providers/status');
    const data = await response.json();
    
    // Vérifier si la requête a réussi
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors de la récupération des données du fournisseur d\'IA');
    }
    
    // Vérifier si un fournisseur d'IA est actif
    if (!data.data.active) {
      // Aucun fournisseur actif
      aiProviderName.textContent = 'Aucun fournisseur IA';
      aiProviderModel.textContent = '';
      aiProviderBadge.classList.remove('loading');
      aiProviderBadge.classList.add('inactive');
      
      tooltip.innerHTML = `
        <div>Aucun fournisseur d'IA n'est actif.</div>
        <div class="ai-tooltip-details">
          <div class="ai-tooltip-detail">
            <span class="ai-tooltip-label">Statut:</span>
            <span>Inactif</span>
          </div>
        </div>
      `;
      
      return;
    }
    
    // Récupérer les informations du fournisseur et du modèle
    const provider = data.data.provider;
    const model = data.data.model;
    
    // Mettre à jour l'interface
    aiProviderName.textContent = provider.name;
    aiProviderModel.textContent = model.name;
    aiProviderBadge.classList.remove('loading');
    
    // Mettre à jour le tooltip avec les détails complets
    tooltip.innerHTML = `
      <div>Fournisseur d'IA actif: ${provider.name}</div>
      <div class="ai-tooltip-details">
        <div class="ai-tooltip-detail">
          <span class="ai-tooltip-label">Type:</span>
          <span>${provider.type}</span>
        </div>
        <div class="ai-tooltip-detail">
          <span class="ai-tooltip-label">Modèle:</span>
          <span>${model.id}</span>
        </div>
        <div class="ai-tooltip-detail">
          <span class="ai-tooltip-label">Statut:</span>
          <span>Actif</span>
        </div>
      </div>
    `;
    
    console.log(`Fournisseur d'IA actif détecté: ${provider.name}, Modèle: ${model.name}`);
    
  } catch (error) {
    console.error('Erreur lors de la récupération du statut du fournisseur d\'IA:', error);
    
    // Afficher l'erreur
    aiProviderName.textContent = 'Erreur';
    aiProviderModel.textContent = '';
    aiProviderBadge.classList.remove('loading');
    aiProviderBadge.classList.add('inactive');
    
    tooltip.innerHTML = `
      <div>Erreur lors de la récupération du fournisseur d'IA</div>
      <div class="ai-tooltip-details">
        <div class="ai-tooltip-detail">
          <span class="ai-tooltip-label">Erreur:</span>
          <span>${error.message}</span>
        </div>
      </div>
    `;
  }
}

// Initialiser l'indicateur lors du chargement de la page
document.addEventListener('DOMContentLoaded', function() {
  // Si la barre latérale est déjà chargée, initialiser immédiatement
  if (document.querySelector('header.header')) {
    initializeAiProvider();
  }
});

// Écouter un événement personnalisé quand la barre latérale est chargée dynamiquement
document.addEventListener('sidebar-loaded', function() {
  console.log('Événement sidebar-loaded reçu, initialisation de l\'indicateur d\'IA...');
  initializeAiProvider();
});