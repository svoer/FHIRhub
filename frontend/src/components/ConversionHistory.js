/**
 * ConversionHistory component
 * Displays history of HL7 to FHIR conversions
 */
function ConversionHistory({ apiKey, onViewFhir }) {
  // DOM elements
  const historyLoading = document.getElementById('historyLoading');
  const historyContent = document.getElementById('historyContent');
  const conversionList = document.getElementById('conversionList');
  const noConversions = document.getElementById('noConversions');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

  // Pagination state
  let currentOffset = 0;
  const pageSize = 10;
  let hasMore = true;

  /**
   * Initialize the ConversionHistory component
   */
  function init() {
    loadMoreBtn.addEventListener('click', loadMore);
    refreshHistoryBtn.addEventListener('click', refreshHistory);
    
    // Load initial data
    loadConversions(0);
  }

  /**
   * Load more conversions
   */
  function loadMore() {
    if (hasMore) {
      currentOffset += pageSize;
      loadConversions(currentOffset);
    }
  }

  /**
   * Refresh conversion history
   */
  function refreshHistory() {
    // Reset pagination
    currentOffset = 0;
    hasMore = true;
    
    // Clear current list
    conversionList.innerHTML = '';
    
    // Load from beginning
    loadConversions(0);
  }

  /**
   * Load conversions from API
   * @param {number} offset - Pagination offset
   */
  async function loadConversions(offset) {
    // Show loading state
    if (offset === 0) {
      historyLoading.style.display = 'block';
      historyContent.style.display = 'none';
    }
    
    try {
      const response = await getConversions(apiKey, pageSize, offset);
      
      if (response.success && response.data) {
        // Update UI based on data
        renderConversions(response.data, offset === 0);
        
        // Update pagination state
        hasMore = response.data.length === pageSize;
        loadMoreBtn.disabled = !hasMore;
      } else {
        console.error('Failed to fetch conversion history', response);
        showError('Failed to fetch conversion history');
      }
    } catch (error) {
      console.error('Error fetching conversion history:', error);
      showError(`Error: ${error.message}`);
    } finally {
      historyLoading.style.display = 'none';
      historyContent.style.display = 'block';
    }
  }

  /**
   * Render conversions in the list
   * @param {Array} conversions - Array of conversion objects
   * @param {boolean} clearExisting - Whether to clear existing list items
   */
  function renderConversions(conversions, clearExisting = false) {
    if (clearExisting) {
      conversionList.innerHTML = '';
    }
    
    if (conversions.length === 0) {
      if (clearExisting) {
        noConversions.style.display = 'block';
      }
      return;
    }
    
    noConversions.style.display = 'none';
    
    conversions.forEach(conversion => {
      const item = document.createElement('div');
      item.className = `conversion-item ${conversion.success ? 'success-item' : 'failed-item'}`;
      item.dataset.id = conversion.id;
      item.dataset.outputFile = conversion.outputFile;
      
      const date = new Date(conversion.timestamp);
      const formattedDate = date.toLocaleString();
      
      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong>${conversion.inputFile}</strong>
            <span class="badge ${conversion.success ? 'bg-success' : 'bg-danger'} ms-2">
              ${conversion.success ? 'Success' : 'Failed'}
            </span>
            <div class="small text-muted mt-1">${formattedDate}</div>
          </div>
          <div>
            ${conversion.success ? 
              `<button class="btn btn-sm btn-outline-primary view-btn">View FHIR</button>` : 
              `<span class="text-danger">${conversion.message}</span>`
            }
          </div>
        </div>
      `;
      
      if (conversion.success) {
        const viewBtn = item.querySelector('.view-btn');
        viewBtn.addEventListener('click', () => {
          handleViewFhir(conversion);
        });
      }
      
      conversionList.appendChild(item);
    });
  }

  /**
   * Handle view FHIR button click
   * @param {Object} conversion - Conversion data object
   */
  function handleViewFhir(conversion) {
    if (!conversion.outputFile) {
      console.error('No output file available for this conversion');
      return;
    }
    
    if (onViewFhir && typeof onViewFhir === 'function') {
      onViewFhir(conversion.outputFile, conversion.id);
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  function showError(message) {
    // Optionally add a toast/alert for error notification
    console.error(message);
  }

  return {
    init,
    refreshHistory
  };
}