/**
 * Point d'entrée pour les utilitaires
 * Ce module exporte tous les utilitaires disponibles
 * 
 * @module utils
 * @author FHIRHub Team
 */

const fileUtility = require('./fileUtility');
const frenchNameExtractor = require('./frenchNameExtractor');

module.exports = {
  ...fileUtility,
  ...frenchNameExtractor
};