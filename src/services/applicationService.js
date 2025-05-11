/**
 * Service de gestion des applications pour FHIRHub
 * Permet la création, modification et suppression des applications
 */

const dbService = require('./dbService');
const apiKeyService = require('./apiKeyService');

/**
 * Créer une nouvelle application
 * @param {Object} appData - Données de l'application
 * @returns {Promise<Object>} Application créée
 */
async function createApplication(appData) {
  try {
    // S'assurer que les champs obligatoires sont présents
    if (!appData.name || !appData.created_by) {
      throw new Error('Le nom de l\'application et l\'identifiant du créateur sont obligatoires');
    }
    
    // Vérifier si une application avec le même nom existe déjà
    const existingApp = await dbService.get(
      'SELECT id FROM applications WHERE name = ?',
      [appData.name]
    );
    
    if (existingApp) {
      throw new Error(`Une application avec le nom "${appData.name}" existe déjà`);
    }
    
    // Insérer l'application dans la base de données
    const result = await dbService.run(
      `INSERT INTO applications (
        name, description, created_by, status
      ) VALUES (?, ?, ?, ?)`,
      [
        appData.name,
        appData.description || '',
        appData.created_by,
        appData.status || 'active'
      ]
    );
    
    // Récupérer l'application créée
    const createdApp = await getApplication(result.lastID);
    
    // Créer une clé API par défaut pour cette application
    if (createdApp) {
      const defaultKey = await apiKeyService.createApiKey({
        application_id: createdApp.id,
        name: 'Clé par défaut',
        environment: 'development'
      });
      
      createdApp.default_key = defaultKey;
    }
    
    return createdApp;
  } catch (error) {
    console.error('[APPLICATION] Erreur lors de la création de l\'application:', error);
    throw error;
  }
}

/**
 * Obtenir une application par son ID
 * @param {number} id - ID de l'application
 * @returns {Promise<Object|null>} Application ou null si non trouvée
 */
async function getApplication(id) {
  try {
    const app = await dbService.get(
      `SELECT a.*, u.username as owner_name
      FROM applications a
      LEFT JOIN users u ON a.owner_id = u.id
      WHERE a.id = ?`,
      [id]
    );
    
    if (!app) {
      return null;
    }
    
    // Récupérer les clés API de l'application
    const apiKeys = await apiKeyService.getApiKeysByApplication(id);
    
    return {
      ...app,
      api_keys: apiKeys
    };
  } catch (error) {
    console.error('[APPLICATION] Erreur lors de la récupération de l\'application:', error);
    return null;
  }
}

/**
 * Obtenir toutes les applications
 * @param {Object} options - Options de filtrage
 * @returns {Promise<Array>} Liste des applications
 */
async function getAllApplications(options = {}) {
  try {
    let query = `
      SELECT a.*, u.username as owner_name,
        (SELECT COUNT(*) FROM api_keys WHERE application_id = a.id) as key_count,
        (SELECT SUM(usage_count) FROM api_keys WHERE application_id = a.id) as total_usage
      FROM applications a
      LEFT JOIN users u ON a.owner_id = u.id
    `;
    
    const whereConditions = [];
    const queryParams = [];
    
    // Filtrer par propriétaire
    if (options.owner_id) {
      whereConditions.push('a.owner_id = ?');
      queryParams.push(options.owner_id);
    }
    
    // Filtrer par statut
    if (options.status) {
      whereConditions.push('a.status = ?');
      queryParams.push(options.status);
    }
    
    // Filtrer par recherche
    if (options.search) {
      whereConditions.push('(a.name LIKE ? OR a.description LIKE ?)');
      queryParams.push(`%${options.search}%`, `%${options.search}%`);
    }
    
    // Construire la clause WHERE si nécessaire
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    // Ajouter l'ordre par défaut
    query += ` ORDER BY ${options.orderBy || 'a.created_at'} ${options.order || 'DESC'}`;
    
    // Ajouter la pagination si spécifiée
    if (options.limit) {
      query += ' LIMIT ?';
      queryParams.push(options.limit);
      
      if (options.offset) {
        query += ' OFFSET ?';
        queryParams.push(options.offset);
      }
    }
    
    return await dbService.query(query, queryParams);
  } catch (error) {
    console.error('[APPLICATION] Erreur lors de la récupération des applications:', error);
    return [];
  }
}

/**
 * Mettre à jour une application
 * @param {number} id - ID de l'application
 * @param {Object} updateData - Données à mettre à jour
 * @returns {Promise<boolean>} True si la mise à jour a réussi
 */
async function updateApplication(id, updateData) {
  try {
    // Vérifier si l'application existe
    const existingApp = await dbService.get(
      'SELECT id FROM applications WHERE id = ?',
      [id]
    );
    
    if (!existingApp) {
      return false;
    }
    
    // Vérifier si le nouveau nom est déjà utilisé par une autre application
    if (updateData.name) {
      const appWithSameName = await dbService.get(
        'SELECT id FROM applications WHERE name = ? AND id != ?',
        [updateData.name, id]
      );
      
      if (appWithSameName) {
        throw new Error(`Une application avec le nom "${updateData.name}" existe déjà`);
      }
    }
    
    // Préparer les champs et valeurs à mettre à jour
    const updateFields = [];
    const updateValues = [];
    
    // Champs autorisés à mettre à jour
    const allowedFields = ['name', 'description', 'status', 'owner_id'];
    
    // Construire la requête de mise à jour
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updateData[field]);
      }
    }
    
    // Si aucun champ n'est à mettre à jour, retourner true
    if (updateFields.length === 0) {
      return true;
    }
    
    // Ajouter l'ID à la fin des valeurs pour la clause WHERE
    updateValues.push(id);
    
    // Exécuter la mise à jour
    const result = await dbService.run(
      `UPDATE applications SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      updateValues
    );
    
    return result.changes > 0;
  } catch (error) {
    console.error('[APPLICATION] Erreur lors de la mise à jour de l\'application:', error);
    throw error;
  }
}

/**
 * Supprimer une application
 * @param {number} id - ID de l'application
 * @returns {Promise<boolean>} True si la suppression a réussi
 */
async function deleteApplication(id) {
  try {
    // Vérifier si l'application existe
    const existingApp = await dbService.get(
      'SELECT id FROM applications WHERE id = ?',
      [id]
    );
    
    if (!existingApp) {
      return false;
    }
    
    // Supprimer toutes les clés API associées à l'application
    const apiKeys = await dbService.query(
      'SELECT id FROM api_keys WHERE application_id = ?',
      [id]
    );
    
    for (const key of apiKeys) {
      await apiKeyService.deleteApiKey(key.id);
    }
    
    // Supprimer les limites d'utilisation des API
    await dbService.run(
      'DELETE FROM api_usage_limits WHERE application_id = ?',
      [id]
    );
    
    // Supprimer les journaux de conversion
    await dbService.run(
      'DELETE FROM conversion_logs WHERE application_id = ?',
      [id]
    );
    
    // Supprimer l'application
    const result = await dbService.run(
      'DELETE FROM applications WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  } catch (error) {
    console.error('[APPLICATION] Erreur lors de la suppression de l\'application:', error);
    return false;
  }
}

/**
 * Obtenir les statistiques d'utilisation d'une application
 * @param {number} id - ID de l'application
 * @returns {Promise<Object>} Statistiques d'utilisation
 */
async function getApplicationStats(id) {
  try {
    // Vérifier si l'application existe
    const app = await dbService.get(
      'SELECT id, name FROM applications WHERE id = ?',
      [id]
    );
    
    if (!app) {
      throw new Error('Application non trouvée');
    }
    
    // Récupérer les statistiques générales
    const generalStats = await dbService.get(
      `SELECT 
        COUNT(k.id) as total_keys,
        SUM(k.usage_count) as total_usage,
        SUM(CASE WHEN k.active = 1 THEN 1 ELSE 0 END) as active_keys,
        SUM(CASE WHEN k.active = 0 THEN 1 ELSE 0 END) as inactive_keys,
        (SELECT COUNT(*) FROM conversion_logs WHERE application_id = ?) as total_conversions
      FROM api_keys k
      WHERE k.application_id = ?`,
      [id, id]
    );
    
    // Récupérer les statistiques des clés API
    const keyStats = await dbService.query(
      `SELECT 
        k.id, k.key, k.name, k.environment, k.usage_count, k.active,
        (SELECT COUNT(*) FROM conversion_logs WHERE api_key_id = k.id) as conversion_count
      FROM api_keys k
      WHERE k.application_id = ?
      ORDER BY k.usage_count DESC`,
      [id]
    );
    
    // Récupérer les statistiques des conversions par jour (30 derniers jours)
    const dailyStats = await dbService.query(
      `SELECT 
        date(c.created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN c.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN c.status != 'success' THEN 1 ELSE 0 END) as error_count,
        AVG(c.processing_time) as avg_processing_time
      FROM conversion_logs c
      WHERE c.application_id = ? AND c.created_at > datetime('now', '-30 days')
      GROUP BY date(c.created_at)
      ORDER BY date(c.created_at) DESC`,
      [id]
    );
    
    // Récupérer les statistiques des conversions par type de source
    const sourceTypeStats = await dbService.query(
      `SELECT 
        c.source_type,
        COUNT(*) as count,
        SUM(CASE WHEN c.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN c.status != 'success' THEN 1 ELSE 0 END) as error_count
      FROM conversion_logs c
      WHERE c.application_id = ?
      GROUP BY c.source_type
      ORDER BY count DESC`,
      [id]
    );
    
    return {
      application: app,
      generalStats: generalStats || {
        total_keys: 0,
        total_usage: 0,
        active_keys: 0,
        inactive_keys: 0,
        total_conversions: 0
      },
      keyStats: keyStats || [],
      dailyStats: dailyStats || [],
      sourceTypeStats: sourceTypeStats || []
    };
  } catch (error) {
    console.error('[APPLICATION] Erreur lors de la récupération des statistiques d\'application:', error);
    
    return {
      application: { id, name: 'Application non trouvée' },
      generalStats: {
        total_keys: 0,
        total_usage: 0,
        active_keys: 0,
        inactive_keys: 0,
        total_conversions: 0
      },
      keyStats: [],
      dailyStats: [],
      sourceTypeStats: []
    };
  }
}

module.exports = {
  createApplication,
  getApplication,
  getAllApplications,
  updateApplication,
  deleteApplication,
  getApplicationStats
};