/**
 * Routes de gestion des applications et des clés API
 */

const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { adminRequired } = require('../middleware/authMiddleware');

// Toutes les routes nécessitent une authentification administrateur
router.use(adminRequired);

// Routes des applications
router.get('/', applicationController.getAllApplications);
router.get('/:id', applicationController.getApplicationById);
router.post('/', applicationController.createApplication);
router.put('/:id', applicationController.updateApplication);
router.delete('/:id', applicationController.deleteApplication);

// Routes des clés API
router.get('/:id/api-keys', applicationController.getApiKeys);
router.post('/:id/api-keys', applicationController.createApiKey);
router.put('/api-keys/:keyId', applicationController.setApiKeyStatus);
router.delete('/api-keys/:keyId', applicationController.revokeApiKey);

// Routes des paramètres
router.post('/:id/parameters', applicationController.addApplicationParameter);
router.put('/parameters/:parameterId', applicationController.updateApplicationParameter);
router.delete('/parameters/:parameterId', applicationController.deleteApplicationParameter);

// Routes des dossiers
router.post('/:id/folders', applicationController.addApplicationFolder);
router.delete('/folders/:folderId', applicationController.deleteApplicationFolder);

module.exports = router;