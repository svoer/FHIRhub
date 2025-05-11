/**
 * Script simplifié pour l'authentification Swagger - Version optimisée sans animations
 * Ajoute automatiquement la clé API et le token JWT sans effets visuels
 */
(function() {
  // Attendre que Swagger UI soit chargé
  function waitForSwaggerUI() {
    if (document.querySelector('.swagger-ui')) {
      setupDirectAuth();
    } else {
      setTimeout(waitForSwaggerUI, 100);
    }
  }

  // Configurer l'authentification directe
  function setupDirectAuth() {
    console.log('[Swagger] Mise en place de l\'authentification directe...');
    
    // Récupérer les éléments de l'interface
    const swaggerUI = document.querySelector('.swagger-ui');
    const infoContainer = swaggerUI.querySelector('.information-container');
    
    if (!infoContainer) {
      console.error('[Swagger] Container d\'information non trouvé');
      return;
    }
    
    // Créer un conteneur pour notre formulaire d'authentification
    const authContainer = document.createElement('div');
    authContainer.className = 'direct-auth-container';
    authContainer.style.cssText = `
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      margin: 15px 0;
      border: 1px solid #e9ecef;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    `;
    
    // Créer le titre du formulaire
    const authTitle = document.createElement('h3');
    authTitle.textContent = 'Authentification API';
    authTitle.style.cssText = `
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 16px;
      color: #333;
    `;
    
    // Créer des onglets pour différentes méthodes d'authentification
    const authTabs = document.createElement('div');
    authTabs.className = 'auth-tabs';
    authTabs.style.cssText = `
      display: flex;
      border-bottom: 1px solid #dee2e6;
      margin-bottom: 15px;
    `;
    
    // Onglet API Key
    const apiKeyTab = document.createElement('div');
    apiKeyTab.className = 'auth-tab active';
    apiKeyTab.setAttribute('data-tab', 'apiKey');
    apiKeyTab.textContent = 'Clé API';
    apiKeyTab.style.cssText = `
      padding: 8px 15px;
      cursor: pointer;
      border-bottom: 2px solid #ff5722;
      font-weight: bold;
      color: #ff5722;
    `;
    
    // Onglet JWT
    const jwtTab = document.createElement('div');
    jwtTab.className = 'auth-tab';
    jwtTab.setAttribute('data-tab', 'jwt');
    jwtTab.textContent = 'JWT Bearer';
    jwtTab.style.cssText = `
      padding: 8px 15px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      color: #6c757d;
    `;
    
    // Ajouter les onglets au conteneur
    authTabs.appendChild(apiKeyTab);
    authTabs.appendChild(jwtTab);
    
    // Créer le contenu des onglets
    const tabContents = document.createElement('div');
    tabContents.className = 'tab-contents';
    
    // Contenu pour l'onglet API Key
    const apiKeyContent = document.createElement('div');
    apiKeyContent.className = 'tab-content apiKey active';
    apiKeyContent.style.display = 'block';
    
    // Formulaire pour API Key
    const apiKeyForm = document.createElement('div');
    apiKeyForm.style.cssText = `
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    `;
    
    // Input pour la clé API
    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'text';
    apiKeyInput.placeholder = 'Entrez votre clé API';
    apiKeyInput.value = 'dev-key'; // Valeur par défaut
    apiKeyInput.style.cssText = `
      flex: 1;
      min-width: 200px;
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
    `;
    
    // Bouton d'application de la clé API
    const apiKeyButton = document.createElement('button');
    apiKeyButton.textContent = 'Appliquer';
    apiKeyButton.style.cssText = `
      background: linear-gradient(to right, #e74c3c, #ff5722);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      min-width: 100px;
    `;
    
    // Note d'aide pour la clé API
    const apiKeyHelp = document.createElement('div');
    apiKeyHelp.innerHTML = '<small>La clé de test <strong>dev-key</strong> est disponible pour tester les API.</small>';
    apiKeyHelp.style.cssText = `
      width: 100%;
      color: #6c757d;
      margin-top: 5px;
      font-size: 12px;
    `;
    
    // Ajouter les éléments au formulaire API Key
    apiKeyForm.appendChild(apiKeyInput);
    apiKeyForm.appendChild(apiKeyButton);
    apiKeyContent.appendChild(apiKeyForm);
    apiKeyContent.appendChild(apiKeyHelp);
    
    // Contenu pour l'onglet JWT
    const jwtContent = document.createElement('div');
    jwtContent.className = 'tab-content jwt';
    jwtContent.style.display = 'none';
    
    // Formulaire pour JWT
    const jwtForm = document.createElement('div');
    jwtForm.style.cssText = `
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    `;
    
    // Input pour le JWT
    const jwtInput = document.createElement('input');
    jwtInput.type = 'text';
    jwtInput.placeholder = 'Entrez votre JWT Bearer Token';
    // Récupérer le token du localStorage s'il existe
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      jwtInput.value = savedToken;
    }
    jwtInput.style.cssText = `
      flex: 1;
      min-width: 200px;
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
    `;
    
    // Bouton d'application du JWT
    const jwtButton = document.createElement('button');
    jwtButton.textContent = 'Appliquer';
    jwtButton.style.cssText = `
      background: linear-gradient(to right, #e74c3c, #ff5722);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      min-width: 100px;
    `;
    
    // Note d'aide pour le JWT
    const jwtHelp = document.createElement('div');
    jwtHelp.innerHTML = '<small>Le token JWT est généré lors de la connexion via /api/login.</small>';
    jwtHelp.style.cssText = `
      width: 100%;
      color: #6c757d;
      margin-top: 5px;
      font-size: 12px;
    `;
    
    // Ajouter les éléments au formulaire JWT
    jwtForm.appendChild(jwtInput);
    jwtForm.appendChild(jwtButton);
    jwtContent.appendChild(jwtForm);
    jwtContent.appendChild(jwtHelp);
    
    // Ajouter les contenus d'onglets
    tabContents.appendChild(apiKeyContent);
    tabContents.appendChild(jwtContent);
    
    // Ajouter tous les éléments au conteneur d'authentification
    authContainer.appendChild(authTitle);
    authContainer.appendChild(authTabs);
    authContainer.appendChild(tabContents);
    
    // Insérer le conteneur d'authentification après le conteneur d'information
    infoContainer.parentNode.insertBefore(authContainer, infoContainer.nextSibling);
    
    // Fonctionnalité pour les onglets
    const tabs = authContainer.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Réinitialiser tous les onglets
        tabs.forEach(t => {
          t.classList.remove('active');
          t.style.borderBottom = '2px solid transparent';
          t.style.color = '#6c757d';
          t.style.fontWeight = 'normal';
        });
        
        // Activer l'onglet cliqué
        tab.classList.add('active');
        tab.style.borderBottom = '2px solid #ff5722';
        tab.style.color = '#ff5722';
        tab.style.fontWeight = 'bold';
        
        // Masquer tous les contenus d'onglets
        const tabContents = authContainer.querySelectorAll('.tab-content');
        tabContents.forEach(tc => {
          tc.style.display = 'none';
        });
        
        // Afficher le contenu correspondant à l'onglet
        const tabContentToShow = authContainer.querySelector('.tab-content.' + tab.getAttribute('data-tab'));
        if (tabContentToShow) {
          tabContentToShow.style.display = 'block';
        }
      });
    });
    
    // Action pour le bouton API Key
    apiKeyButton.addEventListener('click', () => {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) return;
      
      console.log('[Swagger] Application de la clé API: ' + apiKey);
      
      // Appliquer la clé API à toutes les opérations
      applyAuthToOperations('apiKey', apiKey);
      
      // Ajouter un message de confirmation
      showSuccessMessage('Clé API appliquée avec succès !');
    });
    
    // Action pour le bouton JWT
    jwtButton.addEventListener('click', () => {
      const jwt = jwtInput.value.trim();
      if (!jwt) return;
      
      console.log('[Swagger] Application du JWT: ' + jwt);
      
      // Appliquer le JWT à toutes les opérations
      applyAuthToOperations('Bearer', jwt);
      
      // Ajouter un message de confirmation
      showSuccessMessage('Token JWT appliqué avec succès !');
    });
    
    // Fonction pour appliquer l'authentification à toutes les opérations
    function applyAuthToOperations(authType, authValue) {
      // Stocke le token JWT dans le localStorage si c'est un Bearer
      if (authType === 'Bearer') {
        localStorage.setItem('token', authValue);
      }
      
      // Trouver le bouton Authorize original (mais ne pas cliquer dessus pour éviter le modal)
      const authorizeButton = document.querySelector('.swagger-ui .auth-wrapper .authorize');
      if (!authorizeButton) {
        console.error("[Swagger] Bouton d'autorisation non trouvé");
        return;
      }
      
      // Intercepter les requêtes XHR pour ajouter les headers d'authentification
      // Cette méthode est plus fiable que de manipuler l'interface utilisateur de Swagger
      const originalOpen = XMLHttpRequest.prototype.open;
      
      // Remplacer la méthode open pour intercepter toutes les requêtes XHR
      XMLHttpRequest.prototype.open = function() {
        const originalSend = this.send;
        const url = arguments[1]; // URL est le 2ème paramètre de open(method, url, ...)
        
        // Remplacer la méthode send pour ajouter les headers avant l'envoi
        this.send = function() {
          // S'assurer qu'il s'agit d'une requête API (pour éviter d'affecter d'autres XHR)
          if (url && url.indexOf('/api/') !== -1) {
            if (authType === 'apiKey') {
              // Ajouter l'en-tête X-API-KEY
              this.setRequestHeader('X-API-KEY', authValue);
            } else if (authType === 'Bearer') {
              // Ajouter l'en-tête Authorization avec Bearer
              this.setRequestHeader('Authorization', `Bearer ${authValue}`);
            }
          }
          
          // Appeler la méthode send originale
          return originalSend.apply(this, arguments);
        };
        
        // Appeler la méthode open originale
        return originalOpen.apply(this, arguments);
      };
      
      // AJOUTER L'INTERCEPTEUR FETCH
      // Intercepter également les appels fetch pour couvrir tous les cas
      const originalFetch = window.fetch;
      
      window.fetch = function(input, init) {
        // Vérifier si c'est une requête API
        let isApiRequest = false;
        
        // Normaliser l'entrée pour vérifier l'URL
        let url = '';
        if (typeof input === 'string') {
          url = input;
        } else if (input instanceof Request) {
          url = input.url;
        }
        
        // Vérifier si c'est une requête API
        isApiRequest = url.indexOf('/api/') !== -1;
        
        // Si ce n'est pas une requête API, ne pas modifier
        if (!isApiRequest) {
          return originalFetch.call(this, input, init);
        }
        
        // Cloner les init pour éviter de modifier l'objet original
        const modifiedInit = init ? { ...init } : {};
        
        // S'assurer que headers existe
        if (!modifiedInit.headers) {
          modifiedInit.headers = {};
        }
        
        // Si c'est un objet Headers, convertir en objet simple
        if (modifiedInit.headers instanceof Headers) {
          const originalHeaders = modifiedInit.headers;
          modifiedInit.headers = {};
          for (const [key, value] of originalHeaders.entries()) {
            modifiedInit.headers[key] = value;
          }
        }
        
        // Ajouter l'en-tête d'authentification approprié
        if (authType === 'apiKey') {
          modifiedInit.headers['X-API-KEY'] = authValue;
          console.log(`[Swagger] Ajout de l'en-tête X-API-KEY à la requête fetch vers ${url}`);
        } else if (authType === 'Bearer') {
          modifiedInit.headers['Authorization'] = `Bearer ${authValue}`;
          console.log(`[Swagger] Ajout de l'en-tête Authorization à la requête fetch vers ${url}`);
        }
        
        // Si input est un objet Request, créer une nouvelle Request avec les en-têtes modifiés
        if (input instanceof Request) {
          const newRequest = new Request(input, modifiedInit);
          return originalFetch.call(this, newRequest);
        }
        
        // Sinon, appeler fetch original avec l'URL et les en-têtes modifiés
        return originalFetch.call(this, input, modifiedInit);
      };
      
      // Simuler un clic sur le bouton Authorize pour mettre à jour l'interface utilisateur
      try {
        // Indiquer visuellement que la sécurité est activée
        const ui = window.ui;
        if (ui && typeof ui.authActions !== 'undefined' && typeof ui.authActions.authorize === 'function') {
          if (authType === 'apiKey') {
            ui.authActions.authorize({
              ApiKeyAuth: {
                name: 'X-API-KEY',
                value: authValue,
                schema: { type: 'apiKey', in: 'header', name: 'X-API-KEY' }
              }
            });
          } else if (authType === 'Bearer') {
            ui.authActions.authorize({
              BearerAuth: {
                name: 'Authorization',
                value: `Bearer ${authValue}`,
                schema: { type: 'http', scheme: 'bearer' }
              }
            });
          }
        }
        
        console.log('[Swagger] Authentification appliquée avec succès');
      } catch (err) {
        console.error('[Swagger] Erreur lors de l\'authentification UI:', err);
      }
    }
    
    // Fonction pour afficher un message de succès
    function showSuccessMessage(message) {
      const existingMsg = document.querySelector('.auth-success-message');
      if (existingMsg) {
        existingMsg.remove();
      }
      
      const msgElement = document.createElement('div');
      msgElement.className = 'auth-success-message';
      msgElement.textContent = message;
      msgElement.style.cssText = `
        background-color: #d4edda;
        color: #155724;
        padding: 10px 15px;
        border-radius: 4px;
        margin-top: 10px;
      `;
      
      // Suppression de l'animation de disparition qui causait des clignotements
      
      // Ajouter le message au conteneur
      authContainer.appendChild(msgElement);
      
      // Supprimer le message après l'animation
      setTimeout(() => {
        msgElement.remove();
      }, 4000);
    }
    
    // Appliquer automatiquement l'authentification par défaut
    setTimeout(() => {
      // Appliquer la clé API par défaut
      if (apiKeyInput.value) {
        apiKeyButton.click();
      }
      
      // Si un JWT est présent, basculer vers cet onglet et l'appliquer
      if (jwtInput.value) {
        jwtTab.click();
        setTimeout(() => {
          jwtButton.click();
        }, 300);
      }
    }, 1000);
    
    // Cacher complètement le bouton d'authentification original après un certain temps
    setTimeout(() => {
      const authButtons = document.querySelectorAll('.swagger-ui .auth-wrapper');
      authButtons.forEach(btn => {
        btn.style.display = 'none';
      });
    }, 2000);
    
    console.log('[Swagger] Authentification directe configurée avec succès');
  }
  
  // Démarrer l'initialisation
  waitForSwaggerUI();
})();