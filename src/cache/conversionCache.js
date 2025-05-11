/**
 * Cache intelligent pour les conversions HL7 vers FHIR
 * Optimise les performances en mémorisant les résultats des conversions fréquentes
 * 
 * @module cache/conversionCache
 * @version 1.0.0
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration du cache
const CONFIG = {
  // Taille maximale du cache en mémoire (nombre d'entrées)
  MAX_MEMORY_CACHE_SIZE: 500,
  // Durée de vie des entrées du cache (en secondes)
  TTL: 86400, // 24 heures par défaut
  // Répertoire pour le cache persistant (ajusté pour être compatible avec Docker)
  DISK_CACHE_DIR: './storage/data/cache',
  // Taille maximale du cache disque (en nombre de fichiers)
  MAX_DISK_CACHE_SIZE: 5000,
  // Stratégie d'éviction : 'lru' (moins récemment utilisé) ou 'lfu' (moins fréquemment utilisé)
  EVICTION_STRATEGY: 'lru',
  // Active le cache persistant sur disque
  ENABLE_DISK_CACHE: true,
  // Seuil de similarité pour détecter des messages similaires (entre 0 et 1)
  SIMILARITY_THRESHOLD: 0.9,
  // Taille minimale pour être mis en cache (évite de cacher des messages très petits)
  MIN_MESSAGE_SIZE: 100,
};

// Cache en mémoire
const memoryCache = {
  entries: {},
  keys: [],
  hits: 0,
  misses: 0,
  totalRequests: 0,
};

/**
 * Initialise le cache
 */
function initializeCache() {
  console.log('[CACHE] Initialisation du cache de conversion...');
  
  // Créer le répertoire de cache si nécessaire
  if (CONFIG.ENABLE_DISK_CACHE) {
    if (!fs.existsSync(CONFIG.DISK_CACHE_DIR)) {
      fs.mkdirSync(CONFIG.DISK_CACHE_DIR, { recursive: true });
    }
    console.log(`[CACHE] Répertoire de cache persistant : ${CONFIG.DISK_CACHE_DIR}`);
    
    // Lecture du cache existant
    cleanupDiskCache();
  }
  
  console.log(`[CACHE] Cache initialisé avec taille maximale: ${CONFIG.MAX_MEMORY_CACHE_SIZE} entrées`);
  console.log(`[CACHE] Stratégie d'éviction: ${CONFIG.EVICTION_STRATEGY}`);
  
  return {
    get: getFromCache,
    set: addToCache,
    invalidate: invalidateCache,
    getStats: getCacheStats,
    clear: clearCache
  };
}

/**
 * Calcule le hash d'un message HL7
 * @param {string} hl7Message - Message HL7
 * @returns {string} Hash du message
 */
function computeHash(hl7Message) {
  // Normaliser le message (supprimer espaces/caractères spéciaux qui ne changeraient pas le sens)
  const normalizedMessage = hl7Message
    .replace(/\r/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();
  
  return crypto.createHash('sha256').update(normalizedMessage).digest('hex');
}

/**
 * Récupère une entrée du cache
 * @param {string} hl7Message - Message HL7
 * @returns {object|null} Le résultat FHIR mis en cache ou null si non trouvé
 */
function getFromCache(hl7Message) {
  memoryCache.totalRequests++;
  
  // Si le message est trop petit, ne pas utiliser le cache
  if (hl7Message.length < CONFIG.MIN_MESSAGE_SIZE) {
    return null;
  }
  
  const hash = computeHash(hl7Message);
  
  // Vérifier dans le cache mémoire
  if (memoryCache.entries[hash]) {
    const entry = memoryCache.entries[hash];
    
    // Vérifier si l'entrée est expirée
    if (Date.now() < entry.expiresAt) {
      // Mettre à jour les statistiques LRU/LFU
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      
      memoryCache.hits++;
      console.log(`[CACHE] Hit: ${hash.substring(0, 8)}... (${memoryCache.hits}/${memoryCache.totalRequests})`);
      
      return entry.data;
    } else {
      // L'entrée est expirée, la supprimer
      delete memoryCache.entries[hash];
      memoryCache.keys = memoryCache.keys.filter(key => key !== hash);
    }
  }
  
  // Si pas en mémoire, vérifier dans le cache disque
  if (CONFIG.ENABLE_DISK_CACHE) {
    const diskCacheFile = path.join(CONFIG.DISK_CACHE_DIR, `${hash}.json`);
    
    if (fs.existsSync(diskCacheFile)) {
      try {
        const fileContent = fs.readFileSync(diskCacheFile, 'utf8');
        const entry = JSON.parse(fileContent);
        
        // Vérifier si l'entrée est expirée
        if (Date.now() < entry.expiresAt) {
          // Ajouter également au cache mémoire
          memoryCache.entries[hash] = {
            data: entry.data,
            createdAt: entry.createdAt,
            expiresAt: entry.expiresAt,
            lastAccessed: Date.now(),
            accessCount: 1
          };
          
          // Mettre à jour la liste des clés
          memoryCache.keys.push(hash);
          
          memoryCache.hits++;
          console.log(`[CACHE] Disk hit: ${hash.substring(0, 8)}... (${memoryCache.hits}/${memoryCache.totalRequests})`);
          
          return entry.data;
        } else {
          // L'entrée est expirée, la supprimer
          fs.unlinkSync(diskCacheFile);
        }
      } catch (error) {
        console.error(`[CACHE] Erreur lors de la lecture du cache disque: ${error.message}`);
      }
    }
  }
  
  memoryCache.misses++;
  return null;
}

/**
 * Ajoute une entrée au cache
 * @param {string} hl7Message - Message HL7
 * @param {object} fhirResult - Résultat de la conversion vers FHIR
 */
function addToCache(hl7Message, fhirResult) {
  // Si le message est trop petit, ne pas mettre en cache
  if (hl7Message.length < CONFIG.MIN_MESSAGE_SIZE) {
    return;
  }
  
  const hash = computeHash(hl7Message);
  const now = Date.now();
  
  // Créer l'entrée de cache
  const entry = {
    data: fhirResult,
    createdAt: now,
    expiresAt: now + (CONFIG.TTL * 1000),
    lastAccessed: now,
    accessCount: 1
  };
  
  // Ajouter au cache mémoire
  memoryCache.entries[hash] = entry;
  memoryCache.keys.push(hash);
  
  // Gérer la taille du cache mémoire
  if (memoryCache.keys.length > CONFIG.MAX_MEMORY_CACHE_SIZE) {
    evictFromCache();
  }
  
  // Sauvegarder dans le cache disque si activé
  if (CONFIG.ENABLE_DISK_CACHE) {
    const diskCacheFile = path.join(CONFIG.DISK_CACHE_DIR, `${hash}.json`);
    
    try {
      fs.writeFileSync(diskCacheFile, JSON.stringify(entry));
    } catch (error) {
      console.error(`[CACHE] Erreur lors de l'écriture du cache disque: ${error.message}`);
    }
    
    // Nettoyer le cache disque périodiquement
    if (Math.random() < 0.01) { // 1% de chance d'exécuter le nettoyage
      cleanupDiskCache();
    }
  }
  
  console.log(`[CACHE] Nouvelle entrée: ${hash.substring(0, 8)}... (total: ${memoryCache.keys.length})`);
}

/**
 * Évince une entrée du cache selon la stratégie configurée
 */
function evictFromCache() {
  if (memoryCache.keys.length === 0) return;
  
  let keyToRemove;
  
  if (CONFIG.EVICTION_STRATEGY === 'lru') {
    // Least Recently Used - Supprimer l'entrée la moins récemment utilisée
    let oldestAccessTime = Infinity;
    
    for (const key of memoryCache.keys) {
      const entry = memoryCache.entries[key];
      if (entry.lastAccessed < oldestAccessTime) {
        oldestAccessTime = entry.lastAccessed;
        keyToRemove = key;
      }
    }
  } else {
    // Least Frequently Used - Supprimer l'entrée la moins fréquemment utilisée
    let lowestAccessCount = Infinity;
    
    for (const key of memoryCache.keys) {
      const entry = memoryCache.entries[key];
      if (entry.accessCount < lowestAccessCount) {
        lowestAccessCount = entry.accessCount;
        keyToRemove = key;
      }
    }
  }
  
  if (keyToRemove) {
    delete memoryCache.entries[keyToRemove];
    memoryCache.keys = memoryCache.keys.filter(key => key !== keyToRemove);
    console.log(`[CACHE] Éviction: ${keyToRemove.substring(0, 8)}... (stratégie: ${CONFIG.EVICTION_STRATEGY})`);
  }
}

/**
 * Nettoie le cache disque en supprimant les entrées expirées et en respectant la taille maximale
 */
function cleanupDiskCache() {
  if (!CONFIG.ENABLE_DISK_CACHE) return;
  
  try {
    // Lire tous les fichiers du cache
    const files = fs.readdirSync(CONFIG.DISK_CACHE_DIR);
    
    // Collecter les informations sur chaque fichier
    const fileEntries = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(CONFIG.DISK_CACHE_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        fileEntries.push({
          path: filePath,
          expiresAt: content.expiresAt,
          lastAccessed: content.lastAccessed || 0,
          accessCount: content.accessCount || 0,
          createdAt: content.createdAt,
          size: stats.size
        });
      } catch (error) {
        // Fichier corrompu, le supprimer
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error(`[CACHE] Impossible de supprimer le fichier corrompu: ${filePath}`);
        }
      }
    }
    
    // Supprimer les entrées expirées
    const now = Date.now();
    const expiredEntries = fileEntries.filter(entry => entry.expiresAt < now);
    
    for (const entry of expiredEntries) {
      fs.unlinkSync(entry.path);
    }
    
    console.log(`[CACHE] Nettoyage: ${expiredEntries.length} entrées expirées supprimées`);
    
    // Si on dépasse toujours la taille maximale, supprimer selon la stratégie d'éviction
    const remainingEntries = fileEntries.filter(entry => entry.expiresAt >= now);
    
    if (remainingEntries.length > CONFIG.MAX_DISK_CACHE_SIZE) {
      let entriesToRemove;
      
      if (CONFIG.EVICTION_STRATEGY === 'lru') {
        // Trier par date d'accès
        entriesToRemove = remainingEntries
          .sort((a, b) => a.lastAccessed - b.lastAccessed)
          .slice(0, remainingEntries.length - CONFIG.MAX_DISK_CACHE_SIZE);
      } else {
        // Trier par fréquence d'accès
        entriesToRemove = remainingEntries
          .sort((a, b) => a.accessCount - b.accessCount)
          .slice(0, remainingEntries.length - CONFIG.MAX_DISK_CACHE_SIZE);
      }
      
      for (const entry of entriesToRemove) {
        fs.unlinkSync(entry.path);
      }
      
      console.log(`[CACHE] Taille limitée: ${entriesToRemove.length} entrées supplémentaires supprimées`);
    }
  } catch (error) {
    console.error(`[CACHE] Erreur lors du nettoyage du cache disque: ${error.message}`);
  }
}

/**
 * Invalide une entrée spécifique du cache ou l'ensemble du cache
 * @param {string|null} hl7Message - Message HL7 à invalider, ou null pour tout invalider
 */
function invalidateCache(hl7Message = null) {
  if (hl7Message === null) {
    // Invalider tout le cache
    memoryCache.entries = {};
    memoryCache.keys = [];
    console.log('[CACHE] Cache entièrement invalidé');
    
    // Vider également le cache disque
    if (CONFIG.ENABLE_DISK_CACHE) {
      try {
        const files = fs.readdirSync(CONFIG.DISK_CACHE_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(CONFIG.DISK_CACHE_DIR, file));
          }
        }
        console.log('[CACHE] Cache disque entièrement vidé');
      } catch (error) {
        console.error(`[CACHE] Erreur lors de la suppression du cache disque: ${error.message}`);
      }
    }
  } else {
    // Invalider une entrée spécifique
    const hash = computeHash(hl7Message);
    
    if (memoryCache.entries[hash]) {
      delete memoryCache.entries[hash];
      memoryCache.keys = memoryCache.keys.filter(key => key !== hash);
      console.log(`[CACHE] Entrée invalidée: ${hash.substring(0, 8)}...`);
    }
    
    // Supprimer également du cache disque
    if (CONFIG.ENABLE_DISK_CACHE) {
      const diskCacheFile = path.join(CONFIG.DISK_CACHE_DIR, `${hash}.json`);
      if (fs.existsSync(diskCacheFile)) {
        fs.unlinkSync(diskCacheFile);
      }
    }
  }
}

/**
 * Récupère les statistiques du cache
 * @returns {object} Statistiques du cache
 */
function getCacheStats() {
  const memoryEntries = memoryCache.keys.length;
  const hitRatio = memoryCache.totalRequests ? memoryCache.hits / memoryCache.totalRequests : 0;
  
  let diskEntries = 0;
  let diskSize = 0;
  
  if (CONFIG.ENABLE_DISK_CACHE && fs.existsSync(CONFIG.DISK_CACHE_DIR)) {
    try {
      const files = fs.readdirSync(CONFIG.DISK_CACHE_DIR);
      diskEntries = files.filter(file => file.endsWith('.json')).length;
      
      // Calculer la taille totale du cache disque
      for (const file of files) {
        if (file.endsWith('.json')) {
          const stats = fs.statSync(path.join(CONFIG.DISK_CACHE_DIR, file));
          diskSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`[CACHE] Erreur lors du calcul des statistiques: ${error.message}`);
    }
  }
  
  return {
    memory: {
      entries: memoryEntries,
      maxSize: CONFIG.MAX_MEMORY_CACHE_SIZE,
      usage: memoryEntries / CONFIG.MAX_MEMORY_CACHE_SIZE
    },
    disk: {
      entries: diskEntries,
      maxEntries: CONFIG.MAX_DISK_CACHE_SIZE,
      size: diskSize,
      sizeFormatted: formatBytes(diskSize),
      usage: diskEntries / CONFIG.MAX_DISK_CACHE_SIZE
    },
    performance: {
      hits: memoryCache.hits,
      misses: memoryCache.misses,
      total: memoryCache.totalRequests,
      hitRatio: hitRatio,
      hitPercentage: (hitRatio * 100).toFixed(2) + '%'
    },
    config: {
      ttl: CONFIG.TTL,
      strategy: CONFIG.EVICTION_STRATEGY,
      diskCacheEnabled: CONFIG.ENABLE_DISK_CACHE
    }
  };
}

/**
 * Formate une taille en bytes en une chaîne lisible
 * @param {number} bytes - Taille en bytes
 * @returns {string} Taille formatée
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Vide entièrement le cache
 */
function clearCache() {
  invalidateCache(null);
}

module.exports = {
  initializeCache,
  CONFIG
};