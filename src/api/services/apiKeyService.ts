/**
 * Service de gestion des clés API
 */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ApiKey } from '../../types';
import {
  createApiKey,
  getApiKeyByKey,
  getApiKeyById,
  getApiKeysByApplicationId,
  revokeApiKey,
  updateApiKeyLastUsed
} from '../db/database';

/**
 * Génère une nouvelle clé API
 * 
 * @returns Clé API générée
 */
function generateApiKey(): string {
  // Préfixe pour identifier les clés API de notre application
  const prefix = 'fhir_';
  
  // Générer une chaîne aléatoire de 32 caractères
  const randomBytes = crypto.randomBytes(16);
  const randomString = randomBytes.toString('hex');
  
  return `${prefix}${randomString}`;
}

/**
 * Hache une clé API pour le stockage sécurisé
 * 
 * @param apiKey - Clé API à hacher
 * @returns Clé API hachée
 */
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Crée une nouvelle clé API pour une application
 * 
 * @param applicationId - ID de l'application
 * @returns Clé API créée
 */
export function createNewApiKey(applicationId: number): ApiKey {
  // Générer une nouvelle clé API
  const apiKey = generateApiKey();
  
  // Hacher la clé pour le stockage
  const hashedKey = hashApiKey(apiKey);
  
  // Créer la clé dans la base de données
  return createApiKey(applicationId, apiKey, hashedKey);
}

/**
 * Vérifie si une clé API est valide
 * 
 * @param apiKey - Clé API à vérifier
 * @returns ApiKey si valide, undefined sinon
 */
export function validateApiKey(apiKey: string): ApiKey | undefined {
  if (!apiKey) return undefined;
  
  // Récupérer la clé API depuis la base de données
  const storedApiKey = getApiKeyByKey(apiKey);
  
  // Vérifier si la clé existe et n'est pas révoquée
  if (storedApiKey && !storedApiKey.is_revoked) {
    // Mettre à jour la date de dernière utilisation
    updateApiKeyLastUsed(storedApiKey.id);
    return storedApiKey;
  }
  
  return undefined;
}

/**
 * Révoque une clé API
 * 
 * @param apiKeyId - ID de la clé API à révoquer
 * @returns true si la clé a été révoquée avec succès
 */
export function revokeExistingApiKey(apiKeyId: number): boolean {
  return revokeApiKey(apiKeyId);
}

/**
 * Récupère toutes les clés API d'une application
 * 
 * @param applicationId - ID de l'application
 * @returns Liste des clés API
 */
export function getApiKeysForApplication(applicationId: number): ApiKey[] {
  return getApiKeysByApplicationId(applicationId);
}

/**
 * Récupère une clé API par son ID
 * 
 * @param apiKeyId - ID de la clé API
 * @returns Clé API si trouvée, undefined sinon
 */
export function getApiKeyDetails(apiKeyId: number): ApiKey | undefined {
  return getApiKeyById(apiKeyId);
}