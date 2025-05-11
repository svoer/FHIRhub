/**
 * Service de base de données SQLite
 * Fournit des méthodes pour interagir avec la base de données
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Définition du chemin de la base de données
let DB_PATH = process.env.DB_PATH || './storage/db/fhirhub.db';

// S'assurer que le répertoire existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[DB] Répertoire de base de données créé: ${dbDir}`);
  } catch (error) {
    console.error(`[DB] Erreur lors de la création du répertoire de base de données: ${error.message}`);
    DB_PATH = '/tmp/fhirhub.db';
    console.log(`[DB] Utilisation d'un chemin alternatif: ${DB_PATH}`);
  }
}

// Variable pour stocker la connexion à la base de données
let db;

// Initialisation de la base de données
try {
  console.log(`[DB] Ouverture de la base de données: ${DB_PATH}`);
  db = new Database(DB_PATH, { 
    fileMustExist: false,
    verbose: process.env.NODE_ENV === 'development' ? console.log : null
  });
  
  // Configurer la base de données pour une meilleure cohérence
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  
  console.log('[DB] Connexion à la base de données établie avec succès');
} catch (error) {
  console.error(`[DB] Erreur lors de l'ouverture de la base de données: ${error.message}`);
  
  // Essayer un chemin alternatif
  try {
    DB_PATH = '/tmp/fhirhub.db';
    console.log(`[DB] Tentative d'utilisation d'un chemin alternatif: ${DB_PATH}`);
    db = new Database(DB_PATH, { fileMustExist: false });
    console.log('[DB] Connexion à la base de données alternative établie avec succès');
  } catch (fallbackError) {
    console.error(`[DB] Erreur critique de base de données: ${fallbackError.message}`);
    process.exit(1);
  }
}

/**
 * Exécute une requête qui ne retourne pas de résultat
 * @param {string} sql - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Object} - Informations sur l'exécution
 */
function run(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  } catch (error) {
    console.error(`[DB] Erreur d'exécution SQL: ${error.message}`);
    console.error(`[DB] Requête: ${sql}`);
    console.error(`[DB] Paramètres: ${util.inspect(params)}`);
    throw error;
  }
}

/**
 * Exécute une requête qui retourne une seule ligne
 * @param {string} sql - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Object|undefined} - Ligne résultante ou undefined si aucun résultat
 */
function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  } catch (error) {
    console.error(`[DB] Erreur de récupération SQL: ${error.message}`);
    console.error(`[DB] Requête: ${sql}`);
    console.error(`[DB] Paramètres: ${util.inspect(params)}`);
    throw error;
  }
}

/**
 * Exécute une requête qui retourne plusieurs lignes
 * @param {string} sql - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Array} - Lignes résultantes
 */
function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (error) {
    console.error(`[DB] Erreur de récupération multiple SQL: ${error.message}`);
    console.error(`[DB] Requête: ${sql}`);
    console.error(`[DB] Paramètres: ${util.inspect(params)}`);
    throw error;
  }
}

/**
 * Exécute plusieurs requêtes dans une transaction
 * @param {Function} callback - Fonction de transaction
 * @returns {any} - Résultat de la transaction
 */
function transaction(callback) {
  const runTransaction = db.transaction(callback);
  try {
    return runTransaction();
  } catch (error) {
    console.error(`[DB] Erreur de transaction: ${error.message}`);
    throw error;
  }
}

/**
 * Exécute une requête SQL directement
 * @param {string} sql - Requête SQL
 */
function exec(sql) {
  try {
    db.exec(sql);
  } catch (error) {
    console.error(`[DB] Erreur d'exécution directe: ${error.message}`);
    console.error(`[DB] Requête: ${sql}`);
    throw error;
  }
}

/**
 * Vérifie si une table existe
 * @param {string} tableName - Nom de la table
 * @returns {boolean} - True si la table existe
 */
function tableExists(tableName) {
  try {
    const result = get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return !!result;
  } catch (error) {
    console.error(`[DB] Erreur lors de la vérification de la table: ${error.message}`);
    return false;
  }
}

/**
 * Crée une table si elle n'existe pas déjà
 * @param {string} tableName - Nom de la table
 * @param {string} schema - Schéma SQL de la table
 * @returns {boolean} - True si la table a été créée
 */
function createTableIfNotExists(tableName, schema) {
  try {
    if (!tableExists(tableName)) {
      console.log(`[DB] Création de table: ${schema}`);
      exec(schema);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[DB] Erreur lors de la création de la table: ${error.message}`);
    throw error;
  }
}

/**
 * Ferme la connexion à la base de données
 */
function close() {
  if (db) {
    db.close();
    console.log('[DB] Connexion à la base de données fermée');
  }
}

// Créer les indices nécessaires pour améliorer les performances
function createIndices() {
  try {
    // Indice sur la table conversion_logs pour optimiser la recherche par timestamp
    createIndexIfNotExists(
      'idx_conversion_logs_timestamp',
      'CREATE INDEX IF NOT EXISTS idx_conversion_logs_timestamp ON conversion_logs(timestamp)'
    );
    
    // Indice pour optimiser la recherche par application
    createIndexIfNotExists(
      'idx_conversion_logs_app',
      'CREATE INDEX IF NOT EXISTS idx_conversion_logs_app ON conversion_logs(application_id)'
    );
    
    // Indice pour optimiser la recherche par statut
    createIndexIfNotExists(
      'idx_conversion_logs_status',
      'CREATE INDEX IF NOT EXISTS idx_conversion_logs_status ON conversion_logs(status)'
    );
    
    console.log('[DB] Indices créés avec succès');
  } catch (error) {
    console.error(`[DB] Erreur lors de la création des indices: ${error.message}`);
  }
}

/**
 * Crée un indice s'il n'existe pas déjà
 * @param {string} indexName - Nom de l'indice
 * @param {string} schema - Schéma SQL de l'indice
 * @returns {boolean} - True si l'indice a été créé
 */
function createIndexIfNotExists(indexName, schema) {
  try {
    const result = get(
      "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
      [indexName]
    );
    
    if (!result) {
      console.log(`[DB] Création d'indice: ${schema}`);
      exec(schema);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[DB] Erreur lors de la création de l'indice: ${error.message}`);
    throw error;
  }
}

// Exporter les fonctions pour être utilisées dans l'application
module.exports = {
  run,
  get,
  all,
  transaction,
  exec,
  tableExists,
  createTableIfNotExists,
  close,
  createIndices,
  DB_PATH
};