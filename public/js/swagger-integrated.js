/**
 * Scripts pour l'intégration Swagger FHIRHub
 * Gère l'authentification, la navigation et les interactions personnalisées
 */

class FHIRHubSwaggerIntegration {
    constructor() {
        this.apiKey = localStorage.getItem('fhirhub_api_key');
        this.baseUrl = window.location.origin;
        this.swaggerUI = null;
        
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.loadSidebar();
            this.initializeSwagger();
            this.setupEventListeners();
        });
    }

    /**
     * Charge le sidebar FHIRHub
     */
    async loadSidebar() {
        try {
            const response = await fetch('/includes/sidebar.html');
            const html = await response.text();
            
            const sidebarContainer = document.getElementById('sidebar-container');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = html;
                
                // Marquer la page API comme active
                const apiLink = document.querySelector('[data-page="api-docs"]');
                if (apiLink) {
                    apiLink.classList.add('active');
                }
                
                // Initialiser les scripts du sidebar
                if (window.initializeSidebar) {
                    window.initializeSidebar();
                }
            }
        } catch (error) {
            console.warn('Impossible de charger le sidebar:', error);
            this.hideQuickNav();
        }
    }

    /**
     * Initialise Swagger UI avec la configuration FHIRHub
     */
    initializeSwagger() {
        this.swaggerUI = SwaggerUIBundle({
            url: '/api-docs/json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            validatorUrl: null,
            requestInterceptor: this.requestInterceptor.bind(this),
            responseInterceptor: this.responseInterceptor.bind(this),
            onComplete: () => {
                this.onSwaggerComplete();
            }
        });
    }

    /**
     * Intercepteur de requête pour ajouter l'authentification
     */
    requestInterceptor(request) {
        if (this.apiKey && !request.headers['x-api-key']) {
            request.headers['x-api-key'] = this.apiKey;
        }
        
        // Ajouter des headers supplémentaires
        request.headers['Accept'] = 'application/json';
        request.headers['Content-Type'] = 'application/json';
        
        return request;
    }

    /**
     * Intercepteur de réponse pour gérer les erreurs
     */
    responseInterceptor(response) {
        if (response.status === 401) {
            this.showNotification('Authentification requise', 'warning');
            this.clearAuthentication();
        } else if (response.status >= 400) {
            this.showNotification(`Erreur API: ${response.status}`, 'error');
        }
        
        return response;
    }

    /**
     * Callback après le chargement complet de Swagger
     */
    onSwaggerComplete() {
        setTimeout(() => {
            this.generateQuickNav();
            this.customizeUI();
            this.updateAuthStatus();
            this.loadMetadata();
        }, 500);
    }

    /**
     * Génère la navigation rapide des sections
     */
    generateQuickNav() {
        const navContainer = document.getElementById('nav-links');
        const tags = document.querySelectorAll('.swagger-ui .opblock-tag');
        
        if (!navContainer || tags.length === 0) return;
        
        navContainer.innerHTML = '';
        
        tags.forEach((tag) => {
            const tagName = tag.textContent.trim();
            const tagId = tagName.replace(/\s+/g, '_').toLowerCase();
            
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `#${tagId}`;
            a.textContent = tagName;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this.scrollToTag(tag);
            });
            
            li.appendChild(a);
            navContainer.appendChild(li);
        });
    }

    /**
     * Scroll vers une section spécifique
     */
    scrollToTag(element) {
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }

    /**
     * Personnalise l'interface Swagger
     */
    customizeUI() {
        // Masquer le topbar Swagger
        const topbar = document.querySelector('.swagger-ui .topbar');
        if (topbar) {
            topbar.style.display = 'none';
        }

        // Masquer le titre par défaut (on a le nôtre)
        const title = document.querySelector('.swagger-ui .info .title');
        if (title) {
            title.style.display = 'none';
        }

        // Ajouter des classes personnalisées
        const swaggerContainer = document.querySelector('.swagger-ui');
        if (swaggerContainer) {
            swaggerContainer.classList.add('fhirhub-integrated');
        }

        // Personnaliser les boutons d'autorisation
        this.customizeAuthButtons();
    }

    /**
     * Personnalise les boutons d'autorisation
     */
    customizeAuthButtons() {
        const authorizeButtons = document.querySelectorAll('.swagger-ui .auth-wrapper .authorize, .swagger-ui .btn.authorize');
        
        authorizeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                setTimeout(() => this.enhanceAuthModal(), 100);
            });
        });
    }

    /**
     * Améliore la modal d'authentification
     */
    enhanceAuthModal() {
        const modal = document.querySelector('.swagger-ui .auth-container');
        if (modal) {
            // Ajouter des instructions personnalisées
            const existingInstructions = modal.querySelector('.fhirhub-auth-help');
            if (!existingInstructions) {
                const helpDiv = document.createElement('div');
                helpDiv.className = 'fhirhub-auth-help';
                helpDiv.innerHTML = `
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                        <h4 style="margin: 0 0 8px 0; color: #1976d2;">🔑 Authentification FHIRHub</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            Entrez votre clé API FHIRHub pour tester les endpoints protégés.<br>
                            <strong>Format:</strong> Chaîne alphanumériquedeOsj8-128 caractères
                        </p>
                    </div>
                `;
                
                const authWrapper = modal.querySelector('.auth-wrapper');
                if (authWrapper) {
                    authWrapper.insertBefore(helpDiv, authWrapper.firstChild);
                }
            }
        }
    }

    /**
     * Configure les événements de l'interface
     */
    setupEventListeners() {
        // Bouton d'authentification principal
        const authBtn = document.getElementById('auth-btn');
        if (authBtn) {
            authBtn.addEventListener('click', () => this.handleAuthentication());
        }

        // Gestion du toggle de la navigation rapide
        const quickNav = document.getElementById('quick-nav');
        if (quickNav) {
            let isVisible = true;
            
            // Créer un bouton toggle
            const toggleBtn = document.createElement('button');
            toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
            toggleBtn.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                font-size: 0.8rem;
            `;
            
            toggleBtn.addEventListener('click', () => {
                isVisible = !isVisible;
                quickNav.style.transform = isVisible ? 'translateY(-50%)' : 'translateY(-50%) translateX(220px)';
                toggleBtn.innerHTML = isVisible ? '<i class="fas fa-times"></i>' : '<i class="fas fa-list"></i>';
            });
            
            quickNav.appendChild(toggleBtn);
        }

        // Auto-scroll pour les liens d'ancrage
        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });
    }

    /**
     * Gère l'authentification
     */
    handleAuthentication() {
        if (this.apiKey) {
            // Déjà authentifié, proposer de se déconnecter
            if (confirm('Voulez-vous vous déconnecter ?')) {
                this.clearAuthentication();
            }
        } else {
            // Demander la clé API
            this.showAuthDialog();
        }
    }

    /**
     * Affiche la dialog d'authentification
     */
    showAuthDialog() {
        const apiKey = prompt('Entrez votre clé API FHIRHub:');
        
        if (apiKey && apiKey.trim()) {
            this.setAuthentication(apiKey.trim());
        }
    }

    /**
     * Configure l'authentification
     */
    setAuthentication(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('fhirhub_api_key', apiKey);
        
        this.updateAuthStatus();
        this.showNotification('Authentification réussie', 'success');
        
        // Mettre à jour Swagger UI si possible
        if (this.swaggerUI) {
            this.swaggerUI.preauthorizeApiKey('ApiKeyAuth', apiKey);
        }
    }

    /**
     * Efface l'authentification
     */
    clearAuthentication() {
        this.apiKey = null;
        localStorage.removeItem('fhirhub_api_key');
        
        this.updateAuthStatus();
        this.showNotification('Déconnexion réussie', 'info');
    }

    /**
     * Met à jour le statut d'authentification dans l'UI
     */
    updateAuthStatus() {
        const authBtn = document.getElementById('auth-btn');
        if (!authBtn) return;
        
        if (this.apiKey) {
            authBtn.innerHTML = '<i class="fas fa-check"></i> Authentifié';
            authBtn.style.background = 'linear-gradient(135deg, #4CAF50, #66BB6A)';
            authBtn.style.borderColor = '#4CAF50';
        } else {
            authBtn.innerHTML = '<i class="fas fa-key"></i> Authentification';
            authBtn.style.background = 'linear-gradient(135deg, #e74c3c, #f39c12)';
            authBtn.style.borderColor = 'transparent';
        }
    }

    /**
     * Charge les métadonnées de l'API
     */
    async loadMetadata() {
        try {
            const response = await fetch('/api-docs/validate');
            const data = await response.json();
            
            if (data.success) {
                const endpointCount = document.getElementById('endpoint-count');
                if (endpointCount) {
                    endpointCount.textContent = `${data.data.endpoints} endpoints`;
                }
                
                const envIndicator = document.getElementById('api-env');
                if (envIndicator) {
                    const env = window.location.hostname === 'localhost' ? 'Développement' : 'Production';
                    envIndicator.textContent = env;
                }
            }
        } catch (error) {
            console.warn('Impossible de charger les métadonnées:', error);
        }
    }

    /**
     * Gère les changements d'ancrage URL
     */
    handleHashChange() {
        const hash = window.location.hash;
        if (hash) {
            const targetElement = document.querySelector(hash);
            if (targetElement) {
                setTimeout(() => {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }
    }

    /**
     * Masque la navigation rapide
     */
    hideQuickNav() {
        const quickNav = document.getElementById('quick-nav');
        if (quickNav) {
            quickNav.style.display = 'none';
        }
    }

    /**
     * Affiche une notification
     */
    showNotification(message, type = 'info') {
        // Supprimer les notifications existantes
        const existing = document.querySelectorAll('.fhirhub-notification');
        existing.forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = 'fhirhub-notification';
        
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 0.9rem;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;
        
        // Ajouter l'animation CSS
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialiser l'intégration
const fhirHubSwagger = new FHIRHubSwaggerIntegration();