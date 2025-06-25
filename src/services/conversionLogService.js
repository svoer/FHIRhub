const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration de la base de données
const dbPath = path.join(__dirname, '../../storage/db/fhirhub.db');
let db;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  console.log('[CONVERSION-LOG-SERVICE] Base de données initialisée:', dbPath);
} catch (error) {
  console.error('[CONVERSION-LOG-SERVICE] Erreur lors de l\'initialisation de la base de données:', error);
  throw error;
}

/**
 * Créer les tables si elles n'existent pas
 */
function ensureTablesExist() {
  try {
    // Table conversion_logs
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversion_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER,
        input_type TEXT,
        output_type TEXT,
        message_type TEXT,
        success BOOLEAN,
        error_message TEXT,
        processing_time INTEGER,
        resource_count INTEGER,
        input_size INTEGER,
        output_size INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT,
        ip_address TEXT
      )
    `);

    console.log('[CONVERSION-LOG-SERVICE] Tables vérifiées et créées si nécessaire');
  } catch (error) {
    console.error('[CONVERSION-LOG-SERVICE] Erreur lors de la création des tables:', error);
    throw error;
  }
}

/**
 * Logger une conversion
 */
function logConversion(logData) {
  try {
    ensureTablesExist();
    
    const stmt = db.prepare(`
      INSERT INTO conversion_logs (
        application_id, input_type, output_type, message_type, 
        success, error_message, processing_time, resource_count,
        input_size, output_size, user_agent, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      logData.application_id || null,
      logData.input_type || 'HL7',
      logData.output_type || 'FHIR',
      logData.message_type || 'UNKNOWN',
      logData.success ? 1 : 0,
      logData.error_message || null,
      logData.processing_time || null,
      logData.resource_count || null,
      logData.input_size || null,
      logData.output_size || null,
      logData.user_agent || null,
      logData.ip_address || null
    );

    console.log('[CONVERSION-LOG-SERVICE] Conversion loggée avec ID:', result.lastInsertRowid);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('[CONVERSION-LOG-SERVICE] Erreur lors du logging:', error);
    throw error;
  }
}

/**
 * Récupérer les conversions d'une application
 */
function getConversionsForApplication(applicationId, options = {}) {
  try {
    ensureTablesExist();
    
    const { 
      page = 1, 
      limit = 10, 
      include_null = false,
      start_date = null,
      end_date = null
    } = options;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (applicationId) {
      whereClause += ' AND application_id = ?';
      params.push(applicationId);
    }
    
    if (!include_null) {
      whereClause += ' AND application_id IS NOT NULL';
    }
    
    if (start_date) {
      whereClause += ' AND timestamp >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND timestamp <= ?';
      params.push(end_date);
    }
    
    // Requête pour compter le total
    const countQuery = `SELECT COUNT(*) as total FROM conversion_logs ${whereClause}`;
    const totalResult = db.prepare(countQuery).get(...params);
    const total = totalResult.total;
    
    // Requête pour récupérer les données paginées
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT * FROM conversion_logs 
      ${whereClause}
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    
    const conversions = db.prepare(dataQuery).all(...params, limit, offset);
    
    return {
      data: conversions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('[CONVERSION-LOG-SERVICE] Erreur lors de la récupération des conversions:', error);
    throw error;
  }
}

/**
 * Récupérer les statistiques d'une application
 */
function getApplicationStats(applicationId) {
  try {
    ensureTablesExist();
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total_conversions,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_conversions,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_conversions,
        AVG(processing_time) as avg_processing_time,
        SUM(resource_count) as total_resources,
        DATE(timestamp) as conversion_date,
        COUNT(*) as daily_count
      FROM conversion_logs 
      WHERE application_id = ? OR (application_id IS NULL AND ? IS NOT NULL)
      GROUP BY DATE(timestamp)
      ORDER BY conversion_date DESC
      LIMIT 30
    `;
    
    const dailyStats = db.prepare(statsQuery).all(applicationId, applicationId);
    
    // Statistiques globales
    const globalStatsQuery = `
      SELECT 
        COUNT(*) as total_conversions,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_conversions,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_conversions,
        AVG(processing_time) as avg_processing_time,
        SUM(resource_count) as total_resources,
        MIN(timestamp) as first_conversion,
        MAX(timestamp) as last_conversion
      FROM conversion_logs 
      WHERE application_id = ? OR (application_id IS NULL AND ? IS NOT NULL)
    `;
    
    const globalStats = db.prepare(globalStatsQuery).get(applicationId, applicationId);
    
    return {
      global: globalStats,
      daily: dailyStats
    };
  } catch (error) {
    console.error('[CONVERSION-LOG-SERVICE] Erreur lors de la récupération des statistiques:', error);
    throw error;
  }
}

/**
 * Récupérer toutes les conversions (sans filtre d'application)
 */
function getAllConversions(options = {}) {
  try {
    ensureTablesExist();
    
    const { 
      page = 1, 
      limit = 10,
      include_null = true
    } = options;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (!include_null) {
      whereClause += ' AND application_id IS NOT NULL';
    }
    
    // Requête pour compter le total
    const countQuery = `SELECT COUNT(*) as total FROM conversion_logs ${whereClause}`;
    const totalResult = db.prepare(countQuery).get(...params);
    const total = totalResult.total;
    
    // Requête pour récupérer les données paginées
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT * FROM conversion_logs 
      ${whereClause}
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    
    const conversions = db.prepare(dataQuery).all(...params, limit, offset);
    
    return {
      data: conversions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('[CONVERSION-LOG-SERVICE] Erreur lors de la récupération de toutes les conversions:', error);
    throw error;
  }
}

// Initialiser les tables au démarrage
ensureTablesExist();

module.exports = {
  logConversion,
  getConversionsForApplication,
  getApplicationStats,
  getAllConversions,
  ensureTablesExist
};