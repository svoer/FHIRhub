/**
 * Utilitaire d'extraction des noms français à partir de messages HL7
 * Gère les spécificités des noms composés français dans les segments PID
 */

/**
 * Extraire les noms français à partir d'un message HL7
 * @param {string} hl7Message - Message HL7 à analyser
 * @returns {Array<Object>} Liste de noms structurés selon FHIR
 */
function extractFrenchNames(hl7Message) {
  console.log('[FRENCH_NAME_EXTRACTOR] Tentative d\'extraction des noms français');
  const names = [];
  
  try {
    // Diviser le message en segments
    const segments = hl7Message.split('\n');
    
    // Rechercher le segment PID
    const pidSegment = segments.find(segment => segment.trim().startsWith('PID|'));
    
    if (!pidSegment) {
      console.log('[FRENCH_NAME_EXTRACTOR] Segment PID non trouvé');
      return names;
    }
    
    // Diviser le segment PID en champs
    const pidFields = pidSegment.split('|');
    
    // Vérifier si le champ de nom existe (position 5)
    if (pidFields.length < 6 || !pidFields[5]) {
      console.log('[FRENCH_NAME_EXTRACTOR] Champ nom non trouvé dans le segment PID');
      return names;
    }
    
    // Analyser les composants du nom (peuvent être plusieurs, séparés par ~)
    const nameComponents = pidFields[5].split('~');
    
    for (const nameComponent of nameComponents) {
      // Diviser les sous-composants du nom (séparés par ^)
      const nameParts = nameComponent.split('^');
      
      // Vérifier si nous avons au moins un nom de famille
      if (nameParts.length > 0 && nameParts[0]) {
        // Extraire les informations de nom
        const familyName = nameParts[0];
        const firstName = nameParts.length > 1 ? nameParts[1] : '';
        const middleName = nameParts.length > 2 ? nameParts[2] : '';
        const nameType = nameParts.length > 6 ? nameParts[6] : '';
        
        // Créer l'objet de nom au format FHIR
        const nameObject = {
          family: familyName,
          use: nameType === 'D' ? 'maiden' : 'official'
        };
        
        // Traitement spécial pour les prénoms composés français
        const givenNames = [];
        
        if (firstName) {
          givenNames.push(firstName);
        }
        
        // Si le champ middleName contient des prénoms composés (détection avec espaces)
        if (middleName && middleName.includes(' ')) {
          // C'est probablement un prénom composé français (ex: "JEAN PIERRE MARIE")
          // Le diviser en prénoms individuels
          const composedNames = middleName.split(' ').filter(name => name.trim());
          console.log(`[FRENCH_NAME_EXTRACTOR] Prénom composé détecté: ${middleName}`);
          console.log(`[FRENCH_NAME_EXTRACTOR] Prénoms extraits: ${composedNames.join(', ')}`);
          
          // Ajouter chaque prénom individuellement
          composedNames.forEach(name => {
            if (!givenNames.includes(name)) {
              givenNames.push(name);
            }
          });
        } else if (middleName) {
          // Simple second prénom
          givenNames.push(middleName);
        }
        
        // Ajouter les prénoms à l'objet de nom
        if (givenNames.length > 0) {
          nameObject.given = givenNames;
        }
        
        // Ajouter le nom structuré à la liste
        names.push(nameObject);
        
        console.log(`[FRENCH_NAME_EXTRACTOR] Nom extrait: ${familyName}, ${givenNames.join(' ')}`);
      }
    }
    
    console.log(`[FRENCH_NAME_EXTRACTOR] Total de noms extraits: ${names.length}`);
    return names;
  } catch (error) {
    console.error('[FRENCH_NAME_EXTRACTOR] Erreur lors de l\'extraction des noms:', error);
    return names;
  }
}

module.exports = {
  extractFrenchNames
};