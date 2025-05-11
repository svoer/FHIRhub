/**
 * Module de connexion à la base de données SQLite
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Emplacement de la base de données
const DATA_DIR = './data';
const DB_PATH = path.join(DATA_DIR, 'fhirhub.db');

// Créer le répertoire des données s'il n'existe pas
if (!fs.existsSync(DATA_DIR)) {
  console.log('[DB] Création du répertoire de données:', DATA_DIR);
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log('[DB] Chemin de la base de données:', DB_PATH);

// Créer la connexion à la base de données
export const db = new Database(DB_PATH, { verbose: process.env.NODE_ENV !== 'production' ? console.log : undefined });

// Activer les clés étrangères
db.pragma('foreign_keys = ON');

// Initialisation de la base de données
export function initDatabase() {
  console.log('[DB] Initialisation de la base de données...');

  // Créer les tables si elles n'existent pas
  const tables = [
    // Table des utilisateurs
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      name TEXT,
      email TEXT,
      created_at TEXT NOT NULL,
      last_login TEXT
    )`,
    
    // Table des applications
    `CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      settings TEXT, -- JSON des paramètres
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    
    // Table des clés API
    `CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      application_id INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )`,
    
    // Table des logs de conversion
    `CREATE TABLE IF NOT EXISTS conversion_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER NOT NULL,
      application_id INTEGER NOT NULL,
      input_message TEXT NOT NULL,
      output_message TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      processing_time INTEGER NOT NULL, -- en millisecondes
      timestamp TEXT NOT NULL,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )`,
    
    // Table des métriques système
    `CREATE TABLE IF NOT EXISTS system_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpu_usage REAL,
      memory_usage REAL,
      disk_usage REAL,
      active_connections INTEGER,
      timestamp TEXT NOT NULL
    )`,
    
    // Table des notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    
    // Table des logs d'activité API
    `CREATE TABLE IF NOT EXISTS api_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER NOT NULL,
      application_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )`,
    
    // Table des limites d'utilisation API
    `CREATE TABLE IF NOT EXISTS api_usage_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL UNIQUE,
      daily_limit INTEGER,
      monthly_limit INTEGER,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )`
  ];
  
  // Créer chaque table
  tables.forEach(table => {
    console.log('[DB] Création de table:', table.substring(0, table.indexOf('(')));
    db.prepare(table).run();
  });
  
  // Vérifier que toutes les tables sont créées
  const tableCount = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get();
  console.log('[DB] Vérification des tables créées:', tableCount);
  
  // Vérifier si l'application par défaut existe
  const defaultApp = db.prepare('SELECT id FROM applications WHERE id = 1').get();
  
  // Créer l'application par défaut si elle n'existe pas
  if (!defaultApp) {
    console.log('[DB] Création de l\'application par défaut et de la clé API de développement');
    
    // Créer l'application par défaut
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO applications (id, name, description, settings, created_at, updated_at)
      VALUES (1, 'Application par défaut', 'Application créée automatiquement', '{}', ?, ?)
    `).run(now, now);
    
    // Créer la clé API de développement
    if (result.changes > 0) {
      db.prepare(`
        INSERT INTO api_keys (key, name, application_id, is_active, created_at)
        VALUES ('dev-key', 'Clé de développement', 1, 1, ?)
      `).run(now);
    }
  }
  
  // Vérifier si l'utilisateur admin existe
  const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  
  // Créer l'utilisateur admin s'il n'existe pas
  if (!adminUser) {
    console.log('[DB] Création de l\'utilisateur administrateur par défaut');
    
    // Mot de passe par défaut: adminfhirhub
    // En production, il faudrait utiliser bcrypt pour hacher le mot de passe
    db.prepare(`
      INSERT INTO users (username, password, role, name, created_at)
      VALUES ('admin', 'adminfhirhub', 'admin', 'Administrateur', datetime('now'))
    `).run();
  }
  
  console.log('[DB] Structure de la base de données vérifiée');
  
  return db;
}