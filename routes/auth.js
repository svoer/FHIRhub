/**
 * Routes pour l'authentification
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

/**
 * @swagger
 * tags:
 *   name: Authentification
 *   description: Gestion de l'authentification
 */

// Clé secrète pour signer les JWT (à déplacer dans une variable d'environnement en production)
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     description: Authentifie un utilisateur et retourne un token JWT
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authentification réussie
 *       401:
 *         description: Identifiants invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Nom d\'utilisateur et mot de passe requis'
      });
    }
    
    const db = req.app.locals.db;
    
    // Récupérer l'utilisateur par son nom d'utilisateur
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Identifiants invalides'
      });
    }
    
    // Vérifier le mot de passe
    if (!verifyPassword(user.password, password)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Identifiants invalides'
      });
    }
    
    // Créer le payload du token
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    
    // Générer le token JWT (valide 24h)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    
    // Supprimer le mot de passe de l'objet utilisateur
    delete user.password;
    
    res.json({
      success: true,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('[AUTH ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de l\'authentification'
    });
  }
});

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Vérifier le token JWT
 *     description: Vérifie la validité du token JWT et retourne les informations de l'utilisateur
 *     tags: [Authentification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token valide
 *       401:
 *         description: Token invalide ou expiré
 *       500:
 *         description: Erreur serveur
 */
router.get('/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token manquant'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      // Vérifier et décoder le token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Récupérer l'utilisateur actuel
      const db = req.app.locals.db;
      const user = db.prepare(`
        SELECT id, username, role, created_at 
        FROM users 
        WHERE id = ?
      `).get(decoded.id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Utilisateur non trouvé'
        });
      }
      
      res.json({
        success: true,
        data: {
          user,
          token
        }
      });
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token invalide ou expiré'
      });
    }
  } catch (error) {
    console.error('[AUTH ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la vérification du token'
    });
  }
});

// Fonction pour vérifier un mot de passe
function verifyPassword(storedPassword, suppliedPassword) {
  const crypto = require('crypto');
  const [salt, hash] = storedPassword.split(':');
  const suppliedHash = crypto.pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512').toString('hex');
  return hash === suppliedHash;
}

module.exports = router;