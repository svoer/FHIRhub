/**
 * Service d'authentification pour FHIRHub
 * Gère les utilisateurs, l'authentification et les autorisations
 */

const { db } = require('../db/schema');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Clé secrète pour les tokens JWT
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key-change-me-in-production';
// Durée de vie du token en secondes (12 heures par défaut)
const TOKEN_EXPIRATION = process.env.TOKEN_EXPIRATION || 12 * 60 * 60;

/**
 * Créer un nouvel utilisateur
 * @param {Object} userData - Données de l'utilisateur
 * @returns {Object} Utilisateur créé (sans mot de passe)
 */
async function createUser(userData) {
  const { username, password, fullname, email, role = 'user' } = userData;
  
  try {
    // Vérifier si le nom d'utilisateur existe déjà
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      throw new Error('Ce nom d\'utilisateur est déjà utilisé');
    }
    
    // Valider le rôle
    if (role !== 'admin' && role !== 'user') {
      throw new Error('Rôle invalide. Doit être "admin" ou "user"');
    }
    
    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Insérer l'utilisateur
    const result = db.prepare(`
      INSERT INTO users (username, password, fullname, email, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, hashedPassword, fullname, email, role);
    
    // Récupérer l'utilisateur créé (sans mot de passe)
    const user = getUserById(result.lastInsertRowid);
    delete user.password;
    
    return user;
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    throw new Error(`Impossible de créer l'utilisateur: ${error.message}`);
  }
}

/**
 * Obtenir un utilisateur par son ID
 * @param {number} id - ID de l'utilisateur
 * @returns {Object|null} Utilisateur trouvé ou null
 */
function getUserById(id) {
  try {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    throw new Error(`Impossible de récupérer l'utilisateur: ${error.message}`);
  }
}

/**
 * Obtenir un utilisateur par son nom d'utilisateur
 * @param {string} username - Nom d'utilisateur
 * @returns {Object|null} Utilisateur trouvé ou null
 */
function getUserByUsername(username) {
  try {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    throw new Error(`Impossible de récupérer l'utilisateur: ${error.message}`);
  }
}

/**
 * Authentifier un utilisateur
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe
 * @returns {Object} Token JWT et informations utilisateur
 */
async function authenticateUser(username, password) {
  try {
    // Récupérer l'utilisateur
    const user = getUserByUsername(username);
    if (!user) {
      throw new Error('Identifiants invalides');
    }
    
    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Identifiants invalides');
    }
    
    // Mettre à jour la date de dernière connexion
    db.prepare(`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(user.id);
    
    // Créer un token JWT
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
    
    // Préparer la réponse (sans mot de passe)
    const userResponse = { ...user };
    delete userResponse.password;
    
    return {
      token,
      user: userResponse
    };
  } catch (error) {
    console.error('Erreur lors de l\'authentification:', error);
    throw new Error(`Authentification échouée: ${error.message}`);
  }
}

/**
 * Vérifier un token JWT
 * @param {string} token - Token JWT
 * @returns {Object} Payload décodé du token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token invalide ou expiré');
  }
}

/**
 * Changer le mot de passe d'un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} currentPassword - Mot de passe actuel
 * @param {string} newPassword - Nouveau mot de passe
 * @returns {boolean} Succès du changement
 */
async function changePassword(userId, currentPassword, newPassword) {
  try {
    // Récupérer l'utilisateur
    const user = getUserById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }
    
    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new Error('Mot de passe actuel incorrect');
    }
    
    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Mettre à jour le mot de passe
    db.prepare(`
      UPDATE users 
      SET password = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(hashedPassword, userId);
    
    return true;
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    throw new Error(`Impossible de changer le mot de passe: ${error.message}`);
  }
}

/**
 * Réinitialiser le mot de passe d'un utilisateur (par un administrateur)
 * @param {number} userId - ID de l'utilisateur
 * @param {string} newPassword - Nouveau mot de passe
 * @returns {boolean} Succès de la réinitialisation
 */
async function resetPassword(userId, newPassword) {
  try {
    // Récupérer l'utilisateur
    const user = getUserById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }
    
    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Mettre à jour le mot de passe
    db.prepare(`
      UPDATE users 
      SET password = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(hashedPassword, userId);
    
    return true;
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe:', error);
    throw new Error(`Impossible de réinitialiser le mot de passe: ${error.message}`);
  }
}

/**
 * Mettre à jour un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {Object} userData - Données à mettre à jour
 * @returns {Object} Utilisateur mis à jour
 */
function updateUser(userId, userData) {
  const { fullname, email, role } = userData;
  
  try {
    // Récupérer l'utilisateur
    const user = getUserById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }
    
    // Valider le rôle si fourni
    if (role && role !== 'admin' && role !== 'user') {
      throw new Error('Rôle invalide. Doit être "admin" ou "user"');
    }
    
    // Mettre à jour l'utilisateur
    db.prepare(`
      UPDATE users 
      SET fullname = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(
      fullname !== undefined ? fullname : user.fullname,
      email !== undefined ? email : user.email,
      role !== undefined ? role : user.role,
      userId
    );
    
    // Récupérer l'utilisateur mis à jour (sans mot de passe)
    const updatedUser = getUserById(userId);
    delete updatedUser.password;
    
    return updatedUser;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    throw new Error(`Impossible de mettre à jour l'utilisateur: ${error.message}`);
  }
}

/**
 * Supprimer un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @returns {boolean} Succès de la suppression
 */
function deleteUser(userId) {
  try {
    // Vérifier si c'est le dernier administrateur
    const user = getUserById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }
    
    if (user.role === 'admin') {
      const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin').count;
      
      if (adminCount <= 1) {
        throw new Error('Impossible de supprimer le dernier administrateur');
      }
    }
    
    // Supprimer l'utilisateur
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    return result.changes > 0;
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    throw new Error(`Impossible de supprimer l'utilisateur: ${error.message}`);
  }
}

/**
 * Lister tous les utilisateurs
 * @returns {Array} Liste des utilisateurs (sans mots de passe)
 */
function listUsers() {
  try {
    const users = db.prepare('SELECT * FROM users ORDER BY username').all();
    
    // Retirer les mots de passe
    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    throw new Error(`Impossible de récupérer les utilisateurs: ${error.message}`);
  }
}

/**
 * Vérifier si un utilisateur est administrateur
 * @param {number} userId - ID de l'utilisateur
 * @returns {boolean} True si l'utilisateur est administrateur
 */
function isAdmin(userId) {
  try {
    const user = getUserById(userId);
    return user && user.role === 'admin';
  } catch (error) {
    return false;
  }
}

// Middleware pour s'assurer qu'un utilisateur est authentifié
function requireAuth(req, res, next) {
  try {
    // Vérifier si un token est présent
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    // Extraire et vérifier le token
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    // Ajouter les informations utilisateur à la requête
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentification invalide' });
  }
}

// Middleware pour s'assurer qu'un utilisateur est administrateur
function requireAdmin(req, res, next) {
  try {
    // Vérifier si un token est présent
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    // Extraire et vérifier le token
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    // Vérifier le rôle
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    // Ajouter les informations utilisateur à la requête
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentification invalide' });
  }
}

// Exporter les fonctions du service
module.exports = {
  createUser,
  getUserById,
  getUserByUsername,
  authenticateUser,
  verifyToken,
  changePassword,
  resetPassword,
  updateUser,
  deleteUser,
  listUsers,
  isAdmin,
  requireAuth,
  requireAdmin
};