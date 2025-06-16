/**
 * Adaptateur de terminologie française simplifié
 * Version allégée pour FHIRHub après nettoyage
 */

/**
 * Mapper les codes français vers FHIR
 * @param {string} code - Code à mapper
 * @param {string} system - Système de codage
 * @returns {object} Code mappé
 */
function mapFrenchCode(code, system = 'unknown') {
  // Mapping simplifié pour les codes français courants
  const mappings = {
    'M': { code: 'male', system: 'http://hl7.org/fhir/administrative-gender' },
    'F': { code: 'female', system: 'http://hl7.org/fhir/administrative-gender' },
    'I': { code: 'IMP', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' },
    'O': { code: 'AMB', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' }
  };

  return mappings[code] || { code, system };
}

/**
 * Valider un code FHIR
 * @param {string} code - Code à valider
 * @param {string} system - Système de codage
 * @returns {boolean} Validation result
 */
function validateCode(code, system) {
  // Validation basique
  return code && typeof code === 'string' && code.length > 0;
}

module.exports = {
  mapFrenchCode,
  validateCode
};