/**
 * Fonction utilitaire pour extraire le NIR du champ PID-3
 * @param {*} pidField - Champ PID-3
 * @returns {string|null} NIR extrait ou null
 */
function extractNIRFromPID(pidField) {
  if (!pidField) return null;
  
  // Si c'est un tableau d'identifiants
  if (Array.isArray(pidField)) {
    for (const id of pidField) {
      if (Array.isArray(id) && id.length >= 4) {
        const value = id[0];
        const authority = id[3];
        
        // Vérifier si c'est un NIR (15 chiffres) avec autorité INS
        if (value && /^\d{15}$/.test(value) && 
            authority && Array.isArray(authority) && 
            authority[0] && authority[0].includes('INS-NIR')) {
          return value;
        }
      }
    }
  }
  
  return null;
}

module.exports = { extractNIRFromPID };