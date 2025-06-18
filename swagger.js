/**
 * Configuration Swagger pour l'API FHIRHub
 */
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const express = require('express');

// Définition des options Swagger OpenAPI 3.0 complète
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FHIRHub API',
      version: '1.5.0',
      description: 'API d\'interopérabilité santé HL7 ↔ FHIR avec support des terminologies françaises (ANS/MOS)',
      contact: {
        name: 'FHIRHub Support',
        email: 'support@fhirhub.fr'
      },
      license: {
        name: 'Proprietary',
        url: 'https://fhirhub.fr/license'
      },
      termsOfService: 'https://fhirhub.fr/terms'
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Serveur de développement'
      },
      {
        url: 'https://api.fhirhub.fr',
        description: 'Serveur de production'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Clé API pour l\'authentification. Utiliser "dev-key" en développement.'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT pour l\'authentification utilisateur'
        }
      },
      schemas: {
        HL7Message: {
          type: 'object',
          required: ['hl7Message'],
          properties: {
            hl7Message: {
              type: 'string',
              description: 'Message HL7 v2.5 complet',
              example: 'MSH|^~\\&|SENDING_APP|FACILITY|RECEIVING_APP|FACILITY|20240101120000||ADT^A01|12345|P|2.5\nPID|1||123456789^^^HOSPITAL^MR||DOE^JOHN||19800101|M|||123 MAIN ST^^PARIS^^75001^FR||0123456789|||||||||||||||||||'
            },
            options: {
              type: 'object',
              properties: {
                validateFHIR: {
                  type: 'boolean',
                  default: true,
                  description: 'Valider les ressources FHIR générées'
                },
                sendToFHIR: {
                  type: 'boolean',
                  default: false,
                  description: 'Envoyer automatiquement au serveur FHIR'
                }
              }
            }
          }
        },
        FHIRBundle: {
          type: 'object',
          properties: {
            resourceType: {
              type: 'string',
              example: 'Bundle'
            },
            type: {
              type: 'string',
              example: 'transaction'
            },
            entry: {
              type: 'array',
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
        OperationOutcome: {
          type: 'object',
          properties: {
            resourceType: {
              type: 'string',
              example: 'OperationOutcome'
            },
            issue: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  severity: {
                    type: 'string',
                    enum: ['fatal', 'error', 'warning', 'information']
                  },
                  code: {
                    type: 'string'
                  },
                  diagnostics: {
                    type: 'string'
                  }
                }
              }
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object'
            },
            timestamp: {
              type: 'number'
            }
          }
        },
        SystemHealth: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy']
            },
            uptime: {
              type: 'number',
              description: 'Temps de fonctionnement en secondes'
            },
            memory: {
              type: 'object',
              properties: {
                used: { type: 'number' },
                total: { type: 'number' }
              }
            },
            database: {
              type: 'object',
              properties: {
                connected: { type: 'boolean' },
                migrations: { type: 'string' }
              }
            }
          }
        }
      },
      examples: {
        HL7_ADT_A01: {
          summary: 'Message ADT^A01 d\'admission',
          value: {
            hl7Message: 'MSH|^~\\&|HIS|HOSPITAL|FHIRHUB|FHIRHUB|20240101120000||ADT^A01|12345|P|2.5\nEVN|A01|20240101120000|||DOCTOR1\nPID|1||123456789^^^HOSPITAL^MR||DOE^JOHN||19800101|M|||123 MAIN ST^^PARIS^^75001^FR||0123456789|||||||||||||||||||'
          }
        },
        FHIR_Bundle_Response: {
          summary: 'Bundle FHIR résultant',
          value: {
            resourceType: 'Bundle',
            type: 'transaction',
            entry: [
              {
                resource: {
                  resourceType: 'Patient',
                  identifier: [{
                    system: 'http://hospital.fr/patient-id',
                    value: '123456789'
                  }],
                  name: [{
                    family: 'DOE',
                    given: ['JOHN']
                  }],
                  birthDate: '1980-01-01',
                  gender: 'male'
                }
              }
            ]
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Clé API manquante ou invalide',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Non autorisé' },
                  message: { type: 'string', example: 'API Key ou JWT requis' }
                }
              }
            }
          }
        },
        RateLimited: {
          description: 'Limite de débit dépassée',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Trop de requêtes' },
                  code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
                  retryAfter: { type: 'number', example: 60 }
                }
              }
            }
          }
        },
        ServerError: {
          description: 'Erreur interne du serveur',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Erreur du serveur' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      },
      {
        BearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Conversion',
        description: 'Endpoints de conversion HL7 ↔ FHIR'
      },
      {
        name: 'FHIR',
        description: 'Opérations sur les ressources FHIR'
      },
      {
        name: 'IA',
        description: 'Services d\'intelligence artificielle'
      },
      {
        name: 'Administration',
        description: 'Gestion des utilisateurs et API keys'
      },
      {
        name: 'Système',
        description: 'Informations et santé du système'
      },
      {
        name: 'Terminologie',
        description: 'Gestion des terminologies françaises'
      }
    ]
  },
  apis: ['./app.js', './routes/*.js', './api/*.js', './src/**/*.js'] // Fichiers contenant les annotations Swagger
};

// Initialisation du générateur de spécification Swagger
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Fonction d'initialisation de Swagger pour l'application Express
function setupSwagger(app) {
  // Middleware pour permettre à l'admin d'accéder à Swagger sans authentification supplémentaire
  const swaggerAuthMiddleware = (req, res, next) => {
    // Vérifier si l'utilisateur est authentifié avec un JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        // Utiliser la même clé secrète que dans jwtAuth.js
        const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Vérifier si l'utilisateur est admin dans la base de données
        const db = req.app.locals.db;
        const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(decoded.id);
        
        if (user && user.role === 'admin') {
          // Pour les administrateurs, ajouter une clé API de développement aux en-têtes
          const devKey = db.prepare(`SELECT key FROM api_keys WHERE key = 'dev-key' LIMIT 1`).get();
          if (devKey) {
            // Ajouter la clé API aux en-têtes pour les requêtes Swagger
            req.headers['x-api-key'] = devKey.key;
          }
        }
      } catch (error) {
        console.error('[SWAGGER AUTH]', error);
      }
    }
    next();
  };

  // Appliquer le middleware d'authentification pour Swagger
  app.use('/api-docs', swaggerAuthMiddleware);
  
  // Servir le fichier CSS personnalisé pour les correctifs Swagger
  app.use('/css/swagger.css', express.static('public/css/swagger.css'));
  
  // Interface Swagger UI avec configuration optimisée
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { 
        background: linear-gradient(135deg, #e74c3c, #ff5722);
        padding: 10px 0;
      }
      .swagger-ui .topbar .download-url-wrapper { 
        display: none; 
      }
      .swagger-ui .info .title {
        color: #2c3e50;
        font-size: 36px;
      }
      .swagger-ui .info .description {
        font-size: 16px;
        line-height: 1.6;
      }
      .swagger-ui .auth-wrapper {
        margin: 20px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      .swagger-ui .btn.authorize {
        background: linear-gradient(135deg, #e74c3c, #ff5722);
        border-color: #e74c3c;
      }
      .swagger-ui .scheme-container {
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
    `,
    customCssUrl: '/css/swagger.css',
    customJs: ['/js/swagger-helper.js', '/js/swagger-direct-auth.js'],
    customSiteTitle: 'FHIRHub API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
      requestInterceptor: (req) => {
        // Ajouter automatiquement la clé de développement si aucune auth n'est définie
        if (!req.headers.Authorization && !req.headers['x-api-key']) {
          req.headers['x-api-key'] = 'dev-key';
        }
        return req;
      }
    }
  }));

  // Routes pour différents formats de documentation
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  app.get('/api-docs.yaml', (req, res) => {
    const yaml = require('yamljs');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(yaml.stringify(swaggerSpec, 4));
  });

  // Route pour collection Postman
  app.get('/api-docs/postman', (req, res) => {
    const postmanCollection = {
      info: {
        name: 'FHIRHub API',
        description: swaggerSpec.info.description,
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
            value: 'dev-key',
            type: 'string'
          }
        ]
      },
      item: [
        {
          name: 'Conversion HL7 → FHIR',
          request: {
            method: 'POST',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json'
              }
            ],
            url: {
              raw: '{{baseUrl}}/api/convert',
              host: ['{{baseUrl}}'],
              path: ['api', 'convert']
            },
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                hl7Message: 'MSH|^~\\&|SENDING_APP|FACILITY|RECEIVING_APP|FACILITY|20240101120000||ADT^A01|12345|P|2.5\nPID|1||123456789^^^HOSPITAL^MR||DOE^JOHN||19800101|M'
              }, null, 2)
            }
          }
        }
      ],
      variable: [
        {
          key: 'baseUrl',
          value: 'http://localhost:5000'
        }
      ]
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.json(postmanCollection);
  });

  console.log('[SWAGGER] Documentation API disponible sur /api-docs');
  console.log('[SWAGGER] Formats disponibles: JSON (/api-docs.json), YAML (/api-docs.yaml), Postman (/api-docs/postman)');
}

module.exports = {
  setupSwagger
};