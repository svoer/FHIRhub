/**
 * footer-version.js
 * Script pour récupérer et afficher la version du système dans le footer
 */
document.addEventListener('DOMContentLoaded', function() {
    const versionElement = document.querySelector('.version-text');
    
    if (versionElement) {
        // Récupérer la version depuis l'API
        fetch('/api/system/version')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Format de date pour l'affichage
                    const buildDate = new Date(data.data.build_date);
                    const formattedDate = buildDate.toLocaleDateString('fr-FR');
                    
                    // Afficher la version dans le footer
                    versionElement.textContent = `${data.data.version} (${formattedDate})`;
                    
                    // Ajouter une classe pour l'animation de fondu
                    versionElement.classList.add('version-loaded');
                } else {
                    versionElement.textContent = 'Information non disponible';
                }
            })
            .catch(error => {
                console.error('Erreur lors de la récupération de la version:', error);
                versionElement.textContent = 'Erreur de chargement';
            });
    }
});

/**
 * Gestion de l'incrémentation de version
 * 
 * La version est stockée en variable globale dans app.js (global.APP_VERSION)
 * Pour incrémenter la version, il faut:
 * 
 * 1. PATCH: Corriger un bug ou faire une modification mineure
 *    --> Modifier directement le numéro de version dans app.js
 * 
 * 2. MINOR: Ajouter une nouvelle fonctionnalité
 *    --> Modifier directement le numéro de version dans app.js
 * 
 * 3. MAJOR: Changement majeur qui casse la compatibilité
 *    --> Modifier directement le numéro de version dans app.js
 * 
 * Format: MAJOR.MINOR.PATCH (exemple: 1.2.0)
 * 
 * La version est mise à jour manuellement lors des déploiements
 * ou des mises à jour importantes du système.
 */