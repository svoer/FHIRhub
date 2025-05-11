/**
 * Routes pour l'API de conversion HL7 vers FHIR
 */

import express, { Request, Response } from 'express';
import { convertHL7ToFHIR } from '../services/conversionService';
import { db } from '../db/database';

const router = express.Router();

/**
 * @swagger
 * /api/convert:
 *   post:
 *     summary: Convertit un message HL7 v2.5 en FHIR R4
 *     description: Prend un message HL7 au format texte brut et le convertit en ressource FHIR R4 complète
 *     tags: [Conversion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hl7Message:
 *                 type: string
 *                 description: Message HL7 v2.5 à convertir
 *               options:
 *                 type: object
 *                 description: Options de conversion personnalisées
 *     responses:
 *       200:
 *         description: Conversion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indique si la conversion a réussi
 *                 data:
 *                   type: object
 *                   description: Ressource FHIR générée
 *                 processingTime:
 *                   type: integer
 *                   description: Temps de traitement en millisecondes
 *       400:
 *         description: Message HL7 invalide ou manquant
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur lors de la conversion
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const { hl7Message, options } = req.body;
    
    if (!hl7Message) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 est requis'
      });
    }
    
    // Effectuer la conversion
    const fhirResource = convertHL7ToFHIR(hl7Message);
    const processingTime = Date.now() - startTime;
    
    // Enregistrer la conversion dans la base de données
    if (req.apiKey) {
      db.prepare(`
        INSERT INTO conversion_logs (
          api_key_id,
          application_id,
          input_message,
          output_message,
          status,
          processing_time,
          timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        req.apiKey.id,
        req.apiKey.application_id,
        hl7Message.length > 1000 ? hl7Message.substring(0, 1000) + '...' : hl7Message,
        JSON.stringify(fhirResource).length > 1000 ? JSON.stringify(fhirResource).substring(0, 1000) + '...' : JSON.stringify(fhirResource),
        'success',
        processingTime
      );
      
      console.log('[CONVERSION LOG] API Key:', req.apiKey.id, ', Status: success, Time:', processingTime + 'ms');
    }
    
    return res.status(200).json({
      success: true,
      data: fhirResource,
      processingTime
    });
  } catch (error) {
    console.error('[CONVERSION ERROR]', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    
    // Enregistrer l'erreur dans la base de données
    if (req.apiKey) {
      db.prepare(`
        INSERT INTO conversion_logs (
          api_key_id,
          application_id,
          input_message,
          status,
          error_message,
          processing_time,
          timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        req.apiKey.id,
        req.apiKey.application_id,
        req.body.hl7Message ? (req.body.hl7Message.length > 1000 ? req.body.hl7Message.substring(0, 1000) + '...' : req.body.hl7Message) : 'Message manquant',
        'error',
        errorMessage,
        0
      );
      
      console.log('[CONVERSION LOG] API Key:', req.apiKey.id, ', Status: error, Error:', errorMessage);
    }
    
    return res.status(500).json({
      success: false,
      error: 'Conversion Error',
      message: errorMessage
    });
  }
});

/**
 * @swagger
 * /api/convert/validate:
 *   post:
 *     summary: Valide un message HL7 v2.5
 *     description: Vérifie qu'un message HL7 est valide sans effectuer de conversion
 *     tags: [Conversion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hl7Message:
 *                 type: string
 *                 description: Message HL7 v2.5 à valider
 *     responses:
 *       200:
 *         description: Validation réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indique si la validation a réussi
 *                 data:
 *                   type: object
 *                   description: Informations sur la validation
 *       400:
 *         description: Message HL7 invalide ou manquant
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur lors de la validation
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { hl7Message } = req.body;
    
    if (!hl7Message) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 est requis'
      });
    }
    
    // Valider le message HL7
    const segments = hl7Message.replace(/\n/g, '\r').split('\r').filter(Boolean);
    
    if (segments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 ne contient aucun segment'
      });
    }
    
    if (!segments[0].startsWith('MSH|')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 doit commencer par un segment MSH'
      });
    }
    
    // Compter les segments par type
    const segmentTypes: Record<string, number> = {};
    
    segments.forEach(segment => {
      const type = segment.split('|')[0] || 'UNKNOWN';
      segmentTypes[type] = (segmentTypes[type] || 0) + 1;
    });
    
    console.log('[HL7 Validation] Message parsé avec succès:', segments.length, 'segments');
    
    return res.status(200).json({
      success: true,
      data: {
        valid: true,
        segmentCount: segments.length,
        segmentTypes
      }
    });
  } catch (error) {
    console.error('[VALIDATION ERROR]', error);
    
    return res.status(500).json({
      success: false,
      error: 'Validation Error',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * @swagger
 * /api/convert/preview:
 *   post:
 *     summary: Aperçu de la conversion d'un message HL7
 *     description: Convertit partiellement un message HL7 pour montrer un aperçu du résultat
 *     tags: [Conversion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hl7Message:
 *                 type: string
 *                 description: Message HL7 v2.5 à prévisualiser
 *     responses:
 *       200:
 *         description: Aperçu généré avec succès
 *       400:
 *         description: Message HL7 invalide ou manquant
 *       401:
 *         description: Non autorisé
 */
router.post('/preview', (req: Request, res: Response) => {
  try {
    const { hl7Message } = req.body;
    
    if (!hl7Message) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 est requis'
      });
    }
    
    // Extraire les principaux segments pour l'aperçu
    const segments = hl7Message.replace(/\n/g, '\r').split('\r').filter(Boolean);
    const msh = segments.find(s => s.startsWith('MSH|')) || '';
    const pid = segments.find(s => s.startsWith('PID|')) || '';
    
    // Créer un aperçu simplifié
    const preview = {
      messageType: msh.split('|')[9] || 'Unknown',
      patientName: pid.split('|')[5] || 'Unknown',
      segments: segments.map(s => s.split('|')[0]).filter(Boolean),
      segmentCount: segments.length
    };
    
    return res.status(200).json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('[PREVIEW ERROR]', error);
    
    return res.status(500).json({
      success: false,
      error: 'Preview Error',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

export default router;