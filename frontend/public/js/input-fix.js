/**
 * Correctif pour résoudre les problèmes de saisie dans les champs texte
 * de l'interface du testeur d'API et éviter les problèmes de navigation
 */

(function() {
  'use strict';
  
  // Configuration
  const config = {
    selectors: {
      apiTesterTab: '#api-tester-tab',
      allTextInputs: 'input[type="text"], textarea',
      bodyContent: '#body-content',
      paramsTab: '.tab[data-tab="params"]',
      headersTab: '.tab[data-tab="headers"]',
      bodyTab: '.tab[data-tab="body"]',
      paramsTabContent: '#params-tab',
      headersTabContent: '#headers-tab',
      bodyTabContent: '#body-tab'
    },
    init_delay: 500,
    reinit_interval: 2000  // Réinitialiser périodiquement
  };
  
  // État
  let initialized = false;
  
  // Fonction de journalisation
  function log(message) {
    console.log(`[INPUT-FIX] ${message}`);
  }
  
  // Fonction d'erreur
  function error(message) {
    console.error(`[INPUT-FIX] ${message}`);
  }
  
  // Corriger tous les champs de saisie
  function fixAllInputs() {
    const inputs = document.querySelectorAll(config.selectors.allTextInputs);
    
    if (!inputs.length) {
      error('Aucun champ de saisie trouvé');
      return;
    }
    
    inputs.forEach(input => {
      // Cloner pour supprimer les gestionnaires existants
      const clonedInput = input.cloneNode(true);
      input.parentNode.replaceChild(clonedInput, input);
      
      // Empêcher la propagation des événements
      ['click', 'focus', 'keydown', 'keyup', 'keypress', 'input'].forEach(eventType => {
        clonedInput.addEventListener(eventType, function(event) {
          event.stopPropagation();
        }, true);
      });
    });
    
    log(`${inputs.length} champs de saisie corrigés`);
  }
  
  // Corriger les gestionnaires d'événements sur les onglets
  function fixTabHandlers() {
    // Fonctions pour activer les onglets
    function activateParamsTab() {
      document.querySelector(config.selectors.paramsTab)?.classList.add('active');
      document.querySelector(config.selectors.headersTab)?.classList.remove('active');
      document.querySelector(config.selectors.bodyTab)?.classList.remove('active');
      
      document.querySelector(config.selectors.paramsTabContent)?.classList.add('active');
      document.querySelector(config.selectors.headersTabContent)?.classList.remove('active');
      document.querySelector(config.selectors.bodyTabContent)?.classList.remove('active');
      
      log('Onglet Paramètres activé');
    }
    
    function activateHeadersTab() {
      document.querySelector(config.selectors.paramsTab)?.classList.remove('active');
      document.querySelector(config.selectors.headersTab)?.classList.add('active');
      document.querySelector(config.selectors.bodyTab)?.classList.remove('active');
      
      document.querySelector(config.selectors.paramsTabContent)?.classList.remove('active');
      document.querySelector(config.selectors.headersTabContent)?.classList.add('active');
      document.querySelector(config.selectors.bodyTabContent)?.classList.remove('active');
      
      log('Onglet En-têtes activé');
    }
    
    function activateBodyTab() {
      document.querySelector(config.selectors.paramsTab)?.classList.remove('active');
      document.querySelector(config.selectors.headersTab)?.classList.remove('active');
      document.querySelector(config.selectors.bodyTab)?.classList.add('active');
      
      document.querySelector(config.selectors.paramsTabContent)?.classList.remove('active');
      document.querySelector(config.selectors.headersTabContent)?.classList.remove('active');
      document.querySelector(config.selectors.bodyTabContent)?.classList.add('active');
      
      log('Onglet Corps activé');
    }
    
    // Ajouter les gestionnaires d'événements
    const paramsTab = document.querySelector(config.selectors.paramsTab);
    const headersTab = document.querySelector(config.selectors.headersTab);
    const bodyTab = document.querySelector(config.selectors.bodyTab);
    
    if (paramsTab) {
      const newParamsTab = paramsTab.cloneNode(true);
      paramsTab.parentNode.replaceChild(newParamsTab, paramsTab);
      newParamsTab.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        activateParamsTab();
        return false;
      });
      log('Gestionnaire d\'événement ajouté à l\'onglet Paramètres');
    }
    
    if (headersTab) {
      const newHeadersTab = headersTab.cloneNode(true);
      headersTab.parentNode.replaceChild(newHeadersTab, headersTab);
      newHeadersTab.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        activateHeadersTab();
        return false;
      });
      log('Gestionnaire d\'événement ajouté à l\'onglet En-têtes');
    }
    
    if (bodyTab) {
      const newBodyTab = bodyTab.cloneNode(true);
      bodyTab.parentNode.replaceChild(newBodyTab, bodyTab);
      newBodyTab.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        activateBodyTab();
        return false;
      });
      log('Gestionnaire d\'événement ajouté à l\'onglet Corps');
    }
  }
  
  // Assurer que l'éditeur de corps de requête fonctionne correctement
  function fixRequestBodyEditor() {
    const bodyContent = document.querySelector(config.selectors.bodyContent);
    if (!bodyContent) {
      return;
    }
    
    // S'assurer que l'éditeur de corps peut être modifié
    const clonedBodyContent = bodyContent.cloneNode(true);
    bodyContent.parentNode.replaceChild(clonedBodyContent, bodyContent);
    
    clonedBodyContent.addEventListener('click', function(event) {
      event.stopPropagation();
    });
    
    clonedBodyContent.addEventListener('focus', function(event) {
      event.stopPropagation();
    });
    
    clonedBodyContent.addEventListener('keydown', function(event) {
      event.stopPropagation();
    });
    
    log('Éditeur de corps de requête corrigé');
  }
  
  // Fonction d'initialisation
  function initialize() {
    if (!document.querySelector(config.selectors.apiTesterTab)) {
      return; // L'onglet API Tester n'est pas encore chargé
    }
    
    if (initialized) {
      return; // Déjà initialisé
    }
    
    log('Initialisation du correctif de saisie...');
    
    fixAllInputs();
    fixTabHandlers();
    fixRequestBodyEditor();
    
    initialized = true;
    log('Correctif de saisie initialisé avec succès');
  }
  
  // Initialiser après le chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initialize, config.init_delay);
    });
  } else {
    setTimeout(initialize, config.init_delay);
  }
  
  // Réinitialiser périodiquement pour capturer les nouveaux éléments
  setInterval(function() {
    initialize();
    fixAllInputs();
  }, config.reinit_interval);
  
  // Exposer pour l'utilisation externe
  window.inputFix = {
    init: initialize,
    fixInputs: fixAllInputs,
    fixTabs: fixTabHandlers,
    fixBodyEditor: fixRequestBodyEditor
  };
})();