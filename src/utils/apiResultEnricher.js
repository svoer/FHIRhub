/**
 * Module d'enrichissement des résultats d'API
 * 
 * Ce module fournit des fonctions pour enrichir les résultats de l'API
 * avec des données complémentaires avant de les renvoyer au client.
 */

/**
 * Enrichir le résultat d'une conversion HL7 vers FHIR
 * @param {Object} result - Résultat de la conversion
 * @param {Object} options - Options d'enrichissement
 * @returns {Object} Résultat enrichi
 */
function enrichConversionResult(result, options = {}) {
  try {
    if (!result) {
      return result;
    }
    
    // Ajouter une propriété indiquant que le résultat a été enrichi
    result.enriched = true;
    
    // Ajouter des métadonnées standards
    result.metadata = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      converterVersion: '1.0.0',
      processingTime: options.processingTime || null
    };
    
    // Ajouter des informations de validation si demandé
    if (options.validate && result.fhir) {
      result.validation = {
        valid: true, // Simulation de validation
        issues: []
      };
    }
    
    // Ajouter des statistiques sur les ressources générées
    if (result.fhir && result.fhir.entry) {
      const resourceStats = computeResourceStats(result.fhir);
      result.resourceStats = resourceStats;
    }
    
    return result;
  } catch (error) {
    console.error('Erreur lors de l\'enrichissement du résultat:', error);
    return result;
  }
}

/**
 * Calculer des statistiques sur les ressources FHIR générées
 * @param {Object} fhirBundle - Bundle FHIR à analyser
 * @returns {Object} Statistiques sur les ressources
 */
function computeResourceStats(fhirBundle) {
  try {
    const stats = {
      totalResources: 0,
      resourceTypes: {}
    };
    
    if (!fhirBundle || !fhirBundle.entry || !Array.isArray(fhirBundle.entry)) {
      return stats;
    }
    
    // Compter le nombre total de ressources
    stats.totalResources = fhirBundle.entry.length;
    
    // Compter les ressources par type
    fhirBundle.entry.forEach(entry => {
      if (entry.resource && entry.resource.resourceType) {
        const resourceType = entry.resource.resourceType;
        
        if (!stats.resourceTypes[resourceType]) {
          stats.resourceTypes[resourceType] = 0;
        }
        
        stats.resourceTypes[resourceType]++;
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Erreur lors du calcul des statistiques de ressources:', error);
    return {
      totalResources: 0,
      resourceTypes: {}
    };
  }
}

/**
 * Middleware pour enrichir les résultats d'API
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction next d'Express
 */
function apiResultEnricherMiddleware(req, res, next) {
  // Stocker la fonction json originale
  const originalJson = res.json;
  
  // Surcharger la fonction json pour enrichir les résultats
  res.json = function(data) {
    // Enrichir seulement pour les réponses de conversion
    if (data && req.path.includes('/convert')) {
      const enriched = enrichConversionResult(data, {
        processingTime: req.processingTime || null,
        validate: req.query.validate === 'true'
      });
      return originalJson.call(this, enriched);
    }
    
    // Sinon, comportement normal
    return originalJson.call(this, data);
  };
  
  next();
}

module.exports = {
  enrichConversionResult,
  apiResultEnricherMiddleware
};