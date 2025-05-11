/**
 * Module de conversion HL7 vers FHIR
 * 
 * Ce module fait le lien entre l'ancien convertisseur et la nouvelle architecture
 * Il permet une transition en douceur tout en conservant la compatibilité arrière
 */

const advancedConverter = require('../../hl7ToFhirAdvancedConverter');
const frenchTerminology = require('../terminology/FrenchTerminologyAdapter');

/**
 * Convertit un message HL7 en Bundle FHIR
 * @param {string} hl7Message - Message HL7 au format texte
 * @param {object} options - Options de conversion (optionnel)
 * @returns {Object} Bundle FHIR au format R4
 */
function convertHL7ToFHIR(hl7Message, options = {}) {
  console.log("[CONVERTER] Démarrage de la conversion HL7 vers FHIR");
  
  // Pour l'instant, nous déléguons simplement à l'implémentation existante
  // Mais cette structure nous permettra de migrer progressivement vers la nouvelle approche
  try {
    if (!hl7Message) {
      throw new Error("Le message HL7 est requis");
    }
    
    return advancedConverter.convertHL7ToFHIR(hl7Message, options);
  } catch (error) {
    console.error("[CONVERTER] Erreur lors de la conversion:", error);
    throw error;
  }
}

/**
 * Obtient la version de l'adaptateur de terminologie française
 * @returns {string} Version de l'adaptateur
 */
function getTerminologyVersion() {
  return frenchTerminology.getVersion();
}

/**
 * Recharge les mappings de terminologie française
 * @param {string} filePath - Chemin du fichier de mappings (optionnel)
 * @returns {boolean} Réussite du rechargement
 */
function reloadTerminology(filePath) {
  return frenchTerminology.reloadMappings(filePath);
}

module.exports = {
  convertHL7ToFHIR,
  getTerminologyVersion,
  reloadTerminology
};