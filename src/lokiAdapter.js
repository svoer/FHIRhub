/**
 * Module d'adaptation pour Loki (Grafana)
 * Permet de formater les logs de conversion dans un format compatible avec Loki
 */
const express = require('express');
const db = require('./db/dbService');

const lokiRouter = express.Router();

// Format pour Loki : {"streams": [{"stream": {"label": "value"}, "values": [[timestamp, "log message"]]}]}
function createLokiResponse(logs, labels = {}) {
  const streams = [];
  
  // Regrouper les logs par niveau (info, warning, error)
  const logsByLevel = {};
  
  for (const log of logs) {
    const level = log.status === 'error' ? 'error' : 
                  log.status === 'warning' ? 'warning' : 'info';
    
    if (!logsByLevel[level]) {
      logsByLevel[level] = [];
    }
    
    // Timestamp en nanosecondes pour Loki (compatible avec Grafana)
    const timestamp = new Date(log.timestamp || log.created_at || new Date()).getTime() * 1000000;
    
    // Créer un message formaté (peut être personnalisé selon les besoins)
    const message = JSON.stringify({
      id: log.id,
      app: log.application_name || 'Default',
      status: log.status || 'unknown',
      processing_time: log.processing_time || 0,
      resource_count: log.resource_count || 0,
      message: log.message || '',
      details: log.details || ''
    });
    
    logsByLevel[level].push([timestamp.toString(), message]);
  }
  
  // Créer un stream par niveau de log
  for (const [level, values] of Object.entries(logsByLevel)) {
    if (values.length > 0) {
      streams.push({
        stream: { 
          level,
          application: labels.application || 'fhirhub',
          job: labels.job || 'conversion-logs',
          ...labels
        },
        values: values.sort((a, b) => a[0] - b[0]) // Tri par timestamp
      });
    }
  }
  
  return { streams };
}

// Endpoint Loki pour les requêtes de plage (range)
lokiRouter.get('/loki/api/v1/query_range', async (req, res) => {
  try {
    // Paramètres de requête Loki
    const queryStr = req.query.query || '';
    const limit = parseInt(req.query.limit) || 100;
    const start = req.query.start || (Date.now() - 3600000) * 1000000; // Par défaut: dernière heure
    const end = req.query.end || Date.now() * 1000000;
    
    // Convertir les timestamps en nanosecondes en millisecondes
    const startDate = new Date(parseInt(start) / 1000000);
    const endDate = new Date(parseInt(end) / 1000000);
    
    // Extraire les filtres de la requête LogQL
    const parsedQuery = parseLogQLQuery(queryStr);
    
    // Construction de la requête SQL
    let sql = `
      SELECT cl.*, a.name as application_name
      FROM conversion_logs cl
      LEFT JOIN applications a ON cl.application_id = a.id
      WHERE cl.timestamp BETWEEN ? AND ?
    `;
    
    const sqlParams = [startDate.toISOString(), endDate.toISOString()];
    
    // Ajouter des filtres supplémentaires
    if (parsedQuery.filters) {
      if (parsedQuery.filters.application) {
        sql += ' AND a.name = ?';
        sqlParams.push(parsedQuery.filters.application);
      }
      
      if (parsedQuery.filters.status) {
        sql += ' AND cl.status = ?';
        sqlParams.push(parsedQuery.filters.status);
      }
      
      if (parsedQuery.filters.level) {
        if (parsedQuery.filters.level === 'error') {
          sql += ' AND cl.status = "error"';
        } else if (parsedQuery.filters.level === 'warning') {
          sql += ' AND cl.status = "warning"';
        } else if (parsedQuery.filters.level === 'info') {
          sql += ' AND cl.status NOT IN ("error", "warning")';
        }
      }
    }
    
    // Ordre et limite
    sql += ' ORDER BY cl.timestamp DESC LIMIT ?';
    sqlParams.push(limit);
    
    // Exécuter la requête
    const logs = await db.query(sql, sqlParams);
    
    // Formater la réponse pour Loki
    const lokiResponse = createLokiResponse(logs, { 
      queryName: parsedQuery.name || 'conversion_logs'
    });
    
    res.json(lokiResponse);
  } catch (error) {
    console.error('[LOKI-ADAPTER] Erreur lors de la requête:', error);
    res.status(500).json({
      status: 'error',
      errorType: 'server_error',
      error: 'Error executing query'
    });
  }
});

// Endpoint Loki pour les requêtes instantanées
lokiRouter.get('/loki/api/v1/query', async (req, res) => {
  try {
    // Paramètres similaires à query_range
    const queryStr = req.query.query || '';
    const limit = parseInt(req.query.limit) || 100;
    const time = req.query.time || Date.now() * 1000000;
    
    // Convertir le timestamp en date
    const queryTime = new Date(parseInt(time) / 1000000);
    
    // Pour une requête instantanée, nous utilisons une fenêtre de temps courte autour du timestamp
    const startDate = new Date(queryTime.getTime() - 3600000); // 1 heure avant
    const endDate = queryTime;
    
    // Extraire les filtres de la requête LogQL
    const parsedQuery = parseLogQLQuery(queryStr);
    
    // Construction de la requête SQL (similaire à query_range)
    let sql = `
      SELECT cl.*, a.name as application_name
      FROM conversion_logs cl
      LEFT JOIN applications a ON cl.application_id = a.id
      WHERE cl.timestamp BETWEEN ? AND ?
    `;
    
    const sqlParams = [startDate.toISOString(), endDate.toISOString()];
    
    // Ajouter des filtres supplémentaires (même logique que query_range)
    if (parsedQuery.filters) {
      if (parsedQuery.filters.application) {
        sql += ' AND a.name = ?';
        sqlParams.push(parsedQuery.filters.application);
      }
      
      if (parsedQuery.filters.status) {
        sql += ' AND cl.status = ?';
        sqlParams.push(parsedQuery.filters.status);
      }
      
      if (parsedQuery.filters.level) {
        if (parsedQuery.filters.level === 'error') {
          sql += ' AND cl.status = "error"';
        } else if (parsedQuery.filters.level === 'warning') {
          sql += ' AND cl.status = "warning"';
        } else if (parsedQuery.filters.level === 'info') {
          sql += ' AND cl.status NOT IN ("error", "warning")';
        }
      }
    }
    
    // Ordre et limite
    sql += ' ORDER BY cl.timestamp DESC LIMIT ?';
    sqlParams.push(limit);
    
    // Exécuter la requête
    const logs = await db.query(sql, sqlParams);
    
    // Formater la réponse pour Loki
    const lokiResponse = createLokiResponse(logs, { 
      queryName: parsedQuery.name || 'conversion_logs'
    });
    
    res.json(lokiResponse);
  } catch (error) {
    console.error('[LOKI-ADAPTER] Erreur lors de la requête instantanée:', error);
    res.status(500).json({
      status: 'error',
      errorType: 'server_error',
      error: 'Error executing query'
    });
  }
});

// Endpoint pour les libellés (labels)
lokiRouter.get('/loki/api/v1/labels', async (req, res) => {
  try {
    const labels = ["level", "application", "status", "job"];
    res.json({
      status: "success",
      data: labels
    });
  } catch (error) {
    console.error('[LOKI-ADAPTER] Erreur lors de la récupération des labels:', error);
    res.status(500).json({
      status: 'error',
      errorType: 'server_error',
      error: 'Error fetching labels'
    });
  }
});

// Endpoint pour les valeurs de labels (label values)
lokiRouter.get('/loki/api/v1/label/:label/values', async (req, res) => {
  try {
    const label = req.params.label;
    let values = [];
    
    switch (label) {
      case 'level':
        values = ["info", "warning", "error"];
        break;
      case 'application':
        const apps = await db.query('SELECT DISTINCT name FROM applications');
        values = apps.map(app => app.name);
        break;
      case 'status':
        values = ["success", "error", "warning", "pending"];
        break;
      case 'job':
        values = ["conversion-logs", "system-logs"];
        break;
      default:
        values = [];
    }
    
    res.json({
      status: "success",
      data: values
    });
  } catch (error) {
    console.error(`[LOKI-ADAPTER] Erreur lors de la récupération des valeurs pour le label ${req.params.label}:`, error);
    res.status(500).json({
      status: 'error',
      errorType: 'server_error',
      error: 'Error fetching label values'
    });
  }
});

// Fonction utilitaire pour analyser une requête LogQL simple
function parseLogQLQuery(query) {
  const result = {
    name: 'default',
    filters: {}
  };
  
  if (!query) return result;
  
  // Exemple de requête: {application="Default"} |= "error"
  try {
    // Extraire le nom du stream
    const streamNameMatch = query.match(/^(\w+)/);
    if (streamNameMatch) {
      result.name = streamNameMatch[1];
    }
    
    // Extraire les filtres de labels
    const labelMatches = query.matchAll(/{([^}]+)}/g);
    for (const match of labelMatches) {
      const labelFilters = match[1].split(',');
      
      for (const filter of labelFilters) {
        const [key, value] = filter.split(/[=~]/).map(s => s.trim().replace(/"/g, ''));
        if (key && value) {
          result.filters[key] = value;
        }
      }
    }
    
    // Extraire les filtres de contenu
    const contentFilters = query.match(/\|=\s*"([^"]+)"/);
    if (contentFilters) {
      result.contentFilter = contentFilters[1];
    }
    
  } catch (e) {
    console.warn('[LOKI-ADAPTER] Erreur d\'analyse de la requête LogQL:', e);
  }
  
  return result;
}

module.exports = lokiRouter;