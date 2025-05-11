/**
 * Routes pour l'authentification des utilisateurs
 * Fournit les endpoints API pour la connexion, l'inscription et la gestion des utilisateurs
 */

const express = require('express');
const router = express.Router();
// Nous utiliserons ce service quand nous l'implémenterons complètement
// const authService = require('../services/authService');

/**
 * POST /api/auth/login
 * Connecter un utilisateur
 */
router.post('/login', (req, res) => {
  // Pour le moment, simulons une connexion réussie
  // Cela sera remplacé par une véritable authentification plus tard
  res.json({
    success: true,
    message: "Connexion réussie",
    user: {
      id: 1,
      username: "admin",
      role: "admin"
    },
    token: "sample-token" // Sera remplacé par un vrai token JWT
  });
});

/**
 * POST /api/auth/logout
 * Déconnecter un utilisateur
 */
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: "Déconnexion réussie"
  });
});

/**
 * GET /api/auth/user
 * Obtenir les informations de l'utilisateur connecté
 */
router.get('/user', (req, res) => {
  // Endpoint minimal pour le moment
  res.json({
    success: true,
    user: {
      id: 1,
      username: "admin",
      role: "admin"
    }
  });
});

module.exports = router;