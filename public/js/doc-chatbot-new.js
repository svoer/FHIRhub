/**
 * Script simplifié pour le chatbot contextuel de la documentation
 * Ce chatbot utilise la même API que le chatbot principal mais avec
 * un contexte spécifique à la documentation technique.
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log("🤖 Initialisation du chatbot de documentation (v2)...");
    
    // Récupération des éléments du DOM
    const chatbotContainer = document.getElementById('doc-chatbot-container');
    if (!chatbotContainer) {
        console.log("Container du chatbot non trouvé sur cette page");
        return;
    }
    
    const chatbotHeader = document.querySelector('.doc-chatbot-header');
    const chatbotMessages = document.getElementById('doc-chatbot-messages');
    const chatbotInput = document.getElementById('doc-chatbot-input-text');
    const chatbotSend = document.getElementById('doc-chatbot-send');
    
    console.log("Container du chatbot trouvé ✅");
    
    // Variables d'état
    let isTyping = false;
    const messageHistory = [];
    let currentSection = '';
    
    // Fonction pour basculer l'ouverture/fermeture du chatbot
    function toggleChatbot() {
        chatbotContainer.classList.toggle('open');
        if (chatbotContainer.classList.contains('open') && chatbotInput) {
            chatbotInput.focus();
            scrollToBottom();
        }
    }
    
    // Événement de clic sur le header entier
    if (chatbotHeader) {
        chatbotHeader.addEventListener('click', function(e) {
            toggleChatbot();
            e.stopPropagation();
        });
    }
    
    // Fonctionnalités d'envoi de message
    if (chatbotSend && chatbotInput) {
        // Envoyer le message avec le bouton
        chatbotSend.addEventListener('click', function() {
            sendMessage();
        });
        
        // Envoyer avec la touche Entrée
        chatbotInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Fonction pour envoyer un message
    function sendMessage() {
        const message = chatbotInput.value.trim();
        if (message === '') return;
        
        // Ajouter le message utilisateur à l'interface
        addMessageToChat('user', message);
        
        // Vider l'input
        chatbotInput.value = '';
        
        // Afficher l'indicateur "en train d'écrire"
        addTypingIndicator();
        
        // Ajouter le contexte de la section actuelle si disponible
        const enrichedMessage = addSectionContext(message);
        
        // Envoyer au serveur et récupérer la réponse
        fetchAIResponse(enrichedMessage).catch(error => {
            console.error('Erreur lors de la récupération de la réponse:', error);
            removeTypingIndicator();
            addMessageToChat('assistant', "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.");
        });
    }
    
    // Ajouter un message au chat
    function addMessageToChat(role, content) {
        if (!chatbotMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.classList.add('doc-chatbot-message', role);
        
        const avatarElement = document.createElement('div');
        avatarElement.classList.add('doc-chatbot-avatar');
        
        const iconElement = document.createElement('i');
        iconElement.classList.add('fas', role === 'user' ? 'fa-user' : 'fa-robot');
        avatarElement.appendChild(iconElement);
        
        const textElement = document.createElement('div');
        textElement.classList.add('doc-chatbot-text');
        textElement.textContent = content;
        
        messageElement.appendChild(avatarElement);
        messageElement.appendChild(textElement);
        
        chatbotMessages.appendChild(messageElement);
        
        // Faire défiler jusqu'au dernier message
        scrollToBottom();
        
        // Ajouter le message à l'historique (limité à 10 messages)
        messageHistory.push({ role, content });
        if (messageHistory.length > 10) {
            messageHistory.shift();
        }
    }
    
    // Ajouter l'indicateur "en train d'écrire"
    function addTypingIndicator() {
        if (!chatbotMessages) return;
        
        // Si un indicateur existe déjà, ne pas en ajouter un autre
        if (isTyping) return;
        isTyping = true;
        
        const typingElement = document.createElement('div');
        typingElement.classList.add('doc-chatbot-message', 'assistant', 'typing');
        typingElement.id = 'typing-indicator';
        
        const avatarElement = document.createElement('div');
        avatarElement.classList.add('doc-chatbot-avatar');
        
        const iconElement = document.createElement('i');
        iconElement.classList.add('fas', 'fa-robot');
        avatarElement.appendChild(iconElement);
        
        const typingDots = document.createElement('div');
        typingDots.classList.add('doc-chatbot-typing-indicator');
        typingDots.innerHTML = '<span></span><span></span><span></span>';
        
        typingElement.appendChild(avatarElement);
        typingElement.appendChild(typingDots);
        
        chatbotMessages.appendChild(typingElement);
        
        // Faire défiler jusqu'au dernier message
        scrollToBottom();
    }
    
    // Supprimer l'indicateur "en train d'écrire"
    function removeTypingIndicator() {
        if (!chatbotMessages) return;
        
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        isTyping = false;
    }
    
    // Faire défiler la zone de messages jusqu'en bas
    function scrollToBottom() {
        if (!chatbotMessages) return;
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }
    
    // Ajouter le contexte de la section actuelle au message
    function addSectionContext(message) {
        if (!currentSection) {
            return message;
        }
        
        // Trouver le titre de la section actuelle
        const currentSectionElement = document.getElementById(currentSection);
        let sectionTitle = '';
        
        if (currentSectionElement) {
            // Essayer de trouver le titre dans l'élément ou dans un de ses descendants
            const headingElement = currentSectionElement.querySelector('h1, h2, h3, h4, h5, h6');
            if (headingElement) {
                sectionTitle = headingElement.textContent.trim();
            }
        }
        
        if (sectionTitle) {
            return `[En lisant la section: ${sectionTitle}] ${message}`;
        }
        
        return message;
    }
    
    // Observer pour détecter le changement de section
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                if (id) {
                    currentSection = id;
                    console.log("Section actuelle:", currentSection);
                }
            }
        });
    }, { threshold: 0.5 });
    
    // Observer toutes les sections de documentation
    document.querySelectorAll('section[id], div[id].documentation-section').forEach(section => {
        observer.observe(section);
    });
    
    // Fonction pour envoyer le message à l'API et afficher la réponse
    async function fetchAIResponse(message) {
        try {
            console.log("Envoi de la requête à l'API pour:", message);
            
            // Utiliser le point d'API direct pour le chat
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    messages: [
                        { role: "system", content: "Vous êtes l'assistant de documentation technique FHIRHub. Répondez aux questions concernant l'utilisation du logiciel, ses fonctionnalités et son architecture technique." },
                        { role: "user", content: message }
                    ],
                    useKnowledge: true,
                    context: "Documentation technique"
                })
            });
            
            console.log("Réponse reçue du serveur:", response.status);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Données reçues:", data);
            
            // Supprimer l'indicateur de frappe
            removeTypingIndicator();
            
            // Ajouter la réponse de l'IA au chat
            // Extraction correcte du message de la réponse
            console.log("Structure complète de la réponse:", JSON.stringify(data));
            
            let aiResponse = null;
            
            // Cas 1: format de l'API FHIRHub standard
            if (data.content) {
                aiResponse = data.content;
            } 
            // Cas 2: message dans la propriété message
            else if (data.message && typeof data.message === 'string') {
                aiResponse = data.message;
            }
            // Cas 3: réponse dans la propriété response
            else if (data.response) {
                aiResponse = data.response;
            }
            // Cas 4: format OpenAI avec choices
            else if (data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                if (choice.message && choice.message.content) {
                    aiResponse = choice.message.content;
                } else if (choice.text) {
                    aiResponse = choice.text;
                }
            }
            
            // Message par défaut si aucun format ne correspond
            if (!aiResponse) {
                aiResponse = "Désolé, je n'ai pas pu extraire la réponse correctement.";
            }
            
            console.log("Message final extrait:", aiResponse);
            addMessageToChat('assistant', aiResponse);
            
            return data;
        } catch (error) {
            console.error('Erreur lors de la récupération de la réponse:', error);
            removeTypingIndicator();
            addMessageToChat('assistant', "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.");
            throw error;
        }
    }
    
    // Initialiser l'état du chatbot (fermé par défaut)
    console.log("✅ Chatbot de documentation initialisé");
});