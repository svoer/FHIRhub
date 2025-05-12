/**
 * Utilitaires de cryptographie pour l'application
 * Fournit des fonctions pour hacher et vérifier des valeurs
 */

const crypto = require('crypto');

/**
 * Hache une valeur avec SHA-256
 * @param {string} value - La valeur à hacher
 * @returns {string} - La valeur hachée
 */
function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Génère un mot de passe haché avec sel
 * @param {string} password - Le mot de passe à hacher
 * @returns {string} - Le mot de passe haché avec sel
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Vérifie si un mot de passe correspond à un mot de passe haché stocké
 * @param {string} storedPassword - Le mot de passe haché stocké
 * @param {string} suppliedPassword - Le mot de passe fourni pour vérification
 * @returns {boolean} - true si le mot de passe correspond, false sinon
 */
function verifyPassword(storedPassword, suppliedPassword) {
  const [salt, hash] = storedPassword.split(':');
  const suppliedHash = crypto.pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512').toString('hex');
  return hash === suppliedHash;
}

/**
 * Génère une chaîne aléatoire pour les API Keys
 * @param {number} length - La longueur de la chaîne à générer
 * @returns {string} - La chaîne aléatoire générée
 */
function generateRandomString(length = 32) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

module.exports = {
  hashValue,
  hashPassword,
  verifyPassword,
  generateRandomString
};