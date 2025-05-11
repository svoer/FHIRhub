/**
 * Module pour la validation des ressources FHIR
 */
const logger = require('./logger');

/**
 * Fonction pour valider une ressource FHIR
 * @param {Object} resource - Ressource FHIR à valider
 * @returns {Object} Résultat de la validation
 */
function validateFhirResource(resource) {
  try {
    // Validation de base
    if (!resource) {
      return {
        valid: false,
        errors: [{ severity: 'error', message: 'La ressource est vide ou nulle' }]
      };
    }

    // Vérifier resourceType
    if (!resource.resourceType) {
      return {
        valid: false,
        errors: [{ severity: 'error', message: 'resourceType est requis' }]
      };
    }

    // Initialiser le résultat de validation
    const validationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Validation spécifique au type de ressource
    switch (resource.resourceType) {
      case 'Patient':
        validatePatient(resource, validationResult);
        break;
      case 'Practitioner':
        validatePractitioner(resource, validationResult);
        break;
      case 'Organization':
        validateOrganization(resource, validationResult);
        break;
      case 'Encounter':
        validateEncounter(resource, validationResult);
        break;
      case 'Observation':
        validateObservation(resource, validationResult);
        break;
      // Ajouter d'autres types de ressources au besoin
    }

    // Déterminer si la ressource est valide (aucune erreur)
    validationResult.valid = validationResult.errors.length === 0;
    
    return validationResult;
  } catch (error) {
    logger.error(`Erreur lors de la validation de la ressource FHIR: ${error.message}`);
    return {
      valid: false,
      errors: [{ severity: 'error', message: `Erreur lors de la validation: ${error.message}` }]
    };
  }
}

/**
 * Valider une ressource Patient
 * @param {Object} patient - Ressource Patient
 * @param {Object} result - Résultat de validation
 */
function validatePatient(patient, result) {
  // Vérifier l'identifiant
  if (!patient.id && !patient.identifier?.length) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Patient doit avoir un id ou au moins un identifier' 
    });
  }

  // Vérifier le nom
  if (!patient.name || patient.name.length === 0) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Patient doit avoir au moins un nom' 
    });
  } else {
    // Vérifier si au moins un nom a un family ou un given
    const hasValidName = patient.name.some(n => n.family || (n.given && n.given.length));
    if (!hasValidName) {
      result.errors.push({ 
        severity: 'error', 
        message: 'Patient doit avoir au moins un nom avec un nom de famille ou un prénom' 
      });
    }
  }

  // Avertissements
  if (!patient.birthDate) {
    result.warnings.push({ 
      severity: 'warning', 
      message: 'Date de naissance non spécifiée' 
    });
  }

  if (!patient.gender) {
    result.warnings.push({ 
      severity: 'warning', 
      message: 'Genre non spécifié' 
    });
  }
}

/**
 * Valider une ressource Practitioner
 * @param {Object} practitioner - Ressource Practitioner
 * @param {Object} result - Résultat de validation
 */
function validatePractitioner(practitioner, result) {
  // Vérifier l'identifiant
  if (!practitioner.id && !practitioner.identifier?.length) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Practitioner doit avoir un id ou au moins un identifier' 
    });
  }

  // Vérifier le nom
  if (!practitioner.name || practitioner.name.length === 0) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Practitioner doit avoir au moins un nom' 
    });
  }
}

/**
 * Valider une ressource Organization
 * @param {Object} organization - Ressource Organization
 * @param {Object} result - Résultat de validation
 */
function validateOrganization(organization, result) {
  // Vérifier l'identifiant
  if (!organization.id && !organization.identifier?.length) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Organization doit avoir un id ou au moins un identifier' 
    });
  }

  // Vérifier le nom
  if (!organization.name) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Organization doit avoir un nom' 
    });
  }
}

/**
 * Valider une ressource Encounter
 * @param {Object} encounter - Ressource Encounter
 * @param {Object} result - Résultat de validation
 */
function validateEncounter(encounter, result) {
  // Vérifier le statut
  if (!encounter.status) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Encounter doit avoir un statut' 
    });
  } else if (!['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'].includes(encounter.status)) {
    result.errors.push({ 
      severity: 'error', 
      message: `Statut d'Encounter invalide: ${encounter.status}` 
    });
  }

  // Vérifier le type de rencontre
  if (!encounter.class) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Encounter doit avoir une classe' 
    });
  }

  // Vérifier la référence au patient
  if (!encounter.subject) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Encounter doit avoir un sujet (patient)' 
    });
  }
}

/**
 * Valider une ressource Observation
 * @param {Object} observation - Ressource Observation
 * @param {Object} result - Résultat de validation
 */
function validateObservation(observation, result) {
  // Vérifier le statut
  if (!observation.status) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Observation doit avoir un statut' 
    });
  } else if (!['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'].includes(observation.status)) {
    result.errors.push({ 
      severity: 'error', 
      message: `Statut d'Observation invalide: ${observation.status}` 
    });
  }

  // Vérifier la présence d'un code
  if (!observation.code) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Observation doit avoir un code' 
    });
  }

  // Vérifier la référence au patient
  if (!observation.subject) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Observation doit avoir un sujet (patient)' 
    });
  }

  // Vérifier la présence d'une valeur ou d'un composant
  if (!observation.value && !observation.component?.length && !observation.dataAbsentReason) {
    result.errors.push({ 
      severity: 'error', 
      message: 'Observation doit avoir une valeur, un composant ou une raison d\'absence de donnée' 
    });
  }
}

module.exports = {
  validateFhirResource
};