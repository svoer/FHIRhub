/**
 * Script pour cacher les ressources en noir et blanc dans l'onglet Bundle
 * et ne garder que les accordéons colorés
 */
document.addEventListener('DOMContentLoaded', function() {
    // Fonction pour cacher les cartes noir et blanc
    function hideBlackAndWhiteCards() {
        const bundleResourcesList = document.getElementById('bundleResourcesList');
        if (bundleResourcesList) {
            bundleResourcesList.style.display = 'none';
        }
    }
    
    // Exécuter immédiatement
    hideBlackAndWhiteCards();
    
    // Réexécuter quand l'onglet Bundle est activé
    const bundleTab = document.querySelector('.tab[data-tab="bundle"]');
    if (bundleTab) {
        bundleTab.addEventListener('click', function() {
            setTimeout(hideBlackAndWhiteCards, 100);
        });
    }
    
    // Observer les changements DOM pour cacher les cartes noir et blanc 
    // si elles réapparaissent après un chargement de données
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                hideBlackAndWhiteCards();
            }
        });
    });
    
    // Observer le conteneur principal
    const bundleContent = document.getElementById('bundleContent');
    if (bundleContent) {
        observer.observe(bundleContent, { childList: true, subtree: true });
    }
});