/**
 * Script d'aide pour l'utilisateur de la documentation Swagger
 * Ajoute automatiquement le token JWT pour les administrateurs et récupère une clé API
 */
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier si nous sommes sur la page Swagger
  if (window.location.pathname.includes('/api-docs')) {
    // Ajouter des styles personnalisés pour améliorer l'apparence de Swagger UI
    const customStyles = document.createElement('style');
    customStyles.textContent = `
      body {
        padding-top: 0;
      }
      
      .swagger-ui .topbar {
        background: linear-gradient(135deg, #e74c3c, #ff5722);
      }
      
      .swagger-ui .topbar .download-url-wrapper .select-label {
        color: white !important;
      }
      
      .swagger-ui .btn.authorize {
        background: linear-gradient(to right, #e74c3c, #ff5722);
        color: white;
        border-color: transparent;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
      }
      
      .swagger-ui .btn.authorize:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .swagger-ui .btn.authorize svg {
        fill: white;
      }
      
      .info-text-with-api-key {
        background-color: #fff3cd;
        border-left: 4px solid #ffc107;
        padding: 12px 15px;
        margin: 15px 0;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        font-size: 14px;
      }
      
      /* Réduction du clignotement */
      .swagger-ui .dialog-ux {
        transition: opacity 0.4s ease;
      }
      
      .swagger-ui .opblock.opblock-get .opblock-summary {
        border-color: #61affe;
      }
      
      .swagger-ui section.models {
        margin-top: 20px;
      }
      
      /* Amélioration du modal d'authentification */
      .swagger-ui .auth-container {
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        border-radius: 8px;
        border: none;
      }
      
      .swagger-ui .auth-container h4 {
        font-size: 16px;
        margin-bottom: 10px;
      }
      
      .swagger-ui .auth-container input {
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 8px 12px;
        transition: all 0.3s ease;
      }
      
      .swagger-ui .auth-container input:focus {
        border-color: #ff5722;
        outline: none;
        box-shadow: 0 0 0 3px rgba(255, 87, 34, 0.1);
      }
      
      .swagger-ui .auth-btn-wrapper {
        display: flex;
        justify-content: flex-end;
        padding-top: 10px;
      }
      
      .swagger-ui .auth-btn-wrapper .btn {
        border-radius: 4px;
        padding: 8px 16px;
        transition: all 0.3s ease;
      }
      
      .swagger-ui .auth-btn-wrapper .btn-done {
        background: linear-gradient(to right, #e74c3c, #ff5722);
        color: white;
        border: none;
      }
      
      .swagger-ui .auth-btn-wrapper .btn-done:hover {
        background: linear-gradient(to right, #d63031, #e84118);
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }
      
      /* Transition sur les endpoints */
      .swagger-ui .opblock {
        transition: all 0.3s ease;
        margin-bottom: 15px;
        border-radius: 6px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      }
      
      .swagger-ui .opblock:hover {
        box-shadow: 0 5px 15px rgba(0,0,0,0.08);
        transform: translateY(-2px);
      }
      
      /* Section de navigation */
      .swagger-ui .wrapper {
        padding: 0 30px;
      }
      
      /* Préventions des clignotements */
      .swagger-ui .loading-container {
        opacity: 0;
        transition: opacity 0.5s ease;
      }
      
      .swagger-ui .loading-container.loaded {
        opacity: 1;
      }
    `;
    document.head.appendChild(customStyles);
    
    // Ajouter une info-bulle pour expliquer comment utiliser les clés API
    setTimeout(() => {
      const infoSection = document.querySelector('.swagger-ui .information-container');
      if (infoSection) {
        const infoTip = document.createElement('div');
        infoTip.className = 'info-text-with-api-key';
        infoTip.innerHTML = `
          <p><strong>💡 Conseil :</strong> Pour tester les API, utilisez le bouton vert <strong>⚡ Autoriser</strong> ci-dessus et saisissez la clé de test : <code>dev-key</code> dans le champ apiKey.</p>
        `;
        infoSection.appendChild(infoTip);
      }
    }, 1000);
    
    // Fonction pour ajouter un bouton retour en haut
    const addNavigation = () => {
      // Vérifier si la navigation existe déjà
      if (document.querySelector('.fhirhub-back-btn')) {
        return;
      }
      
      // Créer le bouton de retour
      const backBtn = document.createElement('a');
      backBtn.className = 'fhirhub-back-btn';
      backBtn.href = '/dashboard.html';
      backBtn.style.backgroundColor = '#e74c3c';
      backBtn.style.background = 'linear-gradient(to right, #e74c3c, #f39c12)';
      backBtn.style.color = 'white';
      backBtn.style.padding = '8px 16px';
      backBtn.style.display = 'inline-flex';
      backBtn.style.alignItems = 'center';
      backBtn.style.position = 'fixed';
      backBtn.style.top = '10px';
      backBtn.style.left = '10px';
      backBtn.style.zIndex = '9999';
      backBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      backBtn.style.borderRadius = '4px';
      backBtn.style.fontWeight = 'bold';
      backBtn.style.fontSize = '14px';
      backBtn.style.textDecoration = 'none';
      
      // Icône de retour
      const backIcon = document.createElement('span');
      backIcon.innerHTML = '&larr; ';
      backIcon.style.marginRight = '5px';
      
      // Texte du bouton
      const backText = document.createTextNode('Retour');
      
      backBtn.appendChild(backIcon);
      backBtn.appendChild(backText);
      
      // Ajouter le bouton au début du body
      document.body.insertBefore(backBtn, document.body.firstChild);
      
      // Ajuster la position de la barre Swagger pour éviter qu'elle ne soit cachée
      const swaggerTopbar = document.querySelector('.swagger-ui .topbar');
      if (swaggerTopbar) {
        swaggerTopbar.style.paddingLeft = '100px';
      }
    };
    
    // Fonction pour ajouter directement les boutons sans attendre
    const addButtonsDirectly = () => {
      console.log('Ajout direct des boutons dans Swagger UI');
      
      // Ajouter uniquement la barre de navigation
      addNavigation();
      
      console.log('Barre d\'actions ajoutée avec succès');
    };
    
    // Exécuter immédiatement
    addButtonsDirectly();
    
    // Solution radicale - Suppression complète de toutes les animations Swagger
    const noFlickerStyles = document.createElement('style');
    noFlickerStyles.textContent = `
      /* SOLUTION RADICALE - DÉSACTIVATION COMPLÈTE DE TOUTES LES ANIMATIONS ET TRANSITIONS */
      .swagger-ui * {
        animation: none !important;
        transition: none !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        animation-iteration-count: 0 !important;
        animation-fill-mode: none !important;
        animation-play-state: paused !important;
        opacity: 1 !important;
        transform: none !important;
      }
      
      /* Stabilisation forcée du DOM pour éviter les clignotements */
      .swagger-ui .dialog-ux .backdrop-container,
      .swagger-ui .dialog-ux .modal-ux,
      .swagger-ui .dialog-ux .modal-ux-inner,
      .swagger-ui .auth-container,
      .swagger-ui .opblock-body pre.microlight,
      .swagger-ui .dialog-ux .modal-ux-content,
      .swagger-ui .model-box,
      .swagger-ui .model,
      .swagger-ui .model-toggle,
      .swagger-ui .highlight-code,
      .swagger-ui .expand-operation,
      .swagger-ui table tbody tr td {
        animation: none !important;
        transition: none !important;
        transform: none !important;
        opacity: 1 !important;
      }
      
      /* Forcer le rendu immédiat sans délai */
      .swagger-ui .loading-container {
        display: none !important;
      }
      
      /* Garder le modal en position fixe et visible */
      .swagger-ui .dialog-ux {
        position: fixed !important;
        display: block !important;
      }
      
      /* Supprimer complètement les effets de survol transitionnels */
      .swagger-ui .opblock:hover {
        transform: none !important;
        box-shadow: 0 5px 15px rgba(0,0,0,0.08) !important;
      }
      
      /* Stabiliser l'affichage des endpoints */
      .swagger-ui .opblock-summary {
        transition: none !important;
      }
      
      /* Désactiver complètement les slideshows et fades */
      @keyframes none {
        from { opacity: 1; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(noFlickerStyles);
    
    // Injection directe de code JavaScript pour supprimer les animations du runtime
    const preventFlickerScript = document.createElement('script');
    preventFlickerScript.textContent = `
      (function() {
        // Remplacer les fonctions d'animation natives
        window.requestAnimationFrame = function(callback) {
          return setTimeout(callback, 0);
        };
        
        // Nettoyer toutes les animations en cours
        const existingAnimations = document.getAnimations 
          ? document.getAnimations() 
          : [];
          
        existingAnimations.forEach(anim => {
          if (anim.cancel) anim.cancel();
        });
        
        // Désactiver complètement l'API d'animation
        CSSStyleDeclaration.prototype.setProperty = function(propertyName, value, priority) {
          if (propertyName.includes('animation') || propertyName.includes('transition')) {
            return;
          }
          
          return this._native_setProperty 
            ? this._native_setProperty(propertyName, value, priority)
            : null;
        };
        
        // Désactiver les transitions CSS
        document.addEventListener('transitionstart', (e) => {
          e.stopPropagation();
          e.preventDefault();
        }, true);
        
        // Supprimer immédiatement toutes les animations sur les éléments Swagger
        function killAllAnimations() {
          const swaggerElements = document.querySelectorAll('.swagger-ui *');
          swaggerElements.forEach(el => {
            el.style.animation = 'none';
            el.style.transition = 'none';
            el.style.animationDuration = '0s';
            el.style.transitionDuration = '0s';
            el.style.animationDelay = '0s';
            el.style.transitionDelay = '0s';
            
            // Forcer l'opacité sur tous les éléments
            if (el.classList.contains('modal-ux') || 
                el.classList.contains('backdrop-container') ||
                el.classList.contains('auth-container') ||
                el.classList.contains('modal-ux-inner') ||
                el.classList.contains('model-box') ||
                el.classList.contains('model')) {
              el.style.opacity = '1';
              el.style.transform = 'none';
            }
          });
        }
        
        // Exécuter immédiatement et périodiquement (pour les nouveaux éléments)
        killAllAnimations();
        setInterval(killAllAnimations, 100);
        
        // Observer toutes les modifications du DOM et tuer les animations
        const observer = new MutationObserver(killAllAnimations);
        observer.observe(document.body, { 
          childList: true, 
          subtree: true, 
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      })();
    `;
    document.head.appendChild(preventFlickerScript);
    
    // Récupérer le token JWT du localStorage
    const token = localStorage.getItem('token');
    
    // Attendre que Swagger UI soit complètement chargé pour traiter les tokens
    setTimeout(() => {
      // Si un token est trouvé, l'ajouter automatiquement
      if (token) {
        // Ouvrir le dialogue d'autorisation
        const authorizeBtn = document.querySelector('.swagger-ui .auth-wrapper .authorize');
        if (authorizeBtn) {
          authorizeBtn.click();
          
          // Attendre que le dialogue s'ouvre
          setTimeout(() => {
            // Trouver les champs pour chaque type d'auth
            const bearerInput = document.querySelector('.swagger-ui input[data-param-name="bearer"]');
            
            if (bearerInput) {
              bearerInput.value = token;
              // Simuler la saisie
              const event = new Event('input', { bubbles: true });
              bearerInput.dispatchEvent(event);
            }
            
            // Cliquer sur Authorize
            const dialogAuthorizeBtn = document.querySelector('.swagger-ui .auth-btn-wrapper .btn-done');
            if (dialogAuthorizeBtn) {
              dialogAuthorizeBtn.click();
              console.log('Token JWT automatiquement appliqué');
            }
          }, 300);
        }
      }
    }, 2000);
  }
});