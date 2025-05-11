/**
 * Point d'entrée pour les services
 * Ce module exporte tous les services disponibles
 * 
 * @module services
 * @author FHIRHub Team
 */

const fhirNameProcessor = require('./fhirNameProcessor');
const conversionLogService = require('./conversionLogService');
// Intégrer d'autres services au fur et à mesure

module.exports = {
  ...fhirNameProcessor,
  conversionLogService
};