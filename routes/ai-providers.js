/**
 * Routes de gestion des fournisseurs d'IA
 * Permet de configurer et gérer différents fournisseurs d'IA comme Mistral et Ollama
 */

const express = require('express');
const router = express.Router();
const sqlite3 = require('better-sqlite3');
const path = require('path');
const mistralClient = require('../utils/mistralClient');
const directMistralClient = require('../utils/directMistralClient');
const ollamaClient = require('../utils/ollamaClient');
const aiService = require('../utils/aiService');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');

// Chemin de la base de données
const dbPathOld = path.join(__dirname, '../data/db/fhirhub.db');
const dbPathNew = path.join(__dirname, '../storage/db/fhirhub.db');
let dbPath = '';

// Vérifier quel chemin existe
if (require('fs').existsSync(dbPathNew)) {
  dbPath = dbPathNew;
  logger.info(`Utilisation du chemin de base de données: ${dbPath} (nouvelle structure)`);
} else if (require('fs').existsSync(dbPathOld)) {
  dbPath = dbPathOld;
  logger.info(`Utilisation du chemin de base de données: ${dbPath} (ancienne structure)`);
} else {
  dbPath = dbPathNew;
  logger.warn(`Aucune base de données existante trouvée, création de: ${dbPath}`);
}

// Ouvrir la base de données sans l'option fileMustExist pour permettre sa création automatique
const db = new sqlite3(dbPath, { fileMustExist: false });

// Middleware pour vérifier que la table ai_providers existe
function ensureTableExists(req, res, next) {
  try {
    const tableCheck = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'ai_providers\'').get();
    
    if (!tableCheck) {
      logger.warn('Table ai_providers non trouvée, création...');
      
      // Créer la table avec les bons noms de colonnes selon le schéma actuel de la base
      try {
        db.exec(`CREATE TABLE ai_providers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_name TEXT NOT NULL,
          provider_type TEXT NOT NULL,
          api_key TEXT,
          endpoint TEXT,
          models TEXT,
          enabled INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`);
        
        // Ajouter les fournisseurs par défaut
        const now = new Date().toISOString();
        
        // Mistral
        db.prepare(`
          INSERT INTO ai_providers (
            provider_name, provider_type, api_key, endpoint, models, enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'Mistral AI',
          'mistral',
          process.env.MISTRAL_API_KEY || '',
          'https://api.mistral.ai/v1',
          'mistral-large,mistral-medium',
          process.env.MISTRAL_API_KEY ? 1 : 0,
          now,
          now
        );
        
        // Ollama
        db.prepare(`
          INSERT INTO ai_providers (
            provider_name, provider_type, api_key, endpoint, models, enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'Ollama Local',
          'ollama',
          '',
          'http://localhost:11434',
          'llama3,mistral,gemma',
          0,
          now,
          now
        );
        
        logger.info('Table ai_providers créée avec succès et fournisseurs par défaut ajoutés');
      } catch (error) {
        // Si la table existe déjà, cette erreur est attendue, on ignore
        logger.debug(`Erreur lors de la création de la table (peut-être existe-t-elle déjà): ${error.message}`);
      }
    } else {
      // La table existe, vérifions si sa structure correspond à notre attente
      const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
      const columnNames = tableInfo.map(col => col.name);
      
      // Vérifier si les colonnes requises existent
      const requiredColumns = ['provider_name', 'provider_type', 'endpoint', 'models', 'enabled'];
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      
      if (missingColumns.length > 0) {
        logger.warn(`La table ai_providers existe mais il manque des colonnes: ${missingColumns.join(', ')}`);
      }
    }
    
    next();
  } catch (error) {
    logger.error(`Erreur lors de la vérification/création de la table ai_providers: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
}

/**
 * @api {get} /api/ai-providers Récupérer tous les fournisseurs d'IA
 * @apiName GetAIProviders
 * @apiGroup AI Providers
 * @apiDescription Récupère la liste de tous les fournisseurs d'IA configurés
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Array} data Liste des fournisseurs d'IA
 */
router.get('/', auth.apiKeyAuth, ensureTableExists, (req, res) => {
  try {
    // Vérifier la structure de la table
    const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
    const columnNames = tableInfo.map(col => col.name);
    
    let query;
    // Utiliser la structure réelle de la table
    if (columnNames.includes('provider_name') && columnNames.includes('endpoint') && columnNames.includes('models')) {
      // Structure actuelle de la BDD
      query = `
        SELECT 
          id, 
          provider_name, 
          provider_type, 
          api_key,
          endpoint, 
          models, 
          enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        ORDER BY id ASC
      `;
    } else if (columnNames.includes('name') && columnNames.includes('api_url') && columnNames.includes('model_name')) {
      // Ancienne structure potentielle
      query = `
        SELECT 
          id, 
          name as provider_name, 
          provider_type, 
          api_key,
          api_url as endpoint, 
          model_name as models, 
          is_active as enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        ORDER BY id ASC
      `;
    } else {
      // Fallback si la structure est différente
      logger.warn('Structure de table ai_providers non reconnue, tentative de requête générique');
      // Tenter une requête plus générique
      query = `SELECT * FROM ai_providers ORDER BY id ASC`;
    }
    
    logger.info(`Exécution de la requête pour tous les fournisseurs: ${query}`);
    const providers = db.prepare(query).all();
    
    res.json({ success: true, data: providers });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des fournisseurs d'IA: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

/**
 * @api {get} /api/ai-providers/active Récupérer le fournisseur d'IA actif
 * @apiName GetActiveAIProvider
 * @apiGroup AI Providers
 * @apiDescription Récupère le fournisseur d'IA actuellement actif
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Object} data Fournisseur d'IA actif
 */
// Route publique pour accéder aux fournisseurs actifs
router.get('/active', ensureTableExists, (req, res) => {
  try {
    // Vérifier la structure de la table
    const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
    const columnNames = tableInfo.map(col => col.name);
    
    let query;
    // Utiliser la structure réelle de la table
    if (columnNames.includes('provider_name') && columnNames.includes('endpoint') && columnNames.includes('models')) {
      // Structure actuelle de la BDD
      query = `
        SELECT 
          id, 
          provider_name, 
          provider_type, 
          models as model_id, 
          endpoint, 
          enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE enabled = 1
        ORDER BY id ASC
      `;
    } else if (columnNames.includes('name') && columnNames.includes('api_url') && columnNames.includes('model_name')) {
      // Ancienne structure potentielle
      query = `
        SELECT 
          id, 
          name as provider_name, 
          provider_type, 
          model_name as model_id,
          api_url as endpoint, 
          is_active as enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE is_active = 1
        ORDER BY id ASC
      `;
    } else {
      // Fallback si la structure est différente
      logger.warn('Structure de table ai_providers non reconnue, tentative de requête générique');
      // Tenter une requête plus générique
      query = `SELECT * FROM ai_providers WHERE enabled = 1 OR is_active = 1 ORDER BY id ASC`;
    }
    
    logger.info(`Exécution de la requête pour les fournisseurs actifs: ${query}`);
    const providers = db.prepare(query).all();
    
    // Le client attend directement un tableau de fournisseurs
    if (providers && providers.length > 0) {
      // Standardiser les noms de champs si nécessaire
      const standardizedProviders = providers.map(p => {
        const standardizedProvider = { ...p };
        // Assurer que les propriétés attendues par le client sont présentes
        if (p.name && !p.provider_name) standardizedProvider.provider_name = p.name;
        if (p.model_name && !p.model_id) standardizedProvider.model_id = p.model_name;
        if (p.api_url && !p.endpoint) standardizedProvider.endpoint = p.api_url;
        if (p.is_active !== undefined && p.enabled === undefined) standardizedProvider.enabled = p.is_active;
        return standardizedProvider;
      });
      
      res.json(standardizedProviders);
    } else {
      res.json([]);  // Renvoyer un tableau vide si aucun fournisseur n'est actif
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération du fournisseur d'IA actif: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

/**
 * @api {get} /api/ai-providers/models/list Récupérer les modèles disponibles
 * @apiName GetAvailableModels
 * @apiGroup AI Providers
 * @apiDescription Récupère la liste des modèles disponibles pour le fournisseur d'IA actif
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Array} data Liste des modèles disponibles
 */
router.get('/models/list', (req, res) => {
  try {
    // Utiliser le service d'IA unifié pour lister les modèles
    aiService.listModels()
      .then(models => {
        res.json({ success: true, data: models });
      })
      .catch(error => {
        logger.error(`Erreur lors de la récupération des modèles: ${error.message}`);
        res.status(500).json({ 
          success: false, 
          error: 'Erreur lors de la récupération des modèles',
          message: error.message
        });
      });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des modèles: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

/**
 * @api {get} /api/ai-providers/status Récupérer le statut du fournisseur d'IA actif
 * @apiName GetAIStatus
 * @apiGroup AI Providers
 * @apiDescription Récupère les informations sur le fournisseur d'IA actuellement actif
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Object} data Informations sur le fournisseur d'IA actif
 */
router.get('/status', ensureTableExists, (req, res) => {
  try {
    // Vérifier la structure de la table
    const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
    const columnNames = tableInfo.map(col => col.name);
    
    let query;
    // Utiliser la structure réelle de la table
    if (columnNames.includes('provider_name') && columnNames.includes('endpoint') && columnNames.includes('models')) {
      // Structure actuelle de la BDD
      query = `
        SELECT 
          id, 
          provider_name, 
          provider_type, 
          models, 
          endpoint, 
          enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE enabled = 1
        LIMIT 1
      `;
    } else if (columnNames.includes('name') && columnNames.includes('api_url') && columnNames.includes('model_name')) {
      // Ancienne structure potentielle
      query = `
        SELECT 
          id, 
          name as provider_name, 
          provider_type, 
          model_name as models,
          api_url as endpoint, 
          is_active as enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE is_active = 1
        LIMIT 1
      `;
    } else {
      // Fallback si la structure est différente
      logger.warn('Structure de table ai_providers non reconnue, tentative de requête générique');
      // Tenter une requête plus générique
      query = `SELECT * FROM ai_providers LIMIT 1`;
    }
    
    logger.info(`Exécution de la requête pour le fournisseur actif: ${query}`);
    const activeProvider = db.prepare(query).get();
    
    if (!activeProvider) {
      // Aucun fournisseur actif
      return res.json({
        success: true,
        data: { active: false }
      });
    }
    
    // Récupérer les modèles configurés pour ce fournisseur
    const models = activeProvider.models ? 
      activeProvider.models.split(',').map(m => m.trim()) : [];
    
    // Formater les informations du modèle directement à partir du fournisseur actif
    let modelId = activeProvider.models || 'unknown';
    if (modelId.includes(',')) {
      // Si plusieurs modèles sont spécifiés, prendre le premier
      modelId = modelId.split(',')[0].trim();
    }
    
    let modelName = modelId;
    
    // Personnaliser le nom du modèle pour une meilleure lisibilité selon le type de fournisseur
    if (activeProvider.provider_type === 'mistral') {
      if (modelId === 'mistral-large-latest') modelName = 'Mistral Large (latest)';
      else if (modelId === 'mistral-large-2411') modelName = 'Mistral Large (2411)';
      else if (modelId === 'mistral-medium') modelName = 'Mistral Medium';
    } 
    else if (activeProvider.provider_type === 'deepseek') {
      if (modelId === 'deepseek-reasoner') modelName = 'DeepSeek Reasoner';
      else if (modelId === 'deepseek-chat') modelName = 'DeepSeek Chat';
      else if (modelId === 'deepseek-coder') modelName = 'DeepSeek Coder';
    }
    
    // Formater la réponse
    res.json({
      success: true,
      data: {
        active: true,
        provider: {
          id: activeProvider.id,
          name: activeProvider.provider_name,
          type: activeProvider.provider_type,
          endpoint: activeProvider.endpoint || null
        },
        model: {
          id: modelId,
          name: modelName
        },
        availableModels: models
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération du fournisseur d\'IA actif:', error);
    res.status(500).json({
      success: false,
      error: `Erreur lors de la récupération du fournisseur d'IA actif: ${error.message}`
    });
  }
});

/**
 * @api {get} /api/ai-providers/status Récupérer le statut du fournisseur d'IA actif
 * @apiName GetAIStatus
 * @apiGroup AI Providers
 * @apiDescription Récupère les informations sur le fournisseur d'IA actuellement actif
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Object} data Informations sur le fournisseur d'IA actif
 */
router.get('/status', (req, res) => {
  try {
    const aiProviderService = require('../utils/aiProviderService');
    
    aiProviderService.getActiveAIProvider()
      .then(async provider => {
        if (!provider) {
          return res.json({ 
            success: true, 
            data: {
              active: false,
              message: "Aucun fournisseur d'IA n'est actuellement actif"
            }
          });
        }
        
        // Récupérer des informations sur le modèle actif
        let modelInfo = null;
        try {
          // Si c'est DeepSeek, on utilise directement getCurrentModel pour plus de cohérence
          if (provider.provider_type === 'deepseek') {
            modelInfo = await aiService.getCurrentModel();
          } else {
            // Pour les autres fournisseurs, on continue à chercher dans la liste des modèles
            const models = await aiService.listModels();
            const modelId = provider.model_id || provider.models || provider.model_name;
            const modelIdList = modelId ? modelId.split(',').map(m => m.trim()) : [];
            const defaultModelId = modelIdList.length > 0 ? modelIdList[0] : null;
            
            if (defaultModelId) {
              modelInfo = models.find(m => m.id === defaultModelId) || {
                id: defaultModelId,
                name: defaultModelId
              };
            }
          }
        } catch (error) {
          logger.warn(`Impossible de récupérer des informations sur le modèle: ${error.message}`);
        }
        
        const responseData = {
          active: true,
          provider: {
            id: provider.id,
            name: provider.provider_name || provider.name,
            type: provider.provider_type,
            endpoint: provider.endpoint || provider.api_url
          },
          model: modelInfo || {
            id: provider.model_id || provider.models || provider.model_name || "Non spécifié",
            name: provider.model_id || provider.models || provider.model_name || "Non spécifié"
          }
        };
        
        res.json({ success: true, data: responseData });
      })
      .catch(error => {
        logger.error(`Erreur lors de la récupération du statut de l'IA: ${error.message}`);
        res.status(500).json({ 
          success: false, 
          error: "Erreur lors de la récupération du statut de l'IA",
          message: error.message
        });
      });
  } catch (error) {
    logger.error(`Erreur lors de la récupération du statut de l'IA: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

/**
 * @api {get} /api/ai-providers/types/supported Récupérer les types de fournisseurs supportés
 * @apiName GetSupportedProviderTypes
 * @apiGroup AI Providers
 * @apiDescription Récupère la liste des types de fournisseurs d'IA supportés
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Array} data Liste des types de fournisseurs supportés
 */
router.get('/types/supported', (req, res) => { // Temporairement public pour le test
  // Liste des types de fournisseurs supportés avec leurs caractéristiques
  const supportedTypes = [
    {
      id: 'mistral',
      name: 'Mistral AI',
      requires_api_key: true,
      supports_endpoint_override: true,
      default_endpoint: 'https://api.mistral.ai/v1',
      description: 'Service cloud de Mistral AI pour les modèles comme Mistral Medium et Large'
    },
    {
      id: 'ollama',
      name: 'Ollama',
      requires_api_key: false,
      supports_endpoint_override: true,
      default_endpoint: 'http://localhost:11434',
      description: 'Solution locale pour exécuter des modèles open source comme Llama, Mistral, etc.'
    },
    {
      id: 'openai',
      name: 'OpenAI',
      requires_api_key: true,
      supports_endpoint_override: true,
      default_endpoint: 'https://api.openai.com/v1',
      description: 'Service cloud d\'OpenAI pour les modèles comme GPT-4 et GPT-3.5'
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      requires_api_key: true,
      supports_endpoint_override: true,
      default_endpoint: 'https://api.deepseek.com/v1',
      description: 'Service cloud de DeepSeek pour les modèles comme DeepSeek-Coder et DeepSeek-Chat'
    },
    {
      id: 'openai_compatible',
      name: 'API Compatible OpenAI',
      requires_api_key: true,
      supports_endpoint_override: true,
      default_endpoint: '',
      description: 'Pour toute API tierce compatible avec le format OpenAI (Together AI, Groq, Anyscale, etc.)'
    }
  ];
  
  res.json({ success: true, data: supportedTypes });
});

/**
 * @api {get} /api/ai-providers/:id Récupérer un fournisseur d'IA par ID
 * @apiName GetAIProvider
 * @apiGroup AI Providers
 * @apiDescription Récupère les détails d'un fournisseur d'IA spécifique
 * 
 * @apiParam {Number} id ID du fournisseur d'IA
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Object} data Détails du fournisseur d'IA
 */
router.get('/:id', auth.apiKeyAuth, ensureTableExists, (req, res) => {
  try {
    // Vérifier la structure de la table
    const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
    const columnNames = tableInfo.map(col => col.name);
    
    let query;
    // Utiliser la structure réelle de la table
    if (columnNames.includes('provider_name') && columnNames.includes('endpoint') && columnNames.includes('models')) {
      // Structure actuelle de la BDD
      query = `
        SELECT 
          id, 
          provider_name, 
          provider_type, 
          api_key,
          endpoint, 
          models, 
          enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE id = ?
      `;
    } else if (columnNames.includes('name') && columnNames.includes('api_url') && columnNames.includes('model_name')) {
      // Ancienne structure potentielle
      query = `
        SELECT 
          id, 
          name as provider_name, 
          provider_type, 
          api_key,
          api_url as endpoint, 
          model_name as models, 
          is_active as enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE id = ?
      `;
    } else {
      // Fallback si la structure est différente
      logger.warn('Structure de table ai_providers non reconnue, tentative de requête générique');
      // Tenter une requête plus générique
      query = `SELECT * FROM ai_providers WHERE id = ?`;
    }
    
    const provider = db.prepare(query).get(req.params.id);
    
    if (provider) {
      res.json({ success: true, data: provider });
    } else {
      res.status(404).json({ success: false, error: 'Fournisseur d\'IA non trouvé' });
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération du fournisseur d'IA #${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

/**
 * @api {post} /api/ai-providers Ajouter un nouveau fournisseur d'IA
 * @apiName AddAIProvider
 * @apiGroup AI Providers
 * @apiDescription Ajoute un nouveau fournisseur d'IA à la configuration
 * 
 * @apiBody {String} provider_name Nom du fournisseur
 * @apiBody {String} provider_type Type du fournisseur (mistral, ollama, openai)
 * @apiBody {String} [api_key] Clé API du fournisseur
 * @apiBody {String} [endpoint] Point d'accès personnalisé
 * @apiBody {String} [models] Liste des modèles séparés par des virgules
 * @apiBody {Boolean} [enabled=false] État d'activation
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Object} data Détails du fournisseur d'IA ajouté
 */
router.post('/', auth.apiKeyAuth, ensureTableExists, (req, res) => {
  try {
    const { provider_name, provider_type, api_key, endpoint, models, enabled = false } = req.body;
    
    // Validation des données
    if (!provider_name || !provider_type) {
      return res.status(400).json({ success: false, error: 'Nom et type de fournisseur requis' });
    }
    
    // Vérifier si le type de fournisseur est supporté
    const supportedTypes = ['mistral', 'ollama', 'openai', 'deepseek', 'openai_compatible'];
    if (!supportedTypes.includes(provider_type)) {
      return res.status(400).json({ success: false, error: 'Type de fournisseur non supporté' });
    }
    
    // Vérifier la structure de la table
    const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
    const columnNames = tableInfo.map(col => col.name);
    
    const now = new Date().toISOString();
    
    // Si enabled est true, désactiver tous les autres fournisseurs
    if (enabled) {
      if (columnNames.includes('enabled')) {
        db.prepare(`UPDATE ai_providers SET enabled = 0, updated_at = ?`).run(now);
      } else if (columnNames.includes('is_active')) {
        db.prepare(`UPDATE ai_providers SET is_active = 0, updated_at = ?`).run(now);
      }
    }
    
    // Ajouter le nouveau fournisseur selon le schéma de la table
    let query;
    let params;
    
    if (columnNames.includes('provider_name') && columnNames.includes('endpoint') && columnNames.includes('models')) {
      // Structure actuelle de la BDD
      query = `
        INSERT INTO ai_providers (
          provider_name, provider_type, api_key, endpoint, models, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      params = [
        provider_name,
        provider_type,
        api_key || '',
        endpoint || '',
        models || '',
        enabled ? 1 : 0,
        now,
        now
      ];
    } else if (columnNames.includes('name') && columnNames.includes('api_url') && columnNames.includes('model_name')) {
      // Ancienne structure potentielle
      query = `
        INSERT INTO ai_providers (
          name, provider_type, api_key, api_url, model_name, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      params = [
        provider_name,
        provider_type,
        api_key || '',
        endpoint || '',
        models || '',
        enabled ? 1 : 0,
        now,
        now
      ];
    } else {
      return res.status(500).json({ success: false, error: 'Structure de table incompatible' });
    }
    
    // Insérer le fournisseur
    const result = db.prepare(query).run(...params);
    
    // Construire la requête pour récupérer le fournisseur selon le schéma
    let selectQuery;
    if (columnNames.includes('provider_name') && columnNames.includes('endpoint') && columnNames.includes('models')) {
      selectQuery = `
        SELECT 
          id, 
          provider_name, 
          provider_type, 
          endpoint, 
          models, 
          enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE id = ?
      `;
    } else {
      selectQuery = `
        SELECT 
          id, 
          name as provider_name, 
          provider_type, 
          api_url as endpoint, 
          model_name as models, 
          is_active as enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE id = ?
      `;
    }
    
    // Récupérer le fournisseur ajouté
    const provider = db.prepare(selectQuery).get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: provider });
  } catch (error) {
    logger.error(`Erreur lors de l'ajout d'un fournisseur d'IA: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

/**
 * @api {put} /api/ai-providers/:id Mettre à jour un fournisseur d'IA
 * @apiName UpdateAIProvider
 * @apiGroup AI Providers
 * @apiDescription Met à jour les paramètres d'un fournisseur d'IA existant
 * 
 * @apiParam {Number} id ID du fournisseur d'IA
 * 
 * @apiBody {String} [provider_name] Nom du fournisseur
 * @apiBody {String} [api_key] Clé API du fournisseur
 * @apiBody {String} [endpoint] Point d'accès personnalisé
 * @apiBody {String} [models] Liste des modèles séparés par des virgules
 * @apiBody {Boolean} [enabled] État d'activation
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Object} data Détails du fournisseur d'IA mis à jour
 */
router.put('/:id', auth.apiKeyAuth, ensureTableExists, (req, res) => {
  try {
    const id = req.params.id;
    const { provider_name, api_key, endpoint, models, enabled } = req.body;
    
    // Vérifier la structure de la table
    const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
    const columnNames = tableInfo.map(col => col.name);
    
    let selectQuery = 'SELECT * FROM ai_providers WHERE id = ?';
    
    // Vérifier si le fournisseur existe
    const provider = db.prepare(selectQuery).get(id);
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Fournisseur d\'IA non trouvé' });
    }
    
    const now = new Date().toISOString();
    
    // Construire la requête de mise à jour selon le schéma de la table
    let updateQuery = 'UPDATE ai_providers SET updated_at = ?';
    const params = [now];
    
    if (provider_name !== undefined) {
      if (columnNames.includes('provider_name')) {
        updateQuery += ', provider_name = ?';
      } else if (columnNames.includes('name')) {
        updateQuery += ', name = ?';
      }
      params.push(provider_name);
    }
    
    if (api_key !== undefined) {
      updateQuery += ', api_key = ?';
      params.push(api_key);
    }
    
    if (endpoint !== undefined) {
      if (columnNames.includes('endpoint')) {
        updateQuery += ', endpoint = ?';
      } else if (columnNames.includes('api_url')) {
        updateQuery += ', api_url = ?';
      }
      params.push(endpoint);
    }
    
    if (models !== undefined) {
      if (columnNames.includes('models')) {
        updateQuery += ', models = ?';
      } else if (columnNames.includes('model_name')) {
        updateQuery += ', model_name = ?';
      }
      params.push(models);
    }
    
    if (enabled !== undefined) {
      if (columnNames.includes('enabled')) {
        updateQuery += ', enabled = ?';
        
        // Si enabled est true, désactiver tous les autres fournisseurs
        if (enabled) {
          db.prepare(`UPDATE ai_providers SET enabled = 0, updated_at = ? WHERE id != ?`).run(now, id);
        }
      } else if (columnNames.includes('is_active')) {
        updateQuery += ', is_active = ?';
        
        // Si enabled est true, désactiver tous les autres fournisseurs
        if (enabled) {
          db.prepare(`UPDATE ai_providers SET is_active = 0, updated_at = ? WHERE id != ?`).run(now, id);
        }
      }
      params.push(enabled ? 1 : 0);
    }
    
    updateQuery += ' WHERE id = ?';
    params.push(id);
    
    // Exécuter la mise à jour
    db.prepare(updateQuery).run(...params);
    
    // Récupérer le fournisseur mis à jour selon le schéma
    let getUpdatedQuery;
    if (columnNames.includes('provider_name') && columnNames.includes('endpoint') && columnNames.includes('models')) {
      getUpdatedQuery = `
        SELECT 
          id, 
          provider_name, 
          provider_type, 
          endpoint, 
          models, 
          enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE id = ?
      `;
    } else {
      getUpdatedQuery = `
        SELECT 
          id, 
          name as provider_name, 
          provider_type, 
          api_url as endpoint, 
          model_name as models, 
          is_active as enabled, 
          created_at, 
          updated_at
        FROM ai_providers
        WHERE id = ?
      `;
    }
    
    const updatedProvider = db.prepare(getUpdatedQuery).get(id);
    
    res.json({ success: true, data: updatedProvider });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour du fournisseur d'IA #${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

/**
 * @api {delete} /api/ai-providers/:id Supprimer un fournisseur d'IA
 * @apiName DeleteAIProvider
 * @apiGroup AI Providers
 * @apiDescription Supprime un fournisseur d'IA de la configuration
 * 
 * @apiParam {Number} id ID du fournisseur d'IA
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 */
router.delete('/:id', auth.apiKeyAuth, ensureTableExists, (req, res) => {
  try {
    const id = req.params.id;
    
    // Vérifier la structure de la table
    const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
    const columnNames = tableInfo.map(col => col.name);
    
    // Vérifier si le fournisseur existe
    const provider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(id);
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Fournisseur d\'IA non trouvé' });
    }
    
    // Compter le nombre total de fournisseurs
    const count = db.prepare('SELECT COUNT(*) as count FROM ai_providers').get().count;
    
    // Empêcher la suppression s'il n'y a qu'un seul fournisseur
    if (count <= 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Impossible de supprimer le dernier fournisseur d\'IA' 
      });
    }
    
    // Supprimer le fournisseur
    db.prepare('DELETE FROM ai_providers WHERE id = ?').run(id);
    
    // Déterminer si le fournisseur était actif selon le schéma de la table
    let isActive = false;
    if (columnNames.includes('enabled')) {
      isActive = provider.enabled === 1;
    } else if (columnNames.includes('is_active')) {
      isActive = provider.is_active === 1;
    }
    
    // Si le fournisseur était actif, activer le premier fournisseur restant
    if (isActive) {
      const firstProvider = db.prepare('SELECT id FROM ai_providers ORDER BY id ASC LIMIT 1').get();
      if (firstProvider) {
        let updateField;
        if (columnNames.includes('enabled')) {
          updateField = 'enabled';
        } else if (columnNames.includes('is_active')) {
          updateField = 'is_active';
        }
        
        db.prepare(`UPDATE ai_providers SET ${updateField} = 1, updated_at = ? WHERE id = ?`)
          .run(new Date().toISOString(), firstProvider.id);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Erreur lors de la suppression du fournisseur d'IA #${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

/**
 * @api {post} /api/ai-providers/:id/test Tester un fournisseur d'IA
 * @apiName TestAIProvider
 * @apiGroup AI Providers
 * @apiDescription Teste la connexion avec un fournisseur d'IA
 * 
 * @apiParam {Number} id ID du fournisseur d'IA
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Object} data Résultat du test
 */

/**
 * @api {post} /api/ai-providers/:providerType/test-connection Tester une connexion directe
 * @apiName TestProviderConnection
 * @apiGroup AI Providers
 * @apiDescription Teste une connexion avec les informations fournies sans créer un fournisseur d'IA
 * 
 * @apiParam {String} providerType Type du fournisseur à tester (mistral, ollama, etc.)
 * 
 * @apiBody {String} api_key Clé API à utiliser pour le test
 * @apiBody {String} [endpoint] Point d'accès personnalisé
 * 
 * @apiSuccess {Boolean} success Indique si la requête a réussi
 * @apiSuccess {Object} data Résultat du test
 */
router.post('/:providerType/test-connection', auth.apiKeyAuth, async (req, res) => {
  try {
    const providerType = req.params.providerType;
    const { api_key, endpoint } = req.body;
    
    // Validation des données
    if (!api_key && ['mistral', 'openai', 'deepseek', 'openai_compatible'].includes(providerType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Clé API requise pour ce type de fournisseur' 
      });
    }
    
    // Créer un objet provider temporaire pour le test
    const provider = {
      provider_type: providerType,
      api_key,
      api_url: endpoint || '',  // Adaptation pour correspondre au schéma
    };
    
    // Tester le fournisseur selon son type
    let testResult = { test_passed: false, status: 'Échec du test' };
    
    switch (providerType) {
      case 'mistral':
        testResult = await testMistralProvider(provider);
        break;
      case 'ollama':
        testResult = await testOllamaProvider(provider);
        break;
      case 'openai':
      case 'openai_compatible':
        testResult = await testOpenAIProvider(provider);
        break;
      case 'deepseek':
        testResult = await testDeepSeekProvider(provider);
        break;
      default:
        testResult = {
          test_passed: false,
          status: `Type de fournisseur non supporté: ${providerType}`
        };
    }
    
    res.json({ success: true, data: testResult });
  } catch (error) {
    logger.error(`Erreur lors du test direct du fournisseur de type ${req.params.providerType}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

router.post('/:id/test', auth.apiKeyAuth, ensureTableExists, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Vérifier la structure de la table
    const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
    const columnNames = tableInfo.map(col => col.name);
    
    // Récupérer les informations du fournisseur selon le schéma de la table
    let selectQuery;
    if (columnNames.includes('provider_name') && columnNames.includes('endpoint') && columnNames.includes('models')) {
      selectQuery = `
        SELECT 
          id, 
          provider_name, 
          provider_type, 
          api_key,
          endpoint,
          models,
          enabled,
          created_at, 
          updated_at
        FROM ai_providers 
        WHERE id = ?
      `;
    } else if (columnNames.includes('name') && columnNames.includes('api_url') && columnNames.includes('model_name')) {
      selectQuery = `
        SELECT 
          id, 
          name as provider_name, 
          provider_type, 
          api_key,
          api_url as endpoint,
          model_name as models,
          is_active as enabled,
          created_at, 
          updated_at
        FROM ai_providers 
        WHERE id = ?
      `;
    } else {
      selectQuery = `SELECT * FROM ai_providers WHERE id = ?`;
    }
    
    const provider = db.prepare(selectQuery).get(id);
    
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Fournisseur d\'IA non trouvé' });
    }
    
    // Tester le fournisseur selon son type
    let testResult = { test_passed: false, status: 'Échec du test' };
    
    switch (provider.provider_type) {
      case 'mistral':
        testResult = await testMistralProvider(provider);
        break;
      case 'ollama':
        testResult = await testOllamaProvider(provider);
        break;
      case 'openai':
        testResult = await testOpenAIProvider(provider);
        break;
      case 'deepseek':
        testResult = await testDeepSeekProvider(provider);
        break;
      case 'openai_compatible':
        testResult = await testOpenAICompatibleProvider(provider);
        break;
      default:
        testResult = { 
          test_passed: false, 
          status: `Type de fournisseur non supporté: ${provider.provider_type}` 
        };
    }
    
    // Si le test est réussi et qu'une clé API a été utilisée, la sauvegarder dans la base de données
    if (testResult.test_passed && provider.api_key) {
      logger.info(`Test réussi pour le fournisseur ID ${id}, sauvegarde de la clé API...`);
      
      // Mise à jour de la date de modification
      const now = new Date().toISOString();
      
      // Vérifier à nouveau les noms de colonne pour la requête UPDATE
      const tableInfo = db.prepare(`PRAGMA table_info(ai_providers)`).all();
      const columnNames = tableInfo.map(col => col.name);
      
      // Mise à jour du fournisseur avec la clé API testée selon le schéma
      if (columnNames.includes('provider_name') && columnNames.includes('endpoint')) {
        db.prepare(`
          UPDATE ai_providers 
          SET api_key = ?, updated_at = ?
          WHERE id = ?
        `).run(provider.api_key, now, id);
      } else {
        db.prepare(`
          UPDATE ai_providers 
          SET api_key = ?, updated_at = ?
          WHERE id = ?
        `).run(provider.api_key, now, id);
      }
      
      logger.info(`Clé API sauvegardée avec succès pour le fournisseur ID ${id}`);
    }
    
    res.json({ success: true, data: testResult });
  } catch (error) {
    logger.error(`Erreur lors du test du fournisseur d'IA #${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// Fonction pour tester un fournisseur Mistral
async function testMistralProvider(provider) {
  try {
    if (!provider.api_key) {
      return {
        test_passed: false,
        status: 'Aucune clé API fournie pour Mistral',
      };
    }
    
    let models = [];
    let modelNames = [];
    
    try {
      // Essayer d'abord avec le service d'IA unifié
      logger.info(`Test de Mistral avec le service d'IA unifié: ${provider.endpoint || provider.api_url}`);
      
      // Temporairement configurer un fournisseur pour le test
      const aiProviderService = require('../utils/aiProviderService');
      const tempProvider = {
        provider_type: 'mistral',
        api_key: provider.api_key,
        endpoint: provider.endpoint || provider.api_url,
        model_id: provider.model_id || provider.models || 'mistral-large-latest'
      };
      
      // Sauvegarder l'état actuel et configurer temporairement
      await aiProviderService.setTempActiveProvider(tempProvider);
      
      // Utiliser le service d'IA unifié
      models = await aiService.listModels();
      modelNames = models.map(model => model.id);
      
      // Restaurer l'état original
      await aiProviderService.restoreTempActiveProvider();
      
      logger.info(`Test Mistral via aiService réussi: ${modelNames.join(', ')}`);
      
      return {
        test_passed: true,
        status: `Connexion réussie à Mistral via le service unifié. ${models.length} modèles disponibles.`,
        models: models,
        available_models: models
      };
    } catch (unifiedError) {
      logger.warn(`Échec du test unifié Mistral: ${unifiedError.message}. Tentative avec client direct...`);
      
      try {
        // Essayer ensuite avec le client direct
        models = await directMistralClient.testConnection({
          apiKey: provider.api_key,
          endpoint: provider.endpoint || provider.api_url || 'https://api.mistral.ai/v1'
        });
        
        modelNames = models.map(model => model.id);
        logger.info(`Test Mistral direct réussi: ${modelNames.join(', ')}`);
        
        return {
          test_passed: true,
          status: `Connexion réussie à Mistral (méthode directe). ${models.length} modèles disponibles.`,
          models: models,
          available_models: models
        };
      } catch (directError) {
        logger.warn(`Échec du test direct Mistral: ${directError.message}. Tentative avec fetch...`);
        
        try {
          // Fallback à fetch direct si le client échoue
          const endpoint = provider.endpoint || provider.api_url || 'https://api.mistral.ai/v1';
          const response = await fetch(`${endpoint}/models`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${provider.api_key}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Erreur HTTP: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Récupérer les modèles de la réponse
          models = data.data || [];
          modelNames = models.map(model => model.id);
          logger.info(`Test Mistral via fetch réussi: ${modelNames.join(', ')}`);
          
          return {
            test_passed: true,
            status: `Connexion réussie à Mistral (méthode fetch). ${models.length} modèles disponibles.`,
            models: models,
            available_models: models
          };
        } catch (fetchError) {
          logger.error(`Échec du test fetch Mistral: ${fetchError.message}. Tentative avec SDK...`);
          
          // En dernier recours, essayer avec le SDK
          if (mistralClient && mistralClient.isAvailable && typeof mistralClient.isAvailable === 'function') {
            try {
              // Si une clé API personnalisée est fournie, l'utiliser temporairement
              const originalKey = process.env.MISTRAL_API_KEY;
              
              if (provider.api_key) {
                process.env.MISTRAL_API_KEY = provider.api_key;
              }
              
              const models = await mistralClient.listModels();
              
              // Restaurer la clé API originale
              if (provider.api_key) {
                process.env.MISTRAL_API_KEY = originalKey;
              }
              
              return {
                test_passed: true,
                status: `Connexion réussie avec SDK Mistral. ${models.length} modèles disponibles.`,
                models: models,
                available_models: models
              };
            } catch (sdkError) {
              return {
                test_passed: false,
                status: `Toutes les méthodes ont échoué. Dernière erreur: ${sdkError.message}`,
                error: unifiedError.message,
                error_details: {
                  unified: unifiedError.message,
                  direct: directError.message,
                  fetch: fetchError.message,
                  sdk: sdkError.message
                }
              };
            }
          }
          
          return {
            test_passed: false,
            status: `Échec de la connexion avec toutes les méthodes.`,
            error: unifiedError.message,
            error_details: {
              unified: unifiedError.message,
              direct: directError.message,
              fetch: fetchError.message
            }
          };
        }
      }
    }
  } catch (error) {
    logger.error(`Erreur inattendue lors du test Mistral: ${error.message}`);
    
    return {
      test_passed: false,
      status: `Erreur inattendue: ${error.message}`,
      error: error.message
    };
  }
}

// Fonction pour tester un fournisseur Ollama
async function testOllamaProvider(provider) {
  try {
    // Si un endpoint personnalisé est fourni, l'utiliser temporairement
    const originalEndpoint = process.env.OLLAMA_API_ENDPOINT;
    
    if (provider.endpoint || provider.api_url) {
      process.env.OLLAMA_API_ENDPOINT = provider.endpoint || provider.api_url;
    }
    
    const available = await ollamaClient.isAvailable();
    
    if (!available) {
      throw new Error('Serveur Ollama non disponible');
    }
    
    const models = await ollamaClient.getAvailableModels();
    
    // Restaurer l'endpoint original
    if (provider.endpoint || provider.api_url) {
      process.env.OLLAMA_API_ENDPOINT = originalEndpoint;
    }
    
    return {
      test_passed: true,
      status: `Connexion réussie. ${models.length} modèles disponibles.`,
      models: models
    };
  } catch (error) {
    logger.error(`Échec du test Ollama: ${error.message}`);
    return {
      test_passed: false,
      status: `Échec de la connexion: ${error.message}`,
      error: error.message
    };
  }
}

// Fonction pour tester un fournisseur OpenAI
async function testOpenAIProvider(provider) {
  try {
    if (!provider.api_key) {
      return {
        test_passed: false,
        status: 'Aucune clé API fournie pour OpenAI',
      };
    }

    // Tentative simple de connexion à l'API OpenAI
    const response = await fetch(`${provider.endpoint || provider.api_url || 'https://api.openai.com/v1'}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.api_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data || [];
    
    return {
      test_passed: true,
      status: `Connexion réussie. ${models.length} modèles disponibles.`,
      models: models.map(m => m.id)
    };
  } catch (error) {
    logger.error(`Échec du test OpenAI: ${error.message}`);
    return {
      test_passed: false,
      status: `Échec de la connexion: ${error.message}`,
      error: error.message
    };
  }
}

// Fonction pour tester un fournisseur DeepSeek
async function testDeepSeekProvider(provider) {
  try {
    if (!provider.api_key) {
      return {
        test_passed: false,
        status: 'Aucune clé API fournie pour DeepSeek',
      };
    }

    // DeepSeek utilise généralement une API compatible avec OpenAI
    const endpoint = provider.endpoint || provider.api_url || 'https://api.deepseek.com/v1';
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.api_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data || [];
    
    return {
      test_passed: true,
      status: `Connexion réussie à DeepSeek. ${models.length} modèles disponibles.`,
      models: models.map(m => m.id)
    };
  } catch (error) {
    logger.error(`Échec du test DeepSeek: ${error.message}`);
    return {
      test_passed: false,
      status: `Échec de la connexion: ${error.message}`,
      error: error.message
    };
  }
}

// Fonction pour tester un fournisseur compatible OpenAI (Together.ai, Groq, Anyscale, etc.)
async function testOpenAICompatibleProvider(provider) {
  try {
    if (!provider.api_key) {
      return {
        test_passed: false,
        status: 'Aucune clé API fournie',
      };
    }

    if (!provider.endpoint && !provider.api_url) {
      return {
        test_passed: false,
        status: 'Aucun endpoint API fourni. Veuillez spécifier l\'URL complète de l\'API.',
      };
    }

    // Test de connectivité basique à l'API compatible OpenAI
    // La plupart des API compatibles OpenAI supportent l'endpoint /models
    const apiUrl = provider.endpoint || provider.api_url;
    const endpoint = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.api_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data || [];
    
    return {
      test_passed: true,
      status: `Connexion réussie à l'API compatible OpenAI. ${models.length} modèles disponibles.`,
      models: models.map(m => m.id || m.name)
    };
  } catch (error) {
    logger.error(`Échec du test API compatible OpenAI: ${error.message}`);
    
    // Tentative de test avec l'endpoint de complétion comme alternative
    try {
      const endpoint = provider.endpoint.endsWith('/') ? provider.endpoint.slice(0, -1) : provider.endpoint;
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: provider.models?.split(',')[0] || 'gpt-3.5-turbo',
          messages: [{ role: 'system', content: 'Bonjour' }],
          max_tokens: 5
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Erreur HTTP: ${response.status}`);
      }

      return {
        test_passed: true,
        status: `Connexion réussie à l'API compatible OpenAI (endpoint de complétion).`,
        models: [provider.models?.split(',')[0] || 'Modèle par défaut']
      };
    } catch (secondError) {
      return {
        test_passed: false,
        status: `Échec de la connexion: ${error.message}. Tentative sur endpoint de complétion: ${secondError.message}`,
        error: error.message
      };
    }
  }
}

// Route pour obtenir le statut du fournisseur d'IA actif
router.get('/status', async (req, res) => {
  try {
    logger.info('Récupération du statut du fournisseur d\'IA actif');
    
    // Récupérer les colonnes de la table ai_providers
    const tableInfo = db.prepare('PRAGMA table_info(ai_providers)').all();
    const columnNames = tableInfo.map(col => col.name);
    logger.debug(`Colonnes de la table ai_providers: ${columnNames.join(', ')}`);
    
    // Construire la requête en fonction des colonnes disponibles dans la table
    // Compléter la requête avec toutes les colonnes explicites pour éviter les confusions
    let query;
    // Basé sur les logs du système, la colonne est is_active
    if (columnNames.includes('is_active')) {
      query = `
        SELECT 
          id, 
          name, 
          provider_type, 
          api_key, 
          api_url, 
          model_name, 
          is_active, 
          created_at, 
          updated_at
        FROM ai_providers 
        WHERE is_active = 1 
        ORDER BY id ASC
        LIMIT 1
      `;
    } else if (columnNames.includes('enabled')) {
      query = `
        SELECT 
          id, 
          provider_name, 
          provider_type, 
          api_key, 
          endpoint, 
          models, 
          enabled, 
          created_at, 
          updated_at
        FROM ai_providers 
        WHERE enabled = 1 
        ORDER BY id ASC
        LIMIT 1
      `;
    } else {
      return res.status(500).json({ 
        success: false, 
        message: 'Structure de la table ai_providers non reconnue' 
      });
    }
    
    logger.info(`Requête pour fournisseur actif: ${query}`);
    const activeProvider = db.prepare(query).get();
    
    // Afficher plus d'informations sur le fournisseur récupéré
    if (activeProvider) {
      logger.info(`Fournisseur actif trouvé: ${activeProvider.name || activeProvider.provider_name} Type: ${activeProvider.provider_type}`);
      
      // Vérifier toutes les possibilités de colonnes pour le modèle
      const configuredModel = activeProvider.model_name || activeProvider.models || activeProvider.model_id || 'non spécifié';
      logger.info(`Modèle configuré: ${configuredModel}`);
      
      // Log explicite pour le debug des colonnes
      logger.info(`Colonne model_name: ${activeProvider.model_name}`);
      logger.info(`Colonne models: ${activeProvider.models}`);
      logger.info(`Colonne model_id: ${activeProvider.model_id}`);
      
      // Afficher toutes les propriétés du fournisseur pour débogage
      Object.keys(activeProvider).forEach(key => {
        logger.debug(`  - ${key}: ${activeProvider[key]}`);
      });
    }
    
    if (!activeProvider) {
      return res.json({
        success: true,
        data: {
          active: false,
          message: 'Aucun fournisseur d\'IA n\'est actif'
        }
      });
    }
    
    // Récupérer le modèle configuré dans la base de données
    const configuredModel = activeProvider.model_name || activeProvider.models || activeProvider.model_id || 'unknown';
    logger.info(`Modèle identifié dans la base de données: ${configuredModel}`);
    
    // Obtenir les informations sur le modèle actuel
    let modelInfo;
    try {
      // Utiliser directement le service aiService pour la cohérence
      modelInfo = await aiService.getCurrentModel();
      logger.info(`Modèle retourné par aiService.getCurrentModel(): ${JSON.stringify(modelInfo)}`);
    } catch (error) {
      logger.error(`Erreur lors de la récupération du modèle actuel: ${error.message}`);
      // Si erreur, utiliser le modèle trouvé directement dans la base
      modelInfo = { 
        id: configuredModel, 
        name: configuredModel 
      };
      logger.info(`Utilisation du modèle de fallback: ${JSON.stringify(modelInfo)}`);
    }
    
    // Construire la réponse avec les informations du fournisseur et du modèle
    const response = {
      success: true,
      data: {
        active: true,
        provider: {
          id: activeProvider.id,
          name: activeProvider.provider_name || activeProvider.name,
          type: activeProvider.provider_type,
          endpoint: activeProvider.api_url || activeProvider.endpoint
        },
        model: modelInfo,
        // Ajouter la liste des modèles disponibles (au moins le modèle configuré)
        availableModels: [configuredModel]
      }
    };
    
    return res.json(response);
  } catch (error) {
    logger.error(`Erreur lors de la récupération du statut du fournisseur d'IA: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la récupération du statut: ${error.message}` 
    });
  }
});

module.exports = router;