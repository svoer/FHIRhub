/**
 * Module de correction des noms français dans les ressources FHIR
 * 
 * Ce module traite spécifiquement le problème des prénoms composés français
 * qui ne sont pas correctement gérés dans la conversion standard HL7 vers FHIR
 */

/**
 * Extrait les prénoms composés d'un message HL7
 * @param {string} hl7Content - Le message HL7 complet
 * @returns {Array} - Tableau des noms extraits avec leurs prénoms composés
 */
function extractFrenchNames(hl7Content) {
  try {
    console.log('[FRENCH_NAME_EXTRACTOR] Tentative d\'extraction des noms français');
    
    // Découper le message HL7 en segments
    const segments = hl7Content.split(/[\r\n]+/);
    
    // Chercher le segment PID
    const pidSegment = segments.find(seg => seg.startsWith('PID|'));
    
    if (!pidSegment) {
      console.log('[FRENCH_NAME_EXTRACTOR] Aucun segment PID trouvé');
      return [];
    }
    
    console.log('[FRENCH_NAME_EXTRACTOR] Segment PID trouvé');
    
    // Extraire le champ PID-5 (nom)
    const pidFields = pidSegment.split('|');
    if (pidFields.length < 6) {
      console.log('[FRENCH_NAME_EXTRACTOR] Champ PID-5 manquant');
      return [];
    }
    
    const nameField = pidFields[5];
    console.log(`[FRENCH_NAME_EXTRACTOR] Champ PID-5 brut: "${nameField}"`);
    
    if (!nameField) {
      console.log('[FRENCH_NAME_EXTRACTOR] Champ PID-5 vide');
      return [];
    }
    
    // Traiter les répétitions (plusieurs noms)
    const nameValues = nameField.split('~');
    console.log(`[FRENCH_NAME_EXTRACTOR] ${nameValues.length} valeurs de nom trouvées`);
    
    const names = [];
    
    // Chercher un nom légal (use=L)
    const legalNameValue = nameValues.find(val => val.includes('^^^^L'));
    
    if (legalNameValue) {
      console.log(`[FRENCH_NAME_EXTRACTOR] Nom légal trouvé: "${legalNameValue}"`);
      
      // Extraire les composants du nom
      const nameParts = legalNameValue.split('^');
      
      // Le format attendu est: family^given1^given2^given3^...
      const family = nameParts[0];
      console.log(`[FRENCH_NAME_EXTRACTOR] Nom de famille: "${family}"`);
      
      let given = [];
      let compositeGiven = null;
      
      // Premier prénom standard
      if (nameParts.length > 1 && nameParts[1]) {
        console.log(`[FRENCH_NAME_EXTRACTOR] Prénom principal: "${nameParts[1]}"`);
        given.push(nameParts[1]);
      }
      
      // Traitement spécial pour les prénoms composés français
      // Ils sont souvent mis dans le champ des prénoms supplémentaires
      if (nameParts.length > 2 && nameParts[2]) {
        // Vérifier si c'est un prénom composé (contient des espaces)
        if (nameParts[2].includes(' ')) {
          console.log(`[FRENCH_NAME_EXTRACTOR] Prénoms composés: "${nameParts[2]}"`);
          compositeGiven = nameParts[2];
          
          // Diviser le prénom composé en parties individuelles
          const compositeParts = nameParts[2].split(' ');
          
          // Si le premier prénom est déjà inclus, ne pas le dupliquer
          if (given.length > 0 && compositeParts[0] === given[0]) {
            // Ajouter seulement les prénoms supplémentaires
            given = [...given, ...compositeParts.slice(1)];
          } else {
            // Ajouter tous les prénoms
            given = [...given, ...compositeParts];
          }
        } else if (nameParts[2] !== given[0]) {
          // Simple deuxième prénom
          given.push(nameParts[2]);
        }
      }
      
      // Créer l'objet nom FHIR
      const name = {
        family: family,
        given: given,
        use: 'official'
      };
      
      console.log(`[FRENCH_NAME_EXTRACTOR] Nom complet créé avec ${given.length} prénoms:`, name);
      
      // Ajouter l'information sur les prénoms composés pour traitement ultérieur
      if (compositeGiven) {
        name._compositeGiven = compositeGiven;
      }
      
      names.push(name);
    }
    
    return names;
  } catch (error) {
    console.error('[FRENCH_NAME_EXTRACTOR] Erreur lors de l\'extraction des noms:', error);
    return [];
  }
}

/**
 * Applique le correctif des noms français aux ressources FHIR
 * @param {Object} conversionResult - Résultat de la conversion HL7 vers FHIR
 * @param {string} hl7Content - Contenu du message HL7 original
 * @returns {Object} - Résultat de conversion avec noms corrigés
 */
function applyFrenchNamesFix(conversionResult, hl7Content) {
  try {
    // Si la conversion a échoué, retourner le résultat sans modifications
    if (!conversionResult.success || !conversionResult.fhirData) {
      return conversionResult;
    }
    
    // Extraire les noms français du message HL7
    const frenchNames = extractFrenchNames(hl7Content);
    
    if (frenchNames.length === 0) {
      // Pas de noms français trouvés, retourner le résultat sans modifications
      return conversionResult;
    }
    
    // Créer une copie profonde des données FHIR
    const fhirData = JSON.parse(JSON.stringify(conversionResult.fhirData));
    
    // Trouver les ressources Patient
    if (fhirData.entry && Array.isArray(fhirData.entry)) {
      fhirData.entry.forEach(entry => {
        if (entry.resource && entry.resource.resourceType === 'Patient') {
          // Appliquer les noms français
          entry.resource.name = frenchNames;
        }
      });
    }
    
    // Retourner le résultat avec les données FHIR corrigées
    return {
      ...conversionResult,
      fhirData
    };
  } catch (error) {
    console.error('[FRENCH_NAME_FIX] Erreur lors de l\'application du correctif des noms français:', error);
    return conversionResult;
  }
}

module.exports = applyFrenchNamesFix;