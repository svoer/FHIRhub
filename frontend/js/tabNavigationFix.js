/**
 * Correctif pour la navigation entre les onglets
 * Ce module corrige le bug de rémanence dans la section historique
 * et améliore la navigation générale entre les onglets
 * 
 * @module tabNavigationFix
 * @author FHIRHub Team
 */

/**
 * Nettoyer le contenu des onglets inactifs
 * @param {string} activeTabId - ID de l'onglet actif
 */
function cleanupInactiveTabs(activeTabId) {
  // Liste des onglets qui doivent être nettoyés lors de la désactivation
  const tabsToCleanup = {
    'history-tab-content': function() {
      // Vider le conteneur des résultats d'historique
      document.getElementById('history-results-container').innerHTML = '';
    },
    'conversion-tab-content': function() {
      // Réinitialiser les résultats de conversion
      const resultContainer = document.getElementById('fhir-result-container');
      if (resultContainer) {
        resultContainer.innerHTML = '<div class="placeholder-message">Le résultat de la conversion s\'affichera ici</div>';
      }
    }
  };
  
  // Parcourir tous les onglets à nettoyer
  Object.keys(tabsToCleanup).forEach(tabId => {
    // Ne pas nettoyer l'onglet actif
    if (tabId !== activeTabId && document.getElementById(tabId)) {
      tabsToCleanup[tabId]();
    }
  });
}

/**
 * Appliquer le correctif de navigation des onglets
 */
function applyTabNavigationFix() {
  // Récupérer tous les liens d'onglets
  const tabLinks = document.querySelectorAll('.nav-tabs .nav-link');
  
  // Ajouter des écouteurs d'événements à chaque lien d'onglet
  tabLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Récupérer l'ID de l'onglet cible
      const tabId = this.getAttribute('href').substring(1);
      const tabContentId = tabId + '-content';
      
      // Désactiver tous les onglets
      tabLinks.forEach(l => {
        l.classList.remove('active');
        
        // Désactiver le contenu correspondant
        const contentId = l.getAttribute('href').substring(1) + '-content';
        const content = document.getElementById(contentId);
        if (content) {
          content.classList.remove('active');
          content.classList.remove('show');
        }
      });
      
      // Activer l'onglet cliqué
      this.classList.add('active');
      
      // Activer le contenu correspondant
      const tabContent = document.getElementById(tabContentId);
      if (tabContent) {
        tabContent.classList.add('active');
        tabContent.classList.add('show');
        
        // Nettoyer les onglets inactifs
        cleanupInactiveTabs(tabContentId);
        
        // Actions spécifiques à certains onglets
        if (tabId === 'history-tab') {
          // Recharger l'historique lorsqu'on active cet onglet
          if (window.loadConversionHistory) {
            window.loadConversionHistory();
          }
        } else if (tabId === 'dashboard-tab') {
          // Recharger les statistiques lorsqu'on active cet onglet
          if (window.loadDashboardStats) {
            window.loadDashboardStats();
          }
        }
      }
      
      // Stocker l'onglet actif dans le stockage local
      localStorage.setItem('activeTab', tabId);
    });
  });
  
  console.log("Application du correctif de navigation des onglets");
}

/**
 * Initialiser le correctif de navigation
 */
function initTabNavigationFix() {
  document.addEventListener('DOMContentLoaded', () => {
    applyTabNavigationFix();
    
    // Restaurer l'onglet actif s'il est stocké
    const activeTab = localStorage.getItem('activeTab');
    if (activeTab) {
      const tabLink = document.querySelector(`.nav-tabs .nav-link[href="#${activeTab}"]`);
      if (tabLink) {
        tabLink.click();
      }
    }
  });
}

// Initialiser le correctif
initTabNavigationFix();

// Exposer la fonction pour permettre son utilisation directe
window.applyTabNavigationFix = applyTabNavigationFix;