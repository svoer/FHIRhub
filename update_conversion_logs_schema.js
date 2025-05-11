/**
 * Script de mise à jour du schéma de la table conversion_logs
 * Ajoute la colonne application_id si elle n'existe pas et met en place la foreign key
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Déterminer le chemin de la base de données
let DB_PATH = path.join(__dirname, 'data', 'fhirhub.db');

// Vérifier si le dossier data existe, sinon utiliser le chemin direct
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  DB_PATH = path.join(__dirname, 'fhirhub.db');
}

// Vérifier les permissions d'écriture
try {
  if (fs.existsSync(DB_PATH)) {
    fs.accessSync(DB_PATH, fs.constants.W_OK);
  } else {
    const dirPath = path.dirname(DB_PATH);
    fs.accessSync(dirPath, fs.constants.W_OK);
  }
  console.log('Base de données trouvée à:', DB_PATH);
} catch (error) {
  // Si erreur de permission, utiliser un chemin alternatif dans /tmp
  console.error('Erreur de permission sur la base de données:', error);
  console.log('Utilisation d\'un chemin alternatif pour la base de données');
  DB_PATH = '/tmp/fhirhub.db';
  
  if (fs.existsSync(path.join(__dirname, 'fhirhub.db')) && !fs.existsSync(DB_PATH)) {
    // Copier la base de données existante vers /tmp
    try {
      fs.copyFileSync(path.join(__dirname, 'fhirhub.db'), DB_PATH);
      console.log('Base de données copiée vers', DB_PATH);
    } catch (copyError) {
      console.error('Erreur lors de la copie de la base de données:', copyError);
    }
  }
}

// Ouvrir la connexion à la base de données
const db = new Database(DB_PATH, { fileMustExist: false, verbose: console.log });

// Fonction de mise à jour du schéma
function updateSchema() {
  console.log('\n---------------------------------------');
  console.log('| MISE À JOUR DU SCHÉMA DE LA BASE DE DONNÉES |');
  console.log('---------------------------------------\n');

  try {
    // Vérifier si la base de données existe
    if (!fs.existsSync(DB_PATH)) {
      console.error(`La base de données ${DB_PATH} n'existe pas.`);
      console.log('Veuillez exécuter l\'application principale pour créer la base de données.');
      process.exit(1);
    }

    // Vérifier si la table conversion_logs existe
    const tableExists = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='conversion_logs'`
    ).get();

    if (!tableExists) {
      console.error('La table conversion_logs n\'existe pas dans la base de données.');
      console.log('Veuillez exécuter l\'application principale pour créer la structure de base.');
      process.exit(1);
    }

    // Vérifier si la colonne application_id existe déjà
    const tableInfo = db.prepare('PRAGMA table_info(conversion_logs)').all();
    const columns = tableInfo.map(col => col.name);

    if (columns.includes('application_id')) {
      console.log('✅ La colonne application_id existe déjà dans la table conversion_logs.');
    } else {
      console.log('➕ Ajout de la colonne application_id à la table conversion_logs...');
      
      // Ajouter la colonne application_id
      db.exec(`ALTER TABLE conversion_logs ADD COLUMN application_id INTEGER;`);
      
      console.log('✅ Colonne application_id ajoutée avec succès.');
      
      // Mettre à jour tous les enregistrements existants pour utiliser l'application par défaut
      const appResult = db.prepare(
        `SELECT id FROM applications WHERE name LIKE '%Default%' OR name LIKE '%par défaut%' LIMIT 1`
      ).get();
      
      const defaultAppId = appResult ? appResult.id : 1;
      
      console.log(`🔄 Mise à jour des enregistrements existants avec l'application par défaut (ID: ${defaultAppId})...`);
      db.exec(`UPDATE conversion_logs SET application_id = ${defaultAppId} WHERE application_id IS NULL;`);
      
      console.log('✅ Enregistrements mis à jour avec succès.');
    }

    // Vérifier si la foreign key est présente
    const foreignKeys = db.prepare('PRAGMA foreign_key_list(conversion_logs)').all();
    const hasApplicationForeignKey = foreignKeys.some(fk => 
      fk.table === 'applications' && fk.from === 'application_id'
    );

    if (hasApplicationForeignKey) {
      console.log('✅ La foreign key pour application_id est déjà configurée.');
    } else {
      console.log('⚠️ Foreign key pour application_id non trouvée.');
      console.log('ℹ️ SQLite ne permet pas d\'ajouter des contraintes de clé étrangère après la création de la table.');
      console.log('ℹ️ Si nécessaire, recréez la table avec la structure complète dans l\'application principale.');
    }

    console.log('\n✅✅✅ MISE À JOUR DU SCHÉMA TERMINÉE ✅✅✅\n');
    console.log('Vous pouvez maintenant redémarrer l\'application FHIRHub.');

  } catch (error) {
    console.error('Erreur lors de la mise à jour du schéma:', error);
    process.exit(1);
  } finally {
    // Fermer la connexion à la base de données
    if (db) {
      db.close();
    }
  }
}

// Exécuter la mise à jour
updateSchema();