/**
 * Support Chatbot pour FHIRHub
 * Ce module gère le chatbot de support utilisateur intégré à l'application
 */

// Écouteur globale pour s'assurer que tout se charge avant l'initialisation
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si l'utilisateur est authentifié
  if (!localStorage.getItem('token')) {
    console.log('Utilisateur non authentifié, le chatbot ne sera pas chargé.');
    return;
  }
  
  // Vérifier si nous sommes sur la page du tableau de bord (le chatbot ne doit être chargé que sur certaines pages)
  const currentPath = window.location.pathname;
  if (currentPath !== '/dashboard.html' && currentPath !== '/') {
    console.log('Page non dashboard, le chatbot ne sera pas chargé.');
    return;
  }
  
  // Initialiser le chatbot (sans créer les éléments, car ils existent déjà dans le HTML)
  initChatbot();
  
  // Attendre vraiment que le DOM soit complètement chargé, y compris tous les éléments imbriqués
  // Utiliser un petit délai pour s'assurer que tout est bien chargé
  setTimeout(() => {
    // Vérifier à nouveau que les éléments existent avant d'attacher les événements
    const chatbotHeader = document.getElementById('chatbotHeader');
    const chatbotInput = document.getElementById('chatbotInput');
    const chatbotSendButton = document.getElementById('chatbotSend');
    
    if (chatbotHeader && chatbotInput && chatbotSendButton) {
      // S'assurer que les événements sont correctement attachés
      attachChatbotEvents();
    } else {
      console.log('Éléments du chatbot manquants dans le DOM');
    }
  }, 800);
});

// Variables globales
let messageHistory = [];
let aiProvider = null;
let isWaitingForResponse = false;
let currentContext = window.location.pathname;

// Instructions système pour le chatbot
const systemInstructions = `Tu es un assistant intégré dans l'application FHIRHub, qui est une plateforme de conversion HL7 vers FHIR pour le système de santé français.
  
Tes réponses doivent être concises, professionnelles et adaptées au contexte de l'application.
Tu dois aider les utilisateurs avec leurs questions sur:
- L'utilisation de FHIRHub
- La conversion HL7 vers FHIR
- Les fonctionnalités de l'application
- Les problèmes techniques courants
- La documentation et les ressources disponibles

N'oublie pas:
- Tu n'analyses PAS les messages de santé; tu aides uniquement avec l'utilisation de l'application
- Tu ne traites PAS de données patient réelles
- Sois cordial et professionnel dans tes réponses
- Limite tes réponses à 2-3 phrases ou points concis
- Quand tu ne sais pas, suggère de consulter la documentation ou de contacter le support technique`;

/**
 * Initialise le chatbot
 */
async function initChatbot() {
  // La vérification des pages est déjà effectuée dans l'écouteur DOMContentLoaded
  // Nous arrivons ici uniquement si nous sommes sur une page compatible
  
  // Créer les éléments du chatbot si nécessaire
  createChatbotElements();
  
  // Ne pas ajouter les écouteurs d'événements ici (ils sont ajoutés dans DOMContentLoaded)
  // pour éviter les doublons et permettre une vérification préalable
  
  // Ne pas ajouter de message de bienvenue car il existe déjà dans le HTML
  // addMessage('assistant', 'Bonjour ! Je suis votre assistant FHIRHub. Comment puis-je vous aider aujourd\'hui ?');
  
  // Charger le fournisseur d'IA configuré
  await loadAIProvider();
  
  console.log('Chatbot FHIRHub initialisé avec succès.');
}

/**
 * Crée les éléments HTML du chatbot
 */
function createChatbotElements() {
  // Vérifier si le chatbot existe déjà
  if (document.getElementById('fhirhub-chatbot')) {
    return;
  }
  
  // Ajouter Font Awesome s'il n'est pas déjà chargé
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    document.head.appendChild(fontAwesome);
  }
  
  // Créer le HTML du chatbot
  const chatbotHTML = `
    <div class="chatbot-container" id="fhirhub-chatbot">
      <div class="chatbot-header" id="chatbotHeader">
        <div class="chatbot-header-title">
          <i class="fas fa-robot chatbot-header-icon"></i>
          <span>Support FHIRHub</span>
        </div>
        <button class="chatbot-toggle" id="chatbotToggle" type="button">
          <i class="fas fa-chevron-up"></i>
        </button>
      </div>
      <div class="chatbot-messages" id="chatbotMessages"></div>
      <div class="chatbot-input-container">
        <input type="text" id="chatbotInput" placeholder="Comment puis-je vous aider ?">
        <button id="chatbotSend"><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>
  `;
  
  // Ajouter le HTML au DOM
  const chatbotWrapper = document.createElement('div');
  chatbotWrapper.innerHTML = chatbotHTML.trim();
  const chatbotElement = chatbotWrapper.firstChild;
  document.body.appendChild(chatbotElement);
}

/**
 * Fonction spécifique pour attacher les événements du chatbot
 */
function attachChatbotEvents() {
  const chatbotHeader = document.getElementById('chatbotHeader');
  const chatbotInput = document.getElementById('chatbotInput');
  const chatbotSendButton = document.getElementById('chatbotSend');
  
  // Vérifier que les éléments existent
  if (!chatbotHeader || !chatbotInput || !chatbotSendButton) {
    console.error("Éléments du chatbot manquants dans le DOM");
    console.log("Header:", chatbotHeader);
    console.log("Input:", chatbotInput);
    console.log("Send button:", chatbotSendButton);
    return;
  }
  
  // Gestion de l'ouverture/fermeture du chatbot via le header
  chatbotHeader.addEventListener('click', function(event) {
    event.preventDefault();
    const chatbot = document.querySelector('.chatbot-container');
    
    // Basculer la classe open pour l'animation CSS
    chatbot.classList.toggle('open');
    console.log('Chatbot toggled:', chatbot.classList.contains('open') ? 'ouvert' : 'fermé');
    
    // Focus sur l'input quand ouvert
    if (chatbot.classList.contains('open')) {
      setTimeout(() => chatbotInput.focus(), 300);
    }
  });
  
  // Envoi du message via le bouton
  chatbotSendButton.addEventListener('click', function(event) {
    event.preventDefault();
    sendMessage();
  });
  
  // Envoi du message via la touche Entrée
  chatbotInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendMessage();
    }
  });
  
  console.log("Événements du chatbot attachés avec succès");
}

/**
 * Ajoute les écouteurs d'événements (version générique)
 * Cette fonction est conservée pour la rétrocompatibilité
 */
function addEventListeners() {
  // Cette fonction est maintenant remplacée par attachChatbotEvents
  // mais est conservée pour la compatibilité avec le code existant
  console.log("Note: addEventListeners est déprécié, utilisez attachChatbotEvents");
}

/**
 * Charge le fournisseur d'IA configuré
 */
async function loadAIProvider() {
  try {
    // Récupérer la liste des fournisseurs d'IA configurés et actifs
    const response = await fetch('/api/ai-providers/active', {
      headers: {
        // L'authentification est contournée par BYPASS_AUTH=true dans .env
      }
    });
    
    if (!response.ok) {
      console.error('Erreur lors du chargement des fournisseurs d\'IA:', response.statusText);
      return;
    }
    
    const providers = await response.json();
    
    // Utiliser le premier fournisseur actif disponible
    if (providers && providers.length > 0) {
      aiProvider = providers[0];
      console.log('Fournisseur d\'IA chargé:', aiProvider.provider_name);
    } else {
      console.warn('Aucun fournisseur d\'IA actif n\'est disponible.');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des fournisseurs d\'IA:', error);
  }
}

/**
 * Ajoute un message au chatbot
 * @param {string} role - Le rôle ('user' ou 'assistant' ou 'system')
 * @param {string} content - Le contenu du message
 */
function addMessage(role, content) {
  const messagesContainer = document.querySelector('.chatbot-messages') || document.getElementById('chatbotMessages');
  if (!messagesContainer) {
    console.error("Container de messages du chatbot non trouvé");
    return;
  }
  
  const messageElement = document.createElement('div');
  // Adapter les classes pour qu'elles correspondent au HTML existant
  if (role === 'assistant') {
    messageElement.className = 'message system';
  } else if (role === 'user') {
    messageElement.className = 'message user';
  } else {
    messageElement.className = `message ${role}`;
  }
  
  messageElement.textContent = content;
  
  messagesContainer.appendChild(messageElement);
  
  // Faire défiler vers le bas
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Ajouter à l'historique
  messageHistory.push({ role, content });
}

/**
 * Ajoute un indicateur de chargement pendant la réponse de l'IA
 */
function addLoadingIndicator() {
  const messagesContainer = document.querySelector('.chatbot-messages') || document.getElementById('chatbotMessages');
  if (!messagesContainer) {
    console.error("Container de messages du chatbot non trouvé");
    return;
  }
  
  const loadingElement = document.createElement('div');
  loadingElement.className = 'message typing';
  loadingElement.id = 'chatbot-typing';
  loadingElement.innerHTML = '<span>...</span>';
  
  messagesContainer.appendChild(loadingElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Supprime l'indicateur de chargement
 */
function removeLoadingIndicator() {
  const indicator = document.getElementById('chatbot-typing');
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Envoie un message au chatbot
 */
async function sendMessage() {
  // Vérifier si on est déjà en attente d'une réponse
  if (isWaitingForResponse) {
    return;
  }
  
  // Récupérer le message
  const inputField = document.getElementById('chatbotInput');
  if (!inputField) return;
  
  const message = inputField.value.trim();
  
  // Vérifier que le message n'est pas vide
  if (!message) {
    return;
  }
  
  // Vérifier que nous avons un fournisseur d'IA
  if (!aiProvider) {
    addMessage('assistant', "Je suis désolé, mais je ne peux pas vous répondre pour le moment car aucun fournisseur d'IA n'est configuré. Veuillez contacter l'administrateur.");
    inputField.value = '';
    return;
  }
  
  // Ajouter le message de l'utilisateur
  addMessage('user', message);
  
  // Effacer le champ de saisie
  inputField.value = '';
  
  // Afficher l'indicateur de chargement
  addLoadingIndicator();
  
  // Marquer comme en attente de réponse
  isWaitingForResponse = true;
  
  try {
    // Obtenir la réponse de l'IA
    const response = await getAIResponse(message);
    
    // Supprimer l'indicateur de chargement
    removeLoadingIndicator();
    
    // Ajouter la réponse
    addMessage('assistant', response);
  } catch (error) {
    console.error('Erreur lors de la communication avec l\'IA:', error);
    
    // Supprimer l'indicateur de chargement
    removeLoadingIndicator();
    
    // Ajouter un message d'erreur
    addMessage('assistant', "Je suis désolé, mais je n'ai pas pu traiter votre demande. Veuillez réessayer ultérieurement.");
  }
  
  isWaitingForResponse = false;
}

/**
 * Obtient une réponse de l'IA
 */
async function getAIResponse(userMessage) {
  try {
    // Construire le contexte pour la requête IA
    const contextualizedMessage = `[Contexte: L'utilisateur est sur la page ${currentContext} de FHIRHub]\n\nQuestion de l'utilisateur: ${userMessage}`;
    
    // Historique des messages pour la conversation (limité aux 10 derniers échanges)
    const recentHistory = messageHistory.slice(-10);
    
    // Construire la requête pour l'API d'IA
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // L'authentification est contournée par BYPASS_AUTH=true dans .env
      },
      body: JSON.stringify({
        provider: aiProvider.provider_name,
        messages: [
          { role: 'system', content: systemInstructions },
          ...recentHistory.map(msg => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: contextualizedMessage }
        ],
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Ajouter à l'historique du chatbot
    return result.content || "Je suis désolé, je n'ai pas pu générer une réponse appropriée.";
  } catch (error) {
    console.error('Erreur lors de la communication avec l\'IA:', error);
    throw error;
  }
}