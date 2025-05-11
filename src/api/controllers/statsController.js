/**
 * Contrôleur de statistiques et de journaux de conversion
 * Fournit des endpoints pour obtenir les statistiques et l'historique des conversions
 */

const conversionLogService = require('../../services/conversionLogService');

/**
 * Obtenir un résumé des statistiques pour le tableau de bord
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getStatsSummary(req, res) {
  try {
    const { applicationId, startDate, endDate } = req.query;
    
    // Convertir les paramètres
    const options = {
      applicationId: applicationId ? parseInt(applicationId) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };
    
    // Récupérer les statistiques
    const stats = await conversionLogService.getStatsSummary(options);
    
    res.json({ stats });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des statistiques' 
    });
  }
}

/**
 * Obtenir les métriques du tableau de bord
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getDashboardMetrics(req, res) {
  try {
    const { applicationId, metricsType, startDate, endDate, limit } = req.query;
    
    // Convertir les paramètres
    const options = {
      applicationId: applicationId ? parseInt(applicationId) : undefined,
      metricsType: metricsType || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: limit ? parseInt(limit) : undefined
    };
    
    // Récupérer les métriques
    const metrics = await conversionLogService.getDashboardMetrics(options);
    
    res.json({ metrics });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des métriques:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des métriques' 
    });
  }
}

/**
 * Obtenir les logs de conversion
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getConversionLogs(req, res) {
  try {
    const { 
      applicationId, 
      apiKeyId, 
      status, 
      startDate, 
      endDate, 
      requestType, 
      limit, 
      offset 
    } = req.query;
    
    // Convertir les paramètres
    const options = {
      applicationId: applicationId ? parseInt(applicationId) : undefined,
      apiKeyId: apiKeyId ? parseInt(apiKeyId) : undefined,
      status: status || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      requestType: requestType || undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    };
    
    // Récupérer les logs
    const logs = await conversionLogService.getConversionLogs(options);
    
    // Compter le nombre total de logs correspondant aux critères
    const totalCount = await conversionLogService.countConversionLogs(options);
    
    res.json({ 
      logs,
      pagination: {
        total: totalCount,
        limit: options.limit || 100,
        offset: options.offset || 0
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des logs:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des logs' 
    });
  }
}

/**
 * Obtenir un log de conversion par son ID
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function getConversionLogById(req, res) {
  try {
    const logId = parseInt(req.params.id);
    
    // Récupérer le log
    const log = await conversionLogService.getConversionLogById(logId);
    
    // Si le log n'existe pas
    if (!log) {
      return res.status(404).json({ 
        error: 'Log non trouvé',
        message: 'Le log demandé n\'existe pas' 
      });
    }
    
    res.json({ log });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération du log:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération du log' 
    });
  }
}

/**
 * Nettoyer les anciens logs de conversion
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function cleanupOldLogs(req, res) {
  try {
    const { days } = req.body;
    
    // Vérifier que le nombre de jours est fourni
    if (!days || isNaN(parseInt(days))) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le nombre de jours à conserver est requis' 
      });
    }
    
    // Convertir en nombre
    const daysToKeep = parseInt(days);
    
    // Nettoyer les logs
    const deletedCount = await conversionLogService.deleteOldLogs(daysToKeep);
    
    res.json({
      message: `${deletedCount} logs anciens ont été supprimés`,
      deletedCount
    });
  } catch (error) {
    console.error('[API] Erreur lors du nettoyage des logs:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors du nettoyage des logs' 
    });
  }
}

/**
 * Mettre à jour les métriques du tableau de bord
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function updateDashboardMetrics(req, res) {
  try {
    const { applicationId } = req.body;
    
    // Mettre à jour les métriques
    await conversionLogService.updateDashboardMetrics(
      applicationId ? parseInt(applicationId) : null
    );
    
    res.json({
      message: 'Métriques mises à jour avec succès'
    });
  } catch (error) {
    console.error('[API] Erreur lors de la mise à jour des métriques:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la mise à jour des métriques' 
    });
  }
}

module.exports = {
  getStatsSummary,
  getDashboardMetrics,
  getConversionLogs,
  getConversionLogById,
  cleanupOldLogs,
  updateDashboardMetrics
};