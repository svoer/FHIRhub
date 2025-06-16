/**
 * API service for communicating with the FHIRHub backend
 */

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint path
 * @param {string} apiKey - API key for authentication
 * @param {Object} options - Fetch options
 * @returns {Promise} Response data
 */
async function apiRequest(endpoint, apiKey, options = {}) {
  // URL correctement formatée avec le préfixe /api/
  const url = endpoint.startsWith('/') 
    ? `/api${endpoint}` 
    : `/api/${endpoint}`;
  
  // Assurer que les en-têtes sont initialisés
  options.headers = options.headers || {};
  
  // Ajouter l'API key aux en-têtes
  options.headers['X-API-Key'] = apiKey;
  
  // Ajouter l'API key comme paramètre de requête pour compatibilité
  const separator = url.includes('?') ? '&' : '?';
  const urlWithKey = `${url}${separator}apiKey=${encodeURIComponent(apiKey)}`;
  
  try {
    const response = await fetch(urlWithKey, options);
    
    if (!response.ok) {
      console.error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      
      // Tenter de lire le corps de la réponse
      const errorText = await response.text();
      console.error('Réponse détaillée:', errorText.substring(0, 200) + '...');
      
      try {
        // Essayer de parser la réponse comme JSON
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || errorData.error || `Erreur HTTP: ${response.status}`);
      } catch (parseError) {
        // Si on ne peut pas parser comme JSON, utiliser le texte brut
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }
    }
    
    // Vérifier si la réponse est du JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    } else {
      // Convertir en texte si ce n'est pas du JSON
      const text = await response.text();
      console.warn('Réponse non-JSON reçue:', text.substring(0, 100) + '...');
      
      // Essayer de parser comme JSON au cas où
      try {
        return JSON.parse(text);
      } catch (e) {
        // Retourner un objet formaté si ce n'est pas du JSON
        return { 
          status: 'ok', 
          data: text, 
          meta: { 
            contentType: contentType || 'text/plain' 
          }
        };
      }
    }
  } catch (error) {
    console.error(`API request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get conversion statistics
 * @param {string} apiKey - API key for authentication
 * @returns {Promise} Stats data
 */
async function getStats(apiKey) {
  return apiRequest('/stats', apiKey);
}

/**
 * Get conversion history
 * @param {string} apiKey - API key for authentication
 * @param {number} limit - Maximum number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise} Conversion history data
 */
async function getConversions(apiKey, limit = 100, offset = 0) {
  return apiRequest(`/conversions?limit=${limit}&offset=${offset}`, apiKey);
}

/**
 * Get a specific FHIR resource by filename
 * @param {string} apiKey - API key for authentication
 * @param {string} filename - FHIR file name
 * @returns {Promise} FHIR resource data
 */
async function getFhirResource(apiKey, filename) {
  return apiRequest(`/fhir/${filename}`, apiKey);
}

/**
 * Upload an HL7 file
 * @param {string} apiKey - API key for authentication
 * @param {File} file - File object to upload
 * @returns {Promise} Upload result
 */
async function uploadHl7File(apiKey, file) {
  const formData = new FormData();
  formData.append('file', file);
  
  return apiRequest('/upload', apiKey, {
    method: 'POST',
    body: formData
  });
}

/**
 * Convert HL7 message to FHIR
 * @param {string} apiKey - API key for authentication
 * @param {string} hl7 - HL7 message content
 * @param {string} filename - Original file name (optional)
 * @returns {Promise} Conversion result with FHIR data
 */
async function convertHl7(apiKey, hl7, filename = null) {
  return apiRequest('/convert', apiKey, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hl7,
      filename
    })
  });
}

/**
 * Get a specific conversion by ID
 * @param {string} apiKey - API key for authentication
 * @param {string} id - Conversion ID
 * @returns {Promise} Conversion data
 */
async function getConversionById(apiKey, id) {
  return apiRequest(`/conversions/${id}`, apiKey);
}