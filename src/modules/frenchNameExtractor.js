/**
 * Module d'extraction des noms français depuis les messages HL7
 * Spécialisé dans le traitement des prénoms composés français
 * 
 * @module frenchNameExtractor
 * @author FHIRHub Team
 */

/**
 * Extraire correctement les noms français à partir d'un segment PID HL7
 * @param {string} hl7Message - Message HL7 complet
 * @returns {Array|null} Tableau d'objets nom FHIR avec prénoms correctement extraits ou null en cas d'erreur
 */
function extractFrenchNames(hl7Message) {
  try {
    if (!hl7Message || typeof hl7Message !== 'string') {
      console.log("[FRENCH_NAME_EXTRACTOR] Message HL7 invalide");
      return null;
    }
    
    const lines = hl7Message.split(/[\r\n]+/);
    const pidLine = lines.find(line => line.startsWith('PID|'));
    
    if (!pidLine) {
      console.log("[FRENCH_NAME_EXTRACTOR] Segment PID non trouvé");
      return null;
    }
    
    console.log("[FRENCH_NAME_EXTRACTOR] Segment PID trouvé");
    const pidFields = pidLine.split('|');
    
    if (pidFields.length < 6) {
      console.log("[FRENCH_NAME_EXTRACTOR] Segment PID incomplet");
      return null;
    }
    
    const nameField = pidFields[5]; // PID-5 est à l'index 5 car les séparateurs | sont comptés
    if (!nameField) {
      console.log("[FRENCH_NAME_EXTRACTOR] Champ nom manquant");
      return null;
    }
    
    console.log(`[FRENCH_NAME_EXTRACTOR] Champ PID-5 brut: "${nameField}"`);
    
    // Extraire tous les noms (peut contenir plusieurs répétitions séparées par ~)
    const nameValues = nameField.split('~');
    console.log(`[FRENCH_NAME_EXTRACTOR] ${nameValues.length} valeurs de nom trouvées`);
    
    // RECHERCHE SPÉCIFIQUE DU NOM AVEC TYPE "L" (légal) QUI CONTIENT LES PRÉNOMS COMPOSÉS
    // Correction: vérifier toutes les valeurs et pas juste la première
    const legalNameValue = nameValues.find(val => val.includes('^') && val.endsWith('L'));
    
    if (!legalNameValue) {
      console.log("[FRENCH_NAME_EXTRACTOR] Nom légal avec type L non trouvé");
      return null;
    }
    
    console.log(`[FRENCH_NAME_EXTRACTOR] Nom légal trouvé: "${legalNameValue}"`);
    const parts = legalNameValue.split('^');
    
    // Récupérer les informations du nom légal
    const family = parts[0]?.trim() || '';
    const given1 = parts[1]?.trim() || '';
    const middleNames = parts[2]?.trim() || '';
    
    console.log(`[FRENCH_NAME_EXTRACTOR] Nom de famille: "${family}"`);
    console.log(`[FRENCH_NAME_EXTRACTOR] Prénom principal: "${given1}"`);
    console.log(`[FRENCH_NAME_EXTRACTOR] Prénoms composés: "${middleNames}"`);
    
    // Création de l'objet nom avec tous les prénoms extraits
    const fullNameObj = {
      family: family,
      given: [],
      use: 'official'
    };
    
    // Ajout du prénom principal
    if (given1) {
      fullNameObj.given.push(given1);
    }
    
    // Ajout des prénoms composés séparés par espaces
    if (middleNames) {
      const additionalNames = middleNames.split(' ');
      additionalNames.forEach(name => {
        if (name.trim() && !fullNameObj.given.includes(name.trim())) {
          fullNameObj.given.push(name.trim());
        }
      });
    }
    
    // Ajout du préfixe si présent
    if (parts.length > 4 && parts[4]?.trim()) {
      fullNameObj.prefix = [parts[4].trim()];
    }
    
    // Si nous avons extrait des prénoms, retourner l'objet nom
    if (fullNameObj.given.length > 0) {
      console.log(`[FRENCH_NAME_EXTRACTOR] Nom complet créé avec ${fullNameObj.given.length} prénoms:`, fullNameObj);
      return [fullNameObj];
    }
    
    return null;
  } catch (error) {
    console.error("[FRENCH_NAME_EXTRACTOR] Erreur lors de l'extraction des noms français:", error);
    return null;
  }
}

module.exports = {
  extractFrenchNames
};