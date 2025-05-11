/**
 * Service de journalisation des conversions
 */
import { ConversionLog } from '../../types';
import { createConversionLog, getConversionLogsByApiKeyId } from '../db/database';

/**
 * Enregistre un log de conversion
 * 
 * @param apiKeyId - ID de la clé API utilisée
 * @param sourceType - Type de source (par exemple, 'HL7v2.5')
 * @param sourceContent - Contenu source (message HL7)
 * @param resultContent - Contenu résultant (FHIR)
 * @param status - Statut de la conversion ('success' ou 'error')
 * @param processingTime - Temps de traitement en millisecondes
 * @param errorMessage - Message d'erreur (optionnel)
 * @returns Log de conversion créé
 */
export function logConversion(
  apiKeyId: number,
  sourceType: string,
  sourceContent: string,
  resultContent: string,
  status: 'success' | 'error',
  processingTime: number,
  errorMessage?: string
): ConversionLog {
  return createConversionLog({
    api_key_id: apiKeyId,
    source_type: sourceType,
    source_content: sourceContent,
    result_content: resultContent,
    status,
    processing_time: processingTime,
    error_message: errorMessage
  });
}

/**
 * Récupère les logs de conversion pour une clé API
 * 
 * @param apiKeyId - ID de la clé API
 * @param limit - Nombre maximum de logs à récupérer
 * @param offset - Offset pour la pagination
 * @returns Liste des logs de conversion
 */
export function getConversionLogs(apiKeyId: number, limit = 50, offset = 0): ConversionLog[] {
  return getConversionLogsByApiKeyId(apiKeyId, limit, offset);
}