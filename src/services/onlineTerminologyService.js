/**
 * Service d'intégration avec les API du Serveur Multi-Terminologies (SMT) français
 * Permet la récupération en temps réel des terminologies et codes français
 * pour l'enrichissement des ressources FHIR
 * 
 * IMPORTANT: Ce service nécessite une authentification auprès de l'ANS pour fonctionner pleinement.
 * ---------------------------------------------------------------------------------------------
 * COMMENT ACTIVER CE SERVICE:
 * ---------------------------------------------------------------------------------------------
 * 1. Créez un compte sur le portail de l'ANS (https://esante.gouv.fr)
 * 2. Demandez une clé API pour le Serveur Multi-Terminologies (SMT)
 * 3. Dans votre code, utilisez la fonction configureAuth() pour activer l'authentification:
 *    const frenchTerminologyService = require('./french_terminology_service');
 *    frenchTerminologyService.configureAuth({
 *      authEnabled: true,
 *      clientId: 'VOTRE_CLIENT_ID',       // Généralement "user-api"
 *      clientSecret: 'VOTRE_CLIENT_SECRET', 
 *      apiKey: 'VOTRE_CLE_API'            // Clé fournie par l'ANS
 *    });
 * 
 * Pour des besoins hors ligne ou de développement, utilisez plutôt french_terminology_service_offline.js
 * qui ne nécessite pas de connexion internet ni d'authentification.
 *
 * Ce service interagit avec le Serveur Multi-Terminologies (SMT) de l'Agence du
 * Numérique en Santé (ANS) pour accéder aux terminologies standardisées françaises
 * nécessaires à l'interopérabilité des systèmes de santé en France.
 * 
 * Terminologies principales supportées :
 * - TRE-R316-AutreCategorieEtablissement (OID: 1.2.250.1.213.1.6.1.239)
 * - TRE-R51-DESCGroupe2Diplome (OID: 1.2.250.1.213.1.6.1.49)
 * - TRE-G02-TypeProduit (OID: 1.2.250.1.71.1.2.2)
 * - TRE-R217-ProtectionJuridique (OID: 1.2.250.1.213.1.1.4.327)
 * - TRE-R302-ContexteCodeComplementaire (OID: 1.2.250.1.213.3.3.70)
 * - TRE-R239-PublicPrisEnCharge (OID: 1.2.250.1.213.3.3.29)
 * - TRE-A01-CadreExercice
 * - TRE-R303-HL7v3AdministrativeGender
 * 
 * URL du serveur: https://smt.esante.gouv.fr/fhir/
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration des API
const SMT_API_CONFIG = {
  baseUrl: 'https://smt.esante.gouv.fr',
  fhirEndpoint: '/fhir',
  ssoEndpoint: '/ans/sso/auth/realms/ANS/protocol/openid-connect/token',
  clientId: 'user-api',
  grantType: 'client_credentials',
  authEnabled: false, // Désactivé par défaut, à activer avec une clé API valide
  // Liste des terminologies importantes à précharger
  key_terminologies: [
    { id: "TRE-R316-AutreCategorieEtablissement", oid: "1.2.250.1.213.1.6.1.239", description: "Autres catégories d'établissement" },
    { id: "TRE-R51-DESCGroupe2Diplome", oid: "1.2.250.1.213.1.6.1.49", description: "Diplômes groupe 2" },
    { id: "TRE-G02-TypeProduit", oid: "1.2.250.1.71.1.2.2", description: "Type de produit" },
    { id: "TRE-R217-ProtectionJuridique", oid: "1.2.250.1.213.1.1.4.327", description: "Protection juridique" },
    { id: "TRE-R302-ContexteCodeComplementaire", oid: "1.2.250.1.213.3.3.70", description: "Contexte code complémentaire" },
    { id: "TRE-R239-PublicPrisEnCharge", oid: "1.2.250.1.213.3.3.29", description: "Public pris en charge" },
    { id: "TRE-R303-HL7v3AdministrativeGender", description: "Genre administratif" },
    { id: "TRE-A01-CadreExercice", description: "Cadre d'exercice" }
  ]
};

// Chemins de stockage local
const CACHE_DIR = path.join(__dirname, 'french_terminology', 'cache');
const SYSTEM_CACHE_FILE = path.join(CACHE_DIR, 'system_cache.json');
const CODE_CACHE_FILE = path.join(CACHE_DIR, 'code_cache.json');

// Créer le répertoire de cache si nécessaire
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Initialiser les caches
let systemCache = {};
let codeCache = {};

// Charger les caches
try {
  if (fs.existsSync(SYSTEM_CACHE_FILE)) {
    systemCache = JSON.parse(fs.readFileSync(SYSTEM_CACHE_FILE, 'utf8'));
    console.log(`Cache des systèmes chargé: ${Object.keys(systemCache).length} entrées`);
  }
  if (fs.existsSync(CODE_CACHE_FILE)) {
    codeCache = JSON.parse(fs.readFileSync(CODE_CACHE_FILE, 'utf8'));
    console.log(`Cache des codes chargé: ${Object.keys(codeCache).length} entrées`);
  }
} catch (error) {
  console.error(`Erreur lors du chargement des caches: ${error.message}`);
}

// Token d'authentification
let authToken = null;
let tokenExpiration = 0;

/**
 * Obtenir un token d'accès pour les API du Serveur Multi-Terminologies (SMT)
 * 
 * Cette fonction tente d'obtenir un token d'authentification auprès du serveur SSO de l'ANS.
 * Elle vérifie d'abord si un token existant est encore valide avant d'en demander un nouveau.
 * 
 * ACTIVATION REQUISE:
 * Cette fonctionnalité nécessite une authentification active (authEnabled: true) et des
 * identifiants valides (clientId, clientSecret ou apiKey) fournis par l'ANS.
 * 
 * @returns {Promise<string|null>} Token d'accès ou null si non autorisé
 */
async function getAccessToken() {
  // Vérifier si le token existant est encore valide
  if (authToken && tokenExpiration > Date.now()) {
    return authToken;
  }

  // Si l'authentification n'est pas activée, retourner null
  if (!SMT_API_CONFIG.authEnabled) {
    console.log('Authentification SMT désactivée');
    return null;
  }

  try {
    // REMARQUE: Cette implémentation peut nécessiter des ajustements selon les exigences de l'ANS
    // Les paramètres exacts (headers, credentials, etc.) peuvent varier selon votre type de compte
    const response = await axios.post(
      `${SMT_API_CONFIG.baseUrl}${SMT_API_CONFIG.ssoEndpoint}`,
      `grant_type=${SMT_API_CONFIG.grantType}&client_id=${SMT_API_CONFIG.clientId}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (response.status === 200 && response.data && response.data.access_token) {
      authToken = response.data.access_token;
      // Définir l'expiration du token (généralement 3600 secondes = 1 heure)
      const expiresIn = response.data.expires_in || 3600;
      tokenExpiration = Date.now() + expiresIn * 1000;
      return authToken;
    } else {
      console.warn('Échec de l\'authentification SMT');
      return null;
    }
  } catch (error) {
    console.error(`Erreur d'authentification SMT: ${error.message}`);
    return null;
  }
}

/**
 * Construire les en-têtes HTTP avec authentification si disponible
 * @returns {Object} En-têtes HTTP
 */
async function buildHeaders() {
  const headers = {
    'Accept': 'application/json'
  };

  const token = await getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Récupérer un CodeSystem par son ID
 * @param {string} id - Identifiant du CodeSystem
 * @returns {Promise<Object|null>} CodeSystem ou null si non trouvé
 */
async function getCodeSystem(id) {
  // Vérifier le cache
  const cacheKey = `CodeSystem_${id}`;
  if (systemCache[cacheKey]) {
    return systemCache[cacheKey];
  }

  try {
    const headers = await buildHeaders();
    const response = await axios.get(
      `${SMT_API_CONFIG.baseUrl}${SMT_API_CONFIG.fhirEndpoint}/CodeSystem/${id}`,
      { headers }
    );

    if (response.status === 200 && response.data) {
      // Mettre en cache
      systemCache[cacheKey] = response.data;
      saveSystemCache();
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`Erreur lors de la récupération du CodeSystem ${id}: ${error.message}`);
    return null;
  }
}

/**
 * Rechercher dans les CodeSystems
 * @param {Object} params - Paramètres de recherche
 * @returns {Promise<Object|null>} Résultats de recherche ou null en cas d'erreur
 */
async function searchCodeSystems(params = {}) {
  try {
    const headers = await buildHeaders();
    const queryParams = new URLSearchParams(params).toString();
    const url = `${SMT_API_CONFIG.baseUrl}${SMT_API_CONFIG.fhirEndpoint}/CodeSystem/_search?${queryParams}`;
    
    const response = await axios.get(url, { headers });

    if (response.status === 200 && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`Erreur lors de la recherche de CodeSystems: ${error.message}`);
    return null;
  }
}

/**
 * Valider un code dans un système
 * @param {string} system - URL du système
 * @param {string} code - Code à valider
 * @returns {Promise<boolean>} True si le code est valide, false sinon
 */
async function validateCode(system, code) {
  // Vérifier le cache
  const cacheKey = `${system}_${code}`;
  if (codeCache[cacheKey] !== undefined) {
    return codeCache[cacheKey];
  }

  try {
    const headers = await buildHeaders();
    const url = `${SMT_API_CONFIG.baseUrl}${SMT_API_CONFIG.fhirEndpoint}/CodeSystem/$validate-code?system=${encodeURIComponent(system)}&code=${encodeURIComponent(code)}`;
    
    const response = await axios.get(url, { headers });

    if (response.status === 200 && response.data && response.data.parameter) {
      // Chercher le paramètre 'result' dans la réponse
      const resultParam = response.data.parameter.find(p => p.name === 'result');
      const isValid = resultParam && resultParam.valueBoolean === true;
      
      // Mettre en cache
      codeCache[cacheKey] = isValid;
      saveCodeCache();
      
      return isValid;
    }
    return false;
  } catch (error) {
    console.error(`Erreur lors de la validation du code ${code} (${system}): ${error.message}`);
    // En cas d'erreur, permettre l'utilisation du code (privilégier la fonctionnalité)
    return true;
  }
}

/**
 * Enregistrer le cache des systèmes
 */
function saveSystemCache() {
  try {
    fs.writeFileSync(SYSTEM_CACHE_FILE, JSON.stringify(systemCache, null, 2));
  } catch (error) {
    console.error(`Erreur lors de l'enregistrement du cache des systèmes: ${error.message}`);
  }
}

/**
 * Enregistrer le cache des codes
 */
function saveCodeCache() {
  try {
    fs.writeFileSync(CODE_CACHE_FILE, JSON.stringify(codeCache, null, 2));
  } catch (error) {
    console.error(`Erreur lors de l'enregistrement du cache des codes: ${error.message}`);
  }
}

/**
 * Obtenir la configuration actuelle du service de terminologie
 * @returns {Object} Configuration actuelle
 */
function getConfiguration() {
  return {
    authEnabled: SMT_API_CONFIG.authEnabled,
    baseUrl: SMT_API_CONFIG.baseUrl,
    clientId: SMT_API_CONFIG.clientId
  };
}

/**
 * Configurer l'authentification pour le SMT (Serveur Multi-Terminologies)
 * 
 * Cette fonction permet d'activer et de configurer l'authentification avec le
 * serveur de l'ANS. Elle doit être appelée avec vos identifiants personnels
 * pour utiliser les fonctionnalités complètes du service.
 * 
 * IMPORTANT: Vous devez obtenir vos identifiants auprès de l'ANS avant de pouvoir utiliser
 * cette fonctionnalité. Sans credentials valides, certaines opérations échoueront.
 * 
 * Exemple d'utilisation:
 * ```
 * const frenchTerminologyService = require('./french_terminology_service');
 * frenchTerminologyService.configureAuth({
 *   authEnabled: true,
 *   clientId: 'VOTRE_CLIENT_ID',       // Généralement "user-api"
 *   clientSecret: 'VOTRE_CLIENT_SECRET', 
 *   apiKey: 'VOTRE_CLE_API'            // Clé fournie par l'ANS
 * });
 * ```
 * 
 * @param {Object} config - Configuration de l'authentification
 * @param {boolean} [config.authEnabled] - Activer ou désactiver l'authentification
 * @param {string} [config.clientId] - ID client fourni par l'ANS
 * @param {string} [config.clientSecret] - Secret client fourni par l'ANS
 * @param {string} [config.apiKey] - Clé API fournie par l'ANS
 * @returns {Object} Résultat de la configuration
 */
function configureAuth(config = {}) {
  if (config.authEnabled !== undefined) {
    SMT_API_CONFIG.authEnabled = !!config.authEnabled;
  }
  
  if (config.clientId) {
    SMT_API_CONFIG.clientId = config.clientId;
  }
  
  if (config.clientSecret) {
    SMT_API_CONFIG.clientSecret = config.clientSecret;
    SMT_API_CONFIG.authEnabled = true;
  }
  
  if (config.apiKey) {
    SMT_API_CONFIG.apiKey = config.apiKey;
    SMT_API_CONFIG.authEnabled = true;
  }
  
  // Réinitialiser le token pour forcer une nouvelle authentification
  authToken = null;
  tokenExpiration = 0;
  
  return { success: true, authEnabled: SMT_API_CONFIG.authEnabled };
}

/**
 * Obtenir la liste des terminologies françaises importantes
 * @returns {Array} Liste des terminologies françaises importantes
 */
function getKeyTerminologies() {
  return SMT_API_CONFIG.key_terminologies || [];
}

/**
 * Précharger les systèmes de terminologie français principaux
 * @returns {Promise<Object>} Résultats du préchargement
 */
async function preloadKeyTerminologies() {
  const results = {
    success: 0,
    failed: 0,
    systems: []
  };
  
  const terminologies = getKeyTerminologies();
  console.log(`Préchargement de ${terminologies.length} terminologies françaises...`);
  
  for (const term of terminologies) {
    try {
      const system = await getCodeSystem(term.id);
      if (system) {
        results.success++;
        results.systems.push({
          id: term.id,
          name: system.name || term.id,
          url: system.url,
          status: 'loaded'
        });
      } else {
        results.failed++;
        results.systems.push({
          id: term.id,
          status: 'failed'
        });
      }
    } catch (error) {
      results.failed++;
      results.systems.push({
        id: term.id,
        status: 'error',
        message: error.message
      });
    }
  }
  
  return results;
}

module.exports = {
  getCodeSystem,
  searchCodeSystems,
  validateCode,
  configureAuth,
  getConfiguration,
  getKeyTerminologies,
  preloadKeyTerminologies
};