/**
 * Configuration Swagger OpenAPI 3.0 pour FHIRHub
 * Implémentation complète et propre
 */

const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Configuration OpenAPI 3.0
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FHIRHub API',
      version: '1.5.0',
      description: `
# API FHIRHub - Convertisseur HL7 vers FHIR R4

Plateforme complète de conversion et d'interopérabilité des données de santé françaises.

## Fonctionnalités principales
- **Conversion HL7 v2.5 → FHIR R4** avec terminologies françaises (ANS/MOS)
- **Analyse IA** des données patients avec résumés intelligents
- **Administration** complète des clés API et applications
- **Intégration FHIR** avec serveurs externes et locaux

## Authentification
Utilisez une clé API valide dans l'en-tête \`x-api-key\` pour tous les endpoints protégés.

## Environnements
- **Développement**: http://localhost:5000
- **Production**: Configuré selon déploiement

## Support
- Documentation complète: [Documentation FHIRHub](/documentation.html)
- FAQ: [Questions fréquentes](/faq.html)
      `,
      contact: {
        name: 'Équipe FHIRHub',
        email: 'support@fhirhub.fr'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Serveur de développement local'
      },
      {
        url: '/api',
        description: 'API FHIRHub (relatif)'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Clé API FHIRHub (8-128 caractères alphanumériques)'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT pour authentification utilisateur'
        }
      },
      schemas: {
        // Schémas HL7
        HL7Message: {
          type: 'object',
          required: ['hl7Message'],
          properties: {
            hl7Message: {
              type: 'string',
              description: 'Message HL7 v2.5 complet',
              example: 'MSH|^~\\&|SENDER|FACILITY|RECEIVER|FACILITY|202506181200||ADT^A01|MSG001|P|2.5\rPID|1||123456^^^HOSPITAL^MR||DUPONT^JEAN^MARIE||19800315|M|||123 RUE DE LA PAIX^^PARIS^^75001^FR||(01)42.12.34.56|||FR||||||||||\rPV1|1|I|UNIT^ROOM^BED||||DOC123^MARTIN^PAUL^^^Dr|||MED|||||||DOC123^MARTIN^PAUL^^^Dr|INP|VIP|||||||||||||||||||||||202506181200||||||V'
            },
            options: {
              type: 'object',
              description: 'Options de conversion avancées',
              properties: {
                includeComments: {
                  type: 'boolean',
                  default: false,
                  description: 'Inclure les commentaires de conversion dans la sortie'
                },
                validateOutput: {
                  type: 'boolean', 
                  default: true,
                  description: 'Valider le FHIR généré contre le schéma R4'
                },
                frenchTerminology: {
                  type: 'boolean',
                  default: true,
                  description: 'Utiliser les terminologies françaises (ANS/MOS)'
                }
              }
            }
          }
        },
        
        // Schémas FHIR
        FHIRBundle: {
          type: 'object',
          description: 'Bundle FHIR R4 conforme',
          properties: {
            resourceType: {
              type: 'string',
              enum: ['Bundle'],
              example: 'Bundle'
            },
            id: {
              type: 'string',
              description: 'Identifiant unique du bundle',
              example: 'hl7-conversion-001'
            },
            type: {
              type: 'string',
              enum: ['transaction', 'collection', 'document'],
              example: 'collection'
            },
            entry: {
              type: 'array',
              description: 'Ressources FHIR contenues',
              items: {
                type: 'object',
                properties: {
                  resource: {
                    type: 'object',
                    description: 'Ressource FHIR (Patient, Encounter, etc.)'
                  }
                }
              }
            }
          }
        },

        // Schémas de réponse
        ConversionResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: {
              type: 'boolean',
              description: 'Statut de la conversion'
            },
            data: {
              $ref: '#/components/schemas/FHIRBundle'
            },
            metadata: {
              type: 'object',
              properties: {
                conversionTime: {
                  type: 'number',
                  description: 'Temps de conversion en millisecondes'
                },
                resourceCount: {
                  type: 'integer',
                  description: 'Nombre de ressources FHIR générées'
                },
                warnings: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Avertissements lors de la conversion'
                }
              }
            }
          }
        },

        // Schémas d'erreur
        ErrorResponse: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              enum: [false]
            },
            error: {
              type: 'string',
              description: 'Type d\'erreur'
            },
            message: {
              type: 'string',
              description: 'Message d\'erreur détaillé'
            },
            details: {
              type: 'object',
              description: 'Détails techniques supplémentaires'
            }
          }
        },

        // Schémas d'administration
        Application: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'ID unique de l\'application' },
            name: { type: 'string', description: 'Nom de l\'application' },
            description: { type: 'string', description: 'Description de l\'application' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },

        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'ID unique de la clé' },
            name: { type: 'string', description: 'Nom de la clé API' },
            key: { type: 'string', description: 'Clé API (masquée en réponse)' },
            application_id: { type: 'integer', description: 'ID de l\'application associée' },
            is_active: { type: 'boolean', description: 'Statut actif/inactif' },
            expires_at: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        }
      },
      
      responses: {
        BadRequest: {
          description: 'Requête invalide',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: 'Bad Request',
                message: 'Le message HL7 fourni est invalide'
              }
            }
          }
        },
        Unauthorized: {
          description: 'Authentification requise',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: 'Unauthorized',
                message: 'Clé API manquante ou invalide'
              }
            }
          }
        },
        InternalError: {
          description: 'Erreur serveur interne',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: 'Internal Server Error',
                message: 'Erreur lors du traitement de la requête'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Conversion',
        description: 'Endpoints de conversion entre formats de santé (HL7 ↔ FHIR)'
      },
      {
        name: 'Intelligence Artificielle',
        description: 'Analyse IA des données patients et résumés intelligents'
      },
      {
        name: 'FHIR',
        description: 'Intégration directe avec serveurs FHIR et manipulation de ressources'
      },
      {
        name: 'Administration',
        description: 'Gestion des applications, clés API et utilisateurs'
      },
      {
        name: 'Système',
        description: 'Informations système, santé et métriques'
      },
      {
        name: 'Terminologies',
        description: 'Gestion des terminologies françaises et mappings'
      }
    ]
  },
  apis: [
    './routes/*.js',
    './app.js'
  ]
};

// Génération de la spécification
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Configuration UI personnalisée FHIRHub
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { 
      color: #d73027; 
      font-size: 2.5em; 
      font-weight: bold;
    }
    .swagger-ui .info .description { 
      font-size: 1.1em; 
      line-height: 1.6;
    }
    .swagger-ui .scheme-container {
      background: linear-gradient(135deg, #d73027 0%, #fc8d59 100%);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .swagger-ui .auth-wrapper .authorize {
      background: #d73027;
      border-color: #d73027;
    }
    .swagger-ui .btn.authorize {
      background: #d73027;
      border-color: #d73027;
    }
    .swagger-ui .btn.execute {
      background: #fc8d59;
      border-color: #fc8d59;
    }
    .swagger-ui .opblock.opblock-post {
      border-color: #d73027;
      background: rgba(215, 48, 39, 0.1);
    }
    .swagger-ui .opblock.opblock-get {
      border-color: #4575b4;
      background: rgba(69, 117, 180, 0.1);
    }
  `,
  customSiteTitle: 'FHIRHub API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 2,
    tryItOutEnabled: true
  }
};

module.exports = {
  swaggerSpec,
  swaggerUi,
  swaggerUiOptions
};