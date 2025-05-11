/**
 * Script pour réinitialiser le mot de passe admin dans le format attendu par l'application
 */
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// Paramètres de connexion à la base de données
const dbPath = './storage/db/fhirhub.db';
const username = 'admin';
const password = 'admin123';

// Connexion à la base de données
console.log(`Connexion à la base de données: ${dbPath}`);
const db = new Database(dbPath, { verbose: console.log });

// Format de mot de passe attendu par l'application
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Vérifier si l'utilisateur existe
const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
if (!user) {
  console.error(`L'utilisateur ${username} n'existe pas!`);
  db.close();
  process.exit(1);
}

// Générer le nouveau hash compatible
const hashedPassword = hashPassword(password);
console.log(`Nouveau mot de passe formaté: ${hashedPassword}`);

// Mettre à jour le mot de passe
const updateStmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
const result = updateStmt.run(hashedPassword, username);

if (result.changes > 0) {
  console.log(`Le mot de passe de l'utilisateur ${username} a été réinitialisé avec succès.`);
  console.log('Utilisez ces identifiants pour vous connecter:');
  console.log(`Nom d'utilisateur: ${username}`);
  console.log(`Mot de passe: ${password}`);
} else {
  console.error("Erreur: Aucune mise à jour effectuée. Vérifiez le nom d'utilisateur.");
}

db.close();