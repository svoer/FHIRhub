/**
 * Utilitaire de sécurisation des URLs
 * Prévient les vulnérabilités SSRF (Server-Side Request Forgery)
 */

// Liste des domaines autorisés pour les requêtes
const ALLOWED_DOMAINS = [
  'hapi.fhir.org',
  'localhost',
  '127.0.0.1'
];

/**
 * Sanitise une URL pour éviter les attaques SSRF
 * 
 * @param {string} url - L'URL à sanitiser
 * @returns {string} L'URL sanitisée si elle est valide
 * @throws {Error} Si l'URL n'est pas valide ou si le domaine n'est pas autorisé
 */
function sanitizeUrl(url) {
  try {
    // Vérification qu'il s'agit d'une URL valide
    const parsedUrl = new URL(url);
    
    // Vérification que le protocole est http ou https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Protocole non autorisé: ${parsedUrl.protocol}`);
    }
    
    // Vérification que le domaine est dans la liste des domaines autorisés
    const domainIsAllowed = ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );
    
    if (!domainIsAllowed) {
      throw new Error(`Domaine non autorisé: ${parsedUrl.hostname}`);
    }
    
    // Si localhost ou 127.0.0.1, vérifier que le port est autorisé
    if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
      // Limitation aux ports autorisés pour localhost
      const allowedPorts = [8080, 8000, 8081, 3000, 5000];
      const port = parseInt(parsedUrl.port, 10) || (parsedUrl.protocol === 'https:' ? 443 : 80);
      
      if (!allowedPorts.includes(port)) {
        throw new Error(`Port non autorisé pour localhost: ${port}`);
      }
    }
    
    // L'URL est valide et sécurisée
    return url;
    
  } catch (error) {
    // Si l'URL n'est pas valide, lancer une erreur
    throw new Error(`URL non valide ou non autorisée: ${error.message}`);
  }
}

module.exports = {
  sanitizeUrl
};