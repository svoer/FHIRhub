/**
 * Application FHIRHub simplifiée pour le débogage
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { initDatabase } from './api/db/database';

// Configuration de l'application
const app = express();
const PORT = process.env.PORT || 5000;

// Initialisation de la base de données
console.log('Initialisation de la base de données SQLite...');
initDatabase();
console.log('Base de données initialisée avec succès.');

// Middleware de base
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Route de test simple
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API FHIRHub en ligne',
    timestamp: new Date().toISOString()
  });
});

// Route simple pour la conversion
app.post('/api/convert', (req, res) => {
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
    
    return res.status(200).json({
      success: true,
      message: 'Message HL7 reçu',
      segmentCount: segments.length,
      firstSegment: segments[0].substring(0, 50) + '...'
    });
  } catch (error) {
    console.error('[TEST ERROR]', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// Route par défaut pour les autres requêtes
app.get('*', (req, res) => {
  res.json({
    success: false,
    error: 'Not Found',
    message: 'Route non définie'
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`[SERVER] FHIRHub (version simplifiée) démarré sur le port ${PORT}`);
});