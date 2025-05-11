/**
 * Point d'entrée pour le système de cache
 * @module cache
 */

const { initializeCache, CONFIG } = require('./conversionCache');

// Initialiser le cache au démarrage
const cache = initializeCache();

module.exports = cache;