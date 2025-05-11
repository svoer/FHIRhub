// Menu latéral et recherche globale pour FHIRHub

// Variables DOM globales
let menuToggle, sidebar, mainContent, footer, mobileToggle, searchInput, searchResults, favoritesList, favoriteButtons;

// Structure de navigation globale
const navigationItems = [
  { title: 'Tableau de bord', url: '/dashboard.html', category: 'Principal', keywords: ['accueil', 'statistiques', 'dashboard'] },
  { title: 'Conversion HL7 vers FHIR', url: '/convert.html', category: 'Conversion', keywords: ['conversion', 'transformer', 'hl7', 'fhir'] },
  { title: 'Applications', url: '/applications.html', category: 'Administration', keywords: ['apps', 'client'] },
  { title: 'Clés API', url: '/api-keys.html', category: 'Administration', keywords: ['api', 'clés', 'security', 'access'] },
  { title: 'Utilisateurs', url: '/users.html', category: 'Administration', keywords: ['users', 'comptes', 'permissions'] },
  { title: 'Portail FHIR', url: '/fhir-hub.html', category: 'FHIR', keywords: ['fhir', 'portail', 'intégration'] },
  { title: 'Navigateur FHIR', url: '/fhir-browser.html', category: 'FHIR', keywords: ['fhir', 'navigateur', 'resources'] },
  { title: 'Configuration FHIR', url: '/fhir-settings.html', category: 'FHIR', keywords: ['fhir', 'serveurs', 'configuration'] },
  { title: 'Terminologies', url: '/terminologies.html', category: 'Configuration', keywords: ['codes', 'mapping', 'nomenclature'] },
  { title: 'Workflows', url: '/workflows.html', category: 'Configuration', keywords: ['processus', 'automatisation', 'flux'] },
  { title: 'Paramètres IA', url: '/ai-settings.html', category: 'Configuration', keywords: ['intelligence artificielle', 'mistral', 'chatbot'] },
  { title: 'Documentation', url: '/documentation.html', category: 'Ressources', keywords: ['aide', 'docs', 'guide'] },
  { title: 'API Reference', url: '/api-docs/', category: 'Ressources', keywords: ['api', 'développeurs', 'integration'] },
];

// Fonction pour basculer l'état du menu latéral
function toggleSidebar() {
  sidebar.classList.toggle('collapsed');
  mainContent.classList.toggle('expanded');
  if (footer) footer.classList.toggle('expanded');
  
  // Sauvegarder l'état dans localStorage
  localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
  
  // Mettre à jour les icônes du bouton toggle
  updateToggleIcon();
}

// Mettre à jour l'icône du bouton toggle
function updateToggleIcon() {
  const isCollapsed = sidebar.classList.contains('collapsed');
  
  if (menuToggle) {
    // Remplacer l'icône en fonction de l'état
    menuToggle.innerHTML = isCollapsed ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-times"></i>';
    menuToggle.setAttribute('title', isCollapsed ? 'Ouvrir le menu' : 'Fermer le menu');
  }
  
  if (mobileToggle) {
    mobileToggle.innerHTML = '<i class="fas fa-' + (isCollapsed ? 'bars' : 'times') + '"></i>';
  }
}

// Initialiser l'état du menu à partir de localStorage
function initSidebarState() {
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
    mainContent.classList.add('expanded');
    if (footer) footer.classList.add('expanded');
  }
  
  updateToggleIcon();
  
  // Ajouter des classes pour animer les éléments du menu
  const menuItems = document.querySelectorAll('.nav-menu a');
  menuItems.forEach((item, index) => {
    item.style.setProperty('--index', index);
  });
}

// Fonction de recherche globale
function performSearch(query) {
  if (!query || query.length < 2) {
    searchResults.classList.remove('active');
    return;
  }
  
  query = query.toLowerCase().trim();
  const matches = [];
  
  // Recherche dans les éléments de navigation
  navigationItems.forEach(item => {
    const titleMatch = item.title.toLowerCase().includes(query);
    const keywordMatch = item.keywords.some(keyword => keyword.toLowerCase().includes(query));
    
    if (titleMatch || keywordMatch) {
      matches.push(item);
    }
  });
  
  // Afficher les résultats
  displaySearchResults(matches, query);
}

// Afficher les résultats de recherche
function displaySearchResults(matches, query) {
  if (matches.length === 0) {
    searchResults.innerHTML = '<div class="no-results">Aucun résultat trouvé</div>';
    searchResults.classList.add('active');
    return;
  }
  
  let resultsHTML = '';
  
  matches.forEach(match => {
    const title = highlightMatch(match.title, query);
    
    resultsHTML += `
      <div class="search-result-item" data-url="${match.url}">
        <div class="result-title">${title}</div>
        <div class="result-category">${match.category}</div>
      </div>
    `;
  });
  
  searchResults.innerHTML = resultsHTML;
  searchResults.classList.add('active');
  
  // Ajouter des écouteurs d'événements pour les résultats
  document.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', function() {
      window.location.href = this.getAttribute('data-url');
    });
  });
}

// Surligner la partie correspondante dans le texte
function highlightMatch(text, query) {
  const regex = new RegExp('(' + query + ')', 'gi');
  return text.replace(regex, '<span class="result-match">$1</span>');
}

// Identifier la page active et ajouter la classe .active
function setActivePage() {
  const currentPath = window.location.pathname;
  const menuLinks = document.querySelectorAll('.nav-menu a');
  
  menuLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
}

// Système de gestion des favoris - désactivé car maintenant géré par include-sidebar.js
function initFavorites() {
  // Cette fonction est délibérément vide car la gestion des favoris
  // est maintenant entièrement gérée par include-sidebar.js pour éviter les conflits
  console.log("Gestion des favoris déléguée à include-sidebar.js");
}

// Mettre à jour la liste des favoris dans le menu
function updateFavoritesList(favorites) {
  if (!favoritesList) return;
  
  if (favorites.length === 0) {
    favoritesList.innerHTML = '<li><p class="no-favorites">Aucun favori</p></li>';
    return;
  }
  
  // Créer des éléments de menu pour chaque favori
  const items = favorites.map(url => {
    // Trouver les informations de navigation correspondantes
    const navItem = navigationItems.find(item => item.url === url);
    if (!navItem) return '';
    
    return `
      <li>
        <a href="${url}">
          <i class="${getIconForUrl(url)}"></i> ${navItem.title}
          <button class="favorite-btn remove-favorite" data-url="${url}" title="Retirer des favoris">
            <i class="fas fa-times"></i>
          </button>
        </a>
      </li>
    `;
  });
  
  favoritesList.innerHTML = items.join('');
  
  // Ajouter des écouteurs d'événements aux boutons de suppression
  document.querySelectorAll('.remove-favorite').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const url = this.getAttribute('data-url');
      toggleFavorite(url);
    });
  });
}

// Ajouter ou supprimer un favori
function toggleFavorite(url, button) {
  // Récupérer les favoris actuels
  let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  
  // Vérifier si l'URL est déjà dans les favoris
  const index = favorites.indexOf(url);
  
  if (index === -1) {
    // Ajouter aux favoris
    favorites.push(url);
    if (button) {
      button.classList.add('active');
      button.innerHTML = '<i class="fas fa-star"></i>';
      button.setAttribute('title', 'Retirer des favoris');
    }
  } else {
    // Retirer des favoris
    favorites.splice(index, 1);
    if (button) {
      button.classList.remove('active');
      button.innerHTML = '<i class="far fa-star"></i>';
      button.setAttribute('title', 'Ajouter aux favoris');
    }
    
    // Mettre à jour tous les boutons correspondant à cette URL
    document.querySelectorAll(`.favorite-btn[data-url="${url}"]`).forEach(btn => {
      if (btn !== button) {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="far fa-star"></i>';
        btn.setAttribute('title', 'Ajouter aux favoris');
      }
    });
  }
  
  // Enregistrer les favoris mis à jour
  localStorage.setItem('favorites', JSON.stringify(favorites));
  
  // Mettre à jour l'affichage de la liste des favoris
  updateFavoritesList(favorites);
}

// Obtenir l'icône appropriée pour une URL
function getIconForUrl(url) {
  const iconMap = {
    '/dashboard.html': 'fas fa-chart-line',
    '/convert.html': 'fas fa-exchange-alt',
    '/applications.html': 'fas fa-th',
    '/api-keys.html': 'fas fa-key',
    '/users.html': 'fas fa-users',
    '/fhir-hub.html': 'fas fa-fire',
    '/fhir-browser.html': 'fas fa-search',
    '/fhir-settings.html': 'fas fa-cog',
    '/terminologies.html': 'fas fa-book-medical',
    '/workflows.html': 'fas fa-project-diagram',
    '/ai-settings.html': 'fas fa-robot',
    '/documentation.html': 'fas fa-file-alt',
    '/api-docs/': 'fas fa-code'
  };
  
  return iconMap[url] || 'fas fa-link';
}

// Fonction pour attacher tous les écouteurs d'événements
function attachEventListeners() {
  // Associer les écouteurs d'événements
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleSidebar);
  }
  
  if (mobileToggle) {
    mobileToggle.addEventListener('click', function() {
      sidebar.classList.toggle('mobile-open');
      this.innerHTML = sidebar.classList.contains('mobile-open') ? 
        '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
  }
  
  // Recherche en temps réel avec debounce
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performSearch(this.value);
      }, 300);
    });
    
    // Fermer les résultats lors d'un clic à l'extérieur
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.remove('active');
      }
    });
    
    // Naviguer dans les résultats avec le clavier
    searchInput.addEventListener('keydown', function(e) {
      const results = document.querySelectorAll('.search-result-item');
      
      if (e.key === 'Enter' && results.length > 0) {
        window.location.href = results[0].getAttribute('data-url');
      }
    });
  }
}

// Initialiser le menu latéral lorsque le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
  // Ne s'exécute qu'une seule fois par chargement de page
  if (window.sidebarMenuInitialized) return;
  window.sidebarMenuInitialized = true;
  
  // Définir les variables DOM avec vérification
  menuToggle = document.getElementById('menu-toggle');
  sidebar = document.getElementById('sidebar');
  
  // Vérifier que les éléments nécessaires existent
  if (!sidebar) {
    console.warn("Élément sidebar non trouvé. Le menu latéral pourrait ne pas fonctionner correctement.");
    return; // Sortir si les éléments essentiels n'existent pas
  }
  
  mainContent = document.querySelector('.main-content');
  footer = document.querySelector('.footer');
  mobileToggle = document.getElementById('sidebar-toggle-mobile');
  searchInput = document.getElementById('global-search');
  searchResults = document.getElementById('search-results');
  favoritesList = document.getElementById('favorites-list');
  
  // Ne sélectionner les boutons favoris que s'ils existent
  favoriteButtons = document.querySelectorAll('.favorite-btn') || [];
  
  // Initialiser l'état du menu seulement si le sidebar existe
  if (sidebar) {
    initSidebarState();
    
    // Identifier la page active
    setActivePage();
    
    // Pas besoin d'initialiser les favoris ici, c'est fait dans include-sidebar.js
    // pour éviter les conflits et les erreurs
    
    // Attacher les écouteurs d'événements
    attachEventListeners();
  }
});