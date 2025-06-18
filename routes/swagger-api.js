/**
 * Routes Swagger API - Nouvelle implémentation propre
 * Configuration et exposition de la documentation OpenAPI 3.0
 */

const express = require('express');
const router = express.Router();
const { swaggerSpec, swaggerUi, swaggerUiOptions } = require('../docs/swagger-config');
const yaml = require('yamljs');

/**
 * Route principale Swagger UI
 */
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

/**
 * Export JSON de la spécification OpenAPI
 */
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="fhirhub-api-spec.json"');
  res.json(swaggerSpec);
});

/**
 * Export YAML de la spécification OpenAPI
 */
router.get('/yaml', (req, res) => {
  try {
    const yamlString = yaml.stringify(swaggerSpec, 4);
    res.setHeader('Content-Type', 'application/x-yaml');
    res.setHeader('Content-Disposition', 'attachment; filename="fhirhub-api-spec.yaml"');
    res.send(yamlString);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'YAML Generation Error',
      message: 'Erreur lors de la génération du fichier YAML'
    });
  }
});

/**
 * Export Postman Collection
 */
router.get('/postman', (req, res) => {
  try {
    // Conversion basique OpenAPI vers Postman
    const postmanCollection = {
      info: {
        name: 'FHIRHub API Collection',
        description: swaggerSpec.info.description,
        version: swaggerSpec.info.version,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'apikey',
        apikey: [
          {
            key: 'key',
            value: 'x-api-key',
            type: 'string'
          },
          {
            key: 'value',
            value: '{{api_key}}',
            type: 'string'
          },
          {
            key: 'in',
            value: 'header',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'baseUrl',
          value: 'http://localhost:5000',
          type: 'string'
        },
        {
          key: 'api_key',
          value: 'your-api-key-here',
          type: 'string'
        }
      ],
      item: []
    };

    // Ajouter des exemples d'endpoints populaires
    postmanCollection.item.push({
      name: 'Conversion HL7 vers FHIR',
      request: {
        method: 'POST',
        header: [
          {
            key: 'Content-Type',
            value: 'application/json'
          },
          {
            key: 'x-api-key',
            value: '{{api_key}}'
          }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            hl7Message: 'MSH|^~\\&|SENDER|FACILITY|RECEIVER|FACILITY|202506181200||ADT^A01|MSG001|P|2.5\rPID|1||123456^^^HOSPITAL^MR||DUPONT^JEAN^MARIE||19800315|M'
          }, null, 2)
        },
        url: {
          raw: '{{baseUrl}}/api/convert/hl7-to-fhir',
          host: ['{{baseUrl}}'],
          path: ['api', 'convert', 'hl7-to-fhir']
        }
      }
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="fhirhub-postman-collection.json"');
    res.json(postmanCollection);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Postman Export Error',
      message: 'Erreur lors de la génération de la collection Postman'
    });
  }
});

/**
 * Validation de la spécification OpenAPI
 */
router.get('/validate', (req, res) => {
  try {
    // Vérifications basiques de la spec
    const validation = {
      valid: true,
      version: swaggerSpec.openapi,
      title: swaggerSpec.info.title,
      endpoints: 0,
      tags: swaggerSpec.tags ? swaggerSpec.tags.length : 0,
      schemas: swaggerSpec.components && swaggerSpec.components.schemas 
        ? Object.keys(swaggerSpec.components.schemas).length 
        : 0,
      security: swaggerSpec.components && swaggerSpec.components.securitySchemes
        ? Object.keys(swaggerSpec.components.securitySchemes).length
        : 0
    };

    // Compter les endpoints (approximatif)
    if (swaggerSpec.paths) {
      validation.endpoints = Object.keys(swaggerSpec.paths).reduce((count, path) => {
        return count + Object.keys(swaggerSpec.paths[path]).length;
      }, 0);
    }

    res.json({
      success: true,
      data: validation,
      message: 'Spécification OpenAPI valide'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Validation Error',
      message: 'Erreur lors de la validation de la spécification'
    });
  }
});

module.exports = router;