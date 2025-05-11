/**
 * Contrôleur d'authentification pour l'interface d'administration
 * Gère l'inscription, la connexion et les opérations liées aux utilisateurs
 */

const authService = require('../../services/authService');

/**
 * Traiter la connexion d'un utilisateur
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;
    
    // Vérifier que les champs requis sont présents
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le nom d\'utilisateur et le mot de passe sont requis' 
      });
    }
    
    // Authentifier l'utilisateur
    const authResult = await authService.authenticateUser(username, password);
    
    // Si l'authentification a échoué
    if (!authResult) {
      return res.status(401).json({ 
        error: 'Authentification échouée',
        message: 'Nom d\'utilisateur ou mot de passe incorrect' 
      });
    }
    
    // Définir le cookie de session (pour les applications front-end)
    res.cookie('token', authResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 jour
    });
    
    // Renvoyer les informations utilisateur et le token
    res.json({
      message: 'Connexion réussie',
      user: {
        id: authResult.id,
        username: authResult.username,
        email: authResult.email,
        fullName: authResult.fullName,
        role: authResult.role
      },
      token: authResult.token
    });
  } catch (error) {
    console.error('[AUTH] Erreur lors de la connexion:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la connexion' 
    });
  }
}

/**
 * Déconnecter un utilisateur
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
function logout(req, res) {
  // Effacer le cookie de session
  res.clearCookie('token');
  
  res.json({ 
    message: 'Déconnexion réussie' 
  });
}

/**
 * Obtenir les informations de l'utilisateur connecté
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
function getProfile(req, res) {
  // req.auth est défini par le middleware d'authentification
  if (!req.auth || !req.auth.authenticated) {
    return res.status(401).json({ 
      error: 'Non authentifié',
      message: 'Vous devez être connecté pour accéder à cette ressource' 
    });
  }
  
  // Renvoyer les informations utilisateur (sans le token)
  res.json({
    id: req.auth.userId,
    username: req.auth.username,
    email: req.auth.user.email,
    fullName: req.auth.user.fullName,
    role: req.auth.role
  });
}

/**
 * Créer un nouvel utilisateur (admin uniquement)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function createUser(req, res) {
  try {
    // Vérifier que l'utilisateur actuel est administrateur
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Seuls les administrateurs peuvent créer des utilisateurs' 
      });
    }
    
    const { username, password, email, fullName, role } = req.body;
    
    // Vérifier que les champs requis sont présents
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le nom d\'utilisateur et le mot de passe sont requis' 
      });
    }
    
    // Vérifier que le rôle est valide
    if (role && !['admin', 'user'].includes(role)) {
      return res.status(400).json({ 
        error: 'Rôle invalide',
        message: 'Le rôle doit être "admin" ou "user"' 
      });
    }
    
    // Créer l'utilisateur
    const user = await authService.createUser({
      username,
      password,
      email,
      fullName,
      role: role || 'user'
    });
    
    // Renvoyer les informations de l'utilisateur créé
    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    // Gérer l'erreur d'utilisateur existant
    if (error.message.includes('existe déjà')) {
      return res.status(409).json({ 
        error: 'Conflit',
        message: error.message 
      });
    }
    
    console.error('[AUTH] Erreur lors de la création d\'utilisateur:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la création de l\'utilisateur' 
    });
  }
}

/**
 * Mettre à jour un utilisateur
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function updateUser(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const { email, fullName, role, active, password } = req.body;
    
    // Vérifier que l'utilisateur est autorisé à modifier cet utilisateur
    // Les admins peuvent modifier n'importe quel utilisateur
    // Les utilisateurs normaux ne peuvent modifier que leur propre profil
    if (req.auth.role !== 'admin' && req.auth.userId !== userId) {
      return res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Vous n\'êtes pas autorisé à modifier cet utilisateur' 
      });
    }
    
    // Les utilisateurs normaux ne peuvent pas modifier leur rôle ou leur statut
    if (req.auth.role !== 'admin' && (role !== undefined || active !== undefined)) {
      return res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Vous n\'êtes pas autorisé à modifier ces champs' 
      });
    }
    
    // Mettre à jour l'utilisateur
    const updatedUser = await authService.updateUser(userId, {
      email,
      fullName,
      role,
      active,
      password
    });
    
    // Si l'utilisateur n'existe pas
    if (!updatedUser) {
      return res.status(404).json({ 
        error: 'Utilisateur non trouvé',
        message: 'L\'utilisateur demandé n\'existe pas' 
      });
    }
    
    // Renvoyer les informations de l'utilisateur mis à jour
    res.json({
      message: 'Utilisateur mis à jour avec succès',
      user: updatedUser
    });
  } catch (error) {
    console.error('[AUTH] Erreur lors de la mise à jour d\'utilisateur:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la mise à jour de l\'utilisateur' 
    });
  }
}

/**
 * Supprimer un utilisateur (admin uniquement)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function deleteUser(req, res) {
  try {
    // Vérifier que l'utilisateur actuel est administrateur
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Seuls les administrateurs peuvent supprimer des utilisateurs' 
      });
    }
    
    const userId = parseInt(req.params.id);
    
    // Empêcher la suppression de son propre compte
    if (req.auth.userId === userId) {
      return res.status(400).json({ 
        error: 'Opération invalide',
        message: 'Vous ne pouvez pas supprimer votre propre compte' 
      });
    }
    
    // Supprimer l'utilisateur
    const deleted = await authService.deleteUser(userId);
    
    // Si l'utilisateur n'existe pas
    if (!deleted) {
      return res.status(404).json({ 
        error: 'Utilisateur non trouvé',
        message: 'L\'utilisateur demandé n\'existe pas' 
      });
    }
    
    // Renvoyer une confirmation
    res.json({
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    console.error('[AUTH] Erreur lors de la suppression d\'utilisateur:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la suppression de l\'utilisateur' 
    });
  }
}

/**
 * Lister tous les utilisateurs (admin uniquement)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getAllUsers(req, res) {
  try {
    // Vérifier que l'utilisateur actuel est administrateur
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Seuls les administrateurs peuvent lister les utilisateurs' 
      });
    }
    
    // Récupérer tous les utilisateurs
    const users = await authService.getAllUsers();
    
    // Renvoyer la liste des utilisateurs
    res.json({
      users
    });
  } catch (error) {
    console.error('[AUTH] Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des utilisateurs' 
    });
  }
}

module.exports = {
  login,
  logout,
  getProfile,
  createUser,
  updateUser,
  deleteUser,
  getAllUsers
};