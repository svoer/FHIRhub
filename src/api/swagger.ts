/**
 * Configuration et initialisation de Swagger UI
 */

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FHIRHub API',
      version: '1.0.0',
      description: 'API de conversion HL7 v2.5 vers FHIR R4',
      contact: {
        name: 'Support',
        email: 'support@fhirhub.fr'
      },
      license: {
        name: 'Propriétaire',
        url: 'https://fhirhub.fr/license'
      }
    },
    servers: [
      {
        url: '/api',
        description: 'API principale'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-KEY'
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: [
    'src/api/routes/*.ts',
    'src/api/middleware/*.ts'
  ]
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export function setupSwagger(app: Express) {
  // Documentation Swagger
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'FHIRHub API Documentation',
    customfavIcon: '/favicon.ico'
  }));
  
  // Endpoint pour l'obtention de la spécification
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  console.log('[SERVER] Documentation API disponible sur http://localhost:5000/api-docs');
}