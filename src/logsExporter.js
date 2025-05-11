/**
 * Module d'exportation des logs pour Grafana
 * Permet de récupérer et formater les logs de conversion pour affichage dans Grafana
 */
const express = require('express');
const db = require('./db/dbService');
const path = require('path');
const fs = require('fs');

// Création du routeur Express pour les logs
const logsRouter = express.Router();

// Fonction pour formater un log en format Loki (utilisé par Grafana)
function formatLogForLoki(log) {
  // Déterminer le niveau de log
  let level = 'info';
  if (log.error || log.status === 'error' || log.status_code >= 400) {
    level = 'error';
  } else if (log.status === 'warning') {
    level = 'warning';
  }

  // Créer l'entrée de log formatée
  const timestamp = log.timestamp || log.created_at || new Date().toISOString();
  const applicationName = log.application_name || 'Non spécifié';
  const message = log.message || JSON.stringify(log);

  return {
    timestamp,
    level,
    application: applicationName,
    message,
    originalLog: log
  };
}

// Route pour récupérer tous les logs de conversion
logsRouter.get('/api/logs/conversions', async (req, res) => {
  try {
    // Paramètres de filtrage et pagination
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    
    // Filtres
    const filters = {};
    if (req.query.application_id) {
      filters.application_id = req.query.application_id;
    }
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.from_date && req.query.to_date) {
      filters.date_range = {
        from: req.query.from_date,
        to: req.query.to_date
      };
    }

    // Requête SQL de base
    let query = `
      SELECT cl.*, a.name as application_name
      FROM conversion_logs cl
      LEFT JOIN applications a ON cl.application_id = a.id
    `;

    // Ajout des filtres à la requête
    const whereConditions = [];
    const queryParams = [];

    if (filters.application_id) {
      whereConditions.push('cl.application_id = ?');
      queryParams.push(filters.application_id);
    }

    if (filters.status) {
      whereConditions.push('cl.status = ?');
      queryParams.push(filters.status);
    }

    if (filters.date_range) {
      whereConditions.push('cl.timestamp BETWEEN ? AND ?');
      queryParams.push(filters.date_range.from, filters.date_range.to);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Ajout de l'ordre et de la pagination
    query += ' ORDER BY cl.timestamp DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    // Exécution de la requête
    const logs = await db.query(query, queryParams);
    
    // Formatage des logs pour Grafana
    const formattedLogs = logs.map(formatLogForLoki);
    
    // Renvoyer les logs formatés
    res.json({
      status: 'success',
      count: formattedLogs.length,
      total: await db.getCount('conversion_logs'),
      logs: formattedLogs
    });
  } catch (error) {
    console.error('[LOGS EXPORTER] Erreur lors de la récupération des logs:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la récupération des logs',
      error: error.message
    });
  }
});

// Route pour récupérer les statistiques des logs
logsRouter.get('/api/logs/stats', async (req, res) => {
  try {
    // Statistiques par période
    const timeRanges = {
      today: {
        label: "Aujourd'hui",
        start: new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      },
      week: {
        label: '7 derniers jours',
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      month: {
        label: '30 derniers jours',
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    };

    const stats = {};
    
    // Pour chaque période, récupérer les statistiques
    for (const [periodKey, period] of Object.entries(timeRanges)) {
      // Nombre total de conversions
      const totalQuery = `
        SELECT COUNT(*) as count
        FROM conversion_logs
        WHERE timestamp >= ?
      `;
      
      // Nombre d'erreurs
      const errorsQuery = `
        SELECT COUNT(*) as count
        FROM conversion_logs
        WHERE timestamp >= ? AND status = 'error'
      `;
      
      // Temps moyen de traitement
      const avgTimeQuery = `
        SELECT AVG(processing_time) as avg_time
        FROM conversion_logs
        WHERE timestamp >= ? AND processing_time > 0
      `;
      
      // Exécuter les requêtes
      const [totalResult, errorsResult, avgTimeResult] = await Promise.all([
        db.query(totalQuery, [period.start]),
        db.query(errorsQuery, [period.start]),
        db.query(avgTimeQuery, [period.start])
      ]);
      
      stats[periodKey] = {
        label: period.label,
        total: totalResult[0]?.count || 0,
        errors: errorsResult[0]?.count || 0,
        avg_time: avgTimeResult[0]?.avg_time || 0
      };
    }
    
    // Renvoyer les statistiques
    res.json({
      status: 'success',
      stats
    });
  } catch (error) {
    console.error('[LOGS EXPORTER] Erreur lors du calcul des statistiques:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors du calcul des statistiques',
      error: error.message
    });
  }
});

// Route pour récupérer les logs système
logsRouter.get('/api/logs/system', async (req, res) => {
  try {
    // Paramètres de filtrage et pagination
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    
    // Filtres
    const filters = {};
    if (req.query.severity) {
      filters.severity = req.query.severity;
    }
    if (req.query.event_type) {
      filters.event_type = req.query.event_type;
    }
    if (req.query.from_date && req.query.to_date) {
      filters.date_range = {
        from: req.query.from_date,
        to: req.query.to_date
      };
    }

    // Requête SQL de base
    let query = `
      SELECT sl.*, u.username
      FROM system_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
    `;

    // Ajout des filtres à la requête
    const whereConditions = [];
    const queryParams = [];

    if (filters.severity) {
      whereConditions.push('sl.severity = ?');
      queryParams.push(filters.severity);
    }

    if (filters.event_type) {
      whereConditions.push('sl.event_type = ?');
      queryParams.push(filters.event_type);
    }

    if (filters.date_range) {
      whereConditions.push('sl.created_at BETWEEN ? AND ?');
      queryParams.push(filters.date_range.from, filters.date_range.to);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Ajout de l'ordre et de la pagination
    query += ' ORDER BY sl.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    // Exécution de la requête
    const logs = await db.query(query, queryParams);
    
    // Formatage des logs pour Grafana
    const formattedLogs = logs.map(log => {
      return {
        timestamp: log.created_at,
        level: log.severity.toLowerCase(),
        event_type: log.event_type,
        message: log.message,
        details: log.details,
        username: log.username || 'Système',
        ip_address: log.ip_address
      };
    });
    
    // Renvoyer les logs formatés
    res.json({
      status: 'success',
      count: formattedLogs.length,
      total: await db.getCount('system_logs'),
      logs: formattedLogs
    });
  } catch (error) {
    console.error('[LOGS EXPORTER] Erreur lors de la récupération des logs système:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la récupération des logs système',
      error: error.message
    });
  }
});

module.exports = logsRouter;