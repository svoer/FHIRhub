/**
 * Script pour gérer le bouton de retour en haut de page
 * Ce script crée dynamiquement un bouton de retour en haut de page,
 * indépendant du menu latéral et des autres éléments de la page.
 * Positionné exactement comme dans le schéma fourni par l'utilisateur.
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
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #e74c3c, #ff5722);
    color: white;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    opacity: 1;
    transition: transform 0.2s;
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
  
  // Effet d'échelle au survol
  backToTopButton.addEventListener('mouseover', function() {
    backToTopButton.style.transform = 'scale(1.1)';
  });
  
  backToTopButton.addEventListener('mouseout', function() {
    backToTopButton.style.transform = 'scale(1)';
  });
  
  // Effet au clic
  backToTopButton.addEventListener('mousedown', function() {
    backToTopButton.style.transform = 'scale(0.95)';
  });
  
  backToTopButton.addEventListener('mouseup', function() {
    backToTopButton.style.transform = 'scale(1.1)';
  });
  
  // Le bouton est toujours visible comme sur le schéma
  // Aucune gestion d'opacité au scroll nécessaire
  
  console.log("Bouton de retour en haut initialisé ✅");
});