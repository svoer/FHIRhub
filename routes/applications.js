/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Lister toutes les applications
 *     description: Récupère la liste de toutes les applications enregistrées dans le système
 *     tags: [Administration]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des applications récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Application'
 *             examples:
 *               applications:
 *                 summary: "Liste d'applications"
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 1
 *                       name: "Application Production"
 *                       description: "Application principale pour l'environnement de production"
 *                       created_at: "2025-06-18T10:30:00Z"
 *                       updated_at: "2025-06-18T10:30:00Z"
 *                     - id: 2
 *                       name: "Application Test"
 *                       description: "Application de test et développement"
 *                       created_at: "2025-06-18T11:00:00Z"
 *                       updated_at: "2025-06-18T11:00:00Z"
 *   post:
 *     summary: Créer une nouvelle application
 *     description: Crée une nouvelle application dans le système
 *     tags: [Administration]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 description: Nom de l'application
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Description de l'application
 *           examples:
 *             newApp:
 *               summary: "Nouvelle application"
 *               value:
 *                 name: "Application Mobile"
 *                 description: "Application mobile pour la conversion HL7 en déplacement"
 *     responses:
 *       201:
 *         description: Application créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Application'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * Routes pour la gestion des applications
 */
const express = require('express');
const router = express.Router();
const authCombined = require('../middleware/authCombined');

/**
 * @swagger
 * tags:
 *   name: Applications
 *   description: Gestion des applications
 */

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Récupérer toutes les applications
 *     description: Récupère la liste de toutes les applications
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des applications récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       cors_origins:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/', authCombined, (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const applications = db.prepare(`
      SELECT id, name, description, cors_origins, created_at, updated_at
      FROM applications
      ORDER BY name ASC
    `).all();
    
    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('[APPLICATIONS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération des applications'
    });
  }
});

/**
 * @swagger
 * /api/applications/{id}:
 *   get:
 *     summary: Récupérer une application par son ID
 *     description: Récupère les détails d'une application spécifique
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'application
 *     responses:
 *       200:
 *         description: Détails de l'application récupérés avec succès
 *       404:
 *         description: Application non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    const application = db.prepare(`
      SELECT a.*, u.username as created_by_username
      FROM applications a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `).get(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Récupérer les clés API de l'application
    const apiKeys = db.prepare(`
      SELECT id, key, description, is_active, created_at, last_used_at, expires_at
      FROM api_keys
      WHERE application_id = ?
      ORDER BY created_at DESC
    `).all(id);
    
    // Formater les données
    const result = {
      ...application,
      settings: application.settings ? JSON.parse(application.settings) : {},
      api_keys: apiKeys
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[APPLICATIONS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération de l\'application'
    });
  }
});

/**
 * @swagger
 * /api/applications:
 *   post:
 *     summary: Créer une nouvelle application
 *     description: Crée une nouvelle application avec les paramètres fournis
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               cors_origins:
 *                 type: string
 *               settings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Application créée avec succès
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/', authCombined, (req, res) => {
  try {
    const { name, description, cors_origins, settings } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le nom de l\'application est requis'
      });
    }
    
    const db = req.app.locals.db;
    
    // Vérifier si l'application existe déjà
    const existingApp = db.prepare('SELECT id FROM applications WHERE name = ?').get(name);
    
    if (existingApp) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Une application avec ce nom existe déjà'
      });
    }
    
    // Récupérer l'ID de l'utilisateur admin (pour le moment, on utilise l'admin)
    const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    
    if (!adminUser) {
      return res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Utilisateur admin non trouvé'
      });
    }
    
    // Insérer l'application
    const result = db.prepare(`
      INSERT INTO applications (
        name, description, cors_origins, settings, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).run(
      name, 
      description || null, 
      cors_origins || null, 
      settings ? JSON.stringify(settings) : JSON.stringify({}),
      adminUser.id
    );
    
    // Récupérer l'application créée
    const createdApp = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: {
        ...createdApp,
        settings: createdApp.settings ? JSON.parse(createdApp.settings) : {}
      }
    });
  } catch (error) {
    console.error('[APPLICATIONS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la création de l\'application'
    });
  }
});

/**
 * @swagger
 * /api/applications/{id}:
 *   put:
 *     summary: Mettre à jour une application
 *     description: Met à jour les informations d'une application existante
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'application
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               cors_origins:
 *                 type: string
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Application mise à jour avec succès
 *       404:
 *         description: Application non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, cors_origins, settings } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le nom de l\'application est requis'
      });
    }
    
    const db = req.app.locals.db;
    
    // Vérifier si l'application existe
    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Mettre à jour l'application
    db.prepare(`
      UPDATE applications
      SET name = ?, description = ?, cors_origins = ?, settings = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name,
      description || application.description,
      cors_origins !== undefined ? cors_origins : application.cors_origins,
      settings ? JSON.stringify(settings) : application.settings,
      id
    );
    
    // Récupérer l'application mise à jour
    const updatedApplication = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    
    res.json({
      success: true,
      data: {
        ...updatedApplication,
        settings: updatedApplication.settings ? JSON.parse(updatedApplication.settings) : {}
      }
    });
  } catch (error) {
    console.error('[APPLICATIONS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la mise à jour de l\'application'
    });
  }
});

/**
 * @swagger
 * /api/applications/{id}:
 *   delete:
 *     summary: Supprimer une application
 *     description: Supprime une application et toutes ses clés API associées
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'application
 *     responses:
 *       200:
 *         description: Application supprimée avec succès
 *       404:
 *         description: Application non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si l'application existe
    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Supprimer les clés API associées
    db.prepare('DELETE FROM api_keys WHERE application_id = ?').run(id);
    
    // Supprimer l'application
    db.prepare('DELETE FROM applications WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: 'Application supprimée avec succès'
    });
  } catch (error) {
    console.error('[APPLICATIONS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la suppression de l\'application'
    });
  }
});

/**
 * @swagger
 * /api/applications/{id}/stats:
 *   get:
 *     summary: Obtenir les statistiques de conversion d'une application
 *     description: Récupère les statistiques des conversions effectuées pour une application spécifique
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'application
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *       404:
 *         description: Application non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id/stats', authCombined, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si l'application existe
    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Récupérer les statistiques de conversion
    const conversionLogService = require('../src/services/conversionLogService');
    const stats = conversionLogService.getApplicationStats(id);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[APPLICATIONS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération des statistiques'
    });
  }
});

/**
 * @swagger
 * /api/applications/{id}/conversions:
 *   get:
 *     summary: Obtenir l'historique des conversions d'une application
 *     description: Récupère la liste des conversions effectuées pour une application spécifique avec pagination
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'application
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Nombre d'éléments par page
 *     responses:
 *       200:
 *         description: Conversions récupérées avec succès
 *       404:
 *         description: Application non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id/conversions', authCombined, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, include_null = 'false' } = req.query;
    const db = req.app.locals.db;
    
    // Vérifier si l'application existe
    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Récupérer les conversions avec pagination
    const conversionLogService = require('../src/services/conversionLogService');
    const result = conversionLogService.getConversionsForApplication(id, {
      page: parseInt(page),
      limit: parseInt(limit),
      include_null: include_null === 'true'
    });
    const conversions = result.data;
    
    // Le nombre total est déjà inclus dans la réponse du service
    const totalCount = result.pagination.total;
    
    res.json({
      success: true,
      data: {
        conversions: conversions,
        page: result.pagination.page,
        limit: result.pagination.limit,
        totalPages: result.pagination.totalPages,
        totalCount: result.pagination.total
      },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[APPLICATIONS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération des conversions'
    });
  }
});

/**
 * @swagger
 * /api/applications/{id}/conversions/{conversionId}:
 *   get:
 *     summary: Obtenir les détails d'une conversion
 *     description: Récupère les détails complets d'une conversion spécifique d'une application
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'application
 *       - in: path
 *         name: conversionId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la conversion
 *     responses:
 *       200:
 *         description: Détails de la conversion récupérés avec succès
 *       404:
 *         description: Application ou conversion non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id/conversions/:conversionId', authCombined, async (req, res) => {
  try {
    const { id, conversionId } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si l'application existe
    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Récupérer les détails de la conversion directement de la base de données
    const conversion = db.prepare('SELECT * FROM conversion_logs WHERE id = ? AND application_id = ?').get(conversionId, id);
    
    if (!conversion) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Conversion non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: conversion
    });
  } catch (error) {
    console.error('[APPLICATIONS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération des détails de la conversion'
    });
  }
});

module.exports = router;