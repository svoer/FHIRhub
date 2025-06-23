/**
 * Routes pour l'API de conversion sans analyse IA
 * Ces routes permettent d'accéder aux fonctionnalités de base de conversion
 * entre les différents formats (HL7, FHIR)
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/jwtAuth');
const validateApiKey = require('../middleware/apiKeyAuth');
// Utiliser le convertisseur avec cache au lieu du service direct pour de meilleures performances
// Convertisseur avec cache supprimé lors du nettoyage - utilisation directe
const { convertHL7ToFHIR } = require('../hl7ToFhirAdvancedConverter');
// Le service statsService n'existe pas, utilisons le service de journalisation des conversions à la place
// Service de log supprimé lors du nettoyage
// Métriques supprimées lors du nettoyage

/**
 * @swagger
 * tags:
 *   name: Conversion
 *   description: API pour la conversion entre différents formats standards de santé
 */

/**
 * @swagger
 * /api/convert/hl7-to-fhir:
 *   post:
 *     summary: Conversion HL7 v2.5 vers FHIR R4
 *     description: |
 *       Convertit un message HL7 v2.5 en bundle FHIR R4 avec terminologies françaises.
 *       
 *       **Fonctionnalités:**
 *       - Support des segments HL7 : MSH, PID, PV1, OBX, ORC, OBR
 *       - Terminologies françaises (ANS/MOS) automatiques
 *       - Validation FHIR R4 complète
 *       - Génération d'identifiants uniques
 *       
 *       **Formats supportés:** ADT^A01, ADT^A02, ADT^A03, ORU^R01, ORM^O01
 *     tags: [Conversion]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HL7Message'
 *           examples:
 *             adtA01:
 *               summary: "Message ADT^A01 - Admission patient"
 *               value:
 *                 hl7Message: "MSH|^~\\&|HOPITAL_SRC|SERVICE_SRC|FHIRHUB|DEST|202506181200||ADT^A01|MSG001|P|2.5\rPID|1||123456789^^^HOPITAL^MR||DUPONT^JEAN^MARIE||19800315|M|||123 RUE DE LA PAIX^^PARIS^^75001^FR||(01)42.12.34.56|||FR||||||||||\rPV1|1|I|CARDIO^CH101^LIT1||||DOC123^MARTIN^PAUL^^^Dr|||CARDIO|||||||DOC123^MARTIN^PAUL^^^Dr|INP|VIP|||||||||||||||||||||||202506181200||||||V"
 *                 options:
 *                   includeComments: true
 *                   validateOutput: true
 *                   frenchTerminology: true
 *             oruR01:
 *               summary: "Message ORU^R01 - Résultats de laboratoire"
 *               value:
 *                 hl7Message: "MSH|^~\\&|LAB_SRC|LABO|FHIRHUB|DEST|202506181300||ORU^R01|LAB001|P|2.5\rPID|1||987654321^^^LABO^MR||MARTIN^MARIE^CLAIRE||19750520|F\rOBR|1|LAB123|LAB123|88304^ANATOMIE PATHOLOGIQUE^LN|||202506181200|||||||||||DOC456^BERNARD^LUC^^^Dr\rOBX|1|ST|33747-0^HEMOGLOBINE^LN||14.5|g/dL|12.0-15.5||||F"
 *                 options:
 *                   frenchTerminology: true
 *     responses:
 *       200:
 *         description: Conversion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversionResponse'
 *             examples:
 *               success:
 *                 summary: "Conversion réussie"
 *                 value:
 *                   success: true
 *                   data:
 *                     resourceType: "Bundle"
 *                     id: "hl7-conversion-001"
 *                     type: "collection"
 *                     entry:
 *                       - resource:
 *                           resourceType: "Patient"
 *                           id: "patient-123456789"
 *                           identifier:
 *                             - system: "urn:oid:1.2.250.1.213.1.4.10"
 *                               value: "123456789"
 *                           name:
 *                             - family: "DUPONT"
 *                               given: ["JEAN", "MARIE"]
 *                           gender: "male"
 *                           birthDate: "1980-03-15"
 *                   metadata:
 *                     conversionTime: 45
 *                     resourceCount: 3
 *                     warnings: []
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
// Route sécurisée - l'authentification est gérée au niveau de l'app
router.post('/hl7-to-fhir', async (req, res) => {
  apiRequestCounter.inc({ endpoint: 'hl7-to-fhir' });
  try {
    const { hl7Message, options = {} } = req.body;
    
    if (!hl7Message) {
      return res.status(400).json({ error: 'Le message HL7 est requis' });
    }
    
    // Tracer l'application_id depuis la clé API ou la session
    let application_id = req.apiKeyData ? req.apiKeyData.application_id : null;
    if (!application_id && req.user && req.user.default_application_id) {
      application_id = req.user.default_application_id;
    }
    
    // Convertir le message HL7 en FHIR
    try {
      console.log('[HL7-TO-FHIR] Début de la conversion HL7 vers FHIR');
      
      // Envelopper dans une promesse avec timeout pour éviter les blocages
      const result = await new Promise((resolve, reject) => {
        // Ajouter un timeout de 10 secondes pour éviter les blocages
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout lors de la conversion HL7 vers FHIR (10s)'));
        }, 10000);
        
        try {
          // La fonction n'est pas asynchrone, mais comme le fichier l'utilise comme telle,
          // nous allons l'envelopper dans une promesse
          const convertedResult = convertHL7ToFHIR(hl7Message, options);
          clearTimeout(timeoutId);
          resolve(convertedResult);
        } catch (err) {
          clearTimeout(timeoutId);
          reject(err);
        }
      });
      
      console.log('[HL7-TO-FHIR] Conversion réussie');
      
      // Enregistrer la conversion dans les journaux
      try {
        await // conversionLogService.logConversion({
          apiKeyId: req.apiKeyData ? req.apiKeyData.id : null,
          applicationId: application_id || 1,
          sourceType: 'direct',
          hl7Content: hl7Message,
          fhirContent: JSON.stringify(result),
          status: 'success',
          processingTime: result.processingTime || 0,
          errorMessage: null
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de la conversion:', logError);
      }
      
      return res.json(result);
    } catch (conversionError) {
      console.error('Erreur lors de la conversion HL7 vers FHIR:', conversionError);
      
      // Enregistrer l'échec dans les journaux
      try {
        await // conversionLogService.logConversion({
          apiKeyId: req.apiKeyData ? req.apiKeyData.id : null,
          applicationId: application_id || 1,
          sourceType: 'direct',
          hl7Content: hl7Message,
          fhirContent: null,
          status: 'error',
          processingTime: 0,
          errorMessage: conversionError.message
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de l\'erreur de conversion:', logError);
      }
      
      return res.status(400).json({ error: conversionError.message });
    }
    
  } catch (error) {
    console.error('Erreur HL7 vers FHIR:', error);
    return res.status(500).json({ error: 'Erreur de serveur lors de la conversion' });
  }
});

/**
 * @swagger
 * /api/convert/fhir-to-hl7:
 *   post:
 *     summary: Convertir des ressources FHIR en message HL7 v2.5
 *     description: Convertit des ressources FHIR R4 en message HL7 v2.5 correspondant
 *     tags: [Conversion]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fhirResources
 *             properties:
 *               fhirResources:
 *                 type: object
 *                 description: Les ressources FHIR à convertir (peut être un bundle ou un objet individuel)
 *               options:
 *                 type: object
 *                 description: Options supplémentaires pour la conversion
 *                 properties:
 *                   hl7Version:
 *                     type: string
 *                     description: Version HL7 souhaitée (par défaut 2.5)
 *                   includeNotes:
 *                     type: boolean
 *                     description: Inclure des notes explicatives
 *     responses:
 *       200:
 *         description: Conversion réussie
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur serveur
 */
// Route sécurisée - l'authentification est gérée au niveau de l'app  
router.post('/fhir-to-hl7', async (req, res) => {
  try {
    const { fhirResources, options = {} } = req.body;
    
    if (!fhirResources) {
      return res.status(400).json({ error: 'Les ressources FHIR sont requises' });
    }
    
    // Tracer l'application_id depuis la clé API ou la session
    let application_id = req.apiKeyData ? req.apiKeyData.application_id : null;
    if (!application_id && req.user && req.user.default_application_id) {
      application_id = req.user.default_application_id;
    }
    
    // Convertir les ressources FHIR en HL7
    try {
      const result = await converter.convertFHIRToHL7(fhirResources, options);
      
      // Enregistrer la conversion dans les journaux
      try {
        await // conversionLogService.logConversion({
          apiKeyId: req.apiKeyData ? req.apiKeyData.id : null,
          applicationId: application_id || 1,
          sourceType: 'direct',
          hl7Content: result.hl7Message || '',
          fhirContent: JSON.stringify(fhirResources),
          status: 'success',
          processingTime: result.processingTime || 0,
          errorMessage: null
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de la conversion:', logError);
      }
      
      return res.json(result);
    } catch (conversionError) {
      console.error('Erreur lors de la conversion FHIR vers HL7:', conversionError);
      
      // Enregistrer l'échec dans les journaux
      try {
        await // conversionLogService.logConversion({
          apiKeyId: req.apiKeyData ? req.apiKeyData.id : null,
          applicationId: application_id || 1,
          sourceType: 'direct',
          hl7Content: null,
          fhirContent: JSON.stringify(fhirResources),
          status: 'error',
          processingTime: 0,
          errorMessage: conversionError.message
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de l\'erreur de conversion:', logError);
      }
      
      return res.status(400).json({ error: conversionError.message });
    }
    
  } catch (error) {
    console.error('Erreur FHIR vers HL7:', error);
    return res.status(500).json({ error: 'Erreur de serveur lors de la conversion' });
  }
});

module.exports = router;