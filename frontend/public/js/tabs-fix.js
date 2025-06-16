/**
 * Script spécifique pour corriger les problèmes des onglets de l'interface
 * Permet de naviguer entre les onglets "Paramètres", "En-têtes" et "Corps"
 */

(function() {
  'use strict';
  
  // Fonction d'initialisation pour corriger les onglets
  function initTabsFix() {
    console.log('[TABS-FIX] Initialisation de la correction des onglets...');
    
    // Sélectionner tous les onglets
    const tabs = document.querySelectorAll('.tabs .tab');
    
    // Ajouter un gestionnaire d'événement à chaque onglet
    tabs.forEach(tab => {
      // Supprimer l'événement existant pour éviter les duplications
      const clonedTab = tab.cloneNode(true);
      tab.parentNode.replaceChild(clonedTab, tab);
      
      // Ajouter le nouvel événement
      clonedTab.addEventListener('click', function(event) {
        // Empêcher le comportement par défaut
        event.preventDefault();
        event.stopPropagation();
        
        // Désactiver tous les onglets du même groupe
        const tabGroup = this.closest('.tabs');
        tabGroup.querySelectorAll('.tab').forEach(t => {
          t.classList.remove('active');
        });
        
        // Activer l'onglet courant
        this.classList.add('active');
        
        // Récupérer l'identifiant du contenu à afficher
        const tabId = this.getAttribute('data-tab');
        console.log(`[TABS-FIX] Activation de l'onglet ${tabId}`);
        
        // Masquer tous les contenus dans cette section
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
          content.classList.remove('active');
        });
        
        // Afficher le contenu associé à cet onglet
        const targetContent = document.getElementById(`${tabId}-tab`);
        if (targetContent) {
          targetContent.classList.add('active');
          console.log(`[TABS-FIX] Contenu ${tabId}-tab activé`);
        } else {
          console.error(`[TABS-FIX] Contenu ${tabId}-tab non trouvé`);
        }
        
        return false;
      });
    });
    
    console.log(`[TABS-FIX] ${tabs.length} onglets corrigés`);
    
    // Fixer également la saisie de texte dans tous les champs de formulaire
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('click', function(event) {
        event.stopPropagation();
      });
      
      input.addEventListener('keydown', function(event) {
        event.stopPropagation();
      });
    });
    
    console.log(`[TABS-FIX] ${inputs.length} champs de saisie corrigés`);
  }
  
  // Initialiser après le chargement complet de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initTabsFix, 500);
    });
  } else {
    setTimeout(initTabsFix, 500);
  }
  
  // Réinitialiser périodiquement pour capturer les nouveaux éléments ajoutés dynamiquement
  setInterval(initTabsFix, 3000);
  
  // Exposer pour l'utilisation externe
  window.tabsFix = {
    init: initTabsFix
  };
})();