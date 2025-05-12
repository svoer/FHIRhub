/**
 * simple-charts-fixed.js
 * Version simplifiée et robuste des graphiques du tableau de bord
 * Version corrigée sans références aux éléments supprimés
 */

// Stockage global des références aux instances de graphiques
const chartInstances = {};

// Fonction principale d'initialisation des graphiques
function initializeAllCharts() {
  console.log("Initialisation de tous les graphiques avec simple-charts-fixed.js");
  
  try {
    // Vérifier que Chart.js est bien chargé
    if (typeof Chart === 'undefined') {
      console.error("Chart.js n'est pas chargé. Impossible d'initialiser les graphiques.");
      return;
    }
    
    // Obtenir les éléments canvas qui existent réellement dans le HTML
    const canvases = {
      memoryChart: document.getElementById('memoryChart'),
      conversionTrendChart: document.getElementById('conversionTrendChart'),
      successRateChart: document.getElementById('successRateChart'),
      messageTypesChart: document.getElementById('messageTypesChart')
    };
    
    console.log("État des canvas:", {
      memory: canvases.memoryChart ? "OK" : "Manquant",
      conversionTrend: canvases.conversionTrendChart ? "OK" : "Manquant",
      successRate: canvases.successRateChart ? "OK" : "Manquant",
      messageTypes: canvases.messageTypesChart ? "OK" : "Manquant"
    });
    
    // Détruire tous les graphiques existants avant d'en créer de nouveaux
    Object.keys(canvases).forEach(canvasId => {
      const canvas = canvases[canvasId];
      if (canvas) {
        try {
          const existingChart = Chart.getChart(canvas);
          if (existingChart) {
            console.log(`Destruction du graphique existant: ${canvasId}`);
            existingChart.destroy();
          }
        } catch (e) {
          console.warn(`Erreur lors de la destruction du graphique ${canvasId}:`, e);
        }
      }
    });
    
    // Initialiser chaque graphique individuellement avec gestion des erreurs
    
    // Graphique de mémoire
    if (canvases.memoryChart) {
      try {
        initMemoryChart(canvases.memoryChart);
      } catch (e) {
        console.error("Erreur lors de la création du graphique mémoire:", e);
      }
    }
    
    // Graphique de tendance de conversion
    if (canvases.conversionTrendChart) {
      try {
        initConversionTrendChart(canvases.conversionTrendChart);
      } catch (e) {
        console.error("Erreur lors de la création du graphique de tendance de conversion:", e);
      }
    }
    
    // Graphique de taux de réussite
    if (canvases.successRateChart) {
      try {
        initSuccessRateChart(canvases.successRateChart);
      } catch (e) {
        console.error("Erreur lors de la création du graphique de taux de réussite:", e);
      }
    }
    
    // Graphique de types de messages
    if (canvases.messageTypesChart) {
      try {
        initMessageTypesChart(canvases.messageTypesChart);
      } catch (e) {
        console.error("Erreur lors de la création du graphique des types de messages:", e);
      }
    }
    
    // Récupérer les données initiales
    fetchAndUpdateCharts();
    
    // Configurer un intervalle pour mettre à jour les graphiques
    setInterval(fetchAndUpdateCharts, 10000);
    
    console.log("Initialisation des graphiques terminée avec succès");
    return true;
  } catch (error) {
    console.error("Erreur lors de l'initialisation des graphiques:", error);
    return false;
  }
}

// Configuration des couleurs (dégradé rouge-orange)
const chartColors = {
  redGradient: [
    'rgba(231, 76, 60, 0.7)',
    'rgba(241, 136, 5, 0.7)',
    'rgba(243, 156, 18, 0.7)',
    'rgba(246, 185, 59, 0.7)',
    'rgba(249, 231, 159, 0.7)'
  ],
  redGradientBorders: [
    'rgba(231, 76, 60, 1)',
    'rgba(241, 136, 5, 1)',
    'rgba(243, 156, 18, 1)',
    'rgba(246, 185, 59, 1)',
    'rgba(249, 231, 159, 1)'
  ],
  success: {
    background: 'rgba(46, 204, 113, 0.2)',
    border: 'rgba(46, 204, 113, 1)'
  },
  error: {
    background: 'rgba(231, 76, 60, 0.2)',
    border: 'rgba(231, 76, 60, 1)'
  }
};

// Élément spinner pour l'animation de chargement
let refreshSpinner = null;

// Fonction pour montrer l'animation de chargement
function showLoadingAnimation() {
  // Si l'animation existe déjà, ne pas la recréer
  if (refreshSpinner) return;
  
  // Créer l'élément d'animation s'il n'existe pas
  refreshSpinner = document.createElement('div');
  refreshSpinner.className = 'refresh-spinner';
  refreshSpinner.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 6px solid #f3f3f3;
    border-top: 6px solid #e74c3c;
    border-bottom: 6px solid #f39c12;
    animation: spin 1s linear infinite;
    z-index: 9999;
    box-shadow: 0 0 20px rgba(0,0,0,0.2);
    background-color: white;
  `;
  
  // Ajouter un style pour l'animation
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    @keyframes spin {
      0% { transform: translate(-50%, -50%) rotate(0deg); }
      100% { transform: translate(-50%, -50%) rotate(360deg); }
    }
  `;
  document.head.appendChild(styleElement);
  
  // Ajouter l'animation au document
  document.body.appendChild(refreshSpinner);
}

// Fonction pour cacher l'animation de chargement
function hideLoadingAnimation() {
  if (refreshSpinner) {
    document.body.removeChild(refreshSpinner);
    refreshSpinner = null;
  }
}

// Fonction pour récupérer et mettre à jour tous les graphiques
function fetchAndUpdateCharts(forceReset = false) {
  console.log("Récupération des données pour les graphiques...");
  
  // Montrer l'animation de chargement
  showLoadingAnimation();
  
  // Si reset est demandé, afficher une notification
  if (forceReset) {
    console.log("Réinitialisation des statistiques demandée");
    alert("Réinitialisation des statistiques en cours...");
  }
  
  // Ajouter un timestamp pour éviter la mise en cache
  const timestamp = new Date().getTime();
  
  // Récupérer les statistiques générales avec le paramètre reset si nécessaire
  fetch('/api/stats' + (forceReset ? '?reset=true' : '') + `&t=${timestamp}`)
    .then(response => response.json())
    .then(data => {
      if (data.success === false) {
        console.error("Erreur lors de la récupération des statistiques:", data.error);
        hideLoadingAnimation();
        return;
      }
      
      const statsData = data.data || data;
      console.log("Données reçues pour les graphiques:", statsData);
      
      // Si réinitialisation réussie, afficher une notification
      if (forceReset) {
        hideLoadingAnimation();
        alert("Statistiques réinitialisées avec succès!");
        // Également réinitialiser les graphiques localement
        Object.keys(chartInstances).forEach(key => {
          if (chartInstances[key]) {
            chartInstances[key].data.datasets[0].data = Array(chartInstances[key].data.datasets[0].data.length).fill(0);
            chartInstances[key].update();
          }
        });
      }
      
      // Mettre à jour les timestamps
      updateTimestamps(statsData.timestamp);
      
      // Mettre à jour le nombre d'heures économisées
      if (statsData.timeSavedHours !== undefined) {
        console.log("Temps gagné en heures:", statsData.timeSavedHours);
        const timeSavedElement = document.getElementById('timeSavedHours');
        if (timeSavedElement) {
          timeSavedElement.textContent = statsData.timeSavedHours.toFixed(1);
        }
      }
      
      console.log("Données fraîches reçues via fetchStats modifié:", statsData);
      
      // Mettre à jour les compteurs du tableau de bord
      updateDashboardCounters(statsData);
      
      // Mettre à jour les métriques principales
      updateTopMetrics(statsData);
      
      // Mettre à jour les graphiques individuels
      updateAllCharts(statsData);
    })
    .catch(error => {
      console.error("Erreur lors de la récupération des statistiques:", error);
    });
  
  // Récupérer les types de messages HL7
  fetch('/api/message-types')
    .then(response => response.json())
    .then(data => {
      if (data.success === false) {
        console.error("Erreur lors de la récupération des types de messages:", data.error);
        return;
      }
      
      const messageData = data.data || data;
      console.log("Données de types de messages HL7 reçues:", messageData);
      
      // Mettre à jour le graphique des types de messages
      updateMessageTypesChart(messageData);
    })
    .catch(error => {
      console.error("Erreur lors de la récupération des types de messages:", error);
    });
}

// Mettre à jour les compteurs du tableau de bord
function updateDashboardCounters(data) {
  const conversionsCount = document.getElementById('conversionsCount');
  const applicationsCount = document.getElementById('applicationsCount');
  const apiKeysCount = document.getElementById('apiKeysCount');
  
  if (conversionsCount) {
    conversionsCount.textContent = data.conversions || 0;
  }
  
  if (applicationsCount && data.applicationStats) {
    applicationsCount.textContent = data.applicationStats.length || 0;
  }
  
  // Récupérer le nombre de clés API séparément
  if (apiKeysCount) {
    // Si reset a été demandé, mettre à 0
    if (data.conversions === 0 && data.conversionStats && data.conversionStats.avgTime === 0) {
      apiKeysCount.textContent = "0";
    } else {
      // Sinon, faire une requête séparée pour les clés API
      fetch('/api/api-keys/count')
        .then(response => response.json())
        .then(apiData => {
          if (apiData.success === false) {
            console.error("Erreur lors de la récupération du nombre de clés API:", apiData.error);
            return;
          }
          
          // Mettre à jour le compteur de clés API
          const count = apiData.count || 0;
          apiKeysCount.textContent = count;
        })
        .catch(error => {
          console.error("Erreur lors de la récupération du nombre de clés API:", error);
          // En cas d'erreur, afficher une valeur par défaut
          apiKeysCount.textContent = "?";
        });
    }
  }
}

// Mettre à jour les métriques principales
function updateTopMetrics(data) {
  if (!data.conversionStats) return;
  
  const avgConversionTime = document.getElementById('avg-conversion-time');
  const lastConversionTime = document.getElementById('last-conversion-time');
  const minmaxConversionTime = document.getElementById('minmax-conversion-time');
  const avgResources = document.getElementById('avg-resources');
  
  if (avgConversionTime) {
    avgConversionTime.textContent = `${Math.round(data.conversionStats.avgTime)} ms`;
  }
  
  if (lastConversionTime) {
    lastConversionTime.textContent = `${data.conversionStats.lastTime} ms`;
  }
  
  if (minmaxConversionTime) {
    minmaxConversionTime.textContent = `${data.conversionStats.minTime} / ${data.conversionStats.maxTime} ms`;
  }
  
  if (avgResources) {
    avgResources.textContent = Math.round(data.conversionStats.avgResources);
  }
}

// Mettre à jour les timestamps
function updateTimestamps(timestamp) {
  const statsUpdateTime = document.getElementById('statsUpdateTime');
  
  if (statsUpdateTime && timestamp) {
    const date = new Date(timestamp);
    statsUpdateTime.textContent = date.toLocaleTimeString();
  }
}

// Mettre à jour tous les graphiques avec les nouvelles données
function updateAllCharts(statsData) {
  console.log("Mise à jour de tous les graphiques avec les données fraîches:", statsData);
  
  // Mise à jour du graphique de mémoire
  if (chartInstances.memoryChart) {
    updateMemoryChart(statsData.memory);
  }
  
  // Mise à jour du graphique de tendance de conversion
  if (chartInstances.conversionTrendChart && statsData.conversionStats) {
    updateConversionTrendChart(statsData.conversionStats.lastTime);
  }
  
  // Mise à jour du graphique de taux de réussite
  if (chartInstances.successRateChart) {
    // Dans cette version, nous utilisons le nombre de conversions comme valeur par défaut
    // puisque nous n'avons pas accès aux données de réussite/échec
    const successCount = statsData.conversions || 0;
    const errorCount = 0; // Par défaut, on considère qu'il n'y a pas d'erreurs
    
    updateSuccessRateChart(successCount, errorCount);
  }
}

// Initialiser et mettre à jour le graphique de mémoire
function initMemoryChart(canvas) {
  const ctx = canvas.getContext('2d');
  
  chartInstances.memoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Heap Total', 'Heap Used', 'External', 'RSS'],
      datasets: [{
        label: 'Mémoire (MB)',
        data: [0, 0, 0, 0],
        backgroundColor: chartColors.redGradient,
        borderColor: chartColors.redGradientBorders,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + ' MB';
            }
          }
        }
      }
    }
  });
}

function updateMemoryChart(memoryData) {
  if (!chartInstances.memoryChart || !memoryData) return;
  
  const chart = chartInstances.memoryChart;
  const mbFactor = 1024 * 1024;
  
  const memoryValues = [
    memoryData.heapTotal ? Math.round(memoryData.heapTotal / mbFactor * 10) / 10 : 0,
    memoryData.heapUsed ? Math.round(memoryData.heapUsed / mbFactor * 10) / 10 : 0,
    memoryData.external ? Math.round(memoryData.external / mbFactor * 10) / 10 : 0,
    memoryData.rss ? Math.round(memoryData.rss / mbFactor * 10) / 10 : 0
  ];
  
  chart.data.datasets[0].data = memoryValues;
  chart.update();
}

// Initialiser et mettre à jour le graphique de tendance de conversion
function initConversionTrendChart(canvas) {
  const ctx = canvas.getContext('2d');
  
  chartInstances.conversionTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(10).fill(''),
      datasets: [{
        label: 'Temps (ms)',
        data: Array(10).fill(0),
        borderColor: chartColors.redGradientBorders[0],
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function updateConversionTrendChart(lastConversionTime) {
  if (!chartInstances.conversionTrendChart) return;
  
  const chart = chartInstances.conversionTrendChart;
  
  // Ajouter les nouvelles données à la fin et supprimer l'élément le plus ancien
  chart.data.datasets[0].data.push(lastConversionTime);
  chart.data.datasets[0].data.shift();
  
  // Garder les labels vides
  chart.data.labels = Array(10).fill('');
  
  console.log("Recréation du graphique de tendance avec valeur réelle:", lastConversionTime);
  chart.update();
}

// Initialiser et mettre à jour le graphique de taux de réussite
function initSuccessRateChart(canvas) {
  const ctx = canvas.getContext('2d');
  
  chartInstances.successRateChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Réussies', 'Échouées'],
      datasets: [{
        data: [0, 0],
        backgroundColor: [
          chartColors.success.background,
          chartColors.error.background
        ],
        borderColor: [
          chartColors.success.border,
          chartColors.error.border
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
  
  // Masquer le message "Aucune donnée disponible" puisque le graphique est initialisé
  const noDataElement = document.getElementById('successRateNoData');
  if (noDataElement) {
    noDataElement.style.display = 'none';
  }
}

function updateSuccessRateChart(successCount, errorCount) {
  if (!chartInstances.successRateChart) return;
  
  const chart = chartInstances.successRateChart;
  
  if (successCount === 0 && errorCount === 0) {
    // S'il n'y a pas de données, on utilise le nombre de conversions comme valeur par défaut pour le succès
    const conversionCount = document.getElementById('conversionsCount');
    if (conversionCount) {
      const count = parseInt(conversionCount.textContent) || 0;
      console.log("Utilisation du nombre de conversions (" + count + ") comme taux de réussite par défaut");
      successCount = count;
    }
  }
  
  chart.data.datasets[0].data = [successCount, errorCount];
  chart.update();
}

// Initialiser et mettre à jour le graphique des types de messages
function initMessageTypesChart(canvas) {
  const ctx = canvas.getContext('2d');
  
  chartInstances.messageTypesChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: chartColors.redGradient,
        borderColor: chartColors.redGradientBorders,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
  
  // Masquer le message "Aucune donnée disponible" puisque le graphique est initialisé
  const noDataElement = document.getElementById('messageTypesNoData');
  if (noDataElement) {
    noDataElement.style.display = 'none';
  }
}

function updateMessageTypesChart(messageData) {
  if (!chartInstances.messageTypesChart) return;
  
  const chart = chartInstances.messageTypesChart;
  
  if (!messageData || !messageData.length) {
    return;
  }
  
  const labels = messageData.map(item => item.message_type);
  const data = messageData.map(item => item.count);
  
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  
  // Assurer que nous avons suffisamment de couleurs
  const numColors = Math.max(labels.length, chartColors.redGradient.length);
  const backgroundColors = [];
  const borderColors = [];
  
  for (let i = 0; i < numColors; i++) {
    const colorIndex = i % chartColors.redGradient.length;
    backgroundColors.push(chartColors.redGradient[colorIndex]);
    borderColors.push(chartColors.redGradientBorders[colorIndex]);
  }
  
  chart.data.datasets[0].backgroundColor = backgroundColors;
  chart.data.datasets[0].borderColor = borderColors;
  
  console.log("Graphique des types de messages HL7 mis à jour avec les données réelles");
  chart.update();
}

// Écouter les boutons d'action
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM chargé, initialisation des boutons et graphiques...");
  
  // Bouton de rafraîchissement (vert)
  const refreshBtn = document.getElementById('refreshStatsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      console.log("Rafraîchissement des statistiques...");
      fetchAndUpdateCharts(false);
    });
  }
  
  // Bouton de réinitialisation (rouge)
  const resetBtn = document.getElementById('resetStatsBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      if (confirm("Êtes-vous sûr de vouloir réinitialiser toutes les statistiques? Cette action est irréversible.")) {
        console.log("Réinitialisation des statistiques...");
        fetchAndUpdateCharts(true);
      }
    });
  }
  
  // Initialiser les graphiques au chargement de la page
  // Attendre que Chart.js soit chargé
  if (typeof Chart !== 'undefined') {
    initializeAllCharts();
  } else {
    console.error("Chart.js n'est pas chargé, attente...");
    
    // Vérifier périodiquement si Chart.js est chargé
    const checkChartJs = setInterval(function() {
      if (typeof Chart !== 'undefined') {
        clearInterval(checkChartJs);
        console.log("Chart.js chargé, initialisation des graphiques...");
        initializeAllCharts();
      }
    }, 100);
  }
});