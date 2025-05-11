/**
 * Gestionnaire de terminologie française pour FHIR R4
 * Charge et fournit les mappings des terminologies françaises selon les spécifications ANS
 * @module FrenchTerminologyManager
 */

const fs = require('fs');
const path = require('path');

class FrenchTerminologyManager {
  constructor() {
    this.mappings = {};
    this.loaded = false;
    this.lastLoaded = null;
  }

  /**
   * Charge les mappings de terminologie à partir du fichier JSON
   * @param {string} filePath - Chemin vers le fichier de mappings (par défaut: data/french_terminology_mappings.json)
   * @returns {boolean} - Succès du chargement
   */
  loadMappings(filePath = path.join(__dirname, '../../data/french_terminology_mappings.json')) {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`[TERMINOLOGY] Fichier de mappings français non trouvé: ${filePath}`);
        return false;
      }

      const mappingsData = fs.readFileSync(filePath, 'utf8');
      this.mappings = JSON.parse(mappingsData);
      this.loaded = true;
      this.lastLoaded = new Date();
      
      console.log(`[TERMINOLOGY] Mappings français chargés avec succès (version ${this.mappings.version})`);
      return true;
    } catch (error) {
      console.error('[TERMINOLOGY] Erreur lors du chargement des mappings français:', error);
      return false;
    }
  }

  /**
   * Obtient un système de terminologie par son identifiant
   * @param {string} systemId - Identifiant du système
   * @returns {string} - URL du système
   */
  getSystem(systemId) {
    if (!this.loaded && !this.loadMappings()) {
      return null;
    }
    
    return this.mappings.systems[systemId];
  }

  /**
   * Obtient un OID par son identifiant
   * @param {string} oidId - Identifiant de l'OID
   * @returns {string} - OID
   */
  getOID(oidId) {
    if (!this.loaded && !this.loadMappings()) {
      return null;
    }
    
    return this.mappings.oids[oidId];
  }

  /**
   * Obtient une extension par son identifiant
   * @param {string} extensionId - Identifiant de l'extension
   * @returns {string} - URL de l'extension
   */
  getExtension(extensionId) {
    if (!this.loaded && !this.loadMappings()) {
      return null;
    }
    
    return this.mappings.extensions[extensionId];
  }

  /**
   * Obtient les informations sur un type de couverture
   * @param {string} coverageTypeId - Identifiant du type de couverture
   * @returns {object} - Informations sur le type de couverture
   */
  getCoverageType(coverageTypeId) {
    if (!this.loaded && !this.loadMappings()) {
      return { code: coverageTypeId, display: coverageTypeId };
    }
    
    return this.mappings.coverage_types[coverageTypeId] || { code: coverageTypeId, display: coverageTypeId };
  }

  /**
   * Obtient les informations sur une profession
   * @param {string} professionId - Code de la profession
   * @returns {object} - Informations sur la profession
   */
  getProfession(professionId) {
    if (!this.loaded && !this.loadMappings()) {
      return { code: professionId, display: professionId };
    }
    
    return this.mappings.professions[professionId] || { code: professionId, display: professionId };
  }

  /**
   * Obtient les informations sur un identifiant
   * @param {string} identifierId - Type d'identifiant
   * @returns {object} - Informations sur l'identifiant
   */
  getIdentifier(identifierId) {
    if (!this.loaded && !this.loadMappings()) {
      return { 
        system: `urn:system:unknown:${identifierId}`, 
        typeCode: identifierId, 
        display: identifierId 
      };
    }
    
    return this.mappings.identifiers[identifierId] || { 
      system: `urn:system:unknown:${identifierId}`, 
      typeCode: identifierId, 
      display: identifierId 
    };
  }

  /**
   * Obtient les informations sur une classe d'encounter
   * @param {string} encounterClassId - Code de la classe d'encounter
   * @returns {object} - Informations sur la classe d'encounter
   */
  getEncounterClass(encounterClassId) {
    if (!this.loaded && !this.loadMappings()) {
      return { code: 'IMP', display: 'Hospitalisation' };
    }
    
    return this.mappings.encounter_class[encounterClassId] || { code: 'IMP', display: 'Hospitalisation' };
  }

  /**
   * Obtient les informations sur un type de mouvement
   * @param {string} movementTypeId - Code du type de mouvement
   * @returns {object} - Informations sur le type de mouvement
   */
  getMovementType(movementTypeId) {
    if (!this.loaded && !this.loadMappings()) {
      return { code: movementTypeId, display: movementTypeId };
    }
    
    return this.mappings.movement_types[movementTypeId] || { code: movementTypeId, display: movementTypeId };
  }

  /**
   * Obtient tous les systèmes de terminologie
   * @returns {object} - Map des systèmes de terminologie
   */
  getAllSystems() {
    if (!this.loaded && !this.loadMappings()) {
      return {};
    }
    
    return this.mappings.systems;
  }

  /**
   * Obtient tous les OIDs
   * @returns {object} - Map des OIDs
   */
  getAllOIDs() {
    if (!this.loaded && !this.loadMappings()) {
      return {};
    }
    
    return this.mappings.oids;
  }

  /**
   * Recharge les mappings de terminologie
   * @param {string} filePath - Chemin vers le fichier de mappings
   * @returns {boolean} - Succès du rechargement
   */
  reloadMappings(filePath) {
    this.loaded = false;
    return this.loadMappings(filePath);
  }

  /**
   * Obtient la version des mappings
   * @returns {string} - Version des mappings
   */
  getVersion() {
    if (!this.loaded && !this.loadMappings()) {
      return "unknown";
    }
    
    return this.mappings.version;
  }

  /**
   * Obtient la date de dernière mise à jour des mappings
   * @returns {string} - Date de dernière mise à jour
   */
  getLastUpdated() {
    if (!this.loaded && !this.loadMappings()) {
      return null;
    }
    
    return this.mappings.lastUpdated;
  }
}

// Exporter une instance singleton
const instance = new FrenchTerminologyManager();
instance.loadMappings();

module.exports = instance;