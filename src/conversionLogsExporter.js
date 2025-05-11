/**
 * Module d'exportation des logs de conversion pour Prometheus
 * Permet de suivre en temps réel les conversions dans Grafana
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const dbService = require('./db/dbService');

// Assurez-vous que le répertoire de logs existe
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`[LOGS] Répertoire de logs créé: ${logsDir}`);
  } catch (error) {
    console.error(`[LOGS] Erreur lors de la création du répertoire de logs: ${error.message}`);
  }
}
const logger = require('./utils/logger');

// Create an Express app for the conversion logs endpoint
const conversionLogsApp = express.Router();

// Store the most recent conversion logs for direct access without DB queries
let recentConversionLogs = [];
const MAX_RECENT_LOGS = 1000;

// Endpoint to get recent conversion logs in a format suitable for Grafana
conversionLogsApp.get('/conversion-logs', async (req, res) => {
  try {
    // Get query parameters with defaults
    const limit = parseInt(req.query.limit) || 100;
    const app_id = req.query.app_id || null;
    const start = req.query.start || null;
    const end = req.query.end || null;
    
    // Build SQL query with filters
    let query = `
      SELECT 
        c.id, 
        c.api_key_id, 
        c.application_id, 
        SUBSTR(c.input_message, 1, 50) as input_preview,
        c.status, 
        c.processing_time, 
        c.timestamp,
        c.resource_count,
        a.name as application_name, 
        k.description as api_key_name
      FROM conversion_logs c
      LEFT JOIN applications a ON c.application_id = a.id
      LEFT JOIN api_keys k ON c.api_key_id = k.id
    `;
    
    // Add WHERE clauses
    let whereConditions = [];
    if (app_id) {
      whereConditions.push('c.application_id = ?');
    }
    if (start) {
      whereConditions.push('c.timestamp >= ?');
    }
    if (end) {
      whereConditions.push('c.timestamp <= ?');
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Order and limit
    query += ' ORDER BY c.timestamp DESC LIMIT ?';
    
    // Prepare parameters
    let params = [];
    if (app_id) params.push(app_id);
    if (start) params.push(start);
    if (end) params.push(end);
    params.push(limit);
    
    // Execute query
    const conversions = await dbService.all(query, params);
    
    // Format response for Grafana
    const formattedLogs = conversions.map(log => ({
      timestamp: new Date(log.timestamp).getTime(),
      application: log.application_name || 'Default',
      status: log.status || 'unknown',
      processing_time: log.processing_time || 0,
      resource_count: log.resource_count || 0,
      id: log.id,
      preview: log.input_preview || 'No preview',
      api_key: log.api_key_name || 'Direct API'
    }));
    
    // Send response
    res.json({
      status: 'success',
      count: formattedLogs.length,
      data: formattedLogs
    });
    
    // Update recent logs cache
    recentConversionLogs = [...formattedLogs, ...recentConversionLogs].slice(0, MAX_RECENT_LOGS);
    
  } catch (err) {
    logger.error(`[CONVERSION-LOGS] Error fetching conversion logs: ${err.message}`);
    res.status(500).json({
      status: 'error',
      message: `Failed to fetch conversion logs: ${err.message}`
    });
  }
});

// Endpoint for Prometheus metrics format
conversionLogsApp.get('/conversion-metrics', async (req, res) => {
  try {
    // Get current stats
    const totalConversions = await dbService.get('SELECT COUNT(*) as count FROM conversion_logs');
    const successfulConversions = await dbService.get('SELECT COUNT(*) as count FROM conversion_logs WHERE status = ?', ['success']);
    const failedConversions = await dbService.get('SELECT COUNT(*) as count FROM conversion_logs WHERE status != ?', ['success']);
    
    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayConversions = await dbService.get(
      'SELECT COUNT(*) as count FROM conversion_logs WHERE date(timestamp) = ?', 
      [today]
    );
    
    // Calculate average processing time
    const avgTime = await dbService.get(
      'SELECT AVG(processing_time) as avg FROM conversion_logs WHERE processing_time > 0'
    );
    
    // Format response in Prometheus format
    const metrics = [
      '# HELP fhirhub_total_conversions Total number of HL7 to FHIR conversions',
      '# TYPE fhirhub_total_conversions counter',
      `fhirhub_total_conversions ${totalConversions.count || 0}`,
      '',
      '# HELP fhirhub_successful_conversions Number of successful conversions',
      '# TYPE fhirhub_successful_conversions counter',
      `fhirhub_successful_conversions ${successfulConversions.count || 0}`,
      '',
      '# HELP fhirhub_failed_conversions Number of failed conversions',
      '# TYPE fhirhub_failed_conversions counter',
      `fhirhub_failed_conversions ${failedConversions.count || 0}`,
      '',
      '# HELP fhirhub_today_conversions Number of conversions today',
      '# TYPE fhirhub_today_conversions gauge',
      `fhirhub_today_conversions ${todayConversions.count || 0}`,
      '',
      '# HELP fhirhub_avg_processing_time_ms Average processing time in milliseconds',
      '# TYPE fhirhub_avg_processing_time_ms gauge',
      `fhirhub_avg_processing_time_ms ${avgTime.avg || 0}`
    ];
    
    res.set('Content-Type', 'text/plain');
    res.send(metrics.join('\n'));
    
  } catch (err) {
    logger.error(`[CONVERSION-METRICS] Error generating metrics: ${err.message}`);
    res.status(500).send('# Error generating metrics');
  }
});

// Add function to log new conversions when they happen
function logNewConversion(conversionData) {
  if (!conversionData) return;
  
  // Add to recent logs in memory
  const formattedLog = {
    timestamp: new Date().getTime(),
    application: conversionData.application_name || 'Default',
    status: conversionData.status || 'unknown',
    processing_time: conversionData.processing_time || 0,
    resource_count: conversionData.resource_count || 0,
    id: conversionData.id,
    preview: conversionData.input_preview || 'No preview',
    api_key: conversionData.api_key_name || 'Direct API'
  };
  
  recentConversionLogs = [formattedLog, ...recentConversionLogs].slice(0, MAX_RECENT_LOGS);
}

module.exports = {
  conversionLogsApp,
  logNewConversion
};