/**
 * Script de correction des problèmes d'interface utilisateur
 * - Fixe les problèmes de navigation entre onglets
 * - Corrige les problèmes de saisie dans les champs texte
 * - S'assure que les boutons fonctionnent correctement
 */

(function() {
  'use strict';
  
  // Configuration
  const config = {
    debug: true,
    selectors: {
      // Onglets de requête
      requestTabs: '.request-tabs .tab',
      requestTabContents: '.tab-content',
      
      // Onglets de réponse
      responseTabs: '.response-tabs .tab',
      responseTabContents: '.tab-content',
      
      // Champs de saisie
      textInputs: 'input[type="text"], textarea',
      
      // Boutons
      sendButton: '#send-request',
      addParamButton: '#add-param',
      addHeaderButton: '#add-header',
      
      // Conteneurs
      paramsContainer: '.params-container',
      headersContainer: '.headers-container'
    },
    delay: 500 // Délai avant initialisation
  };
  
  // État
  let initialized = false;
  
  // Logging
  function log(message, data) {
    if (config.debug) {
      console.log(`[UI-FIX] ${message}`, data || '');
    }
  }
  
  function error(message, data) {
    console.error(`[UI-FIX] ${message}`, data || '');
  }
  
  // Fonctions utilitaires
  function getElement(selector) {
    return document.querySelector(selector);
  }
  
  function getElements(selector) {
    return document.querySelectorAll(selector);
  }
  
  // Correction des onglets
  function fixTabs() {
    log('Correction des onglets...');
    
    // Fonction pour activer un onglet et son contenu
    function activateTab(tabElement, isRequestTab = true) {
      // Déterminer les sélecteurs à utiliser
      const tabsSelector = isRequestTab ? config.selectors.requestTabs : config.selectors.responseTabs;
      
      // Désactiver tous les onglets de cette catégorie
      getElements(tabsSelector).forEach(tab => {
        tab.classList.remove('active');
      });
      
      // Activer l'onglet sélectionné
      tabElement.classList.add('active');
      
      // Récupérer l'identifiant du contenu associé
      const tabId = tabElement.getAttribute('data-tab');
      
      // Désactiver tous les contenus
      getElements(config.selectors.requestTabContents).forEach(content => {
        content.classList.remove('active');
      });
      
      // Activer le contenu associé à l'onglet
      const tabContent = document.getElementById(`${tabId}-tab`);
      if (tabContent) {
        tabContent.classList.add('active');
        log(`Onglet activé: ${tabId}`);
      } else {
        error(`Contenu d'onglet non trouvé: ${tabId}-tab`);
      }
    }
    
    // Ajouter des gestionnaires d'événements aux onglets de requête
    getElements(config.selectors.requestTabs).forEach(tab => {
      // Supprimer les gestionnaires existants
      const newTab = tab.cloneNode(true);
      tab.parentNode.replaceChild(newTab, tab);
      
      // Ajouter le nouveau gestionnaire
      newTab.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        activateTab(this, true);
        
        // Empêcher le comportement par défaut et la propagation
        return false;
      });
      
      log(`Gestionnaire d'événement ajouté à l'onglet ${newTab.getAttribute('data-tab')}`);
    });
    
    // Ajouter des gestionnaires d'événements aux onglets de réponse
    getElements(config.selectors.responseTabs).forEach(tab => {
      // Supprimer les gestionnaires existants
      const newTab = tab.cloneNode(true);
      tab.parentNode.replaceChild(newTab, tab);
      
      // Ajouter le nouveau gestionnaire
      newTab.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        activateTab(this, false);
        
        // Empêcher le comportement par défaut et la propagation
        return false;
      });
      
      log(`Gestionnaire d'événement ajouté à l'onglet de réponse ${newTab.getAttribute('data-tab')}`);
    });
  }
  
  // Correction des champs de saisie
  function fixTextInputs() {
    log('Correction des champs de saisie...');
    
    // S'assurer que les champs de saisie acceptent le texte
    getElements(config.selectors.textInputs).forEach(input => {
      // Ajouter un gestionnaire pour empêcher la propagation de certains événements
      input.addEventListener('click', function(event) {
        event.stopPropagation();
      });
      
      input.addEventListener('keydown', function(event) {
        event.stopPropagation();
      });
      
      input.addEventListener('focus', function(event) {
        event.stopPropagation();
      });
    });
    
    log(`${getElements(config.selectors.textInputs).length} champs de saisie corrigés`);
  }
  
  // Correction des boutons
  function fixButtons() {
    log('Correction des boutons...');
    
    // Fonction pour corriger un bouton
    function fixButton(selector, callback) {
      const button = getElement(selector);
      if (!button) {
        error(`Bouton non trouvé: ${selector}`);
        return;
      }
      
      // Supprimer les gestionnaires existants
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      // Ajouter le nouveau gestionnaire
      newButton.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Appeler le callback
        if (typeof callback === 'function') {
          callback(this);
        }
        
        // Empêcher le comportement par défaut et la propagation
        return false;
      });
      
      log(`Bouton corrigé: ${selector}`);
    }
    
    // Fixer les boutons principaux
    // Bouton d'envoi de requête
    fixButton(config.selectors.sendButton, () => {
      log('Bouton d\'envoi cliqué');
      
      // Déclencher la fonction sendApiRequest du module send-request-fix.js
      if (window.sendRequestFix && typeof window.sendRequestFix.send === 'function') {
        window.sendRequestFix.send();
      } else {
        error('Fonction d\'envoi non disponible');
      }
    });
    
    // Bouton d'ajout de paramètre
    fixButton(config.selectors.addParamButton, () => {
      log('Bouton d\'ajout de paramètre cliqué');
      
      const container = getElement(config.selectors.paramsContainer);
      if (!container) {
        error('Conteneur de paramètres non trouvé');
        return;
      }
      
      const row = document.createElement('div');
      row.className = 'param-row';
      
      row.innerHTML = `
        <input type="text" class="param-name" placeholder="Nom">
        <input type="text" class="param-value" placeholder="Valeur">
        <button class="remove-param">×</button>
      `;
      
      const removeButton = row.querySelector('.remove-param');
      removeButton.addEventListener('click', function() {
        row.remove();
      });
      
      // Insérer avant le bouton d'ajout
      container.insertBefore(row, getElement(config.selectors.addParamButton));
      
      // Corriger les nouveaux champs de saisie
      fixTextInputs();
    });
    
    // Bouton d'ajout d'en-tête
    fixButton(config.selectors.addHeaderButton, () => {
      log('Bouton d\'ajout d\'en-tête cliqué');
      
      const container = getElement(config.selectors.headersContainer);
      if (!container) {
        error('Conteneur d\'en-têtes non trouvé');
        return;
      }
      
      const row = document.createElement('div');
      row.className = 'header-row';
      
      row.innerHTML = `
        <input type="text" class="header-name" placeholder="Nom">
        <input type="text" class="header-value" placeholder="Valeur">
        <button class="remove-header">×</button>
      `;
      
      const removeButton = row.querySelector('.remove-header');
      removeButton.addEventListener('click', function() {
        row.remove();
      });
      
      // Insérer avant le bouton d'ajout
      container.insertBefore(row, getElement(config.selectors.addHeaderButton));
      
      // Corriger les nouveaux champs de saisie
      fixTextInputs();
    });
    
    // Corriger les boutons de suppression existants
    getElements('.remove-param').forEach(button => {
      button.addEventListener('click', function() {
        this.closest('.param-row').remove();
      });
    });
    
    getElements('.remove-header').forEach(button => {
      button.addEventListener('click', function() {
        this.closest('.header-row').remove();
      });
    });
  }
  
  // Fonction d'initialisation
  function initialize() {
    if (initialized) {
      log('Déjà initialisé');
      return;
    }
    
    log('Initialisation du correctif d\'interface utilisateur...');
    
    // Appliquer les corrections
    fixTabs();
    fixTextInputs();
    fixButtons();
    
    initialized = true;
    log('Correctif d\'interface utilisateur initialisé avec succès');
  }
  
  // Initialiser après le chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initialize, config.delay);
    });
  } else {
    setTimeout(initialize, config.delay);
  }
  
  // Exposer pour l'utilisation externe
  window.uiFix = {
    init: initialize,
    fixTabs: fixTabs,
    fixTextInputs: fixTextInputs,
    fixButtons: fixButtons
  };
})();