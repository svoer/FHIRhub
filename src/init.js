/**
 * Module d'initialisation de FHIRHub
 * Configure tous les services et initialise la base de données
 */

const { initializeDatabase } = require('./db/schema');
const path = require('path');
const fs = require('fs');
const { cleanupOldConversionLogs } = require('./services/conversionLogService');

/**
 * Initialiser tous les composants de FHIRHub
 * @returns {Object} Informations sur l'initialisation
 */
function initialize() {
  console.log('Initialisation de FHIRHub...');
  
  try {
    // Vérifier les répertoires requis
    ensureDirectories();
    
    // Initialiser la base de données
    initializeDatabase();
    
    // Nettoyer les anciennes conversions selon les règles de rétention
    try {
      const deletedCount = cleanupOldConversionLogs();
      console.log(`Nettoyage des conversions terminé: ${deletedCount} conversion(s) supprimée(s)`);
    } catch (error) {
      console.warn('Avertissement: Impossible de nettoyer les anciennes conversions.', error);
    }
    
    console.log('Initialisation réussie');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Vérifier et créer les répertoires requis
 * @private
 */
function ensureDirectories() {
  const baseDir = path.join(__dirname, '..');
  
  const dirs = [
    path.join(baseDir, 'data'),
    path.join(baseDir, 'data', 'conversions'),
    path.join(baseDir, 'data', 'uploads'),
    path.join(baseDir, 'data', 'logs')
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Répertoire créé: ${dir}`);
    }
  }
}

// Exporter la fonction d'initialisation
module.exports = {
  initialize
};