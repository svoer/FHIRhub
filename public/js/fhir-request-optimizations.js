/**
 * Optimisations pour les requêtes FHIR
 * Ce fichier ajoute un délai entre les requêtes FHIR pour éviter les erreurs 429 (Too Many Requests)
 * Il modifie ou étend les fonctions existantes sans les remplacer complètement
 */

// Fonction pour ajouter un délai entre les requêtes FHIR
let lastFetchTime = 0;
const FETCH_DELAY = 500; // 500ms entre les requêtes

async function fetchWithDelay(url, options = {}) {
    // Vérifier s'il faut ajouter un délai
    const now = Date.now();
    const elapsed = now - lastFetchTime;
    
    if (elapsed < FETCH_DELAY) {
        const waitTime = FETCH_DELAY - elapsed;
        console.log(`Ajout d'un délai de ${waitTime}ms pour éviter les erreurs 429`);
        
        // Mettre à jour le statut pour informer l'utilisateur
        const statusElement = document.getElementById('statusMessage');
        if (statusElement) {
            statusElement.textContent = `Délai de ${waitTime}ms ajouté pour respecter les limites du serveur...`;
        }
        
        // Attendre le temps nécessaire
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Mettre à jour le temps de la dernière requête
    lastFetchTime = Date.now();
    
    // Effectuer la requête fetch
    return fetch(url, options);
}

// Fonction générique pour charger une ressource FHIR avec délai
async function loadFhirResourceWithDelay(url, statusCallback, resultCallback, errorCallback) {
    if (statusCallback) {
        statusCallback('Chargement en cours...');
    }
    
    try {
        // Utiliser fetchWithDelay au lieu de fetch directement
        const response = await fetchWithDelay(url);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (resultCallback) {
            resultCallback(data);
        }
        
        return data;
    } catch (error) {
        console.error(`Erreur lors du chargement de la ressource depuis ${url}:`, error);
        
        if (errorCallback) {
            errorCallback(error);
        }
        
        if (statusCallback) {
            statusCallback(`Erreur: ${error.message}`);
        }
        
        return null;
    }
}

// Fonction pour optimiser les appels FHIR existants
function applyFhirOptimizations() {
    console.log('Application des optimisations pour les requêtes FHIR...');
    
    // 1. Optimiser la recherche de patients pour utiliser fetchWithDelay
    const originalSearchPatients = window.searchPatients;
    if (typeof originalSearchPatients === 'function') {
        window.searchPatients = function() {
            const serverUrl = document.getElementById('serverSelect').value;
            const searchTerm = document.getElementById('patientSearch').value.trim();
            const patientSelect = document.getElementById('patientSelect');
            
            if (!searchTerm) {
                showStatus('Veuillez entrer un terme de recherche.', 'warning');
                return;
            }
            
            // Nettoyer la liste déroulante des patients
            patientSelect.innerHTML = '<option value="">-- Sélectionnez un patient --</option>';
            
            showStatus('Recherche de patients en cours...', 'info');
            
            // Construire l'URL de recherche
            let url;
            if (serverUrl.includes('hapi.fhir.org')) {
                // Utiliser notre API proxy pour le serveur public HAPI
                // Augmenter la limite à 250 pour la recherche des patients
                url = `/api/fhir-proxy/hapi/Patient?family=${encodeURIComponent(searchTerm)}&_sort=family&_count=250`;
            } else {
                // URL directe pour les serveurs locaux
                url = `${serverUrl}/Patient?family=${encodeURIComponent(searchTerm)}&_sort=family&_count=250`;
            }
            
            console.log(`Recherche de patients depuis: ${url}`);
            
            // Utiliser fetchWithDelay au lieu de fetch directement
            fetchWithDelay(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Erreur de recherche: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.entry && data.entry.length > 0) {
                        const patients = data.entry.map(entry => entry.resource);
                        
                        // Trier les patients alphabétiquement par nom
                        patients.sort((a, b) => {
                            const nameA = a.name && a.name[0] ? formatPatientName(a.name) : '';
                            const nameB = b.name && b.name[0] ? formatPatientName(b.name) : '';
                            return nameA.localeCompare(nameB);
                        });
                        
                        // Ajouter chaque patient à la liste déroulante
                        patients.forEach(patient => {
                            const option = document.createElement('option');
                            option.value = patient.id;
                            
                            // Formater le nom du patient
                            let patientName = 'Patient sans nom';
                            if (patient.name && patient.name.length > 0) {
                                patientName = formatPatientName(patient.name);
                            }
                            
                            // Ajouter des informations supplémentaires (si disponibles)
                            let additionalInfo = [];
                            if (patient.birthDate) {
                                additionalInfo.push(`Né(e) le: ${patient.birthDate}`);
                            }
                            if (patient.gender) {
                                const genderMap = {
                                    'male': 'Homme',
                                    'female': 'Femme',
                                    'other': 'Autre',
                                    'unknown': 'Non spécifié'
                                };
                                additionalInfo.push(`Genre: ${genderMap[patient.gender] || patient.gender}`);
                            }
                            
                            option.textContent = `${patientName}${additionalInfo.length > 0 ? ' (' + additionalInfo.join(', ') + ')' : ''}`;
                            patientSelect.appendChild(option);
                        });
                        
                        showStatus(`${patients.length} patients trouvés.`, 'success');
                        
                        // Activer le bouton de chargement
                        document.getElementById('loadPatientBtn').removeAttribute('disabled');
                    } else {
                        // Aucun patient trouvé
                        showStatus(`Aucun patient trouvé pour le terme: "${searchTerm}"`, 'warning');
                    }
                })
                .catch(error => {
                    console.error('Erreur lors de la recherche de patients:', error);
                    showStatus(`Erreur lors de la recherche de patients: ${error.message}`, 'error');
                });
        };
        
        console.log('Fonction de recherche de patients optimisée avec délai entre requêtes');
    }
    
    // 2. Si loadPatientBundle existe, l'optimiser également
    const originalLoadPatientBundle = window.loadPatientBundle;
    if (typeof originalLoadPatientBundle === 'function') {
        window.loadPatientBundle = function(patientId, serverUrl) {
            const container = document.querySelector('#bundleContent');
            const bundleInfo = document.getElementById('bundleInfo');
            const bundleResourcesList = document.getElementById('bundleResourcesList');
            const loadingSection = container.querySelector('.loading-resources');
            const noResourcesSection = container.querySelector('.no-resources');
            
            if (loadingSection) loadingSection.style.display = 'block';
            if (noResourcesSection) noResourcesSection.style.display = 'none';
            if (bundleResourcesList) bundleResourcesList.innerHTML = '';
            
            // Déterminer si nous utilisons le proxy ou l'URL directe
            let url;
            if (serverUrl.includes('hapi.fhir.org')) {
                // Utiliser le proxy pour contourner les limitations CORS
                // Utiliser un count réduit (50) pour éviter les erreurs 429 (Too Many Requests)
                url = `/api/fhir-proxy/hapi/Patient/${patientId}/$everything?_count=50&_include=*`;
            } else {
                // URL directe pour les serveurs locaux (déjà sur le même domaine)
                url = `${serverUrl}/Patient/${patientId}/$everything?_count=100&_include=*`;
            }
            
            console.log(`Chargement du bundle patient depuis: ${url} (version optimisée)`);
            
            // Utiliser fetchWithDelay au lieu de fetch directement
            fetchWithDelay(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Erreur de récupération du bundle: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Stocker le bundle pour référence future
                    if (window.bundleData !== undefined) {
                        window.bundleData = data;
                    }
                    
                    if (loadingSection) loadingSection.style.display = 'none';
                    
                    // Afficher les informations sur le bundle
                    if (data.resourceType === 'Bundle') {
                        const resourceCount = data.entry ? data.entry.length : 0;
                        const resourceTypes = data.entry ? 
                            [...new Set(data.entry.map(e => e.resource.resourceType))].sort() : [];
                        
                        bundleInfo.innerHTML = `
                            <p><strong>Type de bundle:</strong> ${data.type || 'Inconnu'}</p>
                            <p><strong>Identifiant:</strong> ${data.id || 'Non spécifié'}</p>
                            <p><strong>Nombre de ressources:</strong> ${resourceCount}</p>
                            <p><strong>Types de ressources:</strong> ${resourceTypes.join(', ') || 'Aucun'}</p>
                        `;
                        
                        if (data.entry && data.entry.length > 0) {
                            // Afficher la liste des ressources
                            const table = document.createElement('table');
                            table.className = 'fhir-resources-table';
                            table.innerHTML = `
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>ID</th>
                                        <th>Détails</th>
                                    </tr>
                                </thead>
                                <tbody>
                                </tbody>
                            `;
                            
                            const tbody = table.querySelector('tbody');
                            
                            data.entry.forEach(entry => {
                                const resource = entry.resource;
                                const row = document.createElement('tr');
                                
                                // Colonne Type
                                const typeCell = document.createElement('td');
                                typeCell.textContent = resource.resourceType;
                                row.appendChild(typeCell);
                                
                                // Colonne ID
                                const idCell = document.createElement('td');
                                idCell.textContent = resource.id || 'N/A';
                                row.appendChild(idCell);
                                
                                // Colonne Détails
                                const detailsCell = document.createElement('td');
                                const detailsButton = document.createElement('button');
                                detailsButton.className = 'btn btn-sm btn-outline-info';
                                detailsButton.textContent = 'Voir';
                                detailsButton.onclick = function() {
                                    showResourceDetails(resource);
                                };
                                detailsCell.appendChild(detailsButton);
                                row.appendChild(detailsCell);
                                
                                tbody.appendChild(row);
                            });
                            
                            bundleResourcesList.innerHTML = '';
                            bundleResourcesList.appendChild(table);
                        } else {
                            bundleResourcesList.innerHTML = '<p>Aucune ressource dans ce bundle.</p>';
                        }
                    } else {
                        // Ce n'est pas un bundle
                        bundleInfo.innerHTML = '<p>Les données reçues ne constituent pas un bundle FHIR.</p>';
                        bundleResourcesList.innerHTML = '';
                    }
                })
                .catch(error => {
                    console.error('Erreur lors du chargement du bundle:', error);
                    
                    if (loadingSection) loadingSection.style.display = 'none';
                    
                    // Montrer le message d'erreur
                    if (noResourcesSection) {
                        noResourcesSection.style.display = 'block';
                        noResourcesSection.innerHTML = `
                            <p>Impossible de récupérer le bundle complet. Tentative de récupération manuelle des ressources.</p>
                        `;
                    }
                    
                    // Tenter de récupérer manuellement un ensemble de ressources associées
                    if (bundleInfo) {
                        bundleInfo.innerHTML = `
                            <p><strong>Erreur lors de la récupération du bundle:</strong> ${error.message}</p>
                            <p>Tentative de récupération des ressources individuelles...</p>
                        `;
                    }
                    
                    // Tenter une approche alternative pour récupérer les données
                    if (typeof fetchResourcesManually === 'function') {
                        fetchResourcesManually(patientId);
                    } else {
                        console.error("La fonction fetchResourcesManually n'est pas disponible");
                    }
                });
        };
        
        console.log('Fonction de chargement de bundle optimisée avec délai entre requêtes');
    }
}

// Attendre que la page soit chargée pour appliquer les optimisations
document.addEventListener('DOMContentLoaded', applyFhirOptimizations);