/**
 * Contrôleur de gestion des applications
 * Gère les opérations CRUD sur les applications et leurs clés API
 */

const applicationService = require('../../services/applicationService');
const apiKeyService = require('../../services/apiKeyService');

/**
 * Lister toutes les applications
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getAllApplications(req, res) {
  try {
    const { active, limit, offset, orderBy, orderDir } = req.query;
    
    // Convertir les paramètres
    const options = {
      active: active === 'true' ? true : (active === 'false' ? false : undefined),
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      orderBy: orderBy || undefined,
      orderDir: orderDir || undefined
    };
    
    // Récupérer les applications
    const applications = await applicationService.getAllApplications(options);
    
    res.json({ applications });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des applications:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des applications' 
    });
  }
}

/**
 * Obtenir une application par son ID
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getApplicationById(req, res) {
  try {
    const applicationId = parseInt(req.params.id);
    
    // Récupérer l'application avec ses détails
    const application = await applicationService.getApplicationDetails(applicationId);
    
    // Si l'application n'existe pas
    if (!application) {
      return res.status(404).json({ 
        error: 'Application non trouvée',
        message: 'L\'application demandée n\'existe pas' 
      });
    }
    
    res.json({ application });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération de l\'application:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération de l\'application' 
    });
  }
}

/**
 * Créer une nouvelle application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function createApplication(req, res) {
  try {
    const { name, description, contactEmail, contactName, logo, settings } = req.body;
    
    // Vérifier que le nom est fourni
    if (!name) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le nom de l\'application est requis' 
      });
    }
    
    // Créer l'application
    const application = await applicationService.createApplication({
      name,
      description,
      contactEmail,
      contactName,
      logo,
      settings
    });
    
    // Récupérer les détails complets (incluant l'API key générée automatiquement)
    const applicationWithDetails = await applicationService.getApplicationDetails(application.id);
    
    res.status(201).json({
      message: 'Application créée avec succès',
      application: applicationWithDetails
    });
  } catch (error) {
    console.error('[API] Erreur lors de la création de l\'application:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la création de l\'application' 
    });
  }
}

/**
 * Mettre à jour une application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function updateApplication(req, res) {
  try {
    const applicationId = parseInt(req.params.id);
    const { name, description, contactEmail, contactName, logo, settings, active } = req.body;
    
    // Mettre à jour l'application
    const application = await applicationService.updateApplication(applicationId, {
      name,
      description,
      contactEmail,
      contactName,
      logo,
      settings,
      active
    });
    
    // Si l'application n'existe pas
    if (!application) {
      return res.status(404).json({ 
        error: 'Application non trouvée',
        message: 'L\'application demandée n\'existe pas' 
      });
    }
    
    res.json({
      message: 'Application mise à jour avec succès',
      application
    });
  } catch (error) {
    console.error('[API] Erreur lors de la mise à jour de l\'application:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la mise à jour de l\'application' 
    });
  }
}

/**
 * Supprimer une application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function deleteApplication(req, res) {
  try {
    const applicationId = parseInt(req.params.id);
    
    // Supprimer l'application
    const deleted = await applicationService.deleteApplication(applicationId);
    
    // Si l'application n'existe pas
    if (!deleted) {
      return res.status(404).json({ 
        error: 'Application non trouvée',
        message: 'L\'application demandée n\'existe pas' 
      });
    }
    
    res.json({
      message: 'Application supprimée avec succès'
    });
  } catch (error) {
    console.error('[API] Erreur lors de la suppression de l\'application:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la suppression de l\'application' 
    });
  }
}

/**
 * Créer une nouvelle clé API pour une application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function createApiKey(req, res) {
  try {
    const applicationId = parseInt(req.params.id);
    const { name, active, expiresAt } = req.body;
    
    // Vérifier que le nom est fourni
    if (!name) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le nom de la clé API est requis' 
      });
    }
    
    // Vérifier que l'application existe
    const application = await applicationService.getApplicationById(applicationId);
    if (!application) {
      return res.status(404).json({ 
        error: 'Application non trouvée',
        message: 'L\'application demandée n\'existe pas' 
      });
    }
    
    // Créer la clé API
    const apiKey = await apiKeyService.createApiKey({
      applicationId,
      name,
      active: active !== undefined ? active : true,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });
    
    res.status(201).json({
      message: 'Clé API créée avec succès',
      apiKey
    });
  } catch (error) {
    console.error('[API] Erreur lors de la création de la clé API:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la création de la clé API' 
    });
  }
}

/**
 * Récupérer toutes les clés API d'une application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getApiKeys(req, res) {
  try {
    const applicationId = parseInt(req.params.id);
    const { active, limit, offset } = req.query;
    
    // Convertir les paramètres
    const options = {
      active: active === 'true' ? true : (active === 'false' ? false : undefined),
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    };
    
    // Vérifier que l'application existe
    const application = await applicationService.getApplicationById(applicationId);
    if (!application) {
      return res.status(404).json({ 
        error: 'Application non trouvée',
        message: 'L\'application demandée n\'existe pas' 
      });
    }
    
    // Récupérer les clés API
    const apiKeys = await apiKeyService.getApiKeysByApplication(applicationId, options);
    
    res.json({ apiKeys });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des clés API:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des clés API' 
    });
  }
}

/**
 * Activer ou désactiver une clé API
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function setApiKeyStatus(req, res) {
  try {
    const keyId = parseInt(req.params.keyId);
    const { active } = req.body;
    
    // Vérifier que le statut est fourni
    if (active === undefined) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le statut d\'activation est requis' 
      });
    }
    
    // Mettre à jour le statut de la clé API
    const apiKey = await apiKeyService.setApiKeyActive(keyId, active);
    
    // Si la clé API n'existe pas
    if (!apiKey) {
      return res.status(404).json({ 
        error: 'Clé API non trouvée',
        message: 'La clé API demandée n\'existe pas' 
      });
    }
    
    res.json({
      message: `Clé API ${active ? 'activée' : 'désactivée'} avec succès`,
      apiKey
    });
  } catch (error) {
    console.error('[API] Erreur lors de la mise à jour de la clé API:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la mise à jour de la clé API' 
    });
  }
}

/**
 * Révoquer (supprimer) une clé API
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function revokeApiKey(req, res) {
  try {
    const keyId = parseInt(req.params.keyId);
    
    // Révoquer la clé API
    const revoked = await apiKeyService.revokeApiKey(keyId);
    
    // Si la clé API n'existe pas
    if (!revoked) {
      return res.status(404).json({ 
        error: 'Clé API non trouvée',
        message: 'La clé API demandée n\'existe pas' 
      });
    }
    
    res.json({
      message: 'Clé API révoquée avec succès'
    });
  } catch (error) {
    console.error('[API] Erreur lors de la révocation de la clé API:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la révocation de la clé API' 
    });
  }
}

/**
 * Ajouter un paramètre à une application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function addApplicationParameter(req, res) {
  try {
    const applicationId = parseInt(req.params.id);
    const { name, value, description, type } = req.body;
    
    // Vérifier que les champs requis sont fournis
    if (!name) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le nom du paramètre est requis' 
      });
    }
    
    // Vérifier que l'application existe
    const application = await applicationService.getApplicationById(applicationId);
    if (!application) {
      return res.status(404).json({ 
        error: 'Application non trouvée',
        message: 'L\'application demandée n\'existe pas' 
      });
    }
    
    // Ajouter le paramètre
    const parameter = await applicationService.addApplicationParameter(applicationId, {
      name,
      value,
      description,
      type
    });
    
    res.status(201).json({
      message: 'Paramètre ajouté avec succès',
      parameter
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'ajout du paramètre:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de l\'ajout du paramètre' 
    });
  }
}

/**
 * Mettre à jour un paramètre d'application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function updateApplicationParameter(req, res) {
  try {
    const parameterId = parseInt(req.params.parameterId);
    const { value, description, type } = req.body;
    
    // Mettre à jour le paramètre
    const parameter = await applicationService.updateApplicationParameter(parameterId, {
      value,
      description,
      type
    });
    
    // Si le paramètre n'existe pas
    if (!parameter) {
      return res.status(404).json({ 
        error: 'Paramètre non trouvé',
        message: 'Le paramètre demandé n\'existe pas' 
      });
    }
    
    res.json({
      message: 'Paramètre mis à jour avec succès',
      parameter
    });
  } catch (error) {
    console.error('[API] Erreur lors de la mise à jour du paramètre:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la mise à jour du paramètre' 
    });
  }
}

/**
 * Supprimer un paramètre d'application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function deleteApplicationParameter(req, res) {
  try {
    const parameterId = parseInt(req.params.parameterId);
    
    // Supprimer le paramètre
    const deleted = await applicationService.deleteApplicationParameter(parameterId);
    
    // Si le paramètre n'existe pas
    if (!deleted) {
      return res.status(404).json({ 
        error: 'Paramètre non trouvé',
        message: 'Le paramètre demandé n\'existe pas' 
      });
    }
    
    res.json({
      message: 'Paramètre supprimé avec succès'
    });
  } catch (error) {
    console.error('[API] Erreur lors de la suppression du paramètre:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la suppression du paramètre' 
    });
  }
}

/**
 * Ajouter un dossier à une application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function addApplicationFolder(req, res) {
  try {
    const applicationId = parseInt(req.params.id);
    const { folderPath, description, isMonitored } = req.body;
    
    // Vérifier que les champs requis sont fournis
    if (!folderPath) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le chemin du dossier est requis' 
      });
    }
    
    // Vérifier que l'application existe
    const application = await applicationService.getApplicationById(applicationId);
    if (!application) {
      return res.status(404).json({ 
        error: 'Application non trouvée',
        message: 'L\'application demandée n\'existe pas' 
      });
    }
    
    // Ajouter le dossier
    const folder = await applicationService.addApplicationFolder(applicationId, {
      folderPath,
      description,
      isMonitored
    });
    
    res.status(201).json({
      message: 'Dossier ajouté avec succès',
      folder
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'ajout du dossier:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de l\'ajout du dossier' 
    });
  }
}

/**
 * Supprimer un dossier d'application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function deleteApplicationFolder(req, res) {
  try {
    const folderId = parseInt(req.params.folderId);
    
    // Supprimer le dossier
    const deleted = await applicationService.deleteApplicationFolder(folderId);
    
    // Si le dossier n'existe pas
    if (!deleted) {
      return res.status(404).json({ 
        error: 'Dossier non trouvé',
        message: 'Le dossier demandé n\'existe pas' 
      });
    }
    
    res.json({
      message: 'Dossier supprimé avec succès'
    });
  } catch (error) {
    console.error('[API] Erreur lors de la suppression du dossier:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la suppression du dossier' 
    });
  }
}

module.exports = {
  getAllApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
  createApiKey,
  getApiKeys,
  setApiKeyStatus,
  revokeApiKey,
  addApplicationParameter,
  updateApplicationParameter,
  deleteApplicationParameter,
  addApplicationFolder,
  deleteApplicationFolder
};