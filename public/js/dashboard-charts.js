/**
 * dashboard-charts-fixed.js
 * Version complètement reconstruite des graphiques du tableau de bord
 * Cette approche résout les problèmes d'affichage simultané des graphiques et des messages "Aucune donnée disponible"
 */

// Configuration globale des couleurs pour maintenir le dégradé rouge-orange
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
  successError: [
    'rgba(46, 204, 113, 0.7)',
    'rgba(231, 76, 60, 0.7)'
  ],
  successErrorBorders: [
    'rgba(46, 204, 113, 1)',
    'rgba(231, 76, 60, 1)'
  ],
  memory: {
    background: 'rgba(241, 136, 5, 0.2)',
    border: '#f18805'
  },
  conversion: {
    background: 'rgba(231, 76, 60, 0.2)',
    border: '#e74c3c'
  }
};

// Stockage des références aux instances de graphiques
window.charts = window.charts || {
  resourceDist: null,
  successRate: null,
  messageTypes: null,
  memoryUsage: null,
  conversionTrend: null
};

// Initialisation de tous les graphiques au chargement de la page
window.addEventListener('load', function() {
  console.log('Initialisation des graphiques du tableau de bord...');
  
  // Initialiser les graphiques statiques (mémoire, tendance de conversion)
  initMemoryChart();
  initConversionTrendChart();
  
  // Préparer les graphiques dynamiques avec des données minimales
  initResourceDistChart();
  initSuccessRateChart();
  initMessageTypesChart();
  
  // Configurer les mises à jour planifiées
  console.log('Configuration des mises à jour périodiques des graphiques...');
  
  // Forcer une mise à jour immédiate des graphiques pour récupérer les données
  setTimeout(function() {
    fetch('/api/stats')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log("Mise à jour initiale des graphiques avec données:", data.data);
          updateAllCharts(data.data);
        }
      })
      .catch(error => {
        console.error("Erreur lors de la mise à jour initiale des graphiques:", error);
      });
  }, 1000);
});

// Fonction pour mettre à jour tous les graphiques dynamiques avec les données actuelles
// Utilisation interne uniquement - la version exportée est window.updateAllCharts
function _updateAllChartsInternal(statsData) {
  if (!statsData) {
    console.warn('Données de statistiques non disponibles pour la mise à jour des graphiques');
    return;
  }
  
  console.log('Mise à jour de tous les graphiques avec les données fraîches:', statsData);
  
  const conversionStats = statsData.conversionStats || {};
  const conversions = statsData.conversions || 0;
  
  // Mettre à jour chaque graphique individuellement
  updateResourceDistChart(conversionStats, conversions);
  updateSuccessRateChart(conversionStats, conversions);
  updateMessageTypesChart(conversionStats, conversions);
  updateConversionTrendChart(conversionStats.lastTime || 250);
  
  // Mettre à jour les indicateurs de dernière mise à jour
  updateTimestamps();
}

// Mise à jour des horodatages
function updateTimestamps() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  
  const lastUpdateElement = document.getElementById('lastUpdateTime');
  if (lastUpdateElement) {
    lastUpdateElement.textContent = timeStr;
  }
  
  const statsUpdateElement = document.getElementById('statsUpdateTime');
  if (statsUpdateElement) {
    statsUpdateElement.textContent = timeStr;
  }
}

// Initialisation et gestion du graphique de distribution des ressources FHIR
function initResourceDistChart() {
  try {
    const ctx = document.getElementById('resourceDistChart');
    if (!ctx) {
      console.error('Canvas resourceDistChart non trouvé');
      return;
    }
    
    console.log('Initialisation du graphique resourceDist sur élément:', ctx);
    
    // Vérifier si le graphique existe déjà
    if (charts.resourceDist) {
      console.log('Destruction de l\'ancien graphique resourceDist');
      charts.resourceDist.destroy();
      charts.resourceDist = null;
    }
    
    // Créer un graphique vide
    charts.resourceDist = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Pas de données'],
        datasets: [{
          label: 'Distribution des ressources',
          data: [1],
          backgroundColor: ['rgba(200, 200, 200, 0.5)'],
          borderColor: ['rgba(200, 200, 200, 1)'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Pas de données disponibles';
              }
            }
          }
        }
      }
    });
    
    console.log('Graphique resourceDist initialisé avec succès:', charts.resourceDist);
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du graphique resourceDist:', error);
  }
  
  // Laisser le conteneur visible mais masquer le message de "Aucune donnée" par défaut
  const chartContainer = document.getElementById('resourceDistChartContainer');
  const noDataMessage = document.getElementById('resourceDistNoData');
  
  // S'assurer que le conteneur est visible et le message est caché
  if (chartContainer) chartContainer.style.display = 'block';
  if (noDataMessage) noDataMessage.style.display = 'none';
}

// Fonction améliorée pour la mise à jour du graphique de distribution des ressources FHIR
function updateResourceDistChart(conversionStats, conversions) {
  if (!charts.resourceDist) {
    console.warn('Graphique resourceDist non initialisé');
    return;
  }
  
  // Détruire l'ancien graphique
  charts.resourceDist.destroy();
  
  // Éléments DOM
  const chartContainer = document.getElementById('resourceDistChartContainer');
  const noDataMessage = document.getElementById('resourceDistNoData');
  const ctx = document.getElementById('resourceDistChart');
  
  // Si les statistiques réelles de distribution sont disponibles
  if (conversionStats && conversionStats.resourcesDistribution) {
    console.log("Utilisation des données réelles de distribution des ressources:", conversionStats.resourcesDistribution);
    const distributionData = [
      conversionStats.resourcesDistribution.single || 0,
      conversionStats.resourcesDistribution.two || 0,
      conversionStats.resourcesDistribution.three || 0,
      conversionStats.resourcesDistribution.fourToFive || 0,
      conversionStats.resourcesDistribution.sixPlus || 0
    ];
    
    // Vérifier si nous avons de vraies données ou seulement des zéros
    const hasRealData = distributionData.some(value => value > 0);
    
    if (hasRealData) {
      // Afficher le container du graphique et masquer le message
      if (chartContainer) chartContainer.style.display = 'block';
      if (noDataMessage) noDataMessage.style.display = 'none';
      
      // Création d'un nouveau graphique avec données réelles
      charts.resourceDist = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['1 ressource', '2 ressources', '3 ressources', '4-5 ressources', '6+ ressources'],
          datasets: [{
            label: 'Nombre de conversions',
            data: distributionData,
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
              position: 'top',
              labels: {
                font: {
                  size: 11
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.label}: ${context.raw} conversion(s)`;
                }
              }
            }
          }
        }
      });
    } else {
      createEmptyResourceChart();
    }
  } else {
    createEmptyResourceChart();
  }
  
  function createEmptyResourceChart() {
    console.log("Données de distribution détaillée non disponibles, affichage d'un message d'information");
    
    // Masquer le container du graphique et afficher le message
    if (chartContainer) chartContainer.style.display = 'none';
    if (noDataMessage) noDataMessage.style.display = 'flex';
    
    // Créer un graphique vide (invisible)
    charts.resourceDist = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [{
          label: '',
          data: [],
          backgroundColor: [],
          borderColor: [],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// Initialisation du graphique de taux de réussite
function initSuccessRateChart() {
  const ctx = document.getElementById('successRateChart');
  if (!ctx) {
    console.error('Canvas successRateChart non trouvé');
    return;
  }
  
  // Créer un graphique vide
  charts.successRate = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        label: '',
        data: [],
        backgroundColor: [],
        borderColor: [],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
  
  // Laisser le conteneur visible mais masquer le message de "Aucune donnée" par défaut
  const chartContainer = document.getElementById('successRateChartContainer');
  const noDataMessage = document.getElementById('successRateNoData');
  
  // S'assurer que le conteneur est visible et le message est caché
  if (chartContainer) chartContainer.style.display = 'block';
  if (noDataMessage) noDataMessage.style.display = 'none';
}

// Fonction pour mettre à jour le graphique de taux de réussite
function updateSuccessRateChart(conversionStats, conversions) {
  if (!charts.successRate) {
    console.warn('Graphique successRate non initialisé');
    return;
  }
  
  // Détruire l'ancien graphique
  charts.successRate.destroy();
  
  // Éléments DOM
  const chartContainer = document.getElementById('successRateChartContainer');
  const noDataMessage = document.getElementById('successRateNoData');
  const ctx = document.getElementById('successRateChart');
  
  // Si les statistiques réelles détaillées sont disponibles
  if (conversionStats && typeof conversionStats.successCount !== 'undefined') {
    const successfulCount = conversionStats.successCount;
    const errorCount = conversionStats.errorCount || 0;
    
    // Afficher le container du graphique et masquer le message
    if (chartContainer) chartContainer.style.display = 'block';
    if (noDataMessage) noDataMessage.style.display = 'none';
    
    // Créer un nouveau graphique avec les données réelles
    charts.successRate = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Réussi', 'Erreur'],
        datasets: [{
          label: 'Taux de réussite',
          data: [successfulCount, errorCount],
          backgroundColor: chartColors.successError,
          borderColor: chartColors.successErrorBorders,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = total > 0 ? Math.round(context.raw / total * 100) : 0;
                return `${context.label}: ${context.raw} (${percent}%)`;
              }
            }
          }
        }
      }
    });
    
    console.log("Données réelles taux de réussite:", { successfulCount, errorCount });
  } else {
    // Utiliser le nombre de conversions comme réussies si disponible
    let successfulCount = parseInt(conversions) || 0;
    let errorCount = 0;
    
    // Créer un nouveau graphique avec valeurs par défaut
    if (successfulCount > 0) {
      // Afficher le container du graphique et masquer le message
      if (chartContainer) chartContainer.style.display = 'block';
      if (noDataMessage) noDataMessage.style.display = 'none';
      
      console.log(`Utilisation du nombre de conversions (${successfulCount}) comme taux de réussite par défaut`);
      charts.successRate = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Réussi', 'Erreur'],
          datasets: [{
            label: 'Taux de réussite',
            data: [successfulCount, errorCount],
            backgroundColor: chartColors.successError,
            borderColor: chartColors.successErrorBorders,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: {
                  size: 11
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percent = total > 0 ? Math.round(context.raw / total * 100) : 0;
                  return `${context.label}: ${context.raw} (${percent}%)`;
                }
              }
            }
          }
        }
      });
    } else {
      createEmptySuccessRateChart();
    }
  }
  
  function createEmptySuccessRateChart() {
    console.log("Aucune donnée de taux de réussite disponible, affichage d'un message");
    
    // Masquer le container du graphique et afficher le message
    if (chartContainer) chartContainer.style.display = 'none';
    if (noDataMessage) noDataMessage.style.display = 'flex';
    
    // Créer un graphique vide (invisible)
    charts.successRate = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          label: '',
          data: [],
          backgroundColor: [],
          borderColor: [],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// Initialisation du graphique des types de messages HL7
function initMessageTypesChart() {
  const ctx = document.getElementById('messageTypesChart');
  if (!ctx) {
    console.error('Canvas messageTypesChart non trouvé');
    return;
  }
  
  // Créer un graphique vide
  charts.messageTypes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: '',
        data: [],
        backgroundColor: [],
        borderColor: [],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
  
  // Laisser le conteneur visible mais masquer le message de "Aucune donnée" par défaut
  const chartContainer = document.getElementById('messageTypesChartContainer');
  const noDataMessage = document.getElementById('messageTypesNoData');
  
  // S'assurer que le conteneur est visible et le message est caché
  if (chartContainer) chartContainer.style.display = 'block';
  if (noDataMessage) noDataMessage.style.display = 'none';
}

// Fonction pour mettre à jour le graphique des types de messages HL7
function updateMessageTypesChart(conversionStats, conversions) {
  if (!charts.messageTypes) {
    console.warn('Graphique messageTypes non initialisé');
    return;
  }
  
  // Détruire l'ancien graphique
  charts.messageTypes.destroy();
  
  // Éléments DOM
  const chartContainer = document.getElementById('messageTypesChartContainer');
  const noDataMessage = document.getElementById('messageTypesNoData');
  const ctx = document.getElementById('messageTypesChart');
  
  // Si les statistiques réelles sont disponibles
  if (conversionStats && conversionStats.messageTypesDistribution) {
    console.log("Utilisation des données réelles de distribution des types de messages:", conversionStats.messageTypesDistribution);
    
    const labels = [];
    const data = [];
    
    // Construire les données réelles
    if (conversionStats.messageTypesDistribution.ADT) {
      labels.push('ADT');
      data.push(conversionStats.messageTypesDistribution.ADT);
    }
    if (conversionStats.messageTypesDistribution.ORU) {
      labels.push('ORU');
      data.push(conversionStats.messageTypesDistribution.ORU);
    }
    if (conversionStats.messageTypesDistribution.ORM) {
      labels.push('ORM');
      data.push(conversionStats.messageTypesDistribution.ORM);
    }
    if (conversionStats.messageTypesDistribution.MDM) {
      labels.push('MDM');
      data.push(conversionStats.messageTypesDistribution.MDM);
    }
    if (conversionStats.messageTypesDistribution.other) {
      labels.push('Autres');
      data.push(conversionStats.messageTypesDistribution.other);
    }
    
    if (labels.length > 0 && data.some(value => value > 0)) {
      // Afficher le container du graphique et masquer le message
      if (chartContainer) chartContainer.style.display = 'block';
      if (noDataMessage) noDataMessage.style.display = 'none';
      
      // Création d'un nouveau graphique avec données réelles
      charts.messageTypes = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Types de messages',
            data: data,
            backgroundColor: chartColors.redGradient.slice(0, data.length),
            borderColor: chartColors.redGradientBorders.slice(0, data.length),
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
                precision: 0
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: {
                  size: 11
                }
              }
            }
          }
        }
      });
    } else {
      fetchMessageTypesData();
    }
  } else {
    fetchMessageTypesData();
  }
  
  // Fonction pour récupérer les types de messages depuis l'API
  function fetchMessageTypesData() {
    // Récupérer les données depuis l'API des types de messages HL7
    fetch('/api/message-types')
      .then(response => response.json())
      .then(messageTypesData => {
        console.log("Données de types de messages HL7 reçues:", messageTypesData);
        
        if (messageTypesData && messageTypesData.length > 0) {
          // Afficher le container du graphique et masquer le message
          if (chartContainer) chartContainer.style.display = 'block';
          if (noDataMessage) noDataMessage.style.display = 'none';
          
          const labels = messageTypesData.map(item => item.message_type);
          const data = messageTypesData.map(item => item.count);
          
          // Création du graphique avec les données réelles
          charts.messageTypes = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: 'Types de messages',
                data: data,
                backgroundColor: chartColors.redGradient.slice(0, data.length),
                borderColor: chartColors.redGradientBorders.slice(0, data.length),
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
                    precision: 0
                  }
                }
              },
              plugins: {
                legend: {
                  position: 'top',
                  labels: {
                    font: {
                      size: 11
                    }
                  }
                }
              }
            }
          });
          
          console.log("Graphique des types de messages HL7 mis à jour avec les données réelles");
        } else {
          createEmptyMessageTypesChart();
        }
      })
      .catch(error => {
        console.error("Erreur lors de la récupération des types de messages:", error);
        createEmptyMessageTypesChart();
      });
  }
  
  // Fonction pour créer un graphique vide et afficher le message
  function createEmptyMessageTypesChart() {
    // Masquer le container du graphique et afficher le message
    if (chartContainer) chartContainer.style.display = 'none';
    if (noDataMessage) noDataMessage.style.display = 'flex';
    
    // Créer un graphique vide (invisible)
    charts.messageTypes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: '',
          data: [],
          backgroundColor: [],
          borderColor: [],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// Initialisation et gestion du graphique d'utilisation de la mémoire
function initMemoryChart() {
  const ctx = document.getElementById('memoryChart');
  if (!ctx) {
    console.error('Canvas memoryChart non trouvé');
    return;
  }
  
  // Création de données initiales minimales pour le graphique de mémoire
  const initialData = {
    labels: Array(10).fill(''),
    datasets: [{
      label: 'Utilisation mémoire (MB)',
      data: Array(10).fill(0),
      borderColor: chartColors.memory.border,
      backgroundColor: chartColors.memory.background,
      borderWidth: 1,
      tension: 0.4,
      fill: true
    }]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'MB'
        }
      },
      x: {
        display: false
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };
  
  charts.memoryUsage = new Chart(ctx, {
    type: 'line',
    data: initialData,
    options: options
  });
}

// Fonction pour mettre à jour le graphique d'utilisation de la mémoire
function updateMemoryChart(memoryData) {
  if (!charts.memoryUsage) {
    console.warn('Graphique memoryUsage non initialisé');
    // Essayer d'initialiser le graphique
    console.log('Tentative d\'initialisation du graphique mémoire...');
    initMemoryChart();
    return;
  }
  
  if (!memoryData || typeof memoryData.rss === 'undefined') {
    return;
  }
  
  // Conversion de bytes à MB pour une meilleure lisibilité
  const memoryMB = Math.round(memoryData.rss / (1024 * 1024));
  
  // Récupérer les anciennes données
  const oldData = [...charts.memoryUsage.data.datasets[0].data];
  
  // Mettre à jour les données (ajouter la nouvelle valeur et retirer la plus ancienne)
  oldData.push(memoryMB);
  if (oldData.length > 10) {
    oldData.shift();
  }
  
  // Mise à jour du graphique
  charts.memoryUsage.data.datasets[0].data = oldData;
  charts.memoryUsage.update();
}

// Initialisation et gestion du graphique de tendance des conversions
function initConversionTrendChart() {
  const ctx = document.getElementById('conversionTrendChart');
  if (!ctx) {
    console.error('Canvas conversionTrendChart non trouvé');
    return;
  }
  
  // Création de données initiales minimales
  const initialData = {
    labels: Array(10).fill(''),
    datasets: [{
      label: 'Temps de traitement (ms)',
      data: Array(10).fill(0),
      borderColor: chartColors.conversion.border,
      backgroundColor: chartColors.conversion.background,
      borderWidth: 1,
      tension: 0.4,
      fill: true
    }]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'ms'
        }
      },
      x: {
        display: false
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };
  
  charts.conversionTrend = new Chart(ctx, {
    type: 'line',
    data: initialData,
    options: options
  });
}

// Fonction pour mettre à jour le graphique de tendance des conversions
function updateConversionTrendChart(lastConversionTime) {
  if (!charts.conversionTrend) {
    console.warn('Graphique conversionTrend non initialisé');
    console.log('Tentative d\'initialisation du graphique de tendance de conversion...');
    initConversionTrendChart();
    return;
  }
  
  console.log("Recréation du graphique de tendance avec valeur réelle:", lastConversionTime);
  
  // Récupérer les anciennes données
  const oldData = [...charts.conversionTrend.data.datasets[0].data];
  
  // Ajouter la nouvelle valeur et retirer la plus ancienne
  oldData.push(lastConversionTime);
  if (oldData.length > 10) {
    oldData.shift();
  }
  
  // Mettre à jour les données du graphique
  charts.conversionTrend.data.datasets[0].data = oldData;
  
  // Actualisation du graphique
  charts.conversionTrend.update();
}

// Fonction centrale de mise à jour de tous les graphiques
// Fonctions globales exportées pour être utilisées depuis l'extérieur
// Ces fonctions sont appelées par le code en dehors de ce fichier, elles doivent rester disponibles
window.updateAllCharts = function(statsData) {
  console.log("Mise à jour de tous les graphiques avec les données fraîches:", statsData);
  
  // Mise à jour du graphique de distribution des ressources FHIR
  updateResourceDistChart(statsData.conversionStats, statsData.conversions);
  
  // Mise à jour du graphique de taux de réussite
  updateSuccessRateChart(statsData.conversionStats, statsData.conversions);
  
  // Mise à jour du graphique des types de messages HL7
  updateMessageTypesChart(statsData.conversionStats, statsData.conversions);
  
  // Mise à jour du graphique d'utilisation mémoire
  if (statsData.memory) {
    updateMemoryChart(statsData.memory);
  }
  
  // Mise à jour du graphique de tendances de conversion
  if (statsData.conversionStats && statsData.conversionStats.lastTime) {
    updateConversionTrendChart(statsData.conversionStats.lastTime);
  }
};

// Fonction pour réinitialiser tous les graphiques
window.resetAllCharts = function() {
  console.log("Réinitialisation de tous les graphiques...");
  
  // S'assurer que charts est accessible
  if (!window.charts) {
    console.warn("Objet charts non disponible pour la réinitialisation");
    return;
  }
  
  // Approche 1: Détruire et recréer tous les graphiques
  try {
    // Détruire les graphiques existants s'ils existent
    Object.keys(window.charts).forEach(key => {
      const chart = window.charts[key];
      if (chart && typeof chart.destroy === 'function') {
        console.log(`Destruction du graphique ${key}`);
        chart.destroy();
        window.charts[key] = null;
      }
    });
    
    console.log("Tous les graphiques ont été réinitialisés avec succès");
    
    // Re-initialiser les graphiques si nécessaire
    setTimeout(() => {
      if (typeof initializeAllCharts === 'function') {
        initializeAllCharts();
      }
    }, 500);
    
    return true;
  } catch (error) {
    console.error("Erreur lors de la réinitialisation des graphiques:", error);
    return false;
  }
}

// Fonction globale pour initialiser tous les graphiques
window.initializeAllCharts = function() {
  console.log("Initialisation de tous les graphiques depuis dashboard-charts.js");
  
  // Vérifier si les éléments canvas existent
  const initializeChart = (canvasId, chartType, config, chartKey) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn(`Canvas ${canvasId} non trouvé, graphique ${chartKey} non initialisé`);
      return false;
    }
    
    try {
      // Détruire le graphique existant s'il existe
      if (window.charts[chartKey] && typeof window.charts[chartKey].destroy === 'function') {
        window.charts[chartKey].destroy();
      }
      
      // Créer un nouveau graphique
      window.charts[chartKey] = new Chart(canvas, {
        type: chartType,
        data: config.data || {},
        options: config.options || {}
      });
      
      console.log(`Graphique ${chartKey} initialisé avec succès`);
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'initialisation du graphique ${chartKey}:`, error);
      return false;
    }
  };
  
  // Initialiser chaque graphique individuellement avec des configurations par défaut
  // Si nécessaire, ces configurations peuvent être ajustées selon les besoins
  
  const initializedCharts = {
    resourceDist: initializeChart('resourceDistributionChart', 'doughnut', {
      data: {
        labels: ['Patient', 'Observation', 'Condition', 'Autre'],
        datasets: [{
          data: [0, 0, 0, 0],
          backgroundColor: chartColors.redGradient,
          borderColor: chartColors.redGradientBorders
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    }, 'resourceDist'),
    
    successRate: initializeChart('successRateChart', 'doughnut', {
      data: {
        labels: ['Succès', 'Échec'],
        datasets: [{
          data: [100, 0],
          backgroundColor: chartColors.successError,
          borderColor: chartColors.successErrorBorders
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    }, 'successRate'),
    
    messageTypes: initializeChart('messageTypesChart', 'bar', {
      data: {
        labels: ['ADT^A01'],
        datasets: [{
          data: [0],
          backgroundColor: chartColors.redGradient[0],
          borderColor: chartColors.redGradientBorders[0]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    }, 'messageTypes'),
    
    conversionTrend: initializeChart('conversionTrendChart', 'line', {
      data: {
        labels: ['', '', '', '', ''],
        datasets: [{
          data: [0, 0, 0, 0, 0],
          backgroundColor: chartColors.conversion.background,
          borderColor: chartColors.conversion.border,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    }, 'conversionTrend')
  };
  
  // Vérifier si tous les graphiques ont été initialisés avec succès
  const allInitialized = Object.values(initializedCharts).every(Boolean);
  console.log(`Initialisation des graphiques ${allInitialized ? 'réussie' : 'partiellement réussie'}`);
  
  // Mettre à jour les graphiques avec les données actuelles
  fetch('/api/stats?t=' + Date.now(), { 
    headers: { 'Cache-Control': 'no-cache' }
  })
  .then(response => response.json())
  .then(data => {
    if (typeof window.updateAllCharts === 'function') {
      window.updateAllCharts(data);
    }
  })
  .catch(error => console.error("Erreur lors de la récupération des statistiques initiales:", error));
  
  return allInitialized;
};

// Initialisation automatique des graphiques au chargement de la page
// et ajout d'une fonction pour appeler explicitement fetchStats
document.addEventListener('DOMContentLoaded', function() {
  console.log("Initialisation automatique des graphiques avec dashboard-charts-fixed.js");
  
  // Attendre que tout soit chargé avant d'initialiser les graphiques
  setTimeout(function() {
    // Initialisation des graphiques du tableau de bord
    initResourceDistChart();
    initSuccessRateChart();
    initMessageTypesChart();
    initMemoryChart();
    initConversionTrendChart();
    
    // Premier chargement des données depuis l'API
    console.log("Chargement initial des données pour les graphiques");
    
    // Récupération des données pour les graphiques
    fetch('/api/stats')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log("Données initiales reçues pour les graphiques:", data.data);
          updateAllCharts(data.data);
        }
      })
      .catch(error => {
        console.error("Erreur lors du chargement initial des données:", error);
      });
  }, 500);
});