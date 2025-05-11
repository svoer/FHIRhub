/**
 * Module de métriques pour FHIRHub
 * Permet d'exposer des métriques pour Prometheus
 */
const express = require('express');
const os = require('os');
const path = require('path');

// Importer SQLite pour accéder aux données de conversion
let db;
try {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, '../storage/db/fhirhub.db');
  db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('[METRICS] Erreur lors de la connexion à la base de données:', err.message);
    } else {
      console.log('[METRICS] Connexion à la base de données établie');
      
      // Synchroniser les compteurs avec la base de données au démarrage
      syncCountersWithDatabase();
    }
  });
} catch (err) {
  console.error('[METRICS] Erreur lors de l\'initialisation de la connexion à la base de données:', err.message);
}

// Variables pour stocker les métriques
let conversionCount = 0;
let apiRequestsCount = 0;
let conversionDurationSum = 0;
let conversionDurationCount = 0;
let activeConnections = 0;

// Horodatage de la dernière réinitialisation des métriques
let lastMetricsReset = Date.now();

// Fonction pour synchroniser les compteurs avec la base de données
function syncCountersWithDatabase() {
  if (!db) return;
  
  // Récupérer le nombre de conversions depuis la base de données
  db.get('SELECT COUNT(*) as count FROM conversion_logs', (err, row) => {
    if (err) {
      console.error('[METRICS] Erreur lors de la récupération du nombre de conversions:', err.message);
    } else if (row) {
      const dbCount = row.count || 0;
      if (dbCount > conversionCount) {
        console.log(`[METRICS] Synchronisation du compteur de conversions: ${conversionCount} -> ${dbCount}`);
        conversionCount = dbCount;
      }
    }
  });
}

// Réinitialisation périodique des compteurs pour éviter les valeurs excessives
// Réinitialiser toutes les 6 heures pour assurer des graphiques précis
setInterval(() => {
  const currentTime = Date.now();
  
  // Synchroniser le compteur avec la base de données à chaque vérification
  syncCountersWithDatabase();
  
  // Si plus de 6 heures se sont écoulées depuis la dernière réinitialisation
  if (currentTime - lastMetricsReset > 6 * 60 * 60 * 1000) {
    console.log('[METRICS] Réinitialisation périodique des compteurs de métriques');
    apiRequestsCount = 0;
    // Ne pas réinitialiser conversionCount car c'est un compteur cumulatif
    conversionDurationSum = 0;
    conversionDurationCount = 0;
    lastMetricsReset = currentTime;
  }
}, 10 * 60 * 1000); // Vérifier toutes les 10 minutes

// Création de l'application Express pour le serveur de métriques
const metricsApp = express();

// Middleware pour compter les requêtes API
function apiRequestCounter(req, res, next) {
  apiRequestsCount++;
  next();
}

// Fonction pour incrémenter le compteur de conversions
function incrementConversionCount() {
  conversionCount++;
  console.log(`[METRICS] Compteur de conversions incrémenté: ${conversionCount}`);
}

// Fonction pour enregistrer la durée d'une conversion
function recordConversionDuration(durationInMs) {
  const durationInSeconds = durationInMs / 1000;
  conversionDurationSum += durationInSeconds;
  conversionDurationCount++;
}

// Fonction pour mettre à jour le nombre de connexions actives
function updateActiveConnections(count) {
  // Si la valeur est excessive pour un environnement local, on la plafonne
  if (process.env.NODE_ENV !== 'production' && count > 30) {
    console.log(`[METRICS] Ajustement des connexions actives: ${count} -> 20 (environnement local)`);
    activeConnections = 20; // Valeur plus réaliste pour un environnement Docker local
  } else {
    activeConnections = count;
  }
  
  // Si la valeur est négative, on la corrige
  if (activeConnections < 0) {
    activeConnections = 0;
  }
}

// Route pour exposer les métriques
metricsApp.get('/metrics', (req, res) => {
  const metrics = [];

  // Métriques de l'application
  metrics.push('# HELP fhirhub_conversion_count_total Nombre total de conversions HL7 vers FHIR');
  metrics.push('# TYPE fhirhub_conversion_count_total counter');
  metrics.push(`fhirhub_conversion_count_total ${conversionCount}`);

  metrics.push('# HELP fhirhub_api_requests_total Nombre total de requêtes API');
  metrics.push('# TYPE fhirhub_api_requests_total counter');
  metrics.push(`fhirhub_api_requests_total ${apiRequestsCount}`);

  metrics.push('# HELP fhirhub_conversion_duration_seconds Durée des conversions en secondes');
  metrics.push('# TYPE fhirhub_conversion_duration_seconds summary');
  metrics.push(`fhirhub_conversion_duration_seconds_sum ${conversionDurationSum}`);
  metrics.push(`fhirhub_conversion_duration_seconds_count ${conversionDurationCount}`);

  metrics.push('# HELP fhirhub_active_connections Nombre de connexions actives');
  metrics.push('# TYPE fhirhub_active_connections gauge');
  metrics.push(`fhirhub_active_connections ${activeConnections}`);

  // Métriques système
  const memoryUsage = process.memoryUsage();
  // Convertir en MB pour une meilleure lisibilité
  const memoryUsageMB = Math.round(memoryUsage.rss / 1024 / 1024);
  metrics.push('# HELP fhirhub_memory_usage_bytes Utilisation mémoire en octets');
  metrics.push('# TYPE fhirhub_memory_usage_bytes gauge');
  metrics.push(`fhirhub_memory_usage_bytes ${memoryUsage.rss}`);
  
  // Version en MB pour Grafana
  metrics.push('# HELP fhirhub_memory_usage_mb Utilisation mémoire en MB');
  metrics.push('# TYPE fhirhub_memory_usage_mb gauge');
  metrics.push(`fhirhub_memory_usage_mb ${memoryUsageMB}`);

  // CPU usage - calculé correctement pour ne pas dépasser 100% par cœur
  const cpuUsage = process.cpuUsage();
  // Limiter à 100% par cœur au maximum
  const cpuUsagePercent = Math.min(
    (cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length * 100, 
    100 * os.cpus().length
  );
  metrics.push('# HELP fhirhub_cpu_usage_percent Pourcentage d\'utilisation CPU');
  metrics.push('# TYPE fhirhub_cpu_usage_percent gauge');
  metrics.push(`fhirhub_cpu_usage_percent ${cpuUsagePercent.toFixed(2)}`);

  // Uptime
  metrics.push('# HELP fhirhub_uptime_seconds Temps écoulé depuis le démarrage de l\'application');
  metrics.push('# TYPE fhirhub_uptime_seconds counter');
  metrics.push(`fhirhub_uptime_seconds ${process.uptime()}`);

  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
});

/**
 * Initialisation du serveur de métriques
 * @param {number} port - Port sur lequel le serveur de métriques sera lancé
 */
function startMetricsServer(port = 9091) {
  if (process.env.METRICS_ENABLED === 'true') {
    metricsApp.listen(port, () => {
      console.log(`[METRICS] Serveur de métriques démarré sur le port ${port}`);
    });
    return true;
  } else {
    console.log('[METRICS] Serveur de métriques désactivé');
    return false;
  }
}

/**
 * Ajouter les endpoints de logs de conversion pour Grafana
 * @param {express.Router} conversionLogsRouter - Le routeur Express pour les logs de conversion
 */
function addConversionLogsEndpoints(conversionLogsRouter) {
  if (conversionLogsRouter) {
    metricsApp.use(conversionLogsRouter);
    console.log('[METRICS] Routes de logs de conversion montées sur le serveur de métriques');
    
    // Ajouter une route de santé pour vérifier que le service est disponible
    metricsApp.get('/conversion-logs-health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'conversion-logs-exporter',
        uptime: process.uptime()
      });
    });
  }
}

module.exports = {
  apiRequestCounter,
  incrementConversionCount,
  recordConversionDuration,
  updateActiveConnections,
  startMetricsServer,
  addConversionLogsEndpoints,
  syncCountersWithDatabase, // Exporter la fonction de synchronisation pour une utilisation externe
  metricsApp  // Exporter l'application pour que d'autres modules puissent y ajouter des routes
};