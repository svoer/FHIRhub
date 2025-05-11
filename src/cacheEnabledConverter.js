/**
 * Convertisseur HL7 vers FHIR avec cache intelligent intégré
 * Améliore les performances en mémorisant les résultats des conversions fréquentes
 * 
 * @module cacheEnabledConverter
 * @version 1.0.0
 */

const { convertHL7ToFHIR } = require('./index');
const cache = require('./cache');

/**
 * Convertit un message HL7 en FHIR en utilisant le cache intelligent
 * 
 * @param {string} hl7Message - Message HL7 à convertir
 * @param {object} options - Options de conversion
 * @returns {object} Bundle FHIR contenant les ressources converties
 */
function convertWithCache(hl7Message, options = {}) {
  const startTime = Date.now();
  let conversionTime = 0;
  let cacheHit = false;
  
  // Vérifier si le message existe dans le cache
  const cachedResult = cache.get(hl7Message);
  
  if (cachedResult) {
    // Le résultat est dans le cache
    cacheHit = true;
    conversionTime = Date.now() - startTime;
    console.log(`[CONVERTER] Utilisation du cache, temps: ${conversionTime}ms`);
    
    return {
      ...cachedResult,
      _meta: {
        ...(cachedResult._meta || {}),
        fromCache: true,
        conversionTime
      }
    };
  }
  
  // Pas dans le cache, effectuer la conversion
  const conversionStart = Date.now();
  const result = convertHL7ToFHIR(hl7Message, options);
  conversionTime = Date.now() - conversionStart;
  
  console.log(`[CONVERTER] Conversion effectuée, temps: ${conversionTime}ms`);
  
  // Ajouter au cache
  const resultWithMeta = {
    ...result,
    _meta: {
      conversionTime,
      fromCache: false,
      cachedAt: Date.now()
    }
  };
  
  cache.set(hl7Message, resultWithMeta);
  
  return resultWithMeta;
}

/**
 * Récupère les statistiques du cache
 * @returns {object} Statistiques détaillées du cache
 */
function getCacheStats() {
  return cache.getStats();
}

/**
 * Vide le cache
 */
function clearCache() {
  return cache.clear();
}

/**
 * Invalide une entrée spécifique du cache
 * @param {string} hl7Message - Message HL7 à invalider dans le cache
 */
function invalidateCacheEntry(hl7Message) {
  return cache.invalidate(hl7Message);
}

module.exports = {
  convertHL7ToFHIR: convertWithCache,
  getCacheStats,
  clearCache,
  invalidateCacheEntry
};