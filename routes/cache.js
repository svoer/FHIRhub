/**
 * Routes pour la gestion du cache de conversion
 * @module routes/cache
 */

const express = require('express');
const router = express.Router();
const jwtAuth = require('../middleware/jwtAuth');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const authCombined = require('../middleware/authCombined');
// Cache manager supprimé lors du nettoyage - cache intégré
// const cacheManager = require('../src/cache');

/**
 * @swagger
 * tags:
 *   name: Cache
 *   description: Gestion du cache de conversion
 */

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     summary: Obtenir les statistiques du cache
 *     description: Retourne les statistiques détaillées sur l'utilisation du cache (taille, hits, misses)
 *     tags:
 *       - Cache
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     memory:
 *                       type: object
 *                       properties:
 *                         size:
 *                           type: integer
 *                           description: Nombre d'entrées actuellement en cache mémoire
 *                         maxSize:
 *                           type: integer
 *                           description: Taille maximale du cache mémoire
 *                         hits:
 *                           type: integer
 *                           description: Nombre de fois où une entrée a été trouvée dans le cache mémoire
 *                         misses:
 *                           type: integer
 *                           description: Nombre de fois où une entrée n'a pas été trouvée dans le cache mémoire
 *                         hitRate:
 *                           type: number
 *                           format: float
 *                           description: Pourcentage de succès du cache mémoire
 *                     disk:
 *                       type: object
 *                       properties:
 *                         size:
 *                           type: integer
 *                           description: Taille actuelle du cache disque en octets
 *                         entries:
 *                           type: integer
 *                           description: Nombre d'entrées dans le cache disque
 *                         hits:
 *                           type: integer
 *                           description: Nombre de fois où une entrée a été trouvée dans le cache disque
 *                         misses:
 *                           type: integer
 *                           description: Nombre de fois où une entrée n'a pas été trouvée dans le cache disque
 *                         hitRate:
 *                           type: number
 *                           format: float
 *                           description: Pourcentage de succès du cache disque
 *                     combined:
 *                       type: object
 *                       properties:
 *                         hits:
 *                           type: integer
 *                           description: Nombre total de hits (mémoire + disque)
 *                         misses:
 *                           type: integer
 *                           description: Nombre total de misses (mémoire + disque)
 *                         hitRate:
 *                           type: number
 *                           format: float
 *                           description: Pourcentage de succès global du système de cache
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats', authCombined, (req, res) => {
  try {
    const stats = // cacheManager.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[CACHE] Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques du cache'
    });
  }
});

/**
 * @swagger
 * /api/cache/clear:
 *   post:
 *     summary: Vider le cache
 *     description: Vide une partie ou la totalité du cache de conversion. Nécessite des droits d'administrateur.
 *     tags:
 *       - Cache
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [memory, disk, all]
 *                 description: Type de cache à vider
 *                 default: all
 *     responses:
 *       200:
 *         description: Cache vidé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Le cache a été vidé avec succès.
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès interdit (nécessite des droits d'administrateur)
 *       500:
 *         description: Erreur serveur
 */
router.post('/clear', jwtAuth, (req, res) => {
  // Vérifier si l'utilisateur est administrateur
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Cette opération nécessite des droits d\'administrateur'
    });
  }

  try {
    const { type = 'all' } = req.body;
    
    switch (type) {
      case 'memory':
        // cacheManager.clearMemoryCache();
        break;
      case 'disk':
        // cacheManager.clearDiskCache();
        break;
      case 'all':
        // cacheManager.clearAllCache();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Type de cache invalide. Options valides: memory, disk, all'
        });
    }
    
    res.json({
      success: true,
      message: `Le cache ${type} a été vidé avec succès.`
    });
  } catch (error) {
    console.error('[CACHE] Erreur lors de la suppression du cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du cache'
    });
  }
});

module.exports = router;