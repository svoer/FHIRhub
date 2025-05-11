/**
 * Script pour la page FAQ technique de FHIRHub
 * Gère la navigation, la recherche et l'interactivité
 * Inclut les correctifs pour l'ouverture des rubriques FAQ
 */

document.addEventListener('DOMContentLoaded', function() {
    // Solution directe pour le problème des flèches FAQ
    console.log("Chargement de la solution directe pour les FAQ");
    
    // Ajout d'un handler direct sur tous les h3 des FAQ
    const faqHeaders = document.querySelectorAll('.faq-item h3');
    console.log(`Nombre d'en-têtes FAQ trouvés: ${faqHeaders.length}`);
    
    faqHeaders.forEach(header => {
        header.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log(`Clic sur: ${this.textContent.substring(0, 20)}...`);
            
            // Trouver le parent .faq-item et basculer sa classe active
            const faqItem = this.closest('.faq-item');
            console.log(`FAQ item trouvé? ${faqItem ? 'Oui' : 'Non'}`);
            
            if (faqItem) {
                // Si on ouvre cet élément, fermer les autres
                if (!faqItem.classList.contains('active')) {
                    document.querySelectorAll('.faq-item.active').forEach(item => {
                        if (item !== faqItem) {
                            item.classList.remove('active');
                        }
                    });
                }
                
                // Basculer l'état
                faqItem.classList.toggle('active');
                console.log(`État actif après toggle: ${faqItem.classList.contains('active')}`);
            }
        });
    });
    
    // Solution alternative avec délégation d'événements
    document.addEventListener('click', function(e) {
        // Vérifier si on a cliqué sur un h3 ou un élément à l'intérieur
        const header = e.target.closest('.faq-item h3');
        if (header) {
            e.preventDefault();
            e.stopPropagation();
            
            const faqItem = header.closest('.faq-item');
            if (faqItem) {
                // Si on ouvre cet élément, fermer les autres
                if (!faqItem.classList.contains('active')) {
                    document.querySelectorAll('.faq-item.active').forEach(item => {
                        if (item !== faqItem) {
                            item.classList.remove('active');
                        }
                    });
                }
                
                // Basculer l'état
                faqItem.classList.toggle('active');
            }
        }
    });
    // Structure des catégories et des questions
    const faqCategories = [
        { id: 'terminology', name: 'Système de terminologie' },
        { id: 'conversion', name: 'Conversion HL7 vers FHIR' },
        { id: 'ai-integration', name: 'Intégration IA' },
        { id: 'auth-security', name: 'Authentification et sécurité' },
        { id: 'database', name: 'Base de données' },
        { id: 'ui', name: 'Interface utilisateur' },
        { id: 'architecture', name: 'Architecture système' },
        { id: 'api', name: 'API et intégration' },
        { id: 'errors-logging', name: 'Erreurs et logging' },
        { id: 'performance', name: 'Performance' },
        { id: 'internationalization', name: 'Internationalisation' }
    ];

    // Éléments DOM
    const categoryList = document.querySelector('.nav-items-container');
    // Éléments de recherche désactivés pour éviter les problèmes de performance
    // const faqSearch = document.getElementById('faqSearch');
    // const searchButton = document.getElementById('searchButton');
    
    // Configurer les gestionnaires d'événements pour la navigation
    function generateCategoryNav() {
        // Au lieu de générer le menu, utiliser les éléments existants et ajouter dataset
        categoryList.querySelectorAll('a.nav-item').forEach(link => {
            // Extraire l'ID de la catégorie à partir du href
            const categoryId = link.getAttribute('href').substring(1);
            link.dataset.category = categoryId;
            
            // Ajouter le gestionnaire d'événements pour le clic
            link.addEventListener('click', function(e) {
                // Activer le lien cliqué
                categoryList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }
    
    // Fonction pour obtenir l'icône appropriée pour chaque catégorie
    function getCategoryIcon(categoryId) {
        const icons = {
            'terminology': 'fas fa-language',
            'conversion': 'fas fa-exchange-alt',
            'ai-integration': 'fas fa-robot',
            'auth-security': 'fas fa-shield-alt',
            'database': 'fas fa-database',
            'ui': 'fas fa-desktop',
            'architecture': 'fas fa-cubes',
            'api': 'fas fa-plug',
            'errors-logging': 'fas fa-exclamation-triangle',
            'performance': 'fas fa-tachometer-alt',
            'internationalization': 'fas fa-globe'
        };
        
        return icons[categoryId] || 'fas fa-question-circle';
    }
    
    // Fonction supprimée : generateTableOfContents
    
    // Configurer les interactions des FAQ items - Approche simplifiée
    function setupFAQInteractions() {
        // Solution simple et directe avec jQuery pour garantir que les clics fonctionnent
        let script = document.createElement('script');
        script.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
        script.onload = function() {
            console.log('jQuery chargé pour simplicité');
            
            // Solution simple et robuste avec jQuery
            $('.faq-item h3').off('click').on('click', function() {
                let parent = $(this).parent();
                
                // Si on ouvre cette FAQ, fermer les autres
                if (!parent.hasClass('active')) {
                    parent.siblings('.faq-item.active').removeClass('active');
                }
                
                // Toggle l'état de cette FAQ
                parent.toggleClass('active');
                return false; // Empêcher la propagation
            });
            
            // Pour les petits écrans et appareils tactiles
            $('.faq-item').off('click').on('click', function(e) {
                if (e.target === this || $(e.target).closest('h3').length > 0) {
                    let parent = $(this);
                    
                    // Si on ouvre cette FAQ, fermer les autres
                    if (!parent.hasClass('active')) {
                        parent.siblings('.faq-item.active').removeClass('active');
                    }
                    
                    // Toggle l'état de cette FAQ
                    parent.toggleClass('active');
                }
            });
            
            // Fallback sans jQuery si nécessaire
            if (!window.jQuery) {
                console.log('Fallback sans jQuery');
                document.querySelectorAll('.faq-item h3').forEach(function(header) {
                    header.addEventListener('click', function(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        
                        var parent = this.parentElement;
                        var isActive = parent.classList.contains('active');
                        
                        // Fermer les autres éléments ouverts
                        if (!isActive) {
                            document.querySelectorAll('.faq-item.active').forEach(function(item) {
                                if (item !== parent) {
                                    item.classList.remove('active');
                                }
                            });
                        }
                        
                        // Toggle l'état de cette FAQ
                        parent.classList.toggle('active');
                        return false;
                    });
                });
            }
        };
        document.head.appendChild(script);
    }
    
    // Fonction supprimée : setupTOCToggle
    
    // Fonction de recherche
    function setupSearch() {
        function performSearch() {
            const query = faqSearch.value.trim().toLowerCase();
            
            if (!query) {
                // Réinitialiser l'affichage si la recherche est vide
                document.querySelectorAll('.faq-item').forEach(item => {
                    item.style.display = '';
                    item.classList.remove('active');
                    
                    // Supprimer les surlignages précédents
                    const content = item.innerHTML;
                    item.innerHTML = content.replace(/<mark class="highlight(.*?)?">|<\/mark>/g, '');
                });
                return;
            }
            
            let foundResults = false;
            
            // Parcourir tous les éléments FAQ
            document.querySelectorAll('.faq-item').forEach(item => {
                const question = item.querySelector('h3').textContent.toLowerCase();
                const answer = item.querySelector('.faq-answer').textContent.toLowerCase();
                const matches = question.includes(query) || answer.includes(query);
                
                if (matches) {
                    item.style.display = '';
                    item.classList.add('active');
                    foundResults = true;
                    
                    // Surligner les occurrences
                    highlightText(item, query);
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Afficher un message si aucun résultat
            const noResultsEl = document.getElementById('noResults');
            if (!foundResults) {
                if (!noResultsEl) {
                    const message = document.createElement('div');
                    message.id = 'noResults';
                    message.className = 'no-results';
                    message.innerHTML = `<p>Aucun résultat trouvé pour <strong>"${query}"</strong>.</p>`;
                    document.querySelector('.faq-container').prepend(message);
                }
            } else if (noResultsEl) {
                noResultsEl.remove();
            }
        }
        
        // Surligner le texte correspondant à la recherche
        function highlightText(element, query) {
            // Enlever les surlignages précédents
            const content = element.innerHTML;
            element.innerHTML = content.replace(/<mark class="highlight(.*?)?">|<\/mark>/g, '');
            
            // Créer une expression régulière pour la recherche insensible à la casse
            const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
            
            // Fonction pour surligner le texte dans un nœud de texte
            function highlightInTextNode(textNode) {
                const parent = textNode.parentNode;
                
                // Sauter les noeuds dans les balises pre/code
                if (parent.tagName === 'CODE' || parent.tagName === 'PRE') {
                    return;
                }
                
                const content = textNode.nodeValue;
                if (regex.test(content)) {
                    const fragment = document.createDocumentFragment();
                    let match;
                    let lastIndex = 0;
                    regex.lastIndex = 0;
                    
                    while ((match = regex.exec(content)) !== null) {
                        // Ajouter le texte avant le match
                        if (match.index > lastIndex) {
                            fragment.appendChild(document.createTextNode(content.substring(lastIndex, match.index)));
                        }
                        
                        // Ajouter le texte surligné
                        const mark = document.createElement('mark');
                        mark.className = 'highlight highlight-pulse';
                        mark.appendChild(document.createTextNode(match[0]));
                        fragment.appendChild(mark);
                        
                        lastIndex = regex.lastIndex;
                    }
                    
                    // Ajouter le reste du texte
                    if (lastIndex < content.length) {
                        fragment.appendChild(document.createTextNode(content.substring(lastIndex)));
                    }
                    
                    parent.replaceChild(fragment, textNode);
                    return true;
                }
                return false;
            }
            
            // Fonction récursive pour parcourir tous les noeuds
            function walkTextNodes(node) {
                if (node.nodeType === 3) { // Noeud texte
                    return highlightInTextNode(node);
                } else if (node.nodeType === 1 && node.childNodes && 
                           !/(script|style|textarea)/i.test(node.tagName)) {
                    let hasHighlight = false;
                    for (let i = 0; i < node.childNodes.length; i++) {
                        const childNode = node.childNodes[i];
                        if (walkTextNodes(childNode)) {
                            hasHighlight = true;
                            // Ajuster l'index pour tenir compte des modifications dans le DOM
                            i += childNode.childNodes ? childNode.childNodes.length - 1 : 0;
                        }
                    }
                    return hasHighlight;
                }
                return false;
            }
            
            // Parcourir et surligner
            walkTextNodes(element);
        }
        
        // Écouter l'événement de recherche
        searchButton.addEventListener('click', performSearch);
        faqSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // Fonction pour gérer le bouton retour en haut de page
    function setupBackToTop() {
        const backToTopButton = document.getElementById('back-to-top');
        if (backToTopButton) {
            // Afficher le bouton quand on descend
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) {
                    backToTopButton.classList.add('visible');
                } else {
                    backToTopButton.classList.remove('visible');
                }
            });
            
            // Revenir en haut lors du clic
            backToTopButton.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    }
    
    // Fonction pour naviguer vers une FAQ spécifique si l'URL contient un hash
    function navigateToHash() {
        if (window.location.hash) {
            const id = window.location.hash.substring(1);
            const targetElement = document.getElementById(id);
            
            if (targetElement) {
                // Si c'est un en-tête de question, ouvrir la FAQ correspondante
                if (targetElement.tagName === 'H3') {
                    const faqItem = targetElement.closest('.faq-item');
                    if (faqItem) {
                        faqItem.classList.add('active');
                    }
                }
                
                // Activer la catégorie correspondante
                const section = targetElement.closest('.faq-section');
                if (section) {
                    const sectionId = section.id;
                    categoryList.querySelectorAll('a').forEach(a => {
                        if (a.dataset.category === sectionId) {
                            a.classList.add('active');
                        }
                    });
                }
                
                // Faire défiler jusqu'à l'élément après un court délai
                setTimeout(() => {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        } else {
            // Si pas de hash, activer la première catégorie par défaut
            const firstCategoryLink = categoryList.querySelector('a');
            if (firstCategoryLink) {
                firstCategoryLink.classList.add('active');
            }
        }
    }
    
    // Initialiser tous les composants
    function init() {
        generateCategoryNav();
        setupFAQInteractions();
        // setupSearch() est désactivé car les éléments de recherche sont commentés
        setupBackToTop();
        
        // Naviguer vers le hash après que tout soit initialisé
        setTimeout(navigateToHash, 100);
        
        // Écouter les changements de hash pour la navigation
        window.addEventListener('hashchange', navigateToHash);
        
        console.log('FAQ technique initialisée avec succès');
    }
    
    // Démarrer l'initialisation
    init();
});