/**
 * Module de traitement des noms dans les ressources FHIR
 * Adapté aux spécificités françaises
 * 
 * @module fhirNameProcessor
 * @author FHIRHub Team
 */

const { extractFrenchNames } = require('../utils/frenchNameExtractor');
const { cleanBundle, cleanNames } = require('../utils/fhirCleaner');

/**
 * Applique le correctif des noms français au résultat de conversion FHIR
 * @param {Object} conversionResult - Résultat de la conversion HL7 vers FHIR
 * @param {string} hl7Message - Message HL7 original
 * @returns {Object} Résultat de conversion avec noms corrigés
 */
function processFhirNames(conversionResult, hl7Message) {
  try {
    console.log("[FHIR_NAME_PROCESSOR] Traitement des noms FHIR");
    
    // Si la conversion a échoué ou s'il n'y a pas de données FHIR, retourner le résultat tel quel
    if (!conversionResult || !conversionResult.success || !conversionResult.fhirData) {
      console.log("[FHIR_NAME_PROCESSOR] Conversion échouée ou pas de données FHIR");
      return conversionResult;
    }
    
    // Extraire correctement les noms français
    const frenchNames = extractFrenchNames(hl7Message);
    
    if (!frenchNames || frenchNames.length === 0) {
      console.log("[FHIR_NAME_PROCESSOR] Aucun nom français extrait");
      return conversionResult;
    }
    
    // Vérifier si le bundle a des entrées
    if (!conversionResult.fhirData.entry || !Array.isArray(conversionResult.fhirData.entry)) {
      console.log("[FHIR_NAME_PROCESSOR] Pas d'entrées dans le bundle FHIR");
      return conversionResult;
    }
    
    // Trouver l'entrée de type Patient
    const patientEntry = conversionResult.fhirData.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Patient');
    
    if (!patientEntry || !patientEntry.resource) {
      console.log("[FHIR_NAME_PROCESSOR] Ressource Patient non trouvée dans le bundle");
      return conversionResult;
    }
    
    // Récupérer la ressource Patient
    const patientResource = patientEntry.resource;
    
    // Vérifier si le patient a déjà des noms
    if (!patientResource.name) {
      patientResource.name = [];
    }
    
    // Filtrer les noms existants pour ne garder que ceux qui ont des prénoms non vides
    patientResource.name = patientResource.name.filter(n => {
      if (!n.given || !Array.isArray(n.given)) return false;
      // Ne garder que les noms avec au moins un prénom non vide
      return n.given.some(g => g && g.trim() !== '');
    });
    
    // Ajouter les noms français extraits au début du tableau des noms
    frenchNames.forEach(name => {
      // Vérifier si un nom identique existe déjà
      const isDuplicate = patientResource.name.some(n => 
        n.family === name.family && 
        n.use === name.use && 
        JSON.stringify(n.given) === JSON.stringify(name.given));
      
      if (!isDuplicate) {
        // Ajouter le nom en première position pour qu'il soit prioritaire
        patientResource.name.unshift(name);
        console.log("[FHIR_NAME_PROCESSOR] Nom français ajouté à la ressource Patient");
      } else {
        console.log("[FHIR_NAME_PROCESSOR] Nom français déjà présent dans la ressource Patient");
      }
    });
    
    // Mettre à jour la ressource Patient dans le bundle
    patientEntry.resource = patientResource;
    
    // Nettoyer le bundle FHIR pour supprimer les données vides ou non significatives
    conversionResult.fhirData = cleanBundle(conversionResult.fhirData);
    console.log("[FHIR_NAME_PROCESSOR] Nettoyage FHIR et traitement terminés avec succès");
    
    return conversionResult;
  } catch (error) {
    console.error("[FHIR_NAME_PROCESSOR] Erreur lors du traitement des noms:", error);
    return conversionResult; // Retourner le résultat original en cas d'erreur
  }
}

module.exports = {
  processFhirNames
};