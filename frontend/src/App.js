/**
 * Main application entry point
 * Initializes and coordinates all components
 */
document.addEventListener('DOMContentLoaded', function() {
  // App state
  let apiKey = localStorage.getItem('apiKey') || 'demo-api-key';
  let currentStats = {};
  
  // Initialize API key field
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  
  apiKeyInput.value = apiKey;
  
  saveApiKeyBtn.addEventListener('click', function() {
    apiKey = apiKeyInput.value.trim();
    localStorage.setItem('apiKey', apiKey);
    refreshAllComponents();
  });
  
  // Initialize components
  const dashboard = Dashboard({
    apiKey,
    stats: currentStats,
    setStats: (stats) => {
      currentStats = stats;
    }
  });
  
  const fhirViewer = FhirViewer({});
  
  const conversionHistory = ConversionHistory({
    apiKey,
    onViewFhir: handleViewFhir
  });
  
  const fileUpload = FileUpload({
    apiKey,
    onConversionComplete: handleConversionComplete
  });
  
  // Initialize all components
  dashboard.init();
  fhirViewer.init();
  conversionHistory.init();
  fileUpload.init();
  
  // Set up tab handling
  document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
    tab.addEventListener('shown.bs.tab', handleTabChange);
  });
  
  /**
   * Handle tab change event
   * @param {Event} event - Tab change event
   */
  function handleTabChange(event) {
    const tabId = event.target.id;
    
    // Perform actions based on selected tab
    if (tabId === 'dashboard-tab') {
      dashboard.refreshStats();
    } else if (tabId === 'history-tab') {
      conversionHistory.refreshHistory();
    } else if (tabId === 'viewer-tab') {
      // Nothing to do here, wait for user to select a conversion
    }
  }
  
  /**
   * Handle viewing FHIR resource
   * @param {string} filename - FHIR resource filename
   * @param {string} conversionId - Conversion ID
   */
  async function handleViewFhir(filename, conversionId) {
    try {
      // Show the viewer tab
      document.getElementById('viewer-tab').click();
      
      // Display loading state
      fhirViewer.showPlaceholder();
      document.getElementById('viewerPlaceholder').innerHTML = 
        '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading FHIR resource...</p></div>';
      
      // Fetch FHIR resource
      const response = await getFhirResource(apiKey, filename);
      
      if (response.success && response.data) {
        fhirViewer.displayFhir(response.data);
      } else {
        document.getElementById('viewerPlaceholder').innerHTML = 
          '<div class="alert alert-danger">Failed to load FHIR resource</div>';
      }
    } catch (error) {
      console.error('Error fetching FHIR resource:', error);
      document.getElementById('viewerPlaceholder').innerHTML = 
        `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }
  
  /**
   * Handle conversion completion
   * @param {Object} fhirData - FHIR resource data
   * @param {Object} meta - Conversion metadata
   */
  function handleConversionComplete(fhirData, meta) {
    // Display the converted FHIR data
    document.getElementById('viewer-tab').click();
    fhirViewer.displayFhir(fhirData);
    
    // Refresh other components
    dashboard.refreshStats();
    conversionHistory.refreshHistory();
  }
  
  /**
   * Refresh all components when API key changes
   */
  function refreshAllComponents() {
    dashboard.refreshStats();
    conversionHistory.refreshHistory();
    fhirViewer.showPlaceholder();
  }
});