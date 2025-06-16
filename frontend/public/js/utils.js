/**
 * Fonctions utilitaires pour FHIRHub
 * Contient des fonctions communes utilisées par plusieurs modules
 */

/**
 * Effectue une requête à l'API FHIRHub
 * @param {string} endpoint - Endpoint API sans le préfixe /api/
 * @param {Object} options - Options de la requête fetch
 * @returns {Promise<Object>} - Réponse de l'API
 */
async function apiRequest(endpoint, options = {}) {
  // Assurer que les en-têtes sont initialisés
  options.headers = options.headers || {};
  
  // Obtenir la clé API depuis le localStorage ou utiliser la clé de développement par défaut
  const apiKey = localStorage.getItem('apiKey') || 'dev-key';
  
  // Ajouter la clé API à la fois dans les en-têtes et dans l'URL (pour compatibilité)
  options.headers['x-api-key'] = apiKey;
  options.headers['Accept'] = 'application/json';
  
  // Construire l'URL avec la clé API en paramètre de requête
  let url = `/api/${endpoint}`;
  if (url.includes('?')) {
    url += `&apiKey=${apiKey}`;
  } else {
    url += `?apiKey=${apiKey}`;
  }
  
  console.log(`Requête API: ${options.method || 'GET'} ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, options);
    const endTime = Date.now();
    console.log(`Temps de réponse API: ${endTime - startTime}ms`);
    
    if (!response.ok) {
      console.error(`Erreur API: ${response.status} ${response.statusText}`);
      
      // Vérifier le type de contenu
      const contentType = response.headers.get('content-type');
      console.log(`Type de contenu de la réponse: ${contentType}`);
      
      // Lire le texte de la réponse
      const errorText = await response.text();
      
      // Afficher le début de la réponse pour diagnostic
      console.error('Début de la réponse:', errorText.substring(0, 300));
      
      // Si c'est du HTML (indiqué par <!DOCTYPE ou <html>)
      if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
        console.error('Réponse HTML reçue au lieu de JSON. Problème de routage API probable.');
        throw new Error('Erreur API: Le serveur a renvoyé une page HTML au lieu de JSON. Vérifiez le routage API ou les redirections.');
      }
      
      try {
        // Essayer de parser comme JSON
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || errorJson.error || `Erreur ${response.status}`);
      } catch (e) {
        // Si ce n'est pas du JSON, renvoyer le texte brut
        throw new Error(`Erreur ${response.status}: ${errorText.substring(0, 100)}...`);
      }
    }
    
    // Pour les réponses vides (comme 204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return { success: true };
    }
    
    // Vérifier le type de contenu
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn(`Réponse non-JSON reçue. Type de contenu: ${contentType}`);
    }
    
    try {
      // Analyser la réponse comme JSON
      const data = await response.json();
      return data;
    } catch (jsonError) {
      console.error('Erreur lors du parsing JSON:', jsonError);
      
      // Lire la réponse comme texte pour diagnostic
      const textResponse = await response.text();
      console.error('Contenu de la réponse brute:', textResponse.substring(0, 500));
      
      throw new Error('Impossible de parser la réponse JSON');
    }
  } catch (error) {
    console.error('Erreur lors de la requête API:', error);
    
    // Pour les erreurs de connexion ou CORS
    if (error.message.includes('NetworkError') || error.message.includes('CORS')) {
      console.error('Erreur réseau détectée. Possible problème CORS ou serveur non disponible.');
    }
    
    throw error;
  }
}

/**
 * Formater une date au format français
 * @param {string|Date} date - Date à formater
 * @returns {string} Date formatée
 */
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Tronquer un texte à une longueur maximale
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} Texte tronqué
 */
function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
}

/**
 * Échapper les caractères HTML
 * @param {string} html - HTML à échapper
 * @returns {string} HTML échappé
 */
function escapeHtml(html) {
  if (!html) return '';
  
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Générer un identifiant unique
 * @returns {string} Identifiant unique
 */
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Exporter les fonctions pour les rendre disponibles globalement
window.apiRequest = apiRequest;
window.formatDate = formatDate;
window.truncateText = truncateText;
window.escapeHtml = escapeHtml;
window.generateUniqueId = generateUniqueId;