/**
 * Service pour la gestion des fournisseurs d'IA
 * @module utils/aiProviderService
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dbPath = path.join(process.cwd(), 'storage', 'db', 'fhirhub.db');

// Assurez-vous que le dossier existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Créer une connexion à la base de données
const db = new sqlite3.Database(dbPath);

/**
 * Initialiser la table des fournisseurs d'IA si elle n'existe pas
 */
function initializeAIProvidersTable() {
    db.run(`CREATE TABLE IF NOT EXISTS ai_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        api_key TEXT,
        api_url TEXT,
        model_name TEXT,
        is_active INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
}

// Initialiser la table au démarrage
initializeAIProvidersTable();

/**
 * Récupérer tous les fournisseurs d'IA
 * @returns {Promise<Array>} Liste des fournisseurs d'IA
 */
function getAllAIProviders() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ai_providers ORDER BY id ASC`, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                // Normaliser tous les fournisseurs pour assurer la compatibilité
                const providers = (rows || []).map(row => {
                    return {
                        id: row.id,
                        provider_name: row.name || row.provider_name,
                        provider_type: row.provider_type,
                        api_key: row.api_key,
                        endpoint: row.api_url || row.endpoint,
                        model_id: row.model_name || row.models,
                        enabled: row.is_active || row.enabled,
                        created_at: row.created_at,
                        updated_at: row.updated_at
                    };
                });
                resolve(providers);
            }
        });
    });
}

/**
 * Obtenir le fournisseur d'IA actif
 * @returns {Promise<Object|null>} Fournisseur d'IA actif ou null si aucun n'est actif
 */
function getActiveAIProvider() {
    return new Promise((resolve, reject) => {
        // Vérifier quelle structure de table est utilisée
        db.all(`PRAGMA table_info(ai_providers)`, (err, rows) => {
            if (err) {
                console.error("Erreur lors de la vérification de la structure de la table:", err);
                reject(err);
                return;
            }
            
            // Extraire tous les noms de colonnes
            const columnNames = rows.map(row => row.name);
            console.log("Colonnes de la table ai_providers:", columnNames.join(', '));
            
            // Construire une requête qui fonctionne avec les deux structures possibles
            let query;
            
            // Déterminer quelle structure de table est utilisée
            if (columnNames.includes('enabled')) {
                query = `SELECT * FROM ai_providers WHERE enabled = 1`;
            } else if (columnNames.includes('is_active')) {
                query = `SELECT * FROM ai_providers WHERE is_active = 1`;
            } else {
                // Fallback: essayer les deux conditions
                query = `SELECT * FROM ai_providers WHERE is_active = 1 OR enabled = 1`;
            }
            
            console.log(`Requête pour fournisseur actif: ${query}`);
            
            db.get(query, (err, row) => {
                if (err) {
                    console.error("Erreur lors de la récupération du fournisseur actif:", err);
                    reject(err);
                } else {
                    if (row) {
                        // Normaliser les noms de colonnes pour assurer la compatibilité
                        const provider = {
                            id: row.id,
                            provider_name: row.name || row.provider_name,
                            provider_type: row.provider_type,
                            api_key: row.api_key,
                            endpoint: row.api_url || row.endpoint,
                            model_id: row.model_name || row.models,
                            enabled: row.is_active || row.enabled,
                            created_at: row.created_at,
                            updated_at: row.updated_at
                        };
                        console.log("Fournisseur actif trouvé:", provider.provider_name, "Type:", provider.provider_type);
                        resolve(provider);
                    } else {
                        console.log("Aucun fournisseur actif trouvé");
                        resolve(null);
                    }
                }
            });
        });
    });
}

/**
 * Ajouter un nouveau fournisseur d'IA
 * @param {Object} provider - Données du fournisseur d'IA
 * @returns {Promise<Object>} Fournisseur d'IA ajouté
 */
function addAIProvider(provider) {
    return new Promise((resolve, reject) => {
        const { name, provider_type, api_key, api_url, model_name, is_active } = provider;
        
        db.run(
            `INSERT INTO ai_providers (name, provider_type, api_key, api_url, model_name, is_active) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, provider_type, api_key, api_url, model_name, is_active ? 1 : 0],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    // Si ce fournisseur est défini comme actif, désactiver les autres
                    if (is_active) {
                        db.run(`UPDATE ai_providers SET is_active = 0 WHERE id != ?`, [this.lastID]);
                    }
                    
                    // Récupérer le fournisseur créé
                    db.get(`SELECT * FROM ai_providers WHERE id = ?`, [this.lastID], (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row);
                        }
                    });
                }
            }
        );
    });
}

/**
 * Mettre à jour un fournisseur d'IA existant
 * @param {number} id - ID du fournisseur d'IA
 * @param {Object} provider - Nouvelles données du fournisseur
 * @returns {Promise<Object>} Fournisseur d'IA mis à jour
 */
function updateAIProvider(id, provider) {
    return new Promise((resolve, reject) => {
        const { name, provider_type, api_key, api_url, model_name, is_active } = provider;
        
        db.run(
            `UPDATE ai_providers SET 
             name = ?, provider_type = ?, api_key = ?, api_url = ?, model_name = ?, is_active = ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, provider_type, api_key, api_url, model_name, is_active ? 1 : 0, id],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    // Si ce fournisseur est défini comme actif, désactiver les autres
                    if (is_active) {
                        db.run(`UPDATE ai_providers SET is_active = 0 WHERE id != ?`, [id]);
                    }
                    
                    // Récupérer le fournisseur mis à jour
                    db.get(`SELECT * FROM ai_providers WHERE id = ?`, [id], (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row);
                        }
                    });
                }
            }
        );
    });
}

/**
 * Définir un fournisseur d'IA comme actif
 * @param {number} id - ID du fournisseur d'IA
 * @returns {Promise<boolean>} Résultat de l'opération
 */
function setActiveAIProvider(id) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE ai_providers SET is_active = 0`, [], function(err) {
            if (err) {
                reject(err);
                return;
            }
            
            db.run(`UPDATE ai_providers SET is_active = 1 WHERE id = ?`, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(true);
                }
            });
        });
    });
}

/**
 * Supprimer un fournisseur d'IA
 * @param {number} id - ID du fournisseur d'IA
 * @returns {Promise<boolean>} Résultat de l'opération
 */
function deleteAIProvider(id) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM ai_providers WHERE id = ?`, [id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Obtenir un fournisseur d'IA par ID
 * @param {number} id - ID du fournisseur d'IA
 * @returns {Promise<Object|null>} Fournisseur d'IA ou null s'il n'existe pas
 */
function getAIProviderById(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM ai_providers WHERE id = ?`, [id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

/**
 * Récupère un fournisseur d'IA par son nom depuis la base de données
 * @param {string} providerName - Nom du fournisseur à récupérer
 * @returns {Promise<Object|null>} Le fournisseur d'IA correspondant ou null s'il n'existe pas
 */
function getAIProviderByName(providerName) {
    return new Promise((resolve, reject) => {
        // Vérifier quelle structure de table est utilisée
        db.all(`PRAGMA table_info(ai_providers)`, (err, rows) => {
            if (err) {
                console.error("Erreur lors de la vérification de la structure de la table:", err);
                reject(err);
                return;
            }
            
            // Extraire tous les noms de colonnes
            const columnNames = rows.map(row => row.name);
            
            // Construire une requête qui fonctionne avec les deux structures possibles
            let query;
            let nameColumn;
            
            // Déterminer quelle structure de table est utilisée
            if (columnNames.includes('name')) {
                nameColumn = 'name';
                query = `SELECT * FROM ai_providers WHERE name = ?`;
            } else if (columnNames.includes('provider_name')) {
                nameColumn = 'provider_name';
                query = `SELECT * FROM ai_providers WHERE provider_name = ?`;
            } else {
                console.error("Structure de table non supportée - impossible de trouver la colonne de nom");
                resolve(null);
                return;
            }
            
            console.log(`[AI-PROVIDER] Recherche du fournisseur par nom: ${providerName} (colonne: ${nameColumn})`);
            
            db.get(query, [providerName], (err, row) => {
                if (err) {
                    console.error("Erreur lors de la récupération du fournisseur par nom:", err);
                    reject(err);
                } else {
                    if (row) {
                        // Normaliser les noms de colonnes pour assurer la compatibilité
                        const provider = {
                            id: row.id,
                            provider_name: row.name || row.provider_name,
                            provider_type: row.provider_type,
                            api_key: row.api_key,
                            endpoint: row.api_url || row.endpoint,
                            model_id: row.model_name || row.models,
                            enabled: row.is_active || row.enabled,
                            created_at: row.created_at,
                            updated_at: row.updated_at
                        };
                        console.log(`[AI-PROVIDER] Fournisseur trouvé: ${provider.provider_name} (${provider.provider_type})`);
                        resolve(provider);
                    } else {
                        console.log(`[AI-PROVIDER] Aucun fournisseur trouvé avec le nom: ${providerName}`);
                        resolve(null);
                    }
                }
            });
        });
    });
}

// Variable pour stocker le fournisseur actif initial lors d'un remplacement temporaire
let originalActiveProvider = null;
let tempProviderActive = false;

/**
 * Configure un fournisseur d'IA temporaire pour des tests sans modifier la base de données
 * @param {Object} provider - Configuration du fournisseur temporaire
 * @returns {Promise<boolean>} - true si le fournisseur a été configuré avec succès
 */
async function setTempActiveProvider(provider) {
    try {
        if (!provider || !provider.provider_type) {
            throw new Error('Configuration de fournisseur invalide');
        }

        // Sauvegarder le fournisseur actif actuel si ce n'est pas déjà fait
        if (!tempProviderActive) {
            originalActiveProvider = await getActiveAIProvider();
            tempProviderActive = true;
            console.log('[AI Provider Service] Fournisseur actif original sauvegardé pour test temporaire');
        }

        // Définir le fournisseur temporaire comme variable globale (en mémoire)
        global.tempAIProvider = {
            id: 'temp',
            provider_name: `Temporary ${provider.provider_type} Provider`,
            provider_type: provider.provider_type,
            api_key: provider.api_key,
            endpoint: provider.endpoint || provider.api_url,
            model_id: provider.model_id || provider.models || provider.model_name,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        console.log(`[AI Provider Service] Fournisseur temporaire configuré: ${provider.provider_type}`);
        return true;
    } catch (error) {
        console.error('[AI Provider Service] Erreur lors de la configuration du fournisseur temporaire:', error);
        return false;
    }
}

/**
 * Restaure le fournisseur d'IA actif original après un test temporaire
 * @returns {Promise<boolean>} - true si le fournisseur a été restauré avec succès
 */
async function restoreTempActiveProvider() {
    try {
        if (!tempProviderActive) {
            return true; // Rien à restaurer
        }

        // Supprimer le fournisseur temporaire
        if (global.tempAIProvider) {
            delete global.tempAIProvider;
        }

        tempProviderActive = false;
        originalActiveProvider = null;
        console.log('[AI Provider Service] Fournisseur actif original restauré');
        return true;
    } catch (error) {
        console.error('[AI Provider Service] Erreur lors de la restauration du fournisseur actif:', error);
        return false;
    }
}

// Surcharge de getActiveAIProvider pour prendre en compte le fournisseur temporaire
const originalGetActiveAIProvider = getActiveAIProvider;
getActiveAIProvider = async function() {
    // Si un fournisseur temporaire est configuré, le retourner
    if (tempProviderActive && global.tempAIProvider) {
        console.log('[AI Provider Service] Utilisation du fournisseur temporaire pour ce test');
        return global.tempAIProvider;
    }
    
    // Sinon, utiliser la méthode originale
    return await originalGetActiveAIProvider();
};

module.exports = {
    getAllAIProviders,
    getActiveAIProvider,
    addAIProvider,
    updateAIProvider,
    setActiveAIProvider,
    deleteAIProvider,
    getAIProviderById,
    setTempActiveProvider,
    restoreTempActiveProvider
};