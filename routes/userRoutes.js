/**
 * Routes de gestion des utilisateurs pour FHIRHub
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/authMiddleware');
const dbService = require('../src/services/dbService');
const logger = require('../src/utils/logger');

// Middleware d'authentification pour toutes les routes
router.use(authMiddleware.verifyToken);

// Obtenir tous les utilisateurs (admin uniquement)
router.get('/', async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }

    const users = await dbService.query('SELECT id, username, role, created_at FROM users');
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des utilisateurs: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

// Obtenir les statistiques d'un utilisateur - IMPORTANT: cette route doit être placée AVANT la route /:id
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Requête pour obtenir le nombre de conversions
    const conversionCountResult = await dbService.query(
      'SELECT COUNT(*) as count FROM conversion_logs WHERE user_id = ?', 
      [userId]
    );
    
    // Récupérer la date de création et de dernière connexion
    const userDetails = await dbService.query(
      'SELECT created_at, last_login FROM users WHERE id = ?', 
      [userId]
    );
    
    // Construire la réponse
    const stats = {
      conversionCount: conversionCountResult[0]?.count || 0,
      createdAt: userDetails[0]?.created_at,
      lastLogin: userDetails[0]?.last_login
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des statistiques utilisateur: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques utilisateur'
    });
  }
});

// Obtenir les détails d'un utilisateur spécifique
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Les utilisateurs peuvent voir leurs propres détails, les admins peuvent voir tous les détails
    if (req.user.id != userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez consulter que votre propre profil.'
      });
    }
    
    const user = await dbService.query(
      'SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ?', 
      [userId]
    );
    
    if (!user || user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: user[0]
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des détails utilisateur: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails utilisateur'
    });
  }
});

// Mettre à jour les informations d'un utilisateur
router.put('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Les utilisateurs peuvent modifier leurs propres informations, les admins peuvent modifier toutes les informations
    if (req.user.id != userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez modifier que votre propre profil.'
      });
    }
    
    const { username, email, language } = req.body;
    
    // Vérification que le nom d'utilisateur est unique s'il est modifié
    if (username) {
      const existingUser = await dbService.query(
        'SELECT id FROM users WHERE username = ? AND id != ?', 
        [username, userId]
      );
      
      if (existingUser && existingUser.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ce nom d\'utilisateur est déjà utilisé'
        });
      }
    }
    
    // Construire les champs à mettre à jour
    const updateFields = [];
    const updateValues = [];
    
    if (username) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }
    
    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    
    if (language) {
      updateFields.push('language = ?');
      updateValues.push(language);
    }
    
    // Ajouter la date de mise à jour
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // Ajouter l'ID utilisateur pour la clause WHERE
    updateValues.push(userId);
    
    // Mettre à jour l'utilisateur
    await dbService.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Récupérer l'utilisateur mis à jour
    const updatedUser = await dbService.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?', 
      [userId]
    );
    
    // Log de l'action
    logger.info(`Utilisateur ${req.user.username} (ID: ${req.user.id}) a modifié le profil de ${updatedUser[0].username} (ID: ${userId})`);
    
    res.json({
      success: true,
      data: updatedUser[0],
      message: 'Profil utilisateur mis à jour avec succès'
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour du profil utilisateur: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil utilisateur'
    });
  }
});

// Changer le mot de passe
router.post('/:id/change-password', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Les utilisateurs peuvent changer leur propre mot de passe, les admins peuvent changer tous les mots de passe
    if (req.user.id != userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez modifier que votre propre mot de passe.'
      });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    // Vérifier que les deux mots de passe ont été fournis
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Les mots de passe actuels et nouveaux sont requis'
      });
    }
    
    // Récupérer l'utilisateur pour vérifier son mot de passe actuel
    const user = await dbService.query(
      'SELECT password FROM users WHERE id = ?', 
      [userId]
    );
    
    if (!user || user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Vérifier que le mot de passe actuel est correct
    // Bypass la vérification pour les administrateurs qui changent le mot de passe d'autres utilisateurs
    if (req.user.id == userId) {
      const isPasswordCorrect = await bcrypt.compare(currentPassword, user[0].password);
      
      if (!isPasswordCorrect) {
        return res.status(400).json({
          success: false,
          message: 'Mot de passe actuel incorrect'
        });
      }
    }
    
    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Mettre à jour le mot de passe
    await dbService.query(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId]
    );
    
    // Log de l'action
    const targetUsername = await dbService.query('SELECT username FROM users WHERE id = ?', [userId]);
    logger.info(`Utilisateur ${req.user.username} (ID: ${req.user.id}) a modifié le mot de passe de ${targetUsername[0].username} (ID: ${userId})`);
    
    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour du mot de passe: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du mot de passe'
    });
  }
});

// Mettre à jour les préférences utilisateur
router.put('/:id/preferences', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Les utilisateurs peuvent modifier leurs propres préférences, les admins peuvent modifier toutes les préférences
    if (req.user.id != userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez modifier que vos propres préférences.'
      });
    }
    
    const { emailNotifications, systemNotifications } = req.body;
    
    // Construire le JSON des préférences
    const preferences = {
      notifications: {
        email: !!emailNotifications,
        system: !!systemNotifications
      }
    };
    
    // Mettre à jour les préférences utilisateur
    await dbService.query(
      'UPDATE users SET preferences = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(preferences), userId]
    );
    
    // Log de l'action
    logger.info(`Utilisateur ${req.user.username} (ID: ${req.user.id}) a mis à jour ses préférences`);
    
    res.json({
      success: true,
      message: 'Préférences mises à jour avec succès'
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour des préférences: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des préférences'
    });
  }
});

module.exports = router;