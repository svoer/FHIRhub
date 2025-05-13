/**
 * Utilitaires pour ajouter un délai entre les requêtes FHIR
 * Permet d'éviter les erreurs 429 (Too Many Requests)
 */

// Fonction utilitaire pour remplacer le fetch natif avec un délai entre les requêtes
(function() {
    // Conserver une référence à la fonction fetch originale
    const originalFetch = window.fetch;
    
    // Stocker la dernière fois qu'une requête a été effectuée
    let lastFetchTime = 0;
    const DELAY = 500; // Délai de 500ms entre les requêtes
    
    // Remplacer uniquement pour les requêtes FHIR spécifiques
    window.fetchWithFhirDelay = async function(url, options) {
        // Si c'est une URL FHIR, ajouter un délai
        if (url.includes('fhir') || url.includes('api/fhir-proxy')) {
            const now = Date.now();
            const elapsed = now - lastFetchTime;
            
            // Si moins de DELAY ms se sont écoulées depuis la dernière requête
            if (elapsed < DELAY) {
                const waitTime = DELAY - elapsed;
                console.log(`Ajout d'un délai de ${waitTime}ms pour éviter les erreurs 429 (Too Many Requests)`);
                
                // Attendre la différence de temps
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            // Mettre à jour le temps de la dernière requête
            lastFetchTime = Date.now();
        }
        
        // Utiliser la fonction fetch originale
        return originalFetch(url, options);
    };
    
    console.log("Utilitaire de délai pour les requêtes FHIR initialisé");
})();