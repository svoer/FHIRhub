/**
 * Script pour optimiser la recherche de patients
 * Utilise la fonction fetchWithFhirDelay pour ajouter un délai entre les requêtes
 * et éviter les erreurs 429 (Too Many Requests)
 */

document.addEventListener('DOMContentLoaded', function() {
    // Optimiser la fonction de recherche de patients
    const originalSearchPatients = window.searchPatients;
    
    if (typeof originalSearchPatients === 'function') {
        // Remplacer l'implémentation originale
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
                url = `/api/fhir-proxy/hapi/Patient?family=${searchTerm}&_sort=family&_count=250`;
            } else {
                // URL directe pour les serveurs locaux
                url = `${serverUrl}/Patient?family=${searchTerm}&_sort=family&_count=250`;
            }
            
            console.log(`Commencer la recherche de patients depuis: ${url}`);
            
            function processPatientResults(data) {
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
            }
            
            function secureSearch(url, isSecondAttempt = false) {
                console.log(`Recherche de patients: ${url}`);
                
                // Utiliser notre fonction optimisée avec délai
                window.fetchWithFhirDelay(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erreur de recherche: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(processPatientResults)
                    .catch(error => {
                        console.error('Erreur lors de la recherche de patients:', error);
                        
                        // Retenter avec le serveur HAPI FHIR public en cas d'échec
                        if (!isSecondAttempt && !serverUrl.includes('hapi.fhir.org')) {
                            showStatus('Serveur local non accessible, tentative avec le serveur public HAPI FHIR...', 'warning');
                            const fallbackUrl = `/api/fhir-proxy/hapi/Patient?family=${searchTerm}&_sort=family&_count=250`;
                            secureSearch(fallbackUrl, true);
                        } else {
                            showStatus(`Erreur lors de la recherche de patients: ${error.message}`, 'error');
                        }
                    });
            }
            
            // Lancer la recherche sécurisée
            secureSearch(url);
        };
        
        console.log("Fonction de recherche de patients optimisée pour éviter les erreurs 429");
    }
});