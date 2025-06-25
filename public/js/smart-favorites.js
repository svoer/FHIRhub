/**
 * Smart Favorites Hydration System
 * Système intelligent d'hydratation des favoris basé sur le contexte de la page
 */

class SmartFavoritesManager {
  constructor() {
    this.currentPage = window.location.pathname;
    this.pageCategories = this.initializePageCategories();
    this.userBehaviorData = this.loadUserBehavior();
    this.contextualSuggestions = [];
  }

  // Catégorisation intelligente des pages
  initializePageCategories() {
    return {
      'conversion': ['/convert.html', '/direct-fhir.html'],
      'management': ['/applications.html', '/api-keys.html', '/users.html'],
      'configuration': ['/fhir-settings.html', '/ai-providers.html', '/terminologies.html'],
      'analysis': ['/dashboard.html', '/patient-viewer.html'],
      'documentation': ['/documentation.html', '/api-docs/integrated', '/faq.html']
    };
  }

  // Charger les données de comportement utilisateur
  loadUserBehavior() {
    const stored = localStorage.getItem('fhirhub-user-behavior');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn('[SMART-FAV] Erreur lecture comportement utilisateur:', error);
      }
    }
    
    return {
      pageVisits: {},
      navigationPatterns: [],
      favoriteInteractions: {},
      lastVisited: {},
      workflowPreferences: {}
    };
  }

  // Sauvegarder les données de comportement
  saveUserBehavior() {
    try {
      localStorage.setItem('fhirhub-user-behavior', JSON.stringify(this.userBehaviorData));
    } catch (error) {
      console.error('[SMART-FAV] Erreur sauvegarde comportement:', error);
    }
  }

  // Enregistrer la visite d'une page
  recordPageVisit(pagePath = this.currentPage) {
    const now = Date.now();
    
    // Compter les visites
    if (!this.userBehaviorData.pageVisits[pagePath]) {
      this.userBehaviorData.pageVisits[pagePath] = 0;
    }
    this.userBehaviorData.pageVisits[pagePath]++;
    
    // Enregistrer la dernière visite
    this.userBehaviorData.lastVisited[pagePath] = now;
    
    // Enregistrer les patterns de navigation
    if (this.userBehaviorData.navigationPatterns.length > 0) {
      const lastPage = this.userBehaviorData.navigationPatterns[this.userBehaviorData.navigationPatterns.length - 1];
      if (lastPage.page !== pagePath) {
        this.userBehaviorData.navigationPatterns.push({
          from: lastPage.page,
          to: pagePath,
          timestamp: now
        });
      }
    } else {
      this.userBehaviorData.navigationPatterns.push({
        page: pagePath,
        timestamp: now
      });
    }
    
    // Limiter l'historique de navigation
    if (this.userBehaviorData.navigationPatterns.length > 50) {
      this.userBehaviorData.navigationPatterns = this.userBehaviorData.navigationPatterns.slice(-50);
    }
    
    this.saveUserBehavior();
    console.log('[SMART-FAV] Visite enregistrée:', pagePath);
  }

  // Générer des suggestions contextuelles
  generateContextualSuggestions() {
    const suggestions = [];
    const currentCategory = this.getCurrentPageCategory();
    
    // Suggestions basées sur la catégorie actuelle
    if (currentCategory) {
      const relatedPages = this.pageCategories[currentCategory].filter(page => page !== this.currentPage);
      suggestions.push(...relatedPages.map(page => ({
        page,
        reason: 'related-category',
        category: currentCategory,
        score: 0.7
      })));
    }
    
    // Suggestions basées sur l'historique de navigation
    const frequentPages = this.getFrequentlyVisitedPages();
    suggestions.push(...frequentPages.map(page => ({
      page: page.path,
      reason: 'frequent-visit',
      visits: page.visits,
      score: Math.min(page.visits / 10, 1)
    })));
    
    // Suggestions basées sur les patterns de navigation
    const nextLikelyPages = this.predictNextPages();
    suggestions.push(...nextLikelyPages.map(page => ({
      page: page.path,
      reason: 'navigation-pattern',
      probability: page.probability,
      score: page.probability
    })));
    
    // Trier par score et éliminer les doublons
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    return uniqueSuggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  // Obtenir la catégorie de la page actuelle
  getCurrentPageCategory() {
    for (const [category, pages] of Object.entries(this.pageCategories)) {
      if (pages.includes(this.currentPage)) {
        return category;
      }
    }
    return null;
  }

  // Obtenir les pages les plus visitées
  getFrequentlyVisitedPages() {
    return Object.entries(this.userBehaviorData.pageVisits)
      .map(([path, visits]) => ({ path, visits }))
      .filter(item => item.path !== this.currentPage)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);
  }

  // Prédire les prochaines pages probables
  predictNextPages() {
    const patterns = this.userBehaviorData.navigationPatterns.filter(p => p.from === this.currentPage);
    const transitions = {};
    
    patterns.forEach(pattern => {
      if (!transitions[pattern.to]) {
        transitions[pattern.to] = 0;
      }
      transitions[pattern.to]++;
    });
    
    const total = patterns.length;
    if (total === 0) return [];
    
    return Object.entries(transitions)
      .map(([path, count]) => ({
        path,
        probability: count / total
      }))
      .filter(item => item.probability > 0.1)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3);
  }

  // Éliminer les suggestions en double
  deduplicateSuggestions(suggestions) {
    const seen = new Set();
    return suggestions.filter(suggestion => {
      if (seen.has(suggestion.page)) {
        return false;
      }
      seen.add(suggestion.page);
      return true;
    });
  }

  // Hydratation intelligente des favoris
  async performSmartHydration() {
    console.log('[SMART-FAV] Démarrage hydratation intelligente...');
    
    // Enregistrer la visite de la page actuelle
    this.recordPageVisit();
    
    // Générer les suggestions contextuelles
    this.contextualSuggestions = this.generateContextualSuggestions();
    
    // Obtenir les favoris actuels
    const currentFavorites = JSON.parse(localStorage.getItem('fhirhub-favorites') || '[]');
    
    // Proposer des suggestions si peu de favoris
    if (currentFavorites.length < 3 && this.contextualSuggestions.length > 0) {
      this.showSmartSuggestions();
    }
    
    // Réorganiser les favoris par pertinence contextuelle
    const reorderedFavorites = this.reorderFavoritesByContext(currentFavorites);
    
    // Mettre à jour l'affichage si l'ordre a changé
    if (JSON.stringify(reorderedFavorites) !== JSON.stringify(currentFavorites)) {
      this.updateFavoritesDisplay(reorderedFavorites);
    }
    
    console.log('[SMART-FAV] Hydratation terminée');
  }

  // Réorganiser les favoris par contexte
  reorderFavoritesByContext(favorites) {
    const currentCategory = this.getCurrentPageCategory();
    if (!currentCategory) return favorites;
    
    return favorites.sort((a, b) => {
      const aInCategory = this.pageCategories[currentCategory]?.includes(a) ? 1 : 0;
      const bInCategory = this.pageCategories[currentCategory]?.includes(b) ? 1 : 0;
      
      // Les pages de la même catégorie en premier
      if (aInCategory !== bInCategory) {
        return bInCategory - aInCategory;
      }
      
      // Puis par fréquence de visite
      const aVisits = this.userBehaviorData.pageVisits[a] || 0;
      const bVisits = this.userBehaviorData.pageVisits[b] || 0;
      return bVisits - aVisits;
    });
  }

  // Afficher les suggestions intelligentes
  showSmartSuggestions() {
    if (this.contextualSuggestions.length === 0) return;
    
    // Créer une notification subtile avec les suggestions
    const suggestionContainer = document.createElement('div');
    suggestionContainer.className = 'smart-favorites-suggestions';
    suggestionContainer.innerHTML = `
      <div class="suggestion-header">
        <i class="fas fa-lightbulb"></i>
        <span>Suggestions de favoris</span>
        <button class="close-suggestions" title="Fermer">&times;</button>
      </div>
      <div class="suggestion-items">
        ${this.contextualSuggestions.slice(0, 3).map(suggestion => this.renderSuggestion(suggestion)).join('')}
      </div>
    `;
    
    // Ajouter au DOM
    document.body.appendChild(suggestionContainer);
    
    // Gestionnaires d'événements
    this.setupSuggestionEvents(suggestionContainer);
    
    // Auto-masquer après 10 secondes
    setTimeout(() => {
      if (suggestionContainer.parentNode) {
        suggestionContainer.remove();
      }
    }, 10000);
  }

  // Rendre une suggestion
  renderSuggestion(suggestion) {
    const navMap = {
      '/dashboard.html': { title: 'Dashboard', icon: 'fas fa-chart-line' },
      '/convert.html': { title: 'Convertir', icon: 'fas fa-exchange-alt' },
      '/direct-fhir.html': { title: 'FHIR Direct', icon: 'fas fa-fire' },
      '/patient-viewer.html': { title: 'Patients', icon: 'fas fa-user-injured' },
      '/fhir-settings.html': { title: 'Config FHIR', icon: 'fas fa-cog' },
      '/applications.html': { title: 'Apps', icon: 'fas fa-th' },
      '/api-keys.html': { title: 'API Keys', icon: 'fas fa-key' },
      '/users.html': { title: 'Utilisateurs', icon: 'fas fa-users' },
      '/terminologies.html': { title: 'Terminologies', icon: 'fas fa-book-medical' },
      '/ai-providers.html': { title: 'IA Config', icon: 'fas fa-robot' },
      '/documentation.html': { title: 'Docs', icon: 'fas fa-file-alt' },
      '/api-docs/integrated': { title: 'API Docs', icon: 'fas fa-code' },
      '/faq.html': { title: 'FAQ', icon: 'fas fa-question-circle' }
    };
    
    const navItem = navMap[suggestion.page];
    if (!navItem) return '';
    
    const reasonText = {
      'related-category': 'Page liée',
      'frequent-visit': 'Souvent visitée',
      'navigation-pattern': 'Navigation habituelle'
    };
    
    return `
      <div class="suggestion-item" data-page="${suggestion.page}">
        <div class="suggestion-content">
          <i class="${navItem.icon}"></i>
          <span class="suggestion-title">${navItem.title}</span>
          <span class="suggestion-reason">${reasonText[suggestion.reason] || suggestion.reason}</span>
        </div>
        <button class="add-to-favorites" title="Ajouter aux favoris">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    `;
  }

  // Configurer les événements des suggestions
  setupSuggestionEvents(container) {
    // Fermer les suggestions
    container.querySelector('.close-suggestions').addEventListener('click', () => {
      container.remove();
    });
    
    // Ajouter aux favoris
    container.querySelectorAll('.add-to-favorites').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const suggestionItem = btn.closest('.suggestion-item');
        const page = suggestionItem.dataset.page;
        
        // Utiliser la fonction toggleFavorite globale
        if (window.toggleFavorite) {
          window.toggleFavorite(page);
        }
        
        // Retirer la suggestion
        suggestionItem.remove();
        
        // Fermer si plus de suggestions
        if (container.querySelectorAll('.suggestion-item').length === 0) {
          container.remove();
        }
      });
    });
  }

  // Mettre à jour l'affichage des favoris
  updateFavoritesDisplay(reorderedFavorites) {
    // Mettre à jour localStorage
    localStorage.setItem('fhirhub-favorites', JSON.stringify(reorderedFavorites));
    
    // Mettre à jour l'état global
    if (window.fhirHubFavorites) {
      window.fhirHubFavorites = reorderedFavorites;
    }
    
    // Mettre à jour l'affichage si les fonctions sont disponibles
    if (window.renderTopFavorites) {
      window.renderTopFavorites(reorderedFavorites);
    }
  }
}

// Styles CSS pour les suggestions
const smartFavoritesStyles = `
  .smart-favorites-suggestions {
    position: fixed;
    top: 80px;
    right: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    z-index: 9999;
    min-width: 320px;
    max-width: 400px;
    border: 1px solid #e1e5e8;
    animation: slideInFromRight 0.3s ease-out;
  }
  
  @keyframes slideInFromRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .suggestion-header {
    display: flex;
    align-items: center;
    padding: 16px 20px 12px;
    border-bottom: 1px solid #f0f2f5;
    background: linear-gradient(135deg, #e74c3c, #f39c12);
    color: white;
    border-radius: 12px 12px 0 0;
  }
  
  .suggestion-header i {
    margin-right: 8px;
    color: #ffd700;
  }
  
  .suggestion-header span {
    flex: 1;
    font-weight: 600;
    font-size: 0.95rem;
  }
  
  .close-suggestions {
    background: none;
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 4px;
    opacity: 0.8;
    transition: opacity 0.2s;
  }
  
  .close-suggestions:hover {
    opacity: 1;
  }
  
  .suggestion-items {
    padding: 8px 0;
  }
  
  .suggestion-item {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    transition: background-color 0.2s;
    cursor: pointer;
  }
  
  .suggestion-item:hover {
    background-color: #f8f9fa;
  }
  
  .suggestion-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .suggestion-content i {
    color: #e74c3c;
    width: 16px;
  }
  
  .suggestion-title {
    font-weight: 500;
    color: #333;
  }
  
  .suggestion-reason {
    font-size: 0.8rem;
    color: #666;
    margin-left: auto;
    padding: 2px 6px;
    background: #f0f2f5;
    border-radius: 8px;
  }
  
  .add-to-favorites {
    background: linear-gradient(135deg, #e74c3c, #f39c12);
    color: white;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s;
    margin-left: 12px;
  }
  
  .add-to-favorites:hover {
    transform: scale(1.1);
  }
  
  @media (max-width: 768px) {
    .smart-favorites-suggestions {
      right: 10px;
      left: 10px;
      min-width: auto;
      max-width: none;
    }
  }
`;

// Injecter les styles
const styleSheet = document.createElement('style');
styleSheet.textContent = smartFavoritesStyles;
document.head.appendChild(styleSheet);

// Instance globale
window.smartFavoritesManager = null;

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    window.smartFavoritesManager = new SmartFavoritesManager();
    window.smartFavoritesManager.performSmartHydration();
  }, 500);
});

// Export pour utilisation externe
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartFavoritesManager;
}