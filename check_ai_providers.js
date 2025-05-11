const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Vérifier l'existence du répertoire data/db et le créer si nécessaire
const dataDir = path.join(__dirname, 'data');
const dbDir = path.join(dataDir, 'db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Répertoire data créé');
}

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('Répertoire data/db créé');
}

// Vérifier que le fichier SQLite existe, sinon le créer
const dbPath = path.join(dbDir, 'fhirhub.db');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, '', { mode: 0o666 });
  console.log('Fichier de base de données créé');
}

// Ouvrir la base de données
const db = new sqlite3(dbPath, { fileMustExist: false });

// Vérifier si la table existe
const tableExists = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name='ai_providers'
`).get();

console.log('Vérification de la table ai_providers:');
if (tableExists) {
  console.log('✓ La table ai_providers existe déjà');
  
  // Afficher la structure de la table
  const columns = db.prepare(`PRAGMA table_info(ai_providers)`).all();
  console.log('Structure de la table:');
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  // Afficher les fournisseurs existants
  const providers = db.prepare(`SELECT * FROM ai_providers`).all();
  console.log('\nFournisseurs d\'IA existants:', providers.length);
  providers.forEach(p => {
    console.log(`  - ${p.id}: ${p.provider_name} (${p.provider_type}) - ${p.enabled ? 'Activé' : 'Désactivé'}`);
  });
} else {
  console.log('✗ La table ai_providers n\'existe pas');
  
  // Créer la table
  console.log('Création de la table ai_providers...');
  db.exec(`CREATE TABLE ai_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_name TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    api_key TEXT,
    endpoint TEXT,
    models TEXT,
    enabled INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  
  // Ajouter le fournisseur Mistral par défaut
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ai_providers (
      provider_name, provider_type, api_key, endpoint, models, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Mistral AI',
    'mistral',
    process.env.MISTRAL_API_KEY || '',
    'https://api.mistral.ai/v1',
    'mistral-large,mistral-medium',
    process.env.MISTRAL_API_KEY ? 1 : 0,
    now,
    now
  );
  
  // Ajouter le fournisseur Ollama
  db.prepare(`
    INSERT INTO ai_providers (
      provider_name, provider_type, api_key, endpoint, models, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Ollama Local',
    'ollama',
    '',
    'http://localhost:11434',
    'llama3,mistral,gemma',
    0,
    now,
    now
  );
  
  console.log('Table ai_providers créée avec succès avec 2 fournisseurs par défaut');
  
  // Vérifier que tout a bien été créé
  const providers = db.prepare(`SELECT * FROM ai_providers`).all();
  console.log('\nFournisseurs d\'IA ajoutés:', providers.length);
  providers.forEach(p => {
    console.log(`  - ${p.id}: ${p.provider_name} (${p.provider_type}) - ${p.enabled ? 'Activé' : 'Désactivé'}`);
  });
}

// Fermer la base de données
db.close();
