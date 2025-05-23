/**
 * Module de chatbot patient pour FHIRHub
 * Permet aux professionnels de santé de poser des questions sur les données du patient chargé
 */

class PatientChatbot {
    constructor() {
        this.patientData = null;
        this.isEnabled = false;
        this.isProcessing = false;
        this.conversationHistory = [];
        
        this.init();
    }

    init() {
        console.log('Initialisation du chatbot patient...');
        
        // Éléments DOM
        this.chatInput = document.getElementById('chatbotInput');
        this.sendButton = document.getElementById('chatbotSendBtn');
        this.messagesContainer = document.getElementById('chatbotMessages');
        this.statusElement = document.getElementById('chatbotStatus');
        
        if (this.chatInput && this.sendButton) {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        // Gestion de l'envoi des messages
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-focus et effets visuels
        this.chatInput.addEventListener('focus', () => {
            this.chatInput.style.borderColor = '#e83e28';
        });

        this.chatInput.addEventListener('blur', () => {
            this.chatInput.style.borderColor = '#e9ecef';
        });

        this.sendButton.addEventListener('mousedown', () => {
            this.sendButton.style.transform = 'scale(0.95)';
        });

        this.sendButton.addEventListener('mouseup', () => {
            this.sendButton.style.transform = 'scale(1)';
        });
    }

    // Méthode appelée quand un patient est chargé
    setPatientData(patientData) {
        console.log('Données patient mises à jour pour le chatbot:', patientData);
        this.patientData = patientData;
        this.enableChatbot();
        this.resetConversation();
    }

    enableChatbot() {
        this.isEnabled = true;
        this.chatInput.disabled = false;
        this.sendButton.disabled = false;
        
        this.chatInput.placeholder = "Posez une question sur ce patient...";
        this.statusElement.textContent = "Chatbot activé - Posez vos questions sur ce patient";
        this.statusElement.style.color = "#28a745";
        
        // Ajouter un message de bienvenue personnalisé
        this.addWelcomeMessage();
    }

    disableChatbot() {
        this.isEnabled = false;
        this.chatInput.disabled = true;
        this.sendButton.disabled = true;
        this.chatInput.placeholder = "Veuillez charger un patient...";
        this.statusElement.textContent = "Veuillez charger un patient pour commencer la conversation";
        this.statusElement.style.color = "#666";
    }

    addWelcomeMessage() {
        if (!this.patientData) return;

        const patientName = this.getPatientName();
        const welcomeText = `Patient ${patientName} chargé avec succès ! Je peux maintenant répondre à vos questions sur ce dossier médical. Que souhaitez-vous savoir ?`;
        
        this.addMessage('bot', welcomeText, 'welcome');
    }

    getPatientName() {
        if (!this.patientData) return 'Inconnu';
        
        try {
            if (this.patientData.name && this.patientData.name[0]) {
                const name = this.patientData.name[0];
                const family = name.family || '';
                const given = name.given ? name.given.join(' ') : '';
                return `${given} ${family}`.trim() || 'Patient';
            }
            return 'Patient';
        } catch (error) {
            console.error('Erreur lors de l\'extraction du nom du patient:', error);
            return 'Patient';
        }
    }

    async sendMessage() {
        if (!this.isEnabled || this.isProcessing || !this.chatInput.value.trim()) {
            return;
        }

        const userMessage = this.chatInput.value.trim();
        this.chatInput.value = '';

        // Ajouter le message de l'utilisateur
        this.addMessage('user', userMessage);
        
        // Ajouter le message "en cours de traitement"
        const processingMessageId = this.addMessage('bot', '', 'processing');
        
        this.isProcessing = true;
        this.updateSendButton(true);

        try {
            // Préparer le contexte du patient pour l'IA
            const patientContext = this.preparePatientContext();
            
            // Envoyer la question à l'IA
            const response = await this.queryAI(userMessage, patientContext);
            
            // Supprimer le message de traitement et ajouter la réponse
            this.removeMessage(processingMessageId);
            this.addMessage('bot', response);
            
            // Ajouter à l'historique de conversation
            this.conversationHistory.push({
                user: userMessage,
                bot: response,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Erreur lors de l\'envoi du message:', error);
            
            // Supprimer le message de traitement et ajouter une erreur
            this.removeMessage(processingMessageId);
            this.addMessage('bot', 'Désolé, je rencontre un problème technique. Veuillez réessayer dans quelques instants.', 'error');
        } finally {
            this.isProcessing = false;
            this.updateSendButton(false);
        }
    }

    preparePatientContext() {
        if (!this.patientData) return '';

        try {
            // Créer un résumé structuré des données patient pour l'IA
            const context = {
                patient: {
                    nom: this.getPatientName(),
                    id: this.patientData.id,
                    genre: this.patientData.gender,
                    dateNaissance: this.patientData.birthDate,
                    adresse: this.patientData.address,
                    telecom: this.patientData.telecom
                },
                // Données cliniques qui seront ajoutées dynamiquement selon ce qui est disponible
                conditions: [],
                medications: [],
                observations: [],
                encounters: []
            };

            // Ajouter d'autres ressources si disponibles dans le contexte global
            if (window.loadedPatientResources) {
                context.conditions = window.loadedPatientResources.conditions || [];
                context.medications = window.loadedPatientResources.medications || [];
                context.observations = window.loadedPatientResources.observations || [];
                context.encounters = window.loadedPatientResources.encounters || [];
            }

            return JSON.stringify(context, null, 2);
        } catch (error) {
            console.error('Erreur lors de la préparation du contexte patient:', error);
            return JSON.stringify(this.patientData, null, 2);
        }
    }

    async queryAI(question, patientContext) {
        const prompt = `Tu es un assistant médical IA spécialisé dans l'analyse des données patients FHIR. 
        
Voici les données du patient actuel :
${patientContext}

Question du professionnel de santé : ${question}

Instructions :
- Réponds uniquement en te basant sur les données fournies
- Si l'information n'est pas disponible, dis-le clairement
- Utilise un langage médical approprié mais accessible
- Sois précis et factuel
- Ne donne pas de conseils médicaux ou de diagnostic
- Concentre-toi sur l'analyse des données présentes

Réponse :`;

        const response = await fetch('/api/ai-providers/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: prompt,
                context: 'patient_analysis'
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }

        const data = await response.json();
        return data.response || 'Aucune réponse disponible.';
    }

    addMessage(sender, message, type = 'normal') {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = 'chat-message';
        
        let messageClass = sender === 'user' ? 'user-message' : 'bot-message';
        if (type === 'processing') messageClass += ' processing-message';
        if (type === 'error') messageClass += ' error-message';
        if (type === 'welcome') messageClass += ' welcome-message';

        messageDiv.innerHTML = `
            <div class="${messageClass}" style="
                margin-bottom: 15px;
                padding: 12px 15px;
                border-radius: 15px;
                max-width: 85%;
                word-wrap: break-word;
                line-height: 1.4;
                ${sender === 'user' ? 
                    'background: linear-gradient(135deg, #e83e28, #fd7e30); color: white; margin-left: auto; text-align: right;' : 
                    type === 'error' ? 
                        'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' :
                        type === 'welcome' ?
                            'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' :
                            'background: #f8f9fa; color: #495057; border: 1px solid #dee2e6;'
                }
            ">
                ${type === 'processing' ? 
                    '<div style="display: flex; align-items: center; gap: 10px;"><div class="typing-indicator"><span></span><span></span><span></span></div>Analyse en cours...</div>' : 
                    message
                }
            </div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageId;
    }

    removeMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.remove();
        }
    }

    updateSendButton(isProcessing) {
        if (isProcessing) {
            this.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            this.sendButton.disabled = true;
            this.statusElement.textContent = "Analyse en cours...";
            this.statusElement.style.color = "#fd7e30";
        } else {
            this.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
            this.sendButton.disabled = !this.isEnabled;
            this.statusElement.textContent = this.isEnabled ? "Chatbot activé - Posez vos questions sur ce patient" : "Veuillez charger un patient pour commencer la conversation";
            this.statusElement.style.color = this.isEnabled ? "#28a745" : "#666";
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    resetConversation() {
        // Garder seulement le message de bienvenue initial
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        this.messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            this.messagesContainer.appendChild(welcomeMessage.parentElement);
        }
        this.conversationHistory = [];
    }

    // Méthode pour nettoyer le chatbot quand le patient est déchargé
    clearPatient() {
        this.patientData = null;
        this.disableChatbot();
        this.resetConversation();
    }
}

// Styles CSS pour les animations
const chatbotStyles = `
<style>
.typing-indicator {
    display: inline-block;
}

.typing-indicator span {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #fd7e30;
    animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) {
    animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
    animation-delay: -0.16s;
}

@keyframes typing {
    0%, 80%, 100% {
        transform: scale(0);
        opacity: 0.5;
    }
    40% {
        transform: scale(1);
        opacity: 1;
    }
}

.chat-message {
    animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

#chatbotInput:focus {
    box-shadow: 0 0 0 3px rgba(232, 62, 40, 0.2);
}

#chatbotSendBtn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(232, 62, 40, 0.3);
}

#chatbotSendBtn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
`;

// Injecter les styles
if (!document.getElementById('chatbot-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'chatbot-styles';
    styleElement.innerHTML = chatbotStyles;
    document.head.appendChild(styleElement);
}

// Initialiser le chatbot patient
let patientChatbot;

document.addEventListener('DOMContentLoaded', function() {
    // Attendre que tous les autres scripts soient chargés
    setTimeout(() => {
        patientChatbot = new PatientChatbot();
        
        // Rendre le chatbot accessible globalement
        window.patientChatbot = patientChatbot;
        
        console.log('✅ Chatbot patient initialisé avec succès');
    }, 500);
});

// Export pour pouvoir utiliser dans d'autres scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatientChatbot;
}