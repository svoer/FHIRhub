/**
 * Script pour le chatbot de documentation avec un bouton lanceur séparé
 * Ce script gère l'interface utilisateur et la communication avec l'API
 * pour le chatbot contextuel de documentation.
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log("🤖 Initialisation du chatbot de documentation (v2)...");
  
  // Éléments DOM
  const chatbotContainer = document.getElementById('doc-chatbot-container');
  const chatbotLauncher = document.getElementById('doc-chatbot-launcher');
  const chatbotToggle = document.getElementById('doc-chatbot-toggle');
  const chatbotMessages = document.getElementById('doc-chatbot-messages');
  const chatbotInputText = document.getElementById('doc-chatbot-input-text');
  const chatbotSendButton = document.getElementById('doc-chatbot-send');
  
  // Vérification de la présence du conteneur
  if (!chatbotContainer) {
    console.error("Container du chatbot non trouvé");
    return;
  }
  
  console.log("Container du chatbot trouvé ✅");
  
  // Fonction pour ouvrir le chatbot
  function openChatbot() {
    chatbotContainer.classList.add('open');
    chatbotLauncher.classList.add('hidden');
    chatbotInputText.focus();
  }
  
  // Fonction pour fermer le chatbot
  function closeChatbot() {
    chatbotContainer.classList.remove('open');
    chatbotLauncher.classList.remove('hidden');
  }
  
  // Par défaut, le chatbot est fermé
  closeChatbot();
  
  // Événement pour le bouton lanceur
  if (chatbotLauncher) {
    chatbotLauncher.addEventListener('click', function() {
      openChatbot();
    });
  }
  
  // Événement pour le bouton de fermeture
  if (chatbotToggle) {
    chatbotToggle.addEventListener('click', function() {
      closeChatbot();
    });
  }
  
  // Ajouter un message au chatbot
  function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `doc-chatbot-message ${type}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'doc-chatbot-avatar';
    
    const avatarIcon = document.createElement('i');
    avatarIcon.className = type === 'user' ? 'fas fa-user' : 'fas fa-robot';
    avatarDiv.appendChild(avatarIcon);
    
    const textDiv = document.createElement('div');
    textDiv.className = 'doc-chatbot-text';
    textDiv.innerHTML = text.replace(/\n/g, '<br>');
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(textDiv);
    
    chatbotMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }
  
  // Ajouter un indicateur de frappe
  function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'doc-chatbot-typing';
    typingDiv.id = 'doc-chatbot-typing';
    
    const dots = ['<span></span>', '<span></span>', '<span></span>'];
    typingDiv.innerHTML = dots.join('');
    
    chatbotMessages.appendChild(typingDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }
  
  // Supprimer l'indicateur de frappe
  function removeTypingIndicator() {
    const typingIndicator = document.getElementById('doc-chatbot-typing');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }
  
  // Envoyer un message à l'API
  async function sendMessage(message) {
    try {
      // Empêcher les messages vides
      if (!message.trim()) return;
      
      // Ajouter le message de l'utilisateur à l'interface
      addMessage('user', message);
      
      // Afficher l'indicateur de frappe
      addTypingIndicator();
      
      // Paramètres de la requête
      const params = {
        prompt: message,
        messagesCount: 2, // Limiter l'historique
        max_tokens: 1000,
        providerRequested: 'par défaut'
      };
      
      // Appel API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      console.log("Réponse reçue du serveur:", response.status);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Données reçues:", data);
      console.log("Structure complète de la réponse:", JSON.stringify(data));
      
      // Supprimer l'indicateur de frappe
      removeTypingIndicator();
      
      // Extraire et afficher le message de réponse
      let messageContent = "";
      if (data && data.success && data.content) {
        messageContent = data.content;
      } else if (data && data.message) {
        messageContent = data.message;
      } else {
        messageContent = "Je n'ai pas pu générer une réponse. Veuillez réessayer.";
      }
      
      console.log("Message final extrait:", messageContent);
      
      // Ajouter le message de l'assistant à l'interface
      addMessage('assistant', messageContent);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      removeTypingIndicator();
      addMessage('assistant', 'Désolé, une erreur s\'est produite lors du traitement de votre demande. Veuillez réessayer.');
    }
  }
  
  // Événement pour l'envoi du message
  chatbotSendButton.addEventListener('click', function() {
    const message = chatbotInputText.value;
    chatbotInputText.value = '';
    sendMessage(message);
  });
  
  // Envoyer avec la touche Entrée (mais Shift+Entrée pour un saut de ligne)
  chatbotInputText.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatbotSendButton.click();
    }
  });
  
  console.log("✅ Chatbot de documentation initialisé");
});