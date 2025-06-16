/**
 * Correctif pour le problème de perte de focus dans les champs de saisie
 * Ce module résout le problème où l'utilisateur perd le focus lors de l'édition
 * des champs de texte, en particulier le champ de saisie HL7.
 * 
 * @module fieldFocusFix
 * @author FHIRHub Team
 */

/**
 * Applique le correctif pour les champs de saisie qui perdent le focus
 * @param {string[]} selectors - Sélecteurs CSS des éléments à corriger
 */
function applyFieldFocusFix(selectors) {
  console.log("Application du correctif pour les champs texte");
  
  let fixedCount = 0;
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    
    elements.forEach(element => {
      if (element && !element.dataset.focusFixed) {
        // Stocker la position du curseur avant tout événement
        element.addEventListener('keydown', function(e) {
          this.dataset.lastPos = this.selectionStart;
        });
        
        // Stocker la valeur actuelle avant les modifications
        element.addEventListener('input', function(e) {
          this.dataset.oldValue = this.value;
          this.dataset.lastPos = this.selectionStart;
        });
        
        // Restaurer le focus et la position du curseur après les mises à jour
        const originalSetValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        
        Object.defineProperty(element, 'value', {
          set: function(newValue) {
            const lastPos = parseInt(this.dataset.lastPos) || 0;
            
            originalSetValue.call(this, newValue);
            
            // Restaurer la position du curseur et le focus
            if (document.activeElement === this) {
              setTimeout(() => {
                this.setSelectionRange(lastPos, lastPos);
                this.focus();
              }, 0);
            }
          },
          get: function() {
            return this.value;
          }
        });
        
        // Marquer cet élément comme corrigé
        element.dataset.focusFixed = "true";
        fixedCount++;
      }
    });
  });
  
  console.log(`Correctif appliqué à ${fixedCount} champs de saisie`);
}

/**
 * Initialise le correctif de focus pour les champs texte
 */
function initFieldFocusFix() {
  // Liste des sélecteurs pour les champs à corriger
  const selectors = [
    'textarea#hl7Input',                // Champ de saisie HL7 principal
    'textarea.message-input',           // Champs de saisie dans l'interface de message
    'textarea.code-editor',             // Éditeurs de code
    'textarea.conversion-textarea'      // Autres zones de texte de conversion
  ];
  
  // Appliquer le correctif immédiatement
  applyFieldFocusFix(selectors);
  
  // Réappliquer le correctif à chaque fois que le DOM change
  // pour prendre en compte les éléments dynamiquement ajoutés
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        applyFieldFocusFix(selectors);
      }
    });
  });
  
  // Observer tout le document pour les changements
  observer.observe(document.body, { childList: true, subtree: true });
}

// Exécuter le correctif lorsque le DOM est chargé
document.addEventListener('DOMContentLoaded', initFieldFocusFix);

// Exposer la fonction pour permettre son utilisation directe
window.applyFieldFocusFix = applyFieldFocusFix;