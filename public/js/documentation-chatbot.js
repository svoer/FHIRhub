/**
 * Chatbot intelligent pour la documentation technique
 * Utilise Mistral AI pour répondre aux questions sur FHIRHub
 */

class DocumentationChatbot {
    constructor() {
        this.conversationHistory = [];
        this.isLoading = false;
        this.init();
    }

    init() {
        this.createChatbotUI();
        this.loadSuggestions();
        this.setupEventListeners();
    }

    createChatbotUI() {
        // Créer le conteneur principal du chatbot
        const chatbotContainer = document.createElement('div');
        chatbotContainer.id = 'documentation-chatbot';
        chatbotContainer.className = 'doc-chatbot-container';
        
        chatbotContainer.innerHTML = `
            <div class="doc-chatbot-header">
                <div class="doc-chatbot-title">
                    <i class="fas fa-robot"></i>
                    Assistant Documentation FHIRHub
                    <span class="doc-chatbot-ai-badge">Mistral AI</span>
                </div>
                <div class="doc-chatbot-controls">
                    <button id="doc-chatbot-minimize" class="doc-chatbot-btn-icon" title="Réduire">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button id="doc-chatbot-close" class="doc-chatbot-btn-icon" title="Fermer">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="doc-chatbot-body">
                <div class="doc-chatbot-welcome">
                    <div class="doc-chatbot-welcome-text">
                        <h4>👋 Bonjour !</h4>
                        <p>Je suis votre assistant pour la documentation FHIRHub. Posez-moi vos questions techniques !</p>
                    </div>
                </div>
                
                <div class="doc-chatbot-suggestions" id="doc-chatbot-suggestions">
                    <div class="doc-chatbot-suggestions-title">Questions suggérées :</div>
                    <div class="doc-chatbot-suggestions-list" id="doc-suggestions-list">
                        <!-- Les suggestions seront chargées ici -->
                    </div>
                </div>
                
                <div class="doc-chatbot-messages" id="doc-chatbot-messages">
                    <!-- Les messages de conversation apparaîtront ici -->
                </div>
            </div>
            
            <div class="doc-chatbot-footer">
                <div class="doc-chatbot-input-container">
                    <textarea 
                        id="doc-chatbot-input" 
                        placeholder="Posez votre question sur FHIRHub..."
                        rows="2"
                        maxlength="500"
                    ></textarea>
                    <button id="doc-chatbot-send" class="doc-chatbot-send-btn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="doc-chatbot-status" id="doc-chatbot-status">
                    Prêt à répondre à vos questions
                </div>
            </div>
        `;

        // Ajouter le chatbot à la page
        document.body.appendChild(chatbotContainer);

        // Créer le bouton d'ouverture du chatbot
        const openButton = document.createElement('div');
        openButton.id = 'doc-chatbot-open-btn';
        openButton.className = 'doc-chatbot-open-btn';
        openButton.innerHTML = `
            <i class="fas fa-question-circle"></i>
            <span>Assistant Doc</span>
        `;
        document.body.appendChild(openButton);
    }

    setupEventListeners() {
        // Bouton d'ouverture
        document.getElementById('doc-chatbot-open-btn').addEventListener('click', () => {
            this.show();
        });

        // Boutons de contrôle
        document.getElementById('doc-chatbot-minimize').addEventListener('click', () => {
            this.minimize();
        });

        document.getElementById('doc-chatbot-close').addEventListener('click', () => {
            this.hide();
        });

        // Envoi de message
        document.getElementById('doc-chatbot-send').addEventListener('click', () => {
            this.sendMessage();
        });

        // Envoi avec Enter (Ctrl+Enter pour nouvelle ligne)
        document.getElementById('doc-chatbot-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        document.getElementById('doc-chatbot-input').addEventListener('input', (e) => {
            this.autoResizeTextarea(e.target);
        });
    }

    async loadSuggestions() {
        try {
            const response = await fetch('/api/documentation-chatbot/suggestions');
            const data = await response.json();

            if (data.success) {
                this.displaySuggestions(data.suggestions);
            }
        } catch (error) {
            console.error('Erreur lors du chargement des suggestions:', error);
        }
    }

    displaySuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('doc-suggestions-list');
        suggestionsContainer.innerHTML = '';

        suggestions.slice(0, 5).forEach(suggestion => {
            const suggestionBtn = document.createElement('button');
            suggestionBtn.className = 'doc-chatbot-suggestion-btn';
            suggestionBtn.textContent = suggestion;
            suggestionBtn.addEventListener('click', () => {
                document.getElementById('doc-chatbot-input').value = suggestion;
                this.sendMessage();
            });
            suggestionsContainer.appendChild(suggestionBtn);
        });
    }

    async sendMessage() {
        const input = document.getElementById('doc-chatbot-input');
        const question = input.value.trim();

        if (!question || this.isLoading) return;

        // Masquer les suggestions après la première question
        document.getElementById('doc-chatbot-suggestions').style.display = 'none';

        // Ajouter la question de l'utilisateur
        this.addMessage('user', question);
        input.value = '';
        this.autoResizeTextarea(input);

        // Ajouter un indicateur de chargement
        const loadingId = this.addMessage('assistant', '💭 Réflexion en cours...', true);

        this.isLoading = true;
        this.updateStatus('Traitement de votre question...');

        try {
            const response = await fetch('/api/documentation-chatbot/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: question,
                    conversation_history: this.conversationHistory
                })
            });

            const data = await response.json();

            // Supprimer l'indicateur de chargement
            this.removeMessage(loadingId);

            if (data.success) {
                // Ajouter la réponse
                this.addMessage('assistant', data.answer);
                
                // Mettre à jour l'historique
                this.conversationHistory.push(
                    { role: 'user', content: question },
                    { role: 'assistant', content: data.answer }
                );

                // Garder seulement les 10 derniers échanges
                if (this.conversationHistory.length > 20) {
                    this.conversationHistory = this.conversationHistory.slice(-20);
                }

                this.updateStatus('Prêt pour votre prochaine question');
            } else {
                this.addMessage('assistant', `❌ Désolé, une erreur s'est produite : ${data.error}`);
                this.updateStatus('Erreur - Réessayez');
            }

        } catch (error) {
            console.error('Erreur lors de l\'envoi du message:', error);
            this.removeMessage(loadingId);
            this.addMessage('assistant', '❌ Erreur de connexion. Veuillez réessayer.');
            this.updateStatus('Erreur de connexion');
        }

        this.isLoading = false;
    }

    addMessage(sender, content, isLoading = false) {
        const messagesContainer = document.getElementById('doc-chatbot-messages');
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `doc-chatbot-message doc-chatbot-message-${sender}`;

        if (isLoading) {
            messageDiv.classList.add('doc-chatbot-message-loading');
        }

        const avatar = sender === 'user' ? '👤' : '🤖';
        const formattedContent = this.formatMessage(content);

        messageDiv.innerHTML = `
            <div class="doc-chatbot-message-avatar">${avatar}</div>
            <div class="doc-chatbot-message-content">
                ${formattedContent}
                <div class="doc-chatbot-message-time">
                    ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        return messageId;
    }

    removeMessage(messageId) {
        const message = document.getElementById(messageId);
        if (message) {
            message.remove();
        }
    }

    formatMessage(content) {
        // Formatage simple pour améliorer la lisibilité
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>')
            .replace(/^- (.*)/gm, '• $1');
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('doc-chatbot-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    updateStatus(message) {
        document.getElementById('doc-chatbot-status').textContent = message;
    }

    show() {
        document.getElementById('documentation-chatbot').classList.add('doc-chatbot-visible');
        document.getElementById('doc-chatbot-open-btn').style.display = 'none';
        document.getElementById('doc-chatbot-input').focus();
    }

    hide() {
        document.getElementById('documentation-chatbot').classList.remove('doc-chatbot-visible');
        document.getElementById('doc-chatbot-open-btn').style.display = 'flex';
    }

    minimize() {
        const container = document.getElementById('documentation-chatbot');
        container.classList.toggle('doc-chatbot-minimized');
    }
}

// Initialiser le chatbot quand la page de documentation est chargée
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si on est sur la page de documentation
    if (window.location.pathname.includes('documentation.html')) {
        console.log('💬 Initialisation du chatbot de documentation...');
        
        // Attendre un peu pour laisser le temps à la page de se charger
        setTimeout(() => {
            new DocumentationChatbot();
            console.log('✅ Chatbot de documentation initialisé');
        }, 1000);
    }
});