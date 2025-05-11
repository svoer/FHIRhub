/**
 * Routes pour la gestion des applications
 */

import express, { Request, Response } from 'express';
import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Récupère toutes les applications
 *     description: Récupère la liste de toutes les applications enregistrées
 *     tags: [Applications]
 *     responses:
 *       200:
 *         description: Liste des applications
 *       401:
 *         description: Non autorisé
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const applications = db.prepare(`
      SELECT 
        applications.id, 
        applications.name, 
        applications.description, 
        applications.created_at,
        applications.updated_at,
        (SELECT COUNT(*) FROM api_keys WHERE api_keys.application_id = applications.id) as api_key_count,
        (SELECT COUNT(*) FROM conversion_logs WHERE conversion_logs.application_id = applications.id) as conversion_count
      FROM applications
      ORDER BY applications.created_at DESC
    `).all();
    
    return res.status(200).json({ success: true, data: applications });
  } catch (error) {
    console.error('[Application List Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la récupération des applications' });
  }
});

/**
 * @swagger
 * /api/applications:
 *   post:
 *     summary: Crée une nouvelle application
 *     description: Crée une nouvelle application avec des paramètres personnalisés
 *     tags: [Applications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nom de l'application
 *               description:
 *                 type: string
 *                 description: Description de l'application
 *               settings:
 *                 type: object
 *                 description: Paramètres personnalisés de l'application
 *     responses:
 *       201:
 *         description: Application créée avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, settings } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Le nom de l\'application est requis' });
    }
    
    // Convertir les paramètres en JSON
    const settingsJson = settings ? JSON.stringify(settings) : '{}';
    
    // Insérer l'application dans la base de données
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO applications (name, description, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description || '', settingsJson, now, now);
    
    if (result.changes === 0) {
      throw new Error('Échec de l\'insertion de l\'application');
    }
    
    // Récupérer l'application créée
    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);
    
    // Créer une clé API par défaut pour l'application
    const apiKey = uuidv4();
    const apiKeyName = `${name} - Clé par défaut`;
    
    db.prepare(`
      INSERT INTO api_keys (key, name, application_id, is_active, created_at)
      VALUES (?, ?, ?, 1, datetime('now'))
    `).run(apiKey, apiKeyName, application.id);
    
    return res.status(201).json({ success: true, data: { ...application, api_key: apiKey } });
  } catch (error) {
    console.error('[Application Creation Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la création de l\'application' });
  }
});

/**
 * @swagger
 * /api/applications/{id}:
 *   get:
 *     summary: Récupère une application par ID
 *     description: Récupère les détails d'une application spécifique
 *     tags: [Applications]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'application
 *     responses:
 *       200:
 *         description: Détails de l'application
 *       404:
 *         description: Application non trouvée
 *       401:
 *         description: Non autorisé
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const application = db.prepare(`
      SELECT 
        applications.id, 
        applications.name, 
        applications.description, 
        applications.settings,
        applications.created_at,
        applications.updated_at,
        (SELECT COUNT(*) FROM api_keys WHERE api_keys.application_id = applications.id) as api_key_count,
        (SELECT COUNT(*) FROM conversion_logs WHERE conversion_logs.application_id = applications.id) as conversion_count
      FROM applications
      WHERE applications.id = ?
    `).get(id);
    
    if (!application) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Application non trouvée' });
    }
    
    // Récupérer les clés API associées
    const apiKeys = db.prepare(`
      SELECT id, key, name, is_active, created_at, last_used_at
      FROM api_keys
      WHERE application_id = ?
      ORDER BY created_at DESC
    `).all(id);
    
    // Récupérer les statistiques de conversion
    const conversionStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        AVG(processing_time) as avg_time
      FROM conversion_logs
      WHERE application_id = ?
    `).get(id);
    
    // Convertir les paramètres JSON
    let settings = {};
    try {
      settings = JSON.parse(application.settings || '{}');
    } catch (e) {
      console.error('Erreur lors du parsing des paramètres:', e);
    }
    
    const result = {
      ...application,
      settings,
      api_keys: apiKeys,
      stats: conversionStats
    };
    
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[Application Get Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la récupération de l\'application' });
  }
});

/**
 * @swagger
 * /api/applications/{id}:
 *   put:
 *     summary: Met à jour une application
 *     description: Met à jour les détails d'une application existante
 *     tags: [Applications]
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
 *                 description: Nouveau nom de l'application
 *               description:
 *                 type: string
 *                 description: Nouvelle description de l'application
 *               settings:
 *                 type: object
 *                 description: Nouveaux paramètres de l'application
 *     responses:
 *       200:
 *         description: Application mise à jour avec succès
 *       404:
 *         description: Application non trouvée
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, settings } = req.body;
    
    if (!name && !description && !settings) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Aucune donnée à mettre à jour' });
    }
    
    // Vérifier que l'application existe
    const application = db.prepare('SELECT id, settings FROM applications WHERE id = ?').get(id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Application non trouvée' });
    }
    
    // Fusionner les paramètres existants avec les nouveaux
    let currentSettings = {};
    try {
      currentSettings = JSON.parse(application.settings || '{}');
    } catch (e) {
      console.error('Erreur lors du parsing des paramètres existants:', e);
    }
    
    const mergedSettings = settings ? { ...currentSettings, ...settings } : currentSettings;
    const settingsJson = JSON.stringify(mergedSettings);
    
    // Construire la requête de mise à jour
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE applications SET 
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        settings = COALESCE(?, settings),
        updated_at = ?
      WHERE id = ?
    `).run(name || null, description || null, settingsJson, now, id);
    
    if (result.changes === 0) {
      return res.status(304).json({ success: true, message: 'Aucune modification apportée à l\'application' });
    }
    
    const updatedApplication = db.prepare(`
      SELECT 
        applications.id, 
        applications.name, 
        applications.description, 
        applications.settings,
        applications.created_at,
        applications.updated_at
      FROM applications
      WHERE applications.id = ?
    `).get(id);
    
    // Convertir les paramètres JSON pour la réponse
    let updatedSettings = {};
    try {
      updatedSettings = JSON.parse(updatedApplication.settings || '{}');
    } catch (e) {
      console.error('Erreur lors du parsing des paramètres mis à jour:', e);
    }
    
    return res.status(200).json({ 
      success: true, 
      data: {
        ...updatedApplication,
        settings: updatedSettings
      }
    });
  } catch (error) {
    console.error('[Application Update Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la mise à jour de l\'application' });
  }
});

/**
 * @swagger
 * /api/applications/{id}:
 *   delete:
 *     summary: Supprime une application
 *     description: Supprime une application existante et toutes ses clés API associées
 *     tags: [Applications]
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
 *       401:
 *         description: Non autorisé
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'application existe
    const application = db.prepare('SELECT id FROM applications WHERE id = ?').get(id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Application non trouvée' });
    }
    
    // Supprimer les clés API associées
    db.prepare('DELETE FROM api_keys WHERE application_id = ?').run(id);
    
    // Supprimer l'application
    const result = db.prepare('DELETE FROM applications WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      throw new Error('Échec de la suppression de l\'application');
    }
    
    return res.status(200).json({ success: true, message: 'Application et ses clés API supprimées avec succès' });
  } catch (error) {
    console.error('[Application Delete Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la suppression de l\'application' });
  }
});

export default router;