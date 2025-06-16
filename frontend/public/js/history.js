/**
 * Module de gestion de l'historique des conversions
 * Fournit des fonctions pour récupérer et afficher l'historique
 * des conversions HL7 vers FHIR avec statistiques
 */

// Variables pour la pagination
let currentPage = 0;
const pageSize = 10;
let hasMoreConversions = true;
let isLoadingHistory = false;

// Initialisation des événements
document.addEventListener('DOMContentLoaded', function() {
  // Ajouter l'événement pour le bouton d'actualisation
  const refreshBtn = document.getElementById('refresh-history');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      refreshStats();
      refreshHistory(true);
    });
  }
  
  // Ajouter l'événement pour le bouton "Charger plus"
  const loadMoreBtn = document.getElementById('load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function() {
      currentPage++;
      refreshHistory(false);
    });
  }
});

/**
 * Rafraîchit les statistiques globales
 */
function refreshStats() {
  // Récupérer les statistiques via l'API avec la fonction apiRequest
  apiRequest('stats')
  .then(data => {
    // Mettre à jour les compteurs dans l'interface
    if (data && data.status === 'ok' && data.data) {
      document.getElementById('total-conversions').textContent = data.data.total || 0;
      document.getElementById('success-count').textContent = data.data.success || 0;
      document.getElementById('error-count').textContent = data.data.failed || 0;
      
      // Formater la date de la dernière conversion
      if (data.data.lastConversion) {
        const lastDate = new Date(data.data.lastConversion);
        if (!isNaN(lastDate.getTime())) {
          const formattedDate = lastDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          document.getElementById('last-conversion').textContent = formattedDate;
        } else {
          document.getElementById('last-conversion').textContent = data.data.lastConversion;
        }
      } else {
        document.getElementById('last-conversion').textContent = '-';
      }
    }
  })
  .catch(error => {
    console.error('Erreur lors du chargement des statistiques:', error);
  });
}

/**
 * Rafraîchit l'historique des conversions
 * @param {boolean} reset - Si true, réinitialise la pagination
 */
function refreshHistory(reset = false) {
  // Éviter les requêtes multiples
  if (isLoadingHistory) return;
  isLoadingHistory = true;
  
  // Réinitialiser la pagination si demandé
  if (reset) {
    currentPage = 0;
    document.getElementById('conversion-history').innerHTML = 
      '<div class="loading">Chargement de l\'historique...</div>';
    hasMoreConversions = true;
  }
  
  // Afficher ou masquer le bouton de chargement
  const loadMoreBtn = document.getElementById('load-more');
  loadMoreBtn.style.display = hasMoreConversions ? 'block' : 'none';
  
  // Paramètres de pagination
  const offset = currentPage * pageSize;
  
  // Récupérer l'historique via l'API avec la fonction apiRequest
  apiRequest(`conversions?limit=${pageSize}&offset=${offset}`)
  .then(data => {
    isLoadingHistory = false;
    
    if (data && data.status === 'ok' && data.data) {
      // Récupérer le conteneur
      const historyContainer = document.getElementById('conversion-history');
      
      // Supprimer le message de chargement si c'est la première page
      if (reset) {
        historyContainer.innerHTML = '';
      }
      
      // Si aucune donnée ou tableau vide
      if (!data.data.length) {
        if (reset) {
          historyContainer.innerHTML = '<div class="no-data">Aucune conversion trouvée</div>';
        }
        hasMoreConversions = false;
        loadMoreBtn.style.display = 'none';
        return;
      }
      
      // Créer une table pour l'historique si elle n'existe pas déjà
      let historyTable = historyContainer.querySelector('table');
      if (!historyTable) {
        historyTable = document.createElement('table');
        historyTable.className = 'history-table';
        historyTable.innerHTML = `
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Source</th>
              <th>Statut</th>
              <th>Ressources</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;
        historyContainer.appendChild(historyTable);
      }
      
      // Récupérer le corps de la table
      const tableBody = historyTable.querySelector('tbody');
      
      // Ajouter chaque conversion à la table
      data.data.forEach(conv => {
        // Créer une nouvelle ligne
        const row = document.createElement('tr');
        
        // Extraire l'ID court pour affichage
        const shortId = (conv.conversion_id || '').substring(0, 8);
        
        // Formater la date
        let formattedDate = '';
        try {
          const convDate = new Date(conv.created_at);
          formattedDate = convDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {
          formattedDate = conv.created_at || '-';
        }
        
        // Déterminer la classe de statut
        const statusClass = conv.status === 'success' ? 'status-success' : 'status-error';
        
        // Remplir la ligne
        row.innerHTML = `
          <td title="${conv.conversion_id || ''}">${shortId}</td>
          <td>${formattedDate}</td>
          <td>${conv.source_name || conv.source_type || '-'}</td>
          <td class="${statusClass}">${conv.status || '-'}</td>
          <td>${conv.resource_count || 0}</td>
          <td>
            <button class="view-btn" data-id="${conv.conversion_id}">
              <i class="fa fa-eye"></i>
            </button>
          </td>
        `;
        
        // Ajouter la ligne à la table
        tableBody.appendChild(row);
        
        // Ajouter l'événement pour le bouton de visualisation
        const viewBtn = row.querySelector('.view-btn');
        if (viewBtn) {
          viewBtn.addEventListener('click', function() {
            const convId = this.getAttribute('data-id');
            viewConversion(convId);
          });
        }
      });
      
      // Vérifier s'il y a plus de conversions
      hasMoreConversions = data.data.length === pageSize;
      loadMoreBtn.style.display = hasMoreConversions ? 'block' : 'none';
    } else {
      // Gérer les erreurs de l'API
      document.getElementById('conversion-history').innerHTML = 
        '<div class="error">Erreur lors du chargement de l\'historique</div>';
      loadMoreBtn.style.display = 'none';
    }
  })
  .catch(error => {
    isLoadingHistory = false;
    console.error('Erreur lors du chargement de l\'historique:', error);
    document.getElementById('conversion-history').innerHTML = 
      '<div class="error">Erreur de communication avec l\'API</div>';
    loadMoreBtn.style.display = 'none';
  });
}

/**
 * Affiche le détail d'une conversion
 * @param {string} conversionId - ID de la conversion
 */
function viewConversion(conversionId) {
  // Récupérer les détails de la conversion avec la fonction apiRequest
  apiRequest(`conversions/${conversionId}`)
  .then(data => {
    if (data && data.status === 'ok') {
      // TODO: Implémenter l'affichage des détails dans une modale
      console.log('Détails de la conversion:', data.data);
      alert('Détails de la conversion disponibles dans la console');
    } else {
      alert('Erreur lors de la récupération des détails');
    }
  })
  .catch(error => {
    console.error('Erreur lors de la récupération des détails:', error);
    alert('Erreur de communication avec l\'API');
  });
}

// Exporter les fonctions pour qu'elles soient accessibles globalement
window.refreshStats = refreshStats;
window.refreshHistory = refreshHistory;