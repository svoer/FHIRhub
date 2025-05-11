/**
 * Module de nettoyage des ressources FHIR
 * Optimise les ressources FHIR pour éviter les erreurs de validation et les rejets
 * en supprimant les données vides, redondantes ou non significatives
 * 
 * Ce module implémente les bonnes pratiques de la spécification FHIR R4
 * pour assurer une meilleure interopérabilité avec les systèmes de santé français
 */

/**
 * Vérifie si un objet est vide ou ne contient que des propriétés vides
 * @param {Object} obj - Objet à vérifier
 * @param {Array} significantProps - Liste des propriétés considérées comme significatives
 * @returns {boolean} True si l'objet est vide ou non significatif
 */
function isEmptyObject(obj, significantProps = []) {
  // Si null ou undefined
  if (!obj) return true;
  
  // Si ce n'est pas un objet
  if (typeof obj !== 'object') return false;
  
  // Si c'est un tableau vide
  if (Array.isArray(obj) && obj.length === 0) return true;
  
  // Si c'est un objet, vérifier s'il contient des propriétés significatives
  if (!Array.isArray(obj)) {
    // Si aucune propriété significative n'est spécifiée, vérifier toutes les propriétés
    if (significantProps.length === 0) {
      return Object.keys(obj).length === 0 || 
             Object.keys(obj).every(key => isEmptyObject(obj[key]));
    }
    
    // Sinon, vérifier uniquement les propriétés significatives
    return significantProps.every(prop => {
      return !obj.hasOwnProperty(prop) || 
             obj[prop] === "" || 
             obj[prop] === null || 
             obj[prop] === undefined ||
             isEmptyObject(obj[prop]);
    });
  }
  
  // Pour un tableau non vide, vérifier chaque élément
  return obj.every(item => isEmptyObject(item, significantProps));
}

/**
 * Supprime les adresses vides ou incomplètes d'une ressource FHIR
 * @param {Object} resource - Ressource FHIR à nettoyer
 */
function cleanAddresses(resource) {
  if (!resource || !resource.address || !Array.isArray(resource.address)) return;

  // Propriétés significatives pour une adresse, en ordre de priorité
  const significantProps = ['line', 'city', 'district', 'state', 'postalCode'];
  
  // Filtrer les adresses trop vides
  resource.address = resource.address.filter(addr => {
    // Une adresse est conservée si:
    // 1. Au moins une propriété significative est présente avec du contenu (non vide)
    const hasSignificantContent = significantProps.some(prop => {
      if (prop === 'line') {
        return addr.line && Array.isArray(addr.line) && addr.line.some(line => line && line.trim() !== "");
      } else {
        return addr[prop] && addr[prop].trim() !== "";
      }
    });
    
    // 2. OU si elle a un pays spécifié différent de UNK ET un usage spécifié
    const hasSpecificCountry = addr.country && addr.country.trim() !== "" && addr.country !== "UNK";
    const hasUse = addr.use && addr.use.trim() !== "";
    
    // Conserver l'adresse si elle contient des informations utiles
    return hasSignificantContent || (hasSpecificCountry && hasUse);
  });
  
  // Nettoyer les propriétés vides dans chaque adresse conservée
  resource.address.forEach(addr => {
    // Nettoyer les lignes vides
    if (addr.line && Array.isArray(addr.line)) {
      addr.line = addr.line.filter(line => line && line.trim() !== "");
      if (addr.line.length === 0) delete addr.line;
    }
    
    // Supprimer les propriétés textuelles vides
    ['city', 'district', 'state', 'postalCode'].forEach(prop => {
      if (addr[prop] === "" || addr[prop] === null || addr[prop] === undefined) {
        delete addr[prop];
      }
    });
    
    // Si country="UNK" et c'est la seule propriété significative, on peut la garder
    // mais on s'assure qu'elle est correctement formatée
    if (addr.country === "UNK" && 
        !addr.line && !addr.city && !addr.district && !addr.state && !addr.postalCode) {
      // On garde UNK pour indiquer explicitement un pays inconnu
    }
  });
  
  // Supprimer le tableau d'adresses s'il est vide
  if (resource.address.length === 0) {
    delete resource.address;
  }
}

/**
 * Supprime les contacts/télécoms vides d'une ressource FHIR
 * @param {Object} resource - Ressource FHIR à nettoyer
 */
function cleanTelecoms(resource) {
  if (!resource || !resource.telecom || !Array.isArray(resource.telecom)) return;
  
  // Filtrer les télécoms sans valeur
  resource.telecom = resource.telecom.filter(telecom => {
    return telecom && telecom.value && telecom.value.trim() !== "";
  });
  
  // Supprimer le tableau telecom s'il est vide
  if (resource.telecom.length === 0) {
    delete resource.telecom;
  }
}

/**
 * Supprime les identifiants vides ou incomplets d'une ressource FHIR
 * @param {Object} resource - Ressource FHIR à nettoyer
 */
function cleanIdentifiers(resource) {
  if (!resource || !resource.identifier || !Array.isArray(resource.identifier)) return;
  
  // Filtrer les identifiants sans valeur
  resource.identifier = resource.identifier.filter(identifier => {
    return identifier && identifier.value && identifier.value.trim() !== "";
  });
  
  // Supprimer le tableau identifier s'il est vide
  if (resource.identifier.length === 0) {
    delete resource.identifier;
  }
}

/**
 * Supprime les noms vides ou incomplets d'une ressource FHIR
 * @param {Object} resource - Ressource FHIR à nettoyer
 */
function cleanNames(resource) {
  if (!resource || !resource.name || !Array.isArray(resource.name)) return;
  
  // Filtrer les noms qui n'ont ni family ni given
  resource.name = resource.name.filter(name => {
    const hasFamily = name.family && name.family.trim() !== "";
    const hasGiven = name.given && Array.isArray(name.given) && 
                    name.given.length > 0 && 
                    name.given.some(g => g && g.trim() !== "");
    
    return hasFamily || hasGiven;
  });
  
  // Pour chaque nom, nettoyer les tableaux given vides
  resource.name.forEach(name => {
    if (name.given && Array.isArray(name.given)) {
      name.given = name.given.filter(given => given && given.trim() !== "");
      if (name.given.length === 0) delete name.given;
    }
    
    // Nettoyer les préfixes vides
    if (name.prefix && Array.isArray(name.prefix)) {
      name.prefix = name.prefix.filter(prefix => prefix && prefix.trim() !== "");
      if (name.prefix.length === 0) delete name.prefix;
    }
    
    // Nettoyer les suffixes vides
    if (name.suffix && Array.isArray(name.suffix)) {
      name.suffix = name.suffix.filter(suffix => suffix && suffix.trim() !== "");
      if (name.suffix.length === 0) delete name.suffix;
    }
  });
  
  // Supprimer le tableau name s'il est vide
  if (resource.name.length === 0) {
    delete resource.name;
  }
}

/**
 * Supprime les extensions vides d'une ressource FHIR
 * @param {Object} resource - Ressource FHIR à nettoyer
 */
function cleanExtensions(resource) {
  if (!resource) return;
  
  // Traiter les extensions au niveau racine
  if (resource.extension && Array.isArray(resource.extension)) {
    resource.extension = resource.extension.filter(ext => {
      return ext && ext.url && (
        ext.hasOwnProperty('valueString') || 
        ext.hasOwnProperty('valueCode') || 
        ext.hasOwnProperty('valueBoolean') ||
        ext.hasOwnProperty('valueInteger') ||
        ext.hasOwnProperty('valueDateTime') ||
        ext.hasOwnProperty('valueQuantity') ||
        ext.hasOwnProperty('valueReference')
      );
    });
    
    if (resource.extension.length === 0) {
      delete resource.extension;
    }
  }
  
  // Parcourir toutes les propriétés pour traiter les extensions imbriquées
  if (typeof resource === 'object' && !Array.isArray(resource)) {
    for (const key in resource) {
      if (resource.hasOwnProperty(key)) {
        const value = resource[key];
        
        // Si la propriété est un objet ou un tableau, appliquer récursivement
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(item => {
              if (typeof item === 'object' && item !== null) {
                cleanExtensions(item);
              }
            });
          } else {
            cleanExtensions(value);
          }
        }
      }
    }
  }
}

/**
 * Supprime les codages vides d'une ressource FHIR
 * @param {Object} resource - Ressource FHIR à nettoyer
 */
function cleanCodings(resource) {
  if (!resource) return;
  
  // Fonction récursive pour traiter les codages
  const processCodings = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    
    // Si c'est un tableau coding
    if (obj.coding && Array.isArray(obj.coding)) {
      obj.coding = obj.coding.filter(coding => {
        return coding && coding.system && coding.code;
      });
      
      if (obj.coding.length === 0) {
        delete obj.coding;
      }
    }
    
    // Traiter récursivement toutes les propriétés
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (item && typeof item === 'object') {
          processCodings(item);
        }
      });
    } else {
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] && typeof obj[key] === 'object') {
          processCodings(obj[key]);
        }
      }
    }
  };
  
  processCodings(resource);
}

/**
 * Supprime les références relatives vides
 * @param {Object} resource - Ressource FHIR à nettoyer
 */
function cleanReferences(resource) {
  if (!resource) return;
  
  // Fonction récursive pour traiter les références
  const processReferences = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    
    // Si c'est un objet reference
    if (obj.reference !== undefined) {
      if (!obj.reference || obj.reference.trim() === "") {
        delete obj.reference;
      }
    }
    
    // Traiter récursivement toutes les propriétés
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (item && typeof item === 'object') {
          processReferences(item);
        }
      });
    } else {
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] && typeof obj[key] === 'object') {
          processReferences(obj[key]);
        }
      }
    }
  };
  
  processReferences(resource);
}

/**
 * Nettoie les tableaux vides dans toute la ressource
 * @param {Object} resource - Ressource FHIR à nettoyer
 */
function cleanEmptyArrays(resource) {
  if (!resource || typeof resource !== 'object') return;
  
  // Fonction récursive pour traiter les tableaux vides
  const processEmptyArrays = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    
    // Traiter les propriétés de l'objet
    if (!Array.isArray(obj)) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          // Si c'est un tableau vide, le supprimer
          if (Array.isArray(value) && value.length === 0) {
            delete obj[key];
          }
          // Si c'est un objet ou un tableau non vide, traiter récursivement
          else if (typeof value === 'object' && value !== null) {
            processEmptyArrays(value);
          }
        }
      }
    }
    // Si c'est un tableau, traiter chaque élément
    else {
      obj.forEach(item => {
        if (item && typeof item === 'object') {
          processEmptyArrays(item);
        }
      });
    }
  };
  
  processEmptyArrays(resource);
}

/**
 * Nettoie les qualifications trop génériques d'une ressource FHIR
 * @param {Object} resource - Ressource FHIR à nettoyer
 */
function cleanQualifications(resource) {
  if (!resource || !resource.qualification || !Array.isArray(resource.qualification)) return;
  
  // Filtrer les qualifications non significatives
  resource.qualification = resource.qualification.filter(qual => {
    // Si pas de code, supprimer
    if (!qual.code) return false;
    
    // Si code.coding est vide, supprimer
    if (!qual.code.coding || !Array.isArray(qual.code.coding) || qual.code.coding.length === 0) return false;
    
    // Vérifier si au moins un coding a un code et un système significatifs
    const hasSignificantCoding = qual.code.coding.some(coding => {
      // Les codes génériques ou par défaut à filtrer
      const genericCodes = ['ODRP', 'UNK', 'Unknown', 'undefined', 'OTHER'];
      const genericDisplays = ['Unknown Qualification', 'Non spécifié', 'Autre'];
      
      // Conserver si le code n'est pas dans la liste des génériques
      const isGenericCode = genericCodes.includes(coding.code);
      const isGenericDisplay = genericDisplays.some(genDisp => 
        coding.display && coding.display.includes(genDisp)
      );
      
      // Les qualifications doivent avoir un code spécifique (non générique)
      return coding.system && coding.code && !isGenericCode && !isGenericDisplay;
    });
    
    // Soit tous les codings sont trop génériques, mais c'est le seul que nous avons (on garde alors)
    // soit on a un coding significatif
    return hasSignificantCoding || (qual.code.text && qual.code.text.trim() !== "");
  });
  
  // Pour les qualifications conservées, nettoyer les codings non significatifs
  resource.qualification.forEach(qual => {
    if (qual.code && qual.code.coding && Array.isArray(qual.code.coding)) {
      const genericCodes = ['ODRP', 'UNK', 'Unknown', 'undefined', 'OTHER'];
      
      // Garder seulement les codings significatifs, sauf s'il n'y en a qu'un seul
      if (qual.code.coding.length > 1) {
        qual.code.coding = qual.code.coding.filter(coding => 
          coding.code && !genericCodes.includes(coding.code)
        );
      }
    }
  });
  
  // Supprimer le tableau qualification s'il est vide
  if (resource.qualification.length === 0) {
    delete resource.qualification;
  }
}

/**
 * Nettoie une ressource FHIR complète
 * @param {Object} resource - Ressource FHIR à nettoyer
 * @returns {Object} Ressource FHIR nettoyée
 */
function cleanResource(resource) {
  if (!resource) return resource;
  
  console.log(`[CLEANER] Nettoyage de la ressource ${resource.resourceType || 'inconnue'}`);
  
  // Appliquer tous les nettoyages spécifiques
  cleanAddresses(resource);
  cleanTelecoms(resource);
  cleanIdentifiers(resource);
  cleanNames(resource);
  cleanExtensions(resource);
  cleanCodings(resource);
  cleanReferences(resource);
  cleanQualifications(resource);
  cleanEmptyArrays(resource);
  
  return resource;
}

/**
 * Nettoie un bundle FHIR complet
 * @param {Object} bundle - Bundle FHIR à nettoyer
 * @returns {Object} Bundle FHIR nettoyé
 */
function cleanBundle(bundle) {
  if (!bundle || !bundle.entry || !Array.isArray(bundle.entry)) {
    return bundle;
  }
  
  console.log(`[CLEANER] Début du nettoyage du bundle FHIR (${bundle.entry.length} ressources)`);
  
  // Nettoyer chaque ressource du bundle
  for (let i = 0; i < bundle.entry.length; i++) {
    const entry = bundle.entry[i];
    if (entry && entry.resource) {
      entry.resource = cleanResource(entry.resource);
    }
  }
  
  // Filtrer les entrées vides (où la ressource a été complètement nettoyée)
  bundle.entry = bundle.entry.filter(entry => entry && entry.resource && Object.keys(entry.resource).length > 0);
  
  console.log(`[CLEANER] Fin du nettoyage: ${bundle.entry.length} ressources conservées`);
  
  return bundle;
}

module.exports = {
  cleanBundle,
  cleanResource,
  isEmptyObject
};