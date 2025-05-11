/**
 * Application principale FHIRHub
 * Service de conversion de HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies et systèmes français de santé
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
// const mainRouter = require('./src/routes/mainRouter');
const tmpRouter = require('./src/routes/tmpRouter');
const dbService = require('./src/services/dbService');
const terminologyService = require('./src/services/terminologyService');
const aiProviderService = require('./src/services/aiProviderService');

// Configuration de l'environnement
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Création de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Configuration des middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'frontend/public')));

// Middleware pour ajouter des informations sur la requête pour le débogage
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Router principal
app.use('/api', tmpRouter);

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur du serveur:', err);
  res.status(500).json({
    success: false,
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur interne est survenue'
  });
});

// Démarrage du serveur
async function startServer() {
  try {
    // Initialisation des services
    await dbService.initialize();
    await terminologyService.initialize();
    await aiProviderService.initialize();
    
    // Démarrage du serveur
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Serveur FHIRHub démarré sur le port ${PORT}`);
      console.log(`API accessible à l'adresse http://localhost:${PORT}/api`);
      console.log(`Interface web accessible à l'adresse http://localhost:${PORT}`);
      console.log(`Mode: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  console.error('Erreur non capturée:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse rejetée non gérée:', reason);
});

// Démarrage de l'application
startServer();