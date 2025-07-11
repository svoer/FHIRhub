// Script pour inclure le menu latéral dans toutes les pages
// Version améliorée pour corriger les problèmes avec les pages FHIR
(function() {
  // Attendre que le DOM soit complètement chargé
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Démarrage de l\'inclusion du menu latéral (version fixe)...');
    
    // Ne pas exécuter pour la page de login ou index
    if (window.location.pathname === '/login.html') {
      return;
    }
    
    // Variable pour éviter les boucles infinies
    if (window.sidebarLoaded) {
      console.log('Menu latéral déjà chargé, évite la boucle infinie');
      return;
    }
    window.sidebarLoaded = true;
    
    console.log('Chargement du menu latéral...');
    
    // Récupérer l'élément où insérer le sidebar avec validation robuste
    let sidebarContainer = document.getElementById('sidebar-container');
    // Vérifier aussi l'élément avec l'ID "sidebar" qui sert de conteneur dans la nouvelle version
    if (!sidebarContainer) {
      sidebarContainer = document.getElementById('sidebar');
    }
    
    if (!sidebarContainer) {
      console.warn('Container de sidebar non trouvé! Création d\'un conteneur...');
      // Si le conteneur n'existe pas, on le crée avec validation
      try {
        const newContainer = document.createElement('div');
        newContainer.id = 'sidebar-container';
        newContainer.className = 'sidebar-container';
        
        // Validation que body existe avant insertion
        if (document.body && document.body.nodeType === Node.ELEMENT_NODE) {
          document.body.insertBefore(newContainer, document.body.firstChild);
          sidebarContainer = newContainer;
        } else {
          console.error('Document body non disponible pour insertion du conteneur');
          return;
        }
      } catch (error) {
        console.error('Erreur lors de la création du conteneur sidebar:', error);
        return;
      }
    }
    
    // Supprimer d'abord tout header existant
    const existingHeader = document.querySelector('header.header');
    if (existingHeader) {
      existingHeader.parentNode.removeChild(existingHeader);
    }
    
    // Supprimer tout sidebar existant
    const existingSidebar = document.querySelector('aside.sidebar');
    if (existingSidebar) {
      existingSidebar.parentNode.removeChild(existingSidebar);
    }
    
    // Supprimer tout bouton mobile existant
    const existingMobileToggle = document.querySelector('#sidebar-toggle-mobile');
    if (existingMobileToggle) {
      existingMobileToggle.parentNode.removeChild(existingMobileToggle);
    }
    
    // Charger le contenu du fichier sidebar.html
    fetch('/includes/sidebar.html')
      .then(response => {
        if (!response.ok) {
          throw new Error('Erreur de chargement du menu latéral');
        }
        return response.text();
      })
      .then(html => {
        console.log('Menu latéral récupéré avec succès, injection...');
        
        // Injecter le HTML du sidebar dans le conteneur (sidebarContainer déjà défini plus haut)
        sidebarContainer.innerHTML = html;
        
        // Référence au contenu principal
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) {
          console.warn('Élément .main-content non trouvé! Création d\'un conteneur principal...');
          
          // Créer un élément main-content s'il n'existe pas
          const newMainContent = document.createElement('div');
          newMainContent.className = 'main-content';
          
          // Déplacer tous les éléments existants sauf le header, le sidebar et le sidebar-container dans main-content
          const elementsToMove = [];
          // On utilise le sidebarContainer déjà défini plus haut
          
          for (let i = 0; i < document.body.children.length; i++) {
            const child = document.body.children[i];
            if (child !== sidebarContainer &&
                child.tagName !== 'HEADER' &&
                child.tagName !== 'ASIDE' &&
                child.id !== 'sidebar-toggle-mobile' &&
                !child.classList.contains('main-content') &&
                !child.classList.contains('footer')) {
              elementsToMove.push(child);
            }
          }
          
          // Move elements safely by checking if they're valid DOM nodes
          for (const element of elementsToMove) {
            try {
              if (element && element.nodeType === Node.ELEMENT_NODE && element.parentNode) {
                newMainContent.appendChild(element);
              }
            } catch (e) {
              console.warn('Failed to move element:', element, e);
            }
          }
          
          // Insérer le nouveau main-content après le sidebar-container
          document.body.insertBefore(newMainContent, sidebarContainer.nextSibling);
        }
        
        console.log('Menu latéral chargé avec succès');
        
        // Réinitialiser l'indicateur d'IA après avoir chargé le sidebar
        if (typeof initializeAiProvider === 'function') {
          initializeAiProvider();
        } else {
          // Créer l'événement que le script ai-provider-indicator.js écoutera
          const event = new Event('sidebar-loaded');
          document.dispatchEvent(event);
        }
        
        // Initialiser le menu latéral avec un délai sécuritaire
        setTimeout(setupSidebarInteractivity, 300);
      })
      .catch(error => {
        console.error('Erreur lors du chargement du menu latéral:', error);
      });
  });
  
  // Fonction pour configurer l'interactivité du menu une fois chargé
  function setupSidebarInteractivity() {
    console.log('Configuration de l\'interactivité du menu latéral...');
    
    // Bascule du menu latéral
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const footer = document.querySelector('.footer');
    
    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        if (mainContent) mainContent.classList.toggle('expanded');
        if (footer) footer.classList.toggle('expanded');
      });
      console.log('Événement de bascule du menu configuré');
    } else {
      console.warn('Éléments de bascule du menu non trouvés');
    }
    
    // Menu mobile
    const mobileToggle = document.getElementById('sidebar-toggle-mobile');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', function() {
        sidebar.classList.toggle('mobile-open');
        this.innerHTML = sidebar.classList.contains('mobile-open') ? 
          '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
      });
      console.log('Événement de menu mobile configuré');
    } else {
      console.warn('Éléments de menu mobile non trouvés');
    }
    
    // Marquer la page active dans le menu
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.nav-menu a');
    
    console.log('Chemin actuel:', currentPath);
    
    if (menuLinks.length > 0) {
      let found = false;
      menuLinks.forEach(link => {
        const href = link.getAttribute('href');
        console.log('Vérification du lien:', href);
        
        if (href === currentPath) {
          link.classList.add('active');
          found = true;
          console.log('Page active trouvée:', href);
        }
      });
      
      if (!found) {
        console.warn('Aucun lien de menu ne correspond au chemin actuel:', currentPath);
      } else {
        console.log('Page active marquée dans le menu');
      }
    }
    
    // === SYSTÈME DE FAVORIS ROBUSTE ===
    
    // État global des favoris en mémoire
    window.fhirHubFavorites = window.fhirHubFavorites || [];
    
    // 1. Initialiser le système de favoris avec réhydratation complète
    function initFavoritesSystem() {
      console.log('[FAVORIS] Initialisation du système de favoris');
      
      try {
        // Récupérer les favoris persistants depuis localStorage
        const storedFavorites = JSON.parse(localStorage.getItem('fhirhub-favorites') || '[]');
        console.log('[FAVORIS] Favoris récupérés depuis localStorage:', storedFavorites);
        
        // Mettre à jour l'état global
        window.fhirHubFavorites = [...storedFavorites];
        
        // Réhydrater immédiatement l'interface complète
        setTimeout(() => {
          window.renderTopFavorites(window.fhirHubFavorites);
          updateFavoriteButtonsState(window.fhirHubFavorites);
        }, 50);
        
        return window.fhirHubFavorites;
      } catch (error) {
        console.error('[FAVORIS] Erreur lors de l\'initialisation:', error);
        window.fhirHubFavorites = [];
        return [];
      }
    }
    

    

    
    // Suppression définitive des favoris - Nettoyage complet
    setTimeout(() => {
      // Nettoyer toutes les références aux favoris
      const favoriteButtons = document.querySelectorAll('.favorite-btn, .favorite-icon, .fa-star, .fa-star-o, .icon-star, .sidebar-favorite');
      favoriteButtons.forEach(btn => btn.remove());
      
      // Remplacer les fonctions favoris par des fonctions vides
      window.renderTopFavorites = function() { return; };
      window.toggleFavorite = function() { return; };
      window.initFavoritesSystem = function() { return []; };
      
      console.log('[CLEANUP] Suppression définitive de', favoriteButtons.length, 'éléments favoris');
    }, 200); // Nettoyage rapide
    
    console.log('[MENU] Navigation simplifiée sans favoris - nettoyage complet effectué');
    
    // Fonction pour mettre à jour les favoris (legacy, maintenue pour compatibilité)
    function updateFavoritesList(favorites) {
      // Mettre à jour la barre du haut
      window.updateTopFavorites(favorites);
      
      // Ancienne liste du sidebar (supprimée mais fonction maintenue)
      const favoritesList = document.getElementById('favorites-list');
      if (!favoritesList) return;
      
      if (!favorites || favorites.length === 0) {
        favoritesList.innerHTML = '<li><p class="no-favorites">Aucun favori</p></li>';
        return;
      }
      
      // Récupérer la structure de navigation pour les étiquettes
      const navMap = {
        '/dashboard.html': { title: 'Tableau de bord', icon: 'fas fa-chart-line' },
        '/convert.html': { title: 'HL7 vers FHIR', icon: 'fas fa-exchange-alt' },
        '/applications.html': { title: 'Applications', icon: 'fas fa-th' },
        '/api-keys.html': { title: 'Clés API', icon: 'fas fa-key' },
        '/users.html': { title: 'Utilisateurs', icon: 'fas fa-users' },
        '/terminologies.html': { title: 'Terminologies', icon: 'fas fa-book-medical' },
        '/processus.html': { title: 'Processus', icon: 'fas fa-project-diagram' },
        '/ai-settings.html': { title: 'Paramètres IA', icon: 'fas fa-robot' },
        '/documentation.html': { title: 'Documentation', icon: 'fas fa-file-alt' },
        '/api-reference.html': { title: 'API Reference', icon: 'fas fa-code' },
        '/faq.html': { title: 'FAQ', icon: 'fas fa-question-circle' },
        '/hl7-ai-assistant.html': { title: 'Assistant IA', icon: 'fas fa-robot' },
        '/fhir-hub.html': { title: 'Portail FHIR', icon: 'fas fa-fire' },
        '/fhir-browser.html': { title: 'Navigateur FHIR', icon: 'fas fa-search' },
        '/fhir-settings.html': { title: 'Configuration FHIR', icon: 'fas fa-cog' }
      };
      
      // Créer des éléments de menu pour chaque favori
      const items = favorites.map(url => {
        const navItem = navMap[url];
        if (!navItem) {
          console.warn(`Navigation item not found for URL: ${url}`);
          return '';
        }
        
        return `
          <li>
            <a href="${url}">
              <i class="${navItem.icon}"></i> ${navItem.title}
              <button class="favorite-btn active remove-favorite" data-url="${url}" title="Retirer des favoris">
                <i class="fas fa-times"></i>
              </button>
            </a>
          </li>
        `;
      }).filter(item => item !== ''); // Filtrer les éléments vides
      
      if (items.length === 0) {
        favoritesList.innerHTML = '<li><p class="no-favorites">Aucun favori valide</p></li>';
        return;
      }
      
      favoritesList.innerHTML = items.join('');
      
      // Ajouter des écouteurs d'événements aux boutons de suppression dans la liste des favoris
      const removeButtons = favoritesList.querySelectorAll('.remove-favorite');
      removeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const url = this.getAttribute('data-url');
          
          // Retirer des favoris
          let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
          const index = favorites.indexOf(url);
          if (index !== -1) {
            favorites.splice(index, 1);
          }
          
          // Enregistrer les favoris mis à jour
          localStorage.setItem('favorites', JSON.stringify(favorites));
          
          // Mettre à jour l'affichage de la liste des favoris
          updateFavoritesList(favorites);
          
          // L'état des boutons est maintenant géré par toggleFavorite
        });
      });
    }
    


    
    // Gestion de la déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
      });
      console.log('Événement de déconnexion configuré');
    } else {
      console.warn('Bouton de déconnexion non trouvé. L\'événement sera géré par include-sidebar.js');
    }
    
    console.log('Configuration de l\'interactivité terminée');
    
    console.log('[MENU] Menu latéral simplifié chargé');
  }
})();