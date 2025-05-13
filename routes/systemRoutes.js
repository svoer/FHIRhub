/**
 * Routes système pour FHIRHub
 * Fournit des endpoints pour la supervision et le monitoring de l'application
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');
const { db } = require('../utils/dbService');
const packageInfo = require('../package.json');

// Health check pour les conteneurs Docker et les outils de monitoring
router.get('/health', (req, res) => {
  try {
    // Vérifications simples de l'état du système
    const health = {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: Date.now(),
      database: 'UP',
      checks: {
        memory: process.memoryUsage().rss < 1024 * 1024 * 1000 ? 'OK' : 'WARNING', // Alerte si > 1GB
        diskSpace: 'OK' // Par défaut ok, sera modifié si problème
      }
    };

    // Vérifier l'accès à la base de données
    try {
      // Requête simple pour vérifier la connectivité à la base de données
      const result = db.prepare('SELECT 1').get();
      if (!result) {
        health.database = 'DOWN';
        health.status = 'DEGRADED';
      }
    } catch (dbError) {
      console.error('[HEALTH] Erreur de base de données:', dbError);
      health.database = 'DOWN';
      health.status = 'DEGRADED';
    }

    // Vérifier l'espace disque (simplifié)
    try {
      const storageDir = path.join(__dirname, '../storage');
      fs.accessSync(storageDir, fs.constants.W_OK);
    } catch (fsError) {
      console.error('[HEALTH] Erreur d\'accès au système de fichiers:', fsError);
      health.checks.diskSpace = 'ERROR';
      health.status = 'DEGRADED';
    }

    // Renvoyer un statut HTTP approprié selon l'état
    const httpStatus = health.status === 'UP' ? 200 : 503;
    return res.status(httpStatus).json(health);
  } catch (error) {
    console.error('[HEALTH] Erreur lors du health check:', error);
    return res.status(500).json({
      status: 'DOWN',
      error: error.message
    });
  }
});

// Informations sur la version du système
router.get('/version', (req, res) => {
  try {
    const versionInfo = {
      success: true,
      data: {
        version: packageInfo.version || global.APP_VERSION || '1.5.0',
        node_version: process.version,
        build_date: packageInfo.buildDate || new Date().toISOString(),
        os: {
          type: os.type(),
          platform: os.platform(),
          release: os.release(),
          arch: os.arch()
        }
      }
    };
    
    return res.status(200).json(versionInfo);
  } catch (error) {
    console.error('[SYSTEM] Erreur lors de la récupération des informations de version:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne',
      message: 'Impossible de récupérer les informations de version'
    });
  }
});

// Informations complètes sur le système
router.get('/info', (req, res) => {
  try {
    const systemInfo = {
      success: true,
      data: {
        version: packageInfo.version || global.APP_VERSION || '1.5.0',
        node: {
          version: process.version,
          environment: process.env.NODE_ENV || 'development',
          memory: process.memoryUsage(),
          uptime: process.uptime()
        },
        os: {
          type: os.type(),
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
          cpus: os.cpus().length,
          memory: {
            total: os.totalmem(),
            free: os.freemem()
          },
          uptime: os.uptime()
        },
        // Ajoutez d'autres informations pertinentes selon vos besoins
      }
    };
    
    return res.status(200).json(systemInfo);
  } catch (error) {
    console.error('[SYSTEM] Erreur lors de la récupération des informations système:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne',
      message: 'Impossible de récupérer les informations système'
    });
  }
});

module.exports = router;