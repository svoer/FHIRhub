/**
 * Utilitaires pour la gestion des promesses
 */

/**
 * Exécute une promesse avec un délai d'expiration
 * @param {Promise} promise - La promesse à exécuter
 * @param {number} timeoutMs - Le délai d'expiration en millisecondes
 * @param {string} [errorMessage='Operation timed out'] - Le message d'erreur en cas d'expiration
 * @returns {Promise} La promesse avec gestion de timeout
 */
async function promiseWithTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
  // Utiliser le timeout demandé sans limitation arbitraire
  const effectiveTimeout = timeoutMs;
  
  console.log(`[UTILS] Définition d'un timeout de ${effectiveTimeout}ms pour la promesse`);
  
  // Créer une promesse qui se résout après le délai spécifié
  const timeoutPromise = new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      clearTimeout(timeoutId);
      reject(new Error(errorMessage));
    }, effectiveTimeout);
  });

  // Utiliser Promise.race pour obtenir le résultat de la première promesse résolue
  // (soit la promesse originale, soit celle du timeout)
  return Promise.race([promise, timeoutPromise]);
}

module.exports = {
  promiseWithTimeout
};