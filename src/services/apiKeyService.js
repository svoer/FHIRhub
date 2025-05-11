/**
 * Service de gestion des clés API pour FHIRHub
 * Gère la création, vérification et révocation des clés API
 */

const dbService = require('./dbService');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Créer une nouvelle clé API
 * @param {Object} keyData - Données de la clé API
 * @returns {Promise<Object>} Clé API créée
 */
async function createApiKey(keyData) {
  try {
    // S'assurer que les champs obligatoires sont présents
    if (!keyData.application_id || !keyData.name) {
      throw new Error('L\'identifiant de l\'application et le nom de la clé sont obligatoires');
    }
    
    // Générer une clé API unique
    const apiKey = generateApiKey();
    
    // Insérer la clé API dans la base de données
    const result = await dbService.run(
      `INSERT INTO api_keys (
        application_id, key, hashed_key, description, 
        is_active, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        keyData.application_id,
        apiKey,
        apiKey, // Utilisé comme hashed_key temporairement
        keyData.name, // Utilisé comme description
        keyData.active !== undefined ? keyData.active : 1,
        keyData.expires_at || null
      ]
    );
    
    // Si spécifié, créer également des limites d'utilisation personnalisées
    if (keyData.daily_limit || keyData.monthly_limit) {
      await dbService.run(
        `INSERT INTO api_usage_limits (
          application_id, api_key_id, daily_limit, monthly_limit
        ) VALUES (?, ?, ?, ?)`,
        [
          keyData.application_id,
          result.lastID,
          keyData.daily_limit || 1000,
          keyData.monthly_limit || 10000
        ]
      );
    }
    
    // Récupérer la clé API créée
    const createdKey = await getApiKey(result.lastID);
    return createdKey;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la création de la clé API:', error);
    throw error;
  }
}

/**
 * Obtenir une clé API par son ID
 * @param {number} id - ID de la clé API
 * @returns {Promise<Object|null>} Clé API ou null si non trouvée
 */
async function getApiKey(id) {
  try {
    const key = await dbService.get(
      `SELECT k.*, a.name as application_name, 
        l.daily_limit, l.monthly_limit, 
        l.current_daily_usage, l.current_monthly_usage
      FROM api_keys k
      LEFT JOIN applications a ON k.application_id = a.id
      LEFT JOIN api_usage_limits l ON k.id = l.api_key_id
      WHERE k.id = ?`,
      [id]
    );
    
    return key || null;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la récupération de la clé API:', error);
    return null;
  }
}

/**
 * Obtenir toutes les clés API
 * @param {Object} options - Options de filtrage
 * @returns {Promise<Array>} Liste des clés API
 */
async function getAllApiKeys(options = {}) {
  try {
    let query = `
      SELECT k.*, a.name as application_name,
        l.daily_limit, l.monthly_limit,
        l.current_daily_usage, l.current_monthly_usage
      FROM api_keys k
      LEFT JOIN applications a ON k.application_id = a.id
      LEFT JOIN api_usage_limits l ON k.id = l.api_key_id
    `;
    
    const whereConditions = [];
    const queryParams = [];
    
    // Filtrer par environnement
    if (options.environment) {
      whereConditions.push('k.environment = ?');
      queryParams.push(options.environment);
    }
    
    // Filtrer par statut (actif/inactif)
    if (options.active !== undefined) {
      whereConditions.push('k.active = ?');
      queryParams.push(options.active ? 1 : 0);
    }
    
    // Filtrer par recherche
    if (options.search) {
      whereConditions.push('(k.name LIKE ? OR k.key LIKE ?)');
      queryParams.push(`%${options.search}%`, `%${options.search}%`);
    }
    
    // Construire la clause WHERE si nécessaire
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    // Ajouter l'ordre par défaut
    query += ` ORDER BY ${options.orderBy || 'k.created_at'} ${options.order || 'DESC'}`;
    
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
    console.error('[API-KEY] Erreur lors de la récupération des clés API:', error);
    return [];
  }
}

/**
 * Obtenir les clés API d'une application
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Array>} Liste des clés API
 */
async function getApiKeysByApplication(applicationId) {
  try {
    const keys = await dbService.query(
      `SELECT k.*, l.daily_limit, l.monthly_limit,
        l.current_daily_usage, l.current_monthly_usage
      FROM api_keys k
      LEFT JOIN api_usage_limits l ON k.id = l.api_key_id
      WHERE k.application_id = ?
      ORDER BY k.created_at DESC`,
      [applicationId]
    );
    
    return keys;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la récupération des clés API par application:', error);
    return [];
  }
}

/**
 * Mettre à jour une clé API
 * @param {number} id - ID de la clé API
 * @param {Object} updateData - Données à mettre à jour
 * @returns {Promise<boolean>} True si la mise à jour a réussi
 */
async function updateApiKey(id, updateData) {
  try {
    // Vérifier si la clé API existe
    const existingKey = await dbService.get(
      'SELECT id FROM api_keys WHERE id = ?',
      [id]
    );
    
    if (!existingKey) {
      return false;
    }
    
    // Préparer les champs et valeurs à mettre à jour
    const updateFields = [];
    const updateValues = [];
    
    // Champs autorisés à mettre à jour
    const allowedFields = [
      'name', 'environment', 'active', 'expires_at', 
      'rate_limit', 'ip_restrictions'
    ];
    
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
      `UPDATE api_keys SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      updateValues
    );
    
    // Mettre à jour les limites d'utilisation si spécifiées
    if (updateData.daily_limit !== undefined || updateData.monthly_limit !== undefined) {
      // Vérifier si des limites d'utilisation existent
      const existingLimits = await dbService.get(
        'SELECT id FROM api_usage_limits WHERE api_key_id = ?',
        [id]
      );
      
      if (existingLimits) {
        // Mettre à jour les limites d'utilisation existantes
        const limitUpdateFields = [];
        const limitUpdateValues = [];
        
        if (updateData.daily_limit !== undefined) {
          limitUpdateFields.push('daily_limit = ?');
          limitUpdateValues.push(updateData.daily_limit);
        }
        
        if (updateData.monthly_limit !== undefined) {
          limitUpdateFields.push('monthly_limit = ?');
          limitUpdateValues.push(updateData.monthly_limit);
        }
        
        if (limitUpdateFields.length > 0) {
          limitUpdateValues.push(id);
          
          await dbService.run(
            `UPDATE api_usage_limits SET ${limitUpdateFields.join(', ')} WHERE api_key_id = ?`,
            limitUpdateValues
          );
        }
      } else {
        // Créer de nouvelles limites d'utilisation
        const keyInfo = await getApiKey(id);
        
        await dbService.run(
          `INSERT INTO api_usage_limits (application_id, api_key_id, daily_limit, monthly_limit)
          VALUES (?, ?, ?, ?)`,
          [
            keyInfo.application_id,
            id,
            updateData.daily_limit || 1000,
            updateData.monthly_limit || 10000
          ]
        );
      }
    }
    
    return result.changes > 0;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la mise à jour de la clé API:', error);
    throw error;
  }
}

/**
 * Supprimer une clé API
 * @param {number} id - ID de la clé API
 * @returns {Promise<boolean>} True si la suppression a réussi
 */
async function deleteApiKey(id) {
  try {
    // Vérifier si la clé API existe
    const existingKey = await dbService.get(
      'SELECT id FROM api_keys WHERE id = ?',
      [id]
    );
    
    if (!existingKey) {
      return false;
    }
    
    // Supprimer les limites d'utilisation associées
    await dbService.run(
      'DELETE FROM api_usage_limits WHERE api_key_id = ?',
      [id]
    );
    
    // Supprimer la clé API
    const result = await dbService.run(
      'DELETE FROM api_keys WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la suppression de la clé API:', error);
    return false;
  }
}

/**
 * Révoquer une clé API (désactivation sans suppression)
 * @param {number} id - ID de la clé API
 * @returns {Promise<boolean>} True si la révocation a réussi
 */
async function revokeApiKey(id) {
  try {
    // Vérifier si la clé API existe
    const existingKey = await dbService.get(
      'SELECT id FROM api_keys WHERE id = ?',
      [id]
    );
    
    if (!existingKey) {
      return false;
    }
    
    // Désactiver la clé API
    const result = await dbService.run(
      'UPDATE api_keys SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la révocation de la clé API:', error);
    return false;
  }
}

/**
 * Vérifier une clé API
 * @param {string} key - Clé API à vérifier
 * @returns {Promise<Object|null>} Informations sur la clé API ou null si invalide
 */
async function verifyApiKey(key) {
  try {
    // Gérer la clé de développement spéciale
    if (key === 'dev-key' && process.env.NODE_ENV !== 'production') {
      // En mode développement, autoriser la clé spéciale
      return {
        id: 0,
        key: 'dev-key',
        name: 'Clé de développement',
        environment: 'development',
        application_id: 1,
        application_name: 'Application par défaut',
        active: true,
        isDevKey: true
      };
    }
    
    // Récupérer la clé API depuis la base de données
    const keyInfo = await dbService.get(
      `SELECT k.*, a.name as application_name
      FROM api_keys k
      LEFT JOIN applications a ON k.application_id = a.id
      WHERE k.key = ?`,
      [key]
    );
    
    // Si la clé n'existe pas, retourner null
    if (!keyInfo) {
      return null;
    }
    
    // Vérifier si la clé est active
    if (!keyInfo.is_active) {
      return null;
    }
    
    // Vérifier si la clé a expiré
    if (keyInfo.expires_at && new Date(keyInfo.expires_at) < new Date()) {
      return null;
    }
    
    // Vérifier les limites d'utilisation
    const usageLimits = await dbService.get(
      `SELECT * FROM api_usage_limits
      WHERE api_key_id = ?`,
      [keyInfo.id]
    );
    
    if (usageLimits) {
      // Vérifier la limite d'utilisation quotidienne
      if (usageLimits.daily_limit > 0 && usageLimits.current_daily_usage >= usageLimits.daily_limit) {
        return null;
      }
      
      // Vérifier la limite d'utilisation mensuelle
      if (usageLimits.monthly_limit > 0 && usageLimits.current_monthly_usage >= usageLimits.monthly_limit) {
        return null;
      }
      
      // Mettre à jour les compteurs d'utilisation
      await dbService.run(
        `UPDATE api_usage_limits
        SET current_daily_usage = current_daily_usage + 1,
            current_monthly_usage = current_monthly_usage + 1
        WHERE api_key_id = ?`,
        [keyInfo.id]
      );
    }
    
    // Mettre à jour le compteur d'utilisation général et la date de dernière utilisation
    await dbService.run(
      `UPDATE api_keys
      SET usage_count = usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [keyInfo.id]
    );
    
    return keyInfo;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la vérification de la clé API:', error);
    
    // En mode développement, autoriser la clé spéciale malgré les erreurs
    if (key === 'dev-key' && process.env.NODE_ENV !== 'production') {
      console.log('[API-KEY] Mode développement: clé de développement autorisée malgré l\'erreur');
      
      return {
        id: 0,
        key: 'dev-key',
        name: 'Clé de développement',
        environment: 'development',
        application_id: 1,
        application_name: 'Application par défaut',
        active: true,
        isDevKey: true,
        error: error.message
      };
    }
    
    return null;
  }
}

/**
 * Obtenir les statistiques d'utilisation des clés API
 * @returns {Promise<Object>} Statistiques d'utilisation
 */
async function getApiKeyStats() {
  try {
    // Statistiques générales
    const generalStats = await dbService.get(
      `SELECT 
        COUNT(*) as total_keys,
        SUM(usage_count) as total_usage,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_keys,
        SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) as inactive_keys,
        COUNT(DISTINCT application_id) as total_applications
      FROM api_keys`
    );
    
    // Statistiques par environnement
    const envStats = await dbService.query(
      `SELECT 
        environment,
        COUNT(*) as key_count,
        SUM(usage_count) as usage_count,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_keys
      FROM api_keys
      GROUP BY environment
      ORDER BY key_count DESC`
    );
    
    // Clés les plus utilisées
    const topKeys = await dbService.query(
      `SELECT k.id, k.key, k.name, k.environment, k.usage_count, a.name as application_name
      FROM api_keys k
      LEFT JOIN applications a ON k.application_id = a.id
      WHERE k.active = 1
      ORDER BY k.usage_count DESC
      LIMIT 10`
    );
    
    // Clés récemment créées
    const recentKeys = await dbService.query(
      `SELECT k.id, k.key, k.name, k.environment, k.created_at, a.name as application_name
      FROM api_keys k
      LEFT JOIN applications a ON k.application_id = a.id
      ORDER BY k.created_at DESC
      LIMIT 10`
    );
    
    return {
      generalStats: generalStats || {
        total_keys: 0,
        total_usage: 0,
        active_keys: 0,
        inactive_keys: 0,
        total_applications: 0
      },
      envStats: envStats || [],
      topKeys: topKeys || [],
      recentKeys: recentKeys || []
    };
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la récupération des statistiques des clés API:', error);
    
    return {
      generalStats: {
        total_keys: 0,
        total_usage: 0,
        active_keys: 0,
        inactive_keys: 0,
        total_applications: 0
      },
      envStats: [],
      topKeys: [],
      recentKeys: []
    };
  }
}

/**
 * Réinitialiser les compteurs d'utilisation quotidiens de toutes les clés API
 * @returns {Promise<boolean>} True si la réinitialisation a réussi
 */
async function resetDailyUsageCounters() {
  try {
    await dbService.run(
      `UPDATE api_usage_limits
      SET current_daily_usage = 0,
          last_reset_daily = CURRENT_TIMESTAMP`
    );
    
    return true;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la réinitialisation des compteurs quotidiens:', error);
    return false;
  }
}

/**
 * Réinitialiser les compteurs d'utilisation mensuels de toutes les clés API
 * @returns {Promise<boolean>} True si la réinitialisation a réussi
 */
async function resetMonthlyUsageCounters() {
  try {
    await dbService.run(
      `UPDATE api_usage_limits
      SET current_monthly_usage = 0,
          last_reset_monthly = CURRENT_TIMESTAMP`
    );
    
    return true;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la réinitialisation des compteurs mensuels:', error);
    return false;
  }
}

/**
 * Générer une clé API unique
 * @returns {string} Clé API générée
 */
function generateApiKey() {
  // Utiliser uuid v4 comme base
  const uuid = uuidv4();
  
  // Générer un préfixe aléatoire
  const prefix = 'fhir';
  
  // Générer un hash SHA-256 tronqué à partir de l'UUID et le formater en base64url
  const hash = crypto.createHash('sha256').update(uuid).digest('base64url').substring(0, 22);
  
  // Construire la clé API avec le format souhaité
  return `${prefix}_${hash}`;
}

module.exports = {
  createApiKey,
  getApiKey,
  getAllApiKeys,
  getApiKeysByApplication,
  updateApiKey,
  deleteApiKey,
  revokeApiKey,
  verifyApiKey,
  getApiKeyStats,
  resetDailyUsageCounters,
  resetMonthlyUsageCounters
};