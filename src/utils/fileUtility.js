/**
 * Utilitaires pour la gestion des fichiers
 * Ce module fournit des fonctions d'aide pour manipuler les fichiers
 * 
 * @module fileUtility
 * @author FHIRHub Team
 */

const fs = require('fs');
const path = require('path');

/**
 * Assure que le répertoire existe, le crée si nécessaire
 * @param {string} dirPath - Chemin du répertoire à vérifier/créer
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Récupère les fichiers d'un répertoire avec filtrage par extension
 * @param {string} directoryPath - Chemin du répertoire à explorer
 * @param {string} [extension] - Extension de fichier à filtrer (optionnel)
 * @returns {Array<string>} Liste des chemins de fichiers
 */
function getFilesInDirectory(directoryPath, extension) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }
  
  let files = fs.readdirSync(directoryPath);
  
  if (extension) {
    files = files.filter(file => file.endsWith(extension));
  }
  
  return files.map(file => path.join(directoryPath, file));
}

/**
 * Sauvegarde un objet JSON dans un fichier
 * @param {string} filePath - Chemin du fichier de destination
 * @param {Object} content - Objet à sauvegarder
 * @returns {boolean} True si la sauvegarde a réussi
 */
function saveJsonToFile(filePath, content) {
  try {
    ensureDirectoryExists(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Erreur lors de la sauvegarde du fichier JSON ${filePath}:`, error);
    return false;
  }
}

/**
 * Charge un objet JSON depuis un fichier
 * @param {string} filePath - Chemin du fichier à charger
 * @returns {Object|null} Objet chargé ou null en cas d'erreur
 */
function loadJsonFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Erreur lors du chargement du fichier JSON ${filePath}:`, error);
    return null;
  }
}

/**
 * Supprime un fichier
 * @param {string} filePath - Chemin du fichier à supprimer
 * @returns {boolean} True si la suppression a réussi
 */
function deleteFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return true; // Le fichier n'existe pas déjà
    }
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error(`Erreur lors de la suppression du fichier ${filePath}:`, error);
    return false;
  }
}

module.exports = {
  ensureDirectoryExists,
  getFilesInDirectory,
  saveJsonToFile,
  loadJsonFromFile,
  deleteFile
};