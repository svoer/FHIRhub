/**
 * Gestion du menu de documentation
 */
document.addEventListener('DOMContentLoaded', function() {
  // Éléments du DOM
  const sectionNav = document.querySelector('.section-nav');
  const navItems = document.querySelectorAll('.section-nav a');
  const backToTopBtn = document.getElementById('back-to-top');
  
  // Variables pour suivre l'état
  let lastScrollY = window.scrollY;
  let isMenuHidden = false;
  let activeSection = 'introduction';
  
  // Initialiser le suivi de la section active
  const sections = {};
  document.querySelectorAll('.documentation-section').forEach(section => {
    sections[section.id] = section.offsetTop - 100;
  });
  
  // Fonctions pour afficher/masquer le menu
  function hideMenu() {
    if (!isMenuHidden) {
      sectionNav.classList.add('hidden');
      isMenuHidden = true;
    }
  }
  
  function showMenu() {
    if (isMenuHidden) {
      sectionNav.classList.remove('hidden');
      isMenuHidden = false;
    }
  }
  
  // Gestionnaire de clic sur les liens de navigation
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      // Mettre à jour l'état actif
      navItems.forEach(link => link.classList.remove('active'));
      this.classList.add('active');
      
      // Mise à jour de la section active
      activeSection = this.getAttribute('href').substring(1);
    });
  });
  
  // Gestion du scroll
  window.addEventListener('scroll', function() {
    const scrollY = window.scrollY;
    
    // Afficher/masquer le bouton retour en haut
    if (scrollY > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
    
    // Masquer le menu lors du défilement vers le bas
    if (scrollY > lastScrollY + 20) {
      hideMenu();
      lastScrollY = scrollY;
    }
    
    // Afficher le menu lors du défilement vers le haut
    if (scrollY < lastScrollY - 50) {
      showMenu();
      lastScrollY = scrollY;
    }
    
    // Si on est tout en haut de la page, on affiche toujours le menu
    if (scrollY < 50) {
      showMenu();
    }
    
    // Mise à jour de la section active lors du défilement
    for (const section in sections) {
      if (scrollY >= sections[section]) {
        activeSection = section;
      }
    }
    
    // Mettre à jour le lien actif dans le menu
    navItems.forEach(item => {
      const href = item.getAttribute('href').substring(1);
      if (href === activeSection) {
        if (!item.classList.contains('active')) {
          navItems.forEach(link => link.classList.remove('active'));
          item.classList.add('active');
        }
      }
    });
  });
  
  // Initialiser l'état du menu au chargement
  showMenu(); // Toujours afficher le menu au début
});