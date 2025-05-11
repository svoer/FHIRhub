/**
 * Script pour rediriger la page Swagger vers une version statique plus simple
 * Élimine complètement le problème de clignotement en proposant une solution alternative
 */

// Configuration de l'authentification
const API_KEY = 'dev-key';
const JWT_TOKEN = localStorage.getItem('token');

// Fonction pour charger la documentation JSON brute
async function fetchSwaggerJson() {
  try {
    const response = await fetch('/api-docs.json');
    return await response.json();
  } catch (error) {
    console.error('Erreur lors du chargement de la documentation API:', error);
    return null;
  }
}

// Fonction pour construire l'URL de la documentation Swagger.io
function buildSwaggerIoUrl(swaggerJson) {
  // Serialiser le JSON en string et encoder pour URL
  const jsonStr = encodeURIComponent(JSON.stringify(swaggerJson));
  
  // Construire l'URL vers Swagger.io (version sans clignotement)
  return `https://petstore.swagger.io/?url=https://petstore.swagger.io/v2/swagger.json#/`;
}

// Fonction principale exécutée au chargement
async function init() {
  const apiDocs = await fetchSwaggerJson();
  
  if (apiDocs) {
    const swaggerUrl = buildSwaggerIoUrl(apiDocs);
    
    // Créer un container pour notre message
    const container = document.createElement('div');
    container.style.cssText = `
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 30px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      text-align: center;
    `;
    
    // Ajouter le logo FHIRHub
    const logo = document.createElement('div');
    logo.innerHTML = `<img src="/img/flame-icon-white.svg" alt="FHIRHub Logo" width="80" height="80" style="background: linear-gradient(135deg, #e74c3c, #ff5722); padding: 10px; border-radius: 8px; margin-bottom: 20px;">`;
    container.appendChild(logo);
    
    // Titre
    const title = document.createElement('h1');
    title.textContent = 'Documentation API FHIRHub';
    title.style.cssText = `
      color: #333;
      margin-bottom: 20px;
    `;
    container.appendChild(title);
    
    // Description
    const description = document.createElement('p');
    description.textContent = 'Documentation complète de l\'API pour l\'application FHIRHub.';
    description.style.cssText = `
      color: #666;
      font-size: 18px;
      margin-bottom: 30px;
    `;
    container.appendChild(description);
    
    // Bouton pour accéder à la documentation API
    const button = document.createElement('a');
    button.textContent = 'Accéder à la Documentation API';
    button.href = '/api-docs/';
    button.style.cssText = `
      display: inline-block;
      background: linear-gradient(135deg, #e74c3c, #ff5722);
      color: white;
      font-weight: bold;
      padding: 12px 24px;
      border-radius: 4px;
      text-decoration: none;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      margin-bottom: 20px;
    `;
    
    button.onmouseover = () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 10px rgba(0,0,0,0.15)';
    };
    
    button.onmouseout = () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    };
    
    container.appendChild(button);
    
    // Ajouter note pour la clé API
    const apiKeyNote = document.createElement('div');
    apiKeyNote.innerHTML = `
      <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 4px; text-align: left;">
        <h3 style="margin-top: 0; color: #333;">Informations d'authentification</h3>
        <p><strong>Clé API de test:</strong> <code style="background: #f1f1f1; padding: 3px 6px; border-radius: 3px;">dev-key</code></p>
        <p><strong>Endpoint de base:</strong> <code style="background: #f1f1f1; padding: 3px 6px; border-radius: 3px;">/api</code></p>
      </div>
    `;
    container.appendChild(apiKeyNote);
    
    // Ajouter au document
    document.body.innerHTML = '';
    document.body.appendChild(container);
    
    // Ajouter des styles de base au body
    document.body.style.cssText = `
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    `;
  }
}

// Démarrer l'initialisation
window.addEventListener('DOMContentLoaded', init);