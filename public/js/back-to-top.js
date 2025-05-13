/**
 * Script pour gérer le bouton de retour en haut de page
 * Ce script crée dynamiquement un bouton de retour en haut de page,
 * indépendant du menu latéral et des autres éléments de la page.
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log("Initialisation du bouton de retour en haut...");
  
  // Suppression des boutons existants pour éviter les doublons
  const existingButtons = document.querySelectorAll('[id^="scroll-to-top"], [id^="back-to-top"]');
  existingButtons.forEach(button => {
    if (button.parentNode) {
      console.log("Suppression d'un bouton de retour en haut existant");
      button.parentNode.removeChild(button);
    }
  });
  
  // Création d'un nouveau bouton
  const backToTopButton = document.createElement('div');
  backToTopButton.id = 'back-to-top-new';
  backToTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
  backToTopButton.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #e74c3c, #ff5722);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s, transform 0.3s;
  `;
  
  // Ajout du bouton directement au body
  document.body.appendChild(backToTopButton);
  console.log("Nouveau bouton de retour en haut créé");
  
  // Gestion du clic sur le bouton
  backToTopButton.addEventListener('click', function() {
    console.log("Retour en haut de page");
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  // Affichage/masquage du bouton au scroll
  window.addEventListener('scroll', function() {
    if (window.scrollY > 300) {
      backToTopButton.style.opacity = '1';
      backToTopButton.style.transform = 'translateY(0)';
    } else {
      backToTopButton.style.opacity = '0';
      backToTopButton.style.transform = 'translateY(10px)';
    }
  });
  
  // Forcer une vérification initiale
  if (window.scrollY > 300) {
    backToTopButton.style.opacity = '1';
    backToTopButton.style.transform = 'translateY(0)';
  }
  
  console.log("Bouton de retour en haut initialisé ✅");
});