/**
 * Routes pour la gestion des clés API
 */
const express = require('express');
const router = express.Router();
const authCombined = require('../middleware/authCombined');

/**
 * @swagger
 * /api/api-keys/count:
 *   get:
 *     summary: Obtenir le nombre de clés API
 *     description: Retourne le nombre total de clés API dans le système
 *     tags: [API Keys]
 *     responses:
 *       200:
 *         description: Nombre de clés API récupéré avec succès
 *       500:
 *         description: Erreur serveur
 */
router.get('/count', (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = db.prepare('SELECT COUNT(*) as count FROM api_keys').get();
    
    res.json({
      success: true,
      count: result ? result.count : 0
    });
  } catch (error) {
    console.error('[API] Erreur lors du comptage des clés API:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur de comptage des clés API',
      count: 0
    });
  }
});

/**
 * @swagger
 * tags:
 *   name: API Keys
 *   description: Gestion des clés API
 */

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: Récupérer toutes les clés API
 *     description: Récupère la liste de toutes les clés API
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des clés API récupérée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/', authCombined, (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const apiKeys = db.prepare(`
      SELECT ak.*, a.name as application_name
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      ORDER BY ak.created_at DESC
    `).all();
    
    res.json({
      success: true,
      data: apiKeys
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération des clés API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}:
 *   get:
 *     summary: Récupérer une clé API par son ID
 *     description: Récupère les détails d'une clé API spécifique
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Détails de la clé API récupérés avec succès
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    const apiKey = db.prepare(`
      SELECT ak.*, a.name as application_name
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      WHERE ak.id = ?
    `).get(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération de la clé API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys:
 *   post:
 *     summary: Créer une nouvelle clé API
 *     description: Crée une nouvelle clé API pour une application
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - application_id
 *             properties:
 *               application_id:
 *                 type: integer
 *               description:
 *                 type: string
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *               custom_key:
 *                 type: string
 *                 description: Clé API personnalisée (sinon une clé sera générée automatiquement)
 *     responses:
 *       201:
 *         description: Clé API créée avec succès
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/', authCombined, (req, res) => {
  try {
    const { application_id, description, expires_at, custom_key } = req.body;
    
    if (!application_id) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'L\'ID de l\'application est requis'
      });
    }
    
    const db = req.app.locals.db;
    
    // Vérifier si l'application existe
    const application = db.prepare('SELECT id FROM applications WHERE id = ?').get(application_id);
    
    if (!application) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Application non trouvée'
      });
    }
    
    // Générer ou utiliser la clé API fournie
    const apiKey = custom_key || require('crypto').randomBytes(32).toString('hex');
    
    // Créer le hash de la clé API
    const hashedKey = require('crypto').createHash('sha256').update(apiKey).digest('hex');

    // Insérer la clé API avec le schéma correct incluant hashed_key et is_active
    const result = db.prepare(`
      INSERT INTO api_keys (
        application_id, key, hashed_key, description, is_active, expires_at, created_at
      ) VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
    `).run(
      application_id,
      apiKey,
      hashedKey,
      description || 'Clé API',
      expires_at || null
    );
    
    // Récupérer la clé API créée
    const createdApiKey = db.prepare(`
      SELECT ak.*, a.name as application_name
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      WHERE ak.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: createdApiKey
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la création de la clé API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}/revoke:
 *   post:
 *     summary: Révoquer une clé API
 *     description: Désactive une clé API existante
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Clé API révoquée avec succès
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.post('/:id/revoke', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si la clé API existe
    const apiKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    // Révoquer la clé API
    db.prepare(`
      UPDATE api_keys
      SET is_active = 0
      WHERE id = ?
    `).run(id);
    
    res.json({
      success: true,
      message: 'Clé API révoquée avec succès'
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la révocation de la clé API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}/activate:
 *   post:
 *     summary: Activer une clé API
 *     description: Active une clé API révoquée
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Clé API activée avec succès
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.post('/:id/activate', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si la clé API existe
    const apiKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    // Activer la clé API
    db.prepare(`
      UPDATE api_keys
      SET is_active = 1
      WHERE id = ?
    `).run(id);
    
    res.json({
      success: true,
      message: 'Clé API activée avec succès'
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de l\'activation de la clé API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}:
 *   delete:
 *     summary: Supprimer une clé API
 *     description: Supprime définitivement une clé API
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Clé API supprimée avec succès
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si la clé API existe
    const apiKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    // Supprimer la clé API
    db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: 'Clé API supprimée avec succès'
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la suppression de la clé API'
    });
  }
});

module.exports = router;