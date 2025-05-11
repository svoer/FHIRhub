/**
 * Utilitaires pour l'authentification
 * @module utils/auth
 */
const crypto = require('crypto');

/**
 * Hache un mot de passe avec un sel aléatoire
 * @param {string} password - Mot de passe en clair
 * @returns {string} - Mot de passe haché au format `sel:hachage`
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Vérifie si un mot de passe correspond au hachage stocké
 * @param {string} storedPassword - Mot de passe haché stocké au format `sel:hachage`
 * @param {string} suppliedPassword - Mot de passe fourni à vérifier
 * @returns {boolean} - true si le mot de passe correspond, false sinon
 */
function verifyPassword(storedPassword, suppliedPassword) {
  const [salt, hash] = storedPassword.split(':');
  const suppliedHash = crypto.pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512').toString('hex');
  return hash === suppliedHash;
}

module.exports = {
  hashPassword,
  verifyPassword
};