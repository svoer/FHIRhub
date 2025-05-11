/**
 * Routes pour la gestion des clés API
 */

import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';

const router = express.Router();

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: Récupère toutes les clés API
 *     description: Récupère la liste de toutes les clés API
 *     tags: [API Keys]
 *     parameters:
 *       - in: query
 *         name: apiKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Clé API pour l'authentification
 *     responses:
 *       200:
 *         description: Liste des clés API
 *       401:
 *         description: Non autorisé
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const apiKeys = db.prepare(`
      SELECT 
        api_keys.id, 
        api_keys.key, 
        api_keys.name, 
        api_keys.application_id,
        applications.name as application_name,
        api_keys.is_active, 
        api_keys.created_at,
        api_keys.last_used_at
      FROM api_keys
      LEFT JOIN applications ON api_keys.application_id = applications.id
      ORDER BY api_keys.created_at DESC
    `).all();
    
    return res.status(200).json({ success: true, data: apiKeys });
  } catch (error) {
    console.error('[API Key List Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la récupération des clés API' });
  }
});

/**
 * @swagger
 * /api/api-keys:
 *   post:
 *     summary: Crée une nouvelle clé API
 *     description: Crée une nouvelle clé API pour une application
 *     tags: [API Keys]
 *     parameters:
 *       - in: query
 *         name: apiKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Clé API pour l'authentification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nom de la clé API
 *               application_id:
 *                 type: integer
 *                 description: ID de l'application associée
 *     responses:
 *       201:
 *         description: Clé API créée avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, application_id } = req.body;
    
    if (!name || !application_id) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Le nom et l\'ID d\'application sont requis' });
    }
    
    // Vérifier que l'application existe
    const application = db.prepare('SELECT id FROM applications WHERE id = ?').get(application_id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Application non trouvée' });
    }
    
    // Générer une nouvelle clé API
    const apiKey = uuidv4();
    
    // Insérer la clé API dans la base de données
    const result = db.prepare(`
      INSERT INTO api_keys (key, name, application_id, is_active, created_at)
      VALUES (?, ?, ?, 1, datetime('now'))
    `).run(apiKey, name, application_id);
    
    if (result.changes === 0) {
      throw new Error('Échec de l\'insertion de la clé API');
    }
    
    const newApiKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(result.lastInsertRowid);
    
    return res.status(201).json({ success: true, data: newApiKey });
  } catch (error) {
    console.error('[API Key Creation Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la création de la clé API' });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}:
 *   get:
 *     summary: Récupère une clé API par ID
 *     description: Récupère les détails d'une clé API spécifique
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *       - in: query
 *         name: apiKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Clé API pour l'authentification
 *     responses:
 *       200:
 *         description: Détails de la clé API
 *       404:
 *         description: Clé API non trouvée
 *       401:
 *         description: Non autorisé
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const apiKey = db.prepare(`
      SELECT 
        api_keys.id, 
        api_keys.key, 
        api_keys.name, 
        api_keys.application_id,
        applications.name as application_name,
        api_keys.is_active, 
        api_keys.created_at,
        api_keys.last_used_at
      FROM api_keys
      LEFT JOIN applications ON api_keys.application_id = applications.id
      WHERE api_keys.id = ?
    `).get(id);
    
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Clé API non trouvée' });
    }
    
    return res.status(200).json({ success: true, data: apiKey });
  } catch (error) {
    console.error('[API Key Get Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la récupération de la clé API' });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}:
 *   put:
 *     summary: Met à jour une clé API
 *     description: Met à jour les détails d'une clé API existante
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *       - in: query
 *         name: apiKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Clé API pour l'authentification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nouveau nom de la clé API
 *               is_active:
 *                 type: boolean
 *                 description: État d'activation de la clé API
 *     responses:
 *       200:
 *         description: Clé API mise à jour avec succès
 *       404:
 *         description: Clé API non trouvée
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    
    if (!name && is_active === undefined) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Aucune donnée à mettre à jour' });
    }
    
    // Vérifier que la clé API existe
    const apiKey = db.prepare('SELECT id FROM api_keys WHERE id = ?').get(id);
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Clé API non trouvée' });
    }
    
    // Construire la requête de mise à jour
    let updateQuery = 'UPDATE api_keys SET ';
    const updateParams = [];
    
    if (name) {
      updateQuery += 'name = ?';
      updateParams.push(name);
    }
    
    if (is_active !== undefined) {
      if (updateParams.length > 0) {
        updateQuery += ', ';
      }
      updateQuery += 'is_active = ?';
      updateParams.push(is_active ? 1 : 0);
    }
    
    updateQuery += ' WHERE id = ?';
    updateParams.push(id);
    
    // Exécuter la mise à jour
    const result = db.prepare(updateQuery).run(...updateParams);
    
    if (result.changes === 0) {
      return res.status(304).json({ success: true, message: 'Aucune modification apportée à la clé API' });
    }
    
    const updatedApiKey = db.prepare(`
      SELECT 
        api_keys.id, 
        api_keys.key, 
        api_keys.name, 
        api_keys.application_id,
        applications.name as application_name,
        api_keys.is_active, 
        api_keys.created_at,
        api_keys.last_used_at
      FROM api_keys
      LEFT JOIN applications ON api_keys.application_id = applications.id
      WHERE api_keys.id = ?
    `).get(id);
    
    return res.status(200).json({ success: true, data: updatedApiKey });
  } catch (error) {
    console.error('[API Key Update Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la mise à jour de la clé API' });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}:
 *   delete:
 *     summary: Supprime une clé API
 *     description: Supprime une clé API existante
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *       - in: query
 *         name: apiKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Clé API pour l'authentification
 *     responses:
 *       200:
 *         description: Clé API supprimée avec succès
 *       404:
 *         description: Clé API non trouvée
 *       401:
 *         description: Non autorisé
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Vérifier que la clé API existe
    const apiKey = db.prepare('SELECT id FROM api_keys WHERE id = ?').get(id);
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Clé API non trouvée' });
    }
    
    // Supprimer la clé API
    const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      throw new Error('Échec de la suppression de la clé API');
    }
    
    return res.status(200).json({ success: true, message: 'Clé API supprimée avec succès' });
  } catch (error) {
    console.error('[API Key Delete Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la suppression de la clé API' });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}/revoke:
 *   post:
 *     summary: Révoque une clé API
 *     description: Désactive une clé API sans la supprimer
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *       - in: query
 *         name: apiKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Clé API pour l'authentification
 *     responses:
 *       200:
 *         description: Clé API révoquée avec succès
 *       404:
 *         description: Clé API non trouvée
 *       401:
 *         description: Non autorisé
 */
router.post('/:id/revoke', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Vérifier que la clé API existe
    const apiKey = db.prepare('SELECT id, is_active FROM api_keys WHERE id = ?').get(id);
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Clé API non trouvée' });
    }
    
    if (apiKey.is_active === 0) {
      return res.status(304).json({ success: true, message: 'La clé API est déjà révoquée' });
    }
    
    // Révoquer la clé API
    const result = db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      throw new Error('Échec de la révocation de la clé API');
    }
    
    return res.status(200).json({ success: true, message: 'Clé API révoquée avec succès' });
  } catch (error) {
    console.error('[API Key Revoke Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la révocation de la clé API' });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}/regenerate:
 *   post:
 *     summary: Régénère une clé API
 *     description: Génère une nouvelle valeur pour une clé API existante
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *       - in: query
 *         name: apiKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Clé API pour l'authentification
 *     responses:
 *       200:
 *         description: Clé API régénérée avec succès
 *       404:
 *         description: Clé API non trouvée
 *       401:
 *         description: Non autorisé
 */
router.post('/:id/regenerate', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Vérifier que la clé API existe
    const apiKey = db.prepare('SELECT id FROM api_keys WHERE id = ?').get(id);
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Clé API non trouvée' });
    }
    
    // Générer une nouvelle clé API
    const newKey = uuidv4();
    
    // Mettre à jour la clé API
    const result = db.prepare('UPDATE api_keys SET key = ? WHERE id = ?').run(newKey, id);
    
    if (result.changes === 0) {
      throw new Error('Échec de la régénération de la clé API');
    }
    
    const updatedApiKey = db.prepare(`
      SELECT 
        api_keys.id, 
        api_keys.key, 
        api_keys.name, 
        api_keys.application_id,
        applications.name as application_name,
        api_keys.is_active, 
        api_keys.created_at,
        api_keys.last_used_at
      FROM api_keys
      LEFT JOIN applications ON api_keys.application_id = applications.id
      WHERE api_keys.id = ?
    `).get(id);
    
    return res.status(200).json({ success: true, data: updatedApiKey });
  } catch (error) {
    console.error('[API Key Regenerate Error]', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Erreur lors de la régénération de la clé API' });
  }
});

export default router;