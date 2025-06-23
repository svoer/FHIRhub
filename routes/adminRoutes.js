/**
 * Routes d'administration pour FHIRHub
 * Ces routes sont protégées et accessibles uniquement aux administrateurs
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
// Service DB supprimé lors du nettoyage - utilisation directe
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../storage/db/fhirhub.db'));
const logger = require('../src/utils/logger');

// Middleware pour vérifier que l'utilisateur est administrateur
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Droits administrateur requis.'
    });
  }
}

// Réinitialisation des statistiques uniquement
router.post('/reset-environment', (req, res) => {
  // Vérifier que nous sommes dans l'environnement de production
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'La réinitialisation des statistiques est désactivée en production'
    });
  }

  // Vérifier l'authentification via clé API uniquement
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== 'dev-key') {
    return res.status(401).json({
      success: false,
      message: 'Clé API invalide ou manquante'
    });
  }

  logger.info('[ADMIN] Demande de réinitialisation des statistiques reçue');

  // Pour éviter l'erreur, on confirme immédiatement
  res.status(200).json({
    success: true,
    message: 'Demande de réinitialisation des statistiques reçue',
    details: 'Le processus de réinitialisation a été lancé en arrière-plan. Les statistiques seront mises à jour.'
  });
  
  // Réinitialisation complète des statistiques et du compteur de conversions
  setTimeout(async () => {
    try {
      // Réinitialiser complètement la table des logs de conversion
      db.prepare(run('DELETE FROM conversion_logs');
      
      // Réinitialiser aussi les compteurs dans d'autres tables
      db.prepare(run('UPDATE api_usage_limits SET current_daily_usage = 0, current_monthly_usage = 0');
      
      // Réinitialiser les compteurs de conversion dans la table des workflows si elle existe
      try {
        db.prepare(run('UPDATE workflows SET conversions_count = 0 WHERE conversions_count IS NOT NULL');
      } catch (e) {
        // Ignorer si la colonne n'existe pas
        logger.debug(`[ADMIN] Note: La colonne conversions_count n'existe pas dans la table workflows: ${e.message}`);
      }
      
      // Nettoyer tous les fichiers de logs et d'historiques
      const logsPath = path.join(__dirname, '..', 'logs');
      fs.readdir(logsPath, (err, files) => {
        if (err) {
          logger.error(`[ADMIN] Erreur lors de la lecture du dossier logs: ${err.message}`);
          return;
        }
        
        // Supprimer tous les fichiers de logs liés aux conversions et aux stats
        files.forEach(file => {
          if (file.includes('conversion') || file.includes('stats') || file.includes('performance')) {
            fs.unlink(path.join(logsPath, file), err => {
              if (err) {
                logger.error(`[ADMIN] Erreur lors de la suppression du fichier de logs: ${err.message}`);
              }
            });
          }
        });
      });
      
      // Vider également les dossiers d'historique des conversions
      const historyPaths = [
        path.join(__dirname, '..', 'data', 'conversions'),
        path.join(__dirname, '..', 'data', 'history'),
        path.join(__dirname, '..', 'data', 'outputs')
      ];
      
      historyPaths.forEach(dirPath => {
        if (fs.existsSync(dirPath)) {
          fs.readdir(dirPath, (err, files) => {
            if (err) {
              logger.error(`[ADMIN] Erreur lors de la lecture du dossier ${dirPath}: ${err.message}`);
              return;
            }
            
            files.forEach(file => {
              // Ne pas supprimer les fichiers .gitkeep ou les dossiers
              if (file !== '.gitkeep') {
                const filePath = path.join(dirPath, file);
                if (fs.lstatSync(filePath).isFile()) {
                  fs.unlink(filePath, err => {
                    if (err) {
                      logger.error(`[ADMIN] Erreur lors de la suppression du fichier ${filePath}: ${err.message}`);
                    }
                  });
                }
              }
            });
          });
        }
      });
      
      // Journaliser la réinitialisation dans les logs système
      db.prepare(run(
        'INSERT INTO system_logs (event_type, message, severity) VALUES (?, ?, ?)',
        ['RESET_STATS', 'Réinitialisation complète des statistiques et compteurs effectuée', 'INFO']
      );
      
      logger.info('[ADMIN] Réinitialisation des statistiques terminée avec succès');
    } catch (e) {
      logger.error(`[ADMIN] Exception lors de la réinitialisation des statistiques: ${e.message}`);
    }
  }, 100);
});

// Récupération des logs système
router.get('/system-logs', authMiddleware.authenticated, adminOnly, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = db.prepare(query(
      'SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    
    return res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    logger.error(`[ADMIN] Erreur lors de la récupération des logs: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des logs système',
      error: error.message
    });
  }
});

module.exports = router;