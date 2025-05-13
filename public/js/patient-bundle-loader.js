/**
 * Module pour charger les bundles FHIR des patients avec gestion des délais
 * Permet de prévenir les erreurs 429 (Too Many Requests) lors des requêtes FHIR
 */

/**
 * Version optimisée de la fonction loadPatientBundle utilisant fetchWithDelay
 * Cette fonction remplace la version dans patient-viewer.js pour éviter les erreurs 429
 */
function loadPatientBundleOptimized(patientId, serverUrl) {
    const container = document.querySelector('#bundleContent');
    const bundleInfo = document.getElementById('bundleInfo');
    const bundleResourcesList = document.getElementById('bundleResourcesList');
    const loadingSection = container.querySelector('.loading-resources');
    const noResourcesSection = container.querySelector('.no-resources');
    
    if (loadingSection) loadingSection.style.display = 'block';
    if (noResourcesSection) noResourcesSection.style.display = 'none';
    if (bundleResourcesList) bundleResourcesList.innerHTML = '';
    
    // Déterminer si nous utilisons le proxy ou l'URL directe
    let url;
    if (serverUrl.includes('hapi.fhir.org')) {
        // Utiliser le proxy pour contourner les limitations CORS
        // Utiliser un count réduit (50) pour éviter les erreurs 429 (Too Many Requests)
        url = `/api/fhir-proxy/hapi/Patient/${patientId}/$everything?_count=50&_include=*`;
    } else {
        // URL directe pour les serveurs locaux (déjà sur le même domaine)
        url = `${serverUrl}/Patient/${patientId}/$everything?_count=100&_include=*`;
    }
    
    console.log(`Chargement du bundle patient depuis: ${url}`);
    
    // Fonction de gestion des erreurs
    const handleBundleError = (error) => {
        console.error('Erreur avec $everything:', error);
        
        if (loadingSection) loadingSection.style.display = 'none';
        
        // Montrer le message d'erreur
        if (noResourcesSection) {
            noResourcesSection.style.display = 'block';
            noResourcesSection.innerHTML = `
                <p>Impossible de récupérer le bundle complet. Tentative de récupération manuelle des ressources.</p>
            `;
        }
        
        // Tenter de récupérer manuellement un ensemble de ressources associées
        if (bundleInfo) {
            bundleInfo.innerHTML = `
                <p><strong>Erreur lors de la récupération du bundle:</strong> ${error.message}</p>
                <p>Tentative de récupération des ressources individuelles...</p>
            `;
        }
        
        // Tenter une approche alternative pour récupérer les données
        if (typeof fetchResourcesManually === 'function') {
            fetchResourcesManually(patientId);
        } else {
            console.error("La fonction fetchResourcesManually n'est pas disponible");
        }
        
        return null;
    };
    
    // Utiliser notre fonction fetchWithDelay pour récupérer les données du bundle
    fetchWithDelay(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur de récupération du bundle: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Stocker le bundle pour référence future
            if (window.bundleData !== undefined) {
                window.bundleData = data;
            }
            
            if (loadingSection) loadingSection.style.display = 'none';
            
            // Si la fonction originale existe, l'appeler avec les données
            // Sinon, effectuer le traitement ici
            if (typeof processPatientBundle === 'function') {
                processPatientBundle(data, bundleInfo, bundleResourcesList, noResourcesSection);
            } else {
                // Afficher les informations sur le bundle
                if (data.resourceType === 'Bundle') {
                    const resourceCount = data.entry ? data.entry.length : 0;
                    const resourceTypes = data.entry ? 
                        [...new Set(data.entry.map(e => e.resource.resourceType))].sort() : [];
                    
                    bundleInfo.innerHTML = `
                        <p><strong>Type de bundle:</strong> ${data.type || 'Inconnu'}</p>
                        <p><strong>Identifiant:</strong> ${data.id || 'Non spécifié'}</p>
                        <p><strong>Nombre de ressources:</strong> ${resourceCount}</p>
                        <p><strong>Types de ressources:</strong> ${resourceTypes.join(', ') || 'Aucun'}</p>
                    `;
                    
                    if (bundleResourcesList) {
                        bundleResourcesList.innerHTML = `
                            <div class="alert alert-info">
                                <p>Bundle chargé avec succès. ${resourceCount} ressources disponibles.</p>
                                <p>Pour visualiser en détail les ressources, veuillez consulter l'onglet Bundle dans l'interface principale.</p>
                            </div>
                        `;
                    }
                } else {
                    bundleInfo.innerHTML = `<p>Le bundle n'a pas pu être correctement chargé.</p>`;
                    if (noResourcesSection) noResourcesSection.style.display = 'block';
                }
            }
        })
        .catch(handleBundleError);
}

// Remplacer la fonction originale si elle existe
document.addEventListener('DOMContentLoaded', () => {
    // Si la fonction loadPatientBundle existe dans la portée globale, la sauvegarder 
    // et la remplacer par notre version optimisée
    if (typeof window.loadPatientBundle === 'function') {
        console.log("Remplacement de loadPatientBundle par la version optimisée avec gestion des délais");
        
        // Extraire la fonction de traitement du bundle de la fonction originale si nécessaire
        window.processPatientBundle = (data, bundleInfo, bundleResourcesList, noResourcesSection) => {
            // Cette fonction sera définie dynamiquement au temps d'exécution
            // Pour l'instant, elle affichera juste un avertissement
            console.warn("Fonction processPatientBundle non initialisée");
        };
        
        // Sauvegarder la fonction originale
        window.loadPatientBundleOriginal = window.loadPatientBundle;
        
        // Remplacer par notre version optimisée
        window.loadPatientBundle = loadPatientBundleOptimized;
    }
});