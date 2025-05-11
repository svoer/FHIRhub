/**
 * Routes d'authentification pour l'interface d'administration
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticated, adminRequired } = require('../middleware/authMiddleware');

// Routes publiques
router.post('/login', authController.login);
router.get('/logout', authController.logout);

// Routes authentifiées
router.get('/profile', authenticated, authController.getProfile);

// Routes administrateur
router.get('/users', adminRequired, authController.getAllUsers);
router.post('/users', adminRequired, authController.createUser);
router.put('/users/:id', authenticated, authController.updateUser);
router.delete('/users/:id', adminRequired, authController.deleteUser);

module.exports = router;