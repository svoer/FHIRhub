/**
 * Module de journalisation pour FHIRHub
 * Fournit des fonctions pour enregistrer les messages de log dans un fichier
 * et dans la console.
 */
const fs = require('fs');
const path = require('path');
const util = require('util');

// Configuration des logs
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // 'debug', 'info', 'warn', 'error'
const LOG_FILE = process.env.LOG_FILE || path.join(__dirname, '../../logs/fhirhub.log');
const MAX_LOG_SIZE = parseInt(process.env.MAX_LOG_SIZE || '5242880', 10); // 5 MB par défaut
const MAX_LOG_FILES = parseInt(process.env.MAX_LOG_FILES || '10', 10);

// S'assurer que le répertoire des logs existe
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (error) {
    console.error(`[LOGGER] Erreur lors de la création du répertoire de logs: ${error.message}`);
  }
}

// Niveaux de log
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Écrit un message dans le fichier de log et dans la console
 * @param {string} level - Niveau de log (debug, info, warn, error)
 * @param {string} message - Message à journaliser
 * @param {any} data - Données additionnelles à journaliser
 */
function log(level, message, data) {
  // Vérifier si le niveau de log est suffisant
  if (LOG_LEVELS[level] < LOG_LEVELS[LOG_LEVEL]) {
    return;
  }

  // Formater le message
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  // Ajouter les données additionnelles si présentes
  if (data !== undefined) {
    if (typeof data === 'object') {
      logMessage += '\n' + util.inspect(data, { depth: null, colors: false });
    } else {
      logMessage += ' ' + data;
    }
  }
  
  // Écrire dans la console
  if (level === 'error') {
    console.error(logMessage);
  } else if (level === 'warn') {
    console.warn(logMessage);
  } else {
    console.log(logMessage);
  }

  // Essayer d'écrire dans le fichier de log
  try {
    // Vérifier si le fichier de log doit être pivoté
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size >= MAX_LOG_SIZE) {
        rotateLogFiles();
      }
    }

    // Écrire dans le fichier de log
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (error) {
    console.error(`[LOGGER] Erreur lors de l'écriture dans le fichier de log: ${error.message}`);
  }
}

/**
 * Pivote les fichiers de log lorsque le fichier principal atteint la taille maximale
 */
function rotateLogFiles() {
  try {
    // Supprimer le fichier de log le plus ancien si le nombre maximal est atteint
    if (fs.existsSync(`${LOG_FILE}.${MAX_LOG_FILES - 1}`)) {
      fs.unlinkSync(`${LOG_FILE}.${MAX_LOG_FILES - 1}`);
    }

    // Déplacer les fichiers de log existants
    for (let i = MAX_LOG_FILES - 2; i >= 0; i--) {
      const oldFile = i === 0 ? LOG_FILE : `${LOG_FILE}.${i}`;
      const newFile = `${LOG_FILE}.${i + 1}`;
      
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile);
      }
    }

    // Créer un nouveau fichier de log vide
    fs.writeFileSync(LOG_FILE, '');
  } catch (error) {
    console.error(`[LOGGER] Erreur lors de la rotation des fichiers de log: ${error.message}`);
  }
}

// Exporter les fonctions pour chaque niveau de log
module.exports = {
  debug: (message, data) => log('debug', message, data),
  info: (message, data) => log('info', message, data),
  warn: (message, data) => log('warn', message, data),
  error: (message, data) => log('error', message, data),
  log
};