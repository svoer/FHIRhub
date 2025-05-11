/**
 * Point d'entrée principal de l'application FHIRHub
 * Service de conversion de HL7 v2.5 vers FHIR R4
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import bodyParser from 'body-parser';
import { initDatabase } from './api/db/database';
import { setupSwagger } from './api/swagger';
import apiKeyRoutes from './api/routes/apiKeyRoutes';
import applicationRoutes from './api/routes/applicationRoutes';
import convertRoutes from './api/routes/convertRoutes';
import { apiKeyAuth } from './api/middleware/apiKeyAuth';

// Configuration de l'application
const app = express();
const PORT = process.env.PORT || 5000;

// Initialisation de la base de données
console.log('Initialisation de la base de données SQLite...');
initDatabase();
console.log('Base de données initialisée avec succès.');

// Middleware
app.use(cors());
app.use(morgan('dev')); // Logging des requêtes
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Routes statiques pour les fichiers frontend
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Configuration de Swagger
setupSwagger(app);

// Routes API protégées par clé API
app.use('/api/api-keys', apiKeyAuth, apiKeyRoutes);
app.use('/api/applications', apiKeyAuth, applicationRoutes);
app.use('/api/convert', apiKeyAuth, convertRoutes);

// Statistiques système
app.get('/api/stats', apiKeyAuth, (req, res) => {
  // Statistiques simplifiées pour démonstration
  res.json({
    success: true,
    data: {
      system: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        disk: Math.random() * 100,
        uptime: process.uptime()
      },
      api: {
        totalRequests: Math.floor(Math.random() * 1000),
        successRate: 95 + Math.random() * 5,
        averageResponseTime: Math.random() * 100
      }
    }
  });
});

// Journaux de conversion
app.get('/api/conversions', apiKeyAuth, (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

// Route par défaut pour le frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`[SERVER] FHIRHub démarré sur le port ${PORT}`);
  console.log(`[SERVER] Documentation API disponible sur http://localhost:${PORT}/api-docs`);
});