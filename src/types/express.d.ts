/**
 * Définitions de types supplémentaires pour Express
 * Permet d'étendre les fonctionnalités de TypeScript pour Express
 */

import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { ApiKey, Application } from './index';

declare global {
  namespace Express {
    export interface Request {
      apiKey?: ApiKey;
      application?: Application;
    }
  }
}

export type RequestHandler = (
  req: ExpressRequest, 
  res: ExpressResponse, 
  next: () => void
) => void | Promise<void>;