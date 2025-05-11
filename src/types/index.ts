/**
 * Définitions des types pour l'application FHIRHub
 */
import { Request } from 'express';

/**
 * Extension de l'interface Request d'Express pour inclure l'API Key et l'Application
 */
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      application?: Application;
    }
  }
}

/**
 * Type Application représentant une application cliente
 */
export interface Application {
  id: number;
  name: string;
  type?: string;
  description?: string;
  is_active: boolean;
  properties?: Record<string, any>;
  cors_domain?: string;
  created_at: string;
  updated_at: string;
}

/**
 * DTO pour la création d'une application
 */
export type CreateApplicationDto = Omit<Application, 'id' | 'created_at' | 'updated_at'>;

/**
 * DTO pour la mise à jour d'une application
 */
export type UpdateApplicationDto = Partial<CreateApplicationDto>;

/**
 * Type ApiKey représentant une clé API
 */
export interface ApiKey {
  id: number;
  application_id: number;
  key: string;
  hashed_key: string;
  created_at: string;
  last_used_at: string | null;
  is_revoked: boolean;
}

/**
 * Type ConversionLog représentant un log de conversion HL7 vers FHIR
 */
export interface ConversionLog {
  id: number;
  api_key_id: number;
  source_type: string;
  source_content: string;
  result_content: string;
  status: 'success' | 'error';
  error_message?: string;
  processing_time: number;
  created_at: string;
}

/**
 * Type User représentant un utilisateur du système
 */
export interface User {
  id: number;
  username: string;
  password: string;
  full_name: string;
  email?: string;
  role: 'admin' | 'user';
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * DTO pour la création d'un utilisateur
 */
export type CreateUserDto = Omit<User, 'id' | 'last_login' | 'created_at' | 'updated_at'>;

/**
 * DTO pour la mise à jour d'un utilisateur
 */
export type UpdateUserDto = Partial<CreateUserDto>;

/**
 * Type pour les métriques système
 */
export interface SystemMetrics {
  id: number;
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_connections: number;
  conversion_count: number;
}

/**
 * Type pour les options de conversion HL7 vers FHIR
 */
export interface ConversionOptions {
  adaptToFrenchTerminology?: boolean;
  includeRawHL7?: boolean;
  includeDebugInfo?: boolean;
  validateOutput?: boolean;
  targetFhirVersion?: 'R4' | 'R5';
}

/**
 * Type pour les informations d'authentification
 */
export interface AuthInfo {
  username: string;
  password: string;
}