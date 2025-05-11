/**
 * Configuration et initialisation de la base de données PostgreSQL pour FHIRHub
 * Utilise Drizzle ORM pour gérer les connexions et opérations sur la BD
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const postgres = require('postgres');
const path = require('path');
const schema = require('./schema');

// Vérification de la présence des variables d'environnement nécessaires
if (!process.env.DATABASE_URL) {
  throw new Error(
    "La variable d'environnement DATABASE_URL n'est pas définie. Impossible de se connecter à la base de données."
  );
}

// Configuration de la connexion à la base de données
const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });

// Client pour les migrations
const migrationDb = drizzle(migrationClient);

// Client pour les requêtes générales
const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle(queryClient, { schema });

/**
 * Exécuter les migrations pour initialiser ou mettre à jour le schéma
 * @returns {Promise} Promesse résolue après l'exécution des migrations
 */
async function runMigrations() {
  try {
    console.log('[DB] Exécution des migrations...');
    await migrate(migrationDb, { migrationsFolder: path.join(__dirname, 'migrations') });
    console.log('[DB] Migrations terminées avec succès');
    return true;
  } catch (error) {
    console.error('[DB] Erreur lors des migrations:', error);
    throw error;
  } finally {
    // Fermer le client de migration après utilisation
    await migrationClient.end();
  }
}

/**
 * Supprimer les logs antérieurs à une certaine date
 * @param {number} days - Nombre de jours à conserver (par défaut 30)
 * @returns {Promise<number>} Nombre de logs supprimés
 */
async function cleanupOldLogs(days = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await db.delete(schema.conversionLogs)
      .where(sql`created_at < ${cutoffDate.toISOString()}`);
    
    console.log(`[DB] ${result.count} anciens logs supprimés (plus vieux que ${days} jours)`);
    return result.count;
  } catch (error) {
    console.error('[DB] Erreur lors du nettoyage des logs:', error);
    return 0;
  }
}

// Exportation des fonctions et objets
module.exports = {
  db,
  schema,
  runMigrations,
  cleanupOldLogs
};