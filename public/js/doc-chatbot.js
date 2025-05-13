/**
 * Script pour le chatbot contextuel de la documentation
 * Ce chatbot utilise la même API que le chatbot principal mais avec
 * un contexte spécifique à la documentation technique.
 */

/**
 * Script simplifié pour le chatbot contextuel de la documentation
 * Ce chatbot utilise la même API que le chatbot principal mais avec
 * un contexte spécifique à la documentation technique.
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log("🤖 Initialisation du chatbot de documentation...");
    
    // Récupération des éléments du DOM
    const chatbotContainer = document.getElementById('doc-chatbot-container');
    const chatbotHeader = document.querySelector('.doc-chatbot-header');
    const chatbotMessages = document.getElementById('doc-chatbot-messages');
    const chatbotInput = document.getElementById('doc-chatbot-input-text');
    const chatbotSend = document.getElementById('doc-chatbot-send');
    
    // Vérifier si le chatbot existe sur cette page
    if (!chatbotContainer) {
        console.log("Le chatbot n'est pas présent sur cette page.");
        return;
    }
    
    console.log("Container du chatbot trouvé ✅");
    
    // Variables d'état
    let isTyping = false;
    const messageHistory = [];
    let currentSection = '';
    
    // Fonction pour basculer l'ouverture/fermeture du chatbot
    function toggleChatbot() {
        chatbotContainer.classList.toggle('open');
        if (chatbotContainer.classList.contains('open')) {
            chatbotInput.focus();
            scrollToBottom();
        }
    }
    
    // Ajouter l'événement au header du chatbot
    if (chatbotHeader) {
        chatbotHeader.addEventListener('click', function(e) {
            // S'assurer que le clic n'est pas sur une autre zone interactive du header
            if (e.target === chatbotHeader || e.target.closest('.doc-chatbot-header')) {
                toggleChatbot();
            }
        });
    }
    
    // Ajouter les fonctionnalités d'envoi de message
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
    document.querySelectorAll('section[id], div[id].documentation-section').forEach(section => {
        observer.observe(section);
    });
    
    // Fonctions auxiliaires pour l'interface utilisateur
    
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
        
        // Ajouter le message à l'historique
        messageHistory.push({ role, content });
        
        // Limiter l'historique à 10 messages
        if (messageHistory.length > 10) {
            messageHistory.shift();
        }
    }
        
        // Événement pour ouvrir/fermer le chatbot via le bouton
        chatbotToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Éviter le déclenchement multiple
            toggleChatbot();
        });
        
        // Permettre de cliquer sur tout le header pour ouvrir/fermer
        const chatbotHeader = document.querySelector('.doc-chatbot-header');
        if (chatbotHeader) {
            chatbotHeader.addEventListener('click', function(e) {
                // Ne pas déclencher si on a cliqué sur le bouton (déjà géré)
                if (e.target !== chatbotToggle && !chatbotToggle.contains(e.target)) {
                    toggleChatbot();
                }
            });
        } else {
            console.error("L'élément .doc-chatbot-header n'a pas été trouvé");
        }
        
        // Événement pour envoyer un message (bouton)
        chatbotSend.addEventListener('click', () => {
            sendMessage();
        });
        
        // Événement pour envoyer un message (touche Entrée)
        chatbotInput.addEventListener('keydown', (e) => {
            // Entrée sans Shift pour envoyer, Shift+Entrée pour un saut de ligne
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    document.querySelectorAll('.documentation-section').forEach(section => {
        observer.observe(section);
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
Si la question de l'utilisateur contient un contexte de section, concentre-toi sur cette section spécifique.

IMPORTANT: Quand tu as besoin d'informations techniques spécifiques sur FHIRHub, tu peux accéder à la base de connaissances via l'API:
- Pour obtenir une FAQ: GET /api/ai-knowledge/faq
- Pour obtenir la liste des fonctionnalités: GET /api/ai-knowledge/features
- Pour obtenir la liste des commandes: GET /api/ai-knowledge/commands
- Pour rechercher des informations pertinentes: GET /api/ai-knowledge/search?query=ta_requête

Quand un utilisateur pose une question technique, tu dois d'abord consulter cette base de connaissances avant de répondre.`
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
    
    // Fonction pour enrichir le contexte avec des recherches dans la base de connaissances
    async function enrichWithKnowledge(userMessage) {
        try {
            console.log(`[DOC-CHATBOT] Recherche de connaissances pour: "${userMessage.substring(0, 50)}..."`);
            
            // Appel à l'API de recherche de connaissances
            const searchResponse = await fetch(`/api/ai-knowledge/search?query=${encodeURIComponent(userMessage)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!searchResponse.ok) {
                console.warn(`[DOC-CHATBOT] Échec de recherche dans la base de connaissances: ${searchResponse.status}`);
                return null;
            }
            
            const searchResult = await searchResponse.json();
            
            if (searchResult.success && searchResult.results && searchResult.results.length > 0) {
                console.log(`[DOC-CHATBOT] ${searchResult.results.length} connaissances pertinentes trouvées`);
                return searchResult.results;
            } else {
                console.log('[DOC-CHATBOT] Aucune connaissance pertinente trouvée');
                return null;
            }
        } catch (error) {
            console.error('[DOC-CHATBOT] Erreur lors de la recherche dans la base de connaissances:', error);
            return null;
        }
    }
    
    // Fonction pour interroger l'API du chatbot
    async function fetchAIResponse(userMessage) {
        try {
            // Ajouter le dernier message à l'historique
            messageHistory.push({ role: 'user', content: userMessage });
            
            // Rechercher des connaissances pertinentes
            const relevantKnowledge = await enrichWithKnowledge(userMessage);
            
            // Créer un prompt enrichi si des connaissances ont été trouvées
            let systemMessage = {
                role: 'system',
                content: `Tu es un assistant spécialisé dans la documentation technique de FHIRHub. 
Ta mission est d'aider les utilisateurs à comprendre cette documentation. 
Utilise un ton professionnel adapté au domaine médical.
Si la question de l'utilisateur contient un contexte de section, concentre-toi sur cette section spécifique.`
            };
            
            if (relevantKnowledge && relevantKnowledge.length > 0) {
                // Formater les connaissances pour le prompt système
                let knowledgeText = "INFORMATIONS PERTINENTES DE LA BASE DE CONNAISSANCES FHIRHUB:\n\n";
                
                relevantKnowledge.forEach((info, index) => {
                    if (info.type === 'faq' && info.question && info.answer) {
                        knowledgeText += `[INFO-${index+1}] Q: "${info.question}"\nR: "${info.answer}"\n\n`;
                    } else if (info.type === 'feature' && info.name && info.description) {
                        knowledgeText += `[INFO-${index+1}] Fonctionnalité: "${info.name}"\nDescription: "${info.description}"\n\n`;
                    } else if (info.type === 'command' && info.name && info.description) {
                        knowledgeText += `[INFO-${index+1}] Commande: "${info.name}"\nDescription: "${info.description}"\n\n`;
                    }
                });
                
                // Ajouter les connaissances au message système
                systemMessage.content += `\n\n${knowledgeText}`;
                console.log(`[DOC-CHATBOT] Prompt enrichi avec ${relevantKnowledge.length} connaissances`);
            }
            
            // Préparer les messages pour l'API
            const messages = [systemMessage];
            
            // Ajouter l'historique des messages
            messageHistory.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
            
            // Préparer les données
            const data = {
                messages: messages,
                max_tokens: 1000
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