/**
 * Script pour le chatbot contextuel de la documentation
 * Ce chatbot utilise la même API que le chatbot principal mais avec
 * un contexte spécifique à la documentation technique.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const chatbotContainer = document.getElementById('doc-chatbot-container');
    const chatbotToggle = document.getElementById('doc-chatbot-toggle');
    const chatbotMessages = document.getElementById('doc-chatbot-messages');
    const chatbotInput = document.getElementById('doc-chatbot-input-text');
    const chatbotSend = document.getElementById('doc-chatbot-send');
    
    // Variables d'état
    let isTyping = false;
    
    // Historique des messages pour le contexte
    const messageHistory = [];
    
    // Section courante de la documentation (pour le contexte)
    let currentSection = '';
    
    // Observer pour détecter le changement de section
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // Quand une section devient visible
            if (entry.isIntersecting && entry.target.id) {
                currentSection = entry.target.id;
                console.log('Section active:', currentSection);
            }
        });
    }, { threshold: 0.5 });
    
    // Observer toutes les sections de documentation
    document.querySelectorAll('.documentation-section').forEach(section => {
        observer.observe(section);
    });
    
    // Ouvrir/fermer le chatbot
    chatbotToggle.addEventListener('click', () => {
        chatbotContainer.classList.toggle('open');
        
        // Scroll au bas des messages quand on ouvre
        if (chatbotContainer.classList.contains('open')) {
            scrollToBottom();
        }
    });
    
    // Envoyer un message quand on clique sur le bouton
    chatbotSend.addEventListener('click', sendMessage);
    
    // Envoyer un message avec la touche Entrée (mais pas Shift+Entrée)
    chatbotInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    
    // Fonction pour envoyer un message
    function sendMessage() {
        const message = chatbotInput.value.trim();
        
        // Ignorer les messages vides
        if (message === '' || isTyping) return;
        
        // Ajouter le message de l'utilisateur à l'interface
        addMessageToChat('user', message);
        
        // Ajouter le contexte de la section active si pertinent
        const contextualMessage = addSectionContext(message);
        
        // Vider l'input
        chatbotInput.value = '';
        
        // Ajouter l'indicateur de frappe
        addTypingIndicator();
        
        // Envoyer la requête à l'API
        fetchAIResponse(contextualMessage);
    }
    
    // Fonction pour ajouter le contexte de la section active au message
    function addSectionContext(message) {
        // Si on est sur une section spécifique
        if (currentSection) {
            const sectionTitle = document.querySelector(`#${currentSection} h2`)?.textContent || '';
            
            // Ajouter le contexte au début du message
            return `[Contexte: Section "${sectionTitle}"] ${message}`;
        }
        
        return message;
    }
    
    // Fonction pour ajouter un message au chat
    function addMessageToChat(role, content) {
        // Créer les éléments du message
        const messageDiv = document.createElement('div');
        messageDiv.className = `doc-chatbot-message ${role}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'doc-chatbot-avatar';
        
        const avatarIcon = document.createElement('i');
        avatarIcon.className = role === 'user' ? 'fas fa-user' : 'fas fa-robot';
        avatarDiv.appendChild(avatarIcon);
        
        const textDiv = document.createElement('div');
        textDiv.className = 'doc-chatbot-text';
        textDiv.textContent = content;
        
        // Assembler le message
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(textDiv);
        
        // Ajouter au conteneur de messages
        chatbotMessages.appendChild(messageDiv);
        
        // Scroll au bas de la conversation
        scrollToBottom();
        
        // Ajouter à l'historique pour le contexte
        messageHistory.push({ role, content });
        
        // Limiter l'historique à 10 messages pour éviter une surcharge de contexte
        if (messageHistory.length > 10) {
            messageHistory.shift();
        }
    }
    
    // Fonction pour ajouter l'indicateur de "en train d'écrire"
    function addTypingIndicator() {
        isTyping = true;
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'doc-chatbot-message assistant';
        typingDiv.id = 'typing-indicator';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'doc-chatbot-avatar';
        
        const avatarIcon = document.createElement('i');
        avatarIcon.className = 'fas fa-robot';
        avatarDiv.appendChild(avatarIcon);
        
        const typingContent = document.createElement('div');
        typingContent.className = 'doc-chatbot-typing';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            typingContent.appendChild(dot);
        }
        
        typingDiv.appendChild(avatarDiv);
        typingDiv.appendChild(typingContent);
        
        chatbotMessages.appendChild(typingDiv);
        scrollToBottom();
    }
    
    // Fonction pour supprimer l'indicateur de frappe
    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
        isTyping = false;
    }
    
    // Fonction pour faire défiler vers le bas
    function scrollToBottom() {
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }
    
    // Fonction pour formater l'historique des messages pour l'API
    function formatMessagesForAPI() {
        const formattedMessages = [];
        
        // Message système pour donner le contexte de la documentation
        formattedMessages.push({
            role: 'system',
            content: `Tu es un assistant spécialisé dans la documentation technique de FHIRHub. 
Ta mission est d'aider les utilisateurs à comprendre cette documentation. 
Utilise un ton professionnel adapté au domaine médical.
Si la question de l'utilisateur contient un contexte de section, concentre-toi sur cette section spécifique.`
        });
        
        // Ajouter l'historique des messages
        messageHistory.forEach(msg => {
            formattedMessages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });
        
        return formattedMessages;
    }
    
    // Fonction pour interroger l'API du chatbot
    async function fetchAIResponse(userMessage) {
        try {
            // Ajouter le dernier message à l'historique
            messageHistory.push({ role: 'user', content: userMessage });
            
            // Préparer les données
            const data = {
                messages: formatMessagesForAPI(),
                max_tokens: 800
            };
            
            // Faire la requête à l'API
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            // Retirer l'indicateur de frappe
            removeTypingIndicator();
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.response) {
                // Ajouter la réponse au chat
                addMessageToChat('assistant', result.response);
                
                // Ajouter à l'historique
                messageHistory.push({ role: 'assistant', content: result.response });
                
                // Limiter l'historique
                if (messageHistory.length > 10) {
                    messageHistory.shift();
                }
            } else {
                throw new Error(result.message || 'Erreur inconnue');
            }
            
        } catch (error) {
            console.error('Erreur lors de l\'appel à l\'API:', error);
            
            // Retirer l'indicateur de frappe
            removeTypingIndicator();
            
            // Afficher un message d'erreur
            addMessageToChat('assistant', 'Désolé, je rencontre un problème technique. Veuillez réessayer plus tard.');
        }
    }
});