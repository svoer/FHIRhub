/**
 * Dashboard component
 * Displays conversion statistics
 */
function Dashboard({ apiKey, stats, setStats }) {
  // DOM elements
  const statsLoading = document.getElementById('statsLoading');
  const statsContent = document.getElementById('statsContent');
  const refreshStatsBtn = document.getElementById('refreshStats');
  
  // Stat display elements
  const totalConversionsEl = document.getElementById('totalConversions');
  const successfulConversionsEl = document.getElementById('successfulConversions');
  const failedConversionsEl = document.getElementById('failedConversions');
  const successRateEl = document.getElementById('successRate');
  const conversionsLast24HoursEl = document.getElementById('conversionsLast24Hours');

  /**
   * Initialize the Dashboard component
   */
  function init() {
    refreshStatsBtn.addEventListener('click', refreshStats);
    refreshStats();
  }

  /**
   * Fetch and update statistics
   */
  async function refreshStats() {
    statsLoading.style.display = 'block';
    statsContent.style.display = 'none';
    
    try {
      const response = await getStats(apiKey);
      if (response.success && response.data) {
        updateStats(response.data);
        setStats(response.data);
      } else {
        console.error('Failed to fetch statistics', response);
        showError('Failed to fetch statistics');
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      showError(`Error: ${error.message}`);
    } finally {
      statsLoading.style.display = 'none';
      statsContent.style.display = 'block';
    }
  }

  /**
   * Update statistics display
   * @param {Object} data - Statistics data
   */
  function updateStats(data) {
    totalConversionsEl.textContent = data.totalConversions;
    successfulConversionsEl.textContent = data.successfulConversions;
    failedConversionsEl.textContent = data.failedConversions;
    successRateEl.textContent = `${data.successRate}%`;
    conversionsLast24HoursEl.textContent = data.conversionsLast24Hours;
  }

  /**
   * Display error message
   * @param {string} message - Error message
   */
  function showError(message) {
    totalConversionsEl.textContent = '?';
    successfulConversionsEl.textContent = '?';
    failedConversionsEl.textContent = '?';
    successRateEl.textContent = '?';
    conversionsLast24HoursEl.textContent = '?';
    
    // Optionally add a toast/alert for error notification
    console.error(message);
  }

  return {
    init,
    refreshStats
  };
}