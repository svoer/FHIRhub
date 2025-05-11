/**
 * Middleware d'authentification par clé API
 * Vérifie que la clé API est valide et active
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';

interface ApiKey {
  id: number;
  key: string;
  name: string;
  application_id: number;
  is_active: number;
  created_at: string;
  last_used_at: string | null;
}

// Étendre l'interface Request pour y ajouter la clé API
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
    }
  }
}

/**
 * Middleware d'authentification par clé API
 * Vérifie que la clé API est fournie et valide
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  // Récupérer la clé API depuis l'en-tête ou les paramètres de requête
  const apiKey = 
    req.headers['x-api-key'] || 
    req.query.apiKey || 
    '';
  
  // Vérifier que la clé API est fournie
  if (!apiKey) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized', 
      message: 'Clé API manquante' 
    });
  }
  
  // Si c'est la clé de développement, autoriser l'accès sans vérification
  if (apiKey === 'dev-key') {
    req.apiKey = {
      id: 1,
      key: 'dev-key',
      name: 'Clé de développement',
      application_id: 1,
      is_active: 1,
      created_at: new Date().toISOString(),
      last_used_at: null
    };
    return next();
  }
  
  try {
    // Vérifier que la clé API existe et est active
    const key = db.prepare(`
      SELECT 
        api_keys.id, 
        api_keys.key, 
        api_keys.name, 
        api_keys.application_id,
        api_keys.is_active, 
        api_keys.created_at,
        api_keys.last_used_at
      FROM api_keys
      WHERE api_keys.key = ?
    `).get(apiKey);
    
    if (!key) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized', 
        message: 'Clé API invalide' 
      });
    }
    
    if (key.is_active !== 1) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized', 
        message: 'Clé API révoquée' 
      });
    }
    
    // Mettre à jour la date de dernière utilisation
    db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?')
      .run(key.id);
    
    // Ajouter la clé API à la requête
    req.apiKey = key;
    
    // Logger l'utilisation de l'API
    db.prepare(`
      INSERT INTO api_activity_logs (
        api_key_id, 
        application_id, 
        endpoint, 
        method, 
        timestamp
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).run(
      key.id, 
      key.application_id, 
      req.originalUrl, 
      req.method
    );
    
    next();
  } catch (error) {
    console.error('[API Key Auth Error]', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error', 
      message: 'Erreur lors de la vérification de la clé API' 
    });
  }
}