/**
 * FhirViewer component
 * Displays FHIR resource data in a formatted view
 */
function FhirViewer({ fhir }) {
  // DOM elements
  const viewerPlaceholder = document.getElementById('viewerPlaceholder');
  const jsonViewer = document.getElementById('jsonViewer');

  /**
   * Initialize the FhirViewer component
   */
  function init() {
    // Nothing to initialize
  }

  /**
   * Display FHIR resource
   * @param {Object} fhirData - FHIR resource data
   */
  function displayFhir(fhirData) {
    if (!fhirData) {
      showPlaceholder();
      return;
    }
    
    viewerPlaceholder.style.display = 'none';
    jsonViewer.style.display = 'block';
    
    // Format the JSON with syntax highlighting
    jsonViewer.innerHTML = formatJson(fhirData);
  }

  /**
   * Show placeholder when no FHIR data is available
   */
  function showPlaceholder() {
    viewerPlaceholder.style.display = 'block';
    jsonViewer.style.display = 'none';
    jsonViewer.innerHTML = '';
  }

  /**
   * Format JSON data with syntax highlighting
   * @param {Object} json - JSON data to format
   * @returns {string} HTML string with formatted JSON
   */
  function formatJson(json) {
    const jsonString = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
    
    // Simple syntax highlighting
    return jsonString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'key';
          } else {
            cls = 'string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'boolean';
        } else if (/null/.test(match)) {
          cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      })
      .replace(/\n/g, '<br>')
      .replace(/\s{2}/g, '&nbsp;&nbsp;');
  }

  return {
    init,
    displayFhir,
    showPlaceholder
  };
}