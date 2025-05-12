/**
 * Script pour le visualiseur de patient
 * Récupère et affiche toutes les ressources liées à un patient dans une interface utilisateur moderne
 * Supporte les conditions, observations, médicaments, consultations et chronologie
 */

document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    const serverSelect = document.getElementById('serverSelect');
    const patientSearch = document.getElementById('patientSearch');
    const searchPatientBtn = document.getElementById('searchPatientBtn');
    const patientSelect = document.getElementById('patientSelect');
    const loadPatientBtn = document.getElementById('loadPatientBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const analyzeAIBtn = document.getElementById('analyzeAIBtn');
    
    // Stockage centralisé de toutes les données
    let patientData = null;
    let conditionsData = [];
    let observationsData = [];
    let medicationsData = [];
    let encountersData = [];
    // Variables pour les nouvelles ressources
    let practitionersData = [];
    let organizationsData = [];
    let relatedPersonsData = [];
    let coverageData = [];
    let bundleData = null;
    let lastBundleResponse = null; // Pour stocker la réponse de transaction du serveur FHIR
    
    // Navigation par onglets
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Désactiver tous les onglets
            tabs.forEach(t => {
                t.classList.remove('active');
                // Réinitialiser le style
                t.style.background = '#f5f5f5';
                t.style.color = '#555';
            });
            
            // Désactiver tous les contenus
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });
            
            // Activer l'onglet sélectionné
            this.classList.add('active');
            // Appliquer le style actif (dégradé rouge-orange)
            this.style.background = 'linear-gradient(135deg, #e83e28, #fd7e30)';
            this.style.color = 'white';
            
            // Activer le contenu correspondant
            const tabId = this.getAttribute('data-tab');
            const activeTab = document.getElementById(tabId);
            activeTab.classList.add('active');
            activeTab.style.display = 'block';
            
            // Si c'est l'onglet JSON, mettre à jour le contenu
            if (tabId === 'json') {
                updateJsonView();
            }
        });
    });
    
    // Fonction pour formater le nom du patient
    function formatPatientName(nameArray) {
        if (!nameArray || nameArray.length === 0) {
            return 'Patient sans nom';
        }
        
        const name = nameArray[0];
        
        const family = name.family || '';
        const given = name.given || [];
        
        if (family && given.length > 0) {
            return `${family.toUpperCase()} ${given.join(' ')}`;
        } else if (family) {
            return family.toUpperCase();
        } else if (given.length > 0) {
            return given.join(' ');
        } else {
            return 'Patient sans nom';
        }
    }
    
    // Fonction pour montrer les statuts/alertes
    function showStatus(message, type = 'info') {
        const statusDisplay = document.getElementById('serverStatus');
        statusDisplay.innerHTML = message;
        statusDisplay.className = 'status-display';
        
        if (type === 'error') {
            statusDisplay.classList.add('status-error');
        } else if (type === 'success') {
            statusDisplay.classList.add('status-success');
        } else {
            statusDisplay.classList.add('status-info');
        }
        
        statusDisplay.style.display = 'block';
    }
    
    // Fonction pour générer un résumé du patient (sans appeler l'IA)
    function generatePatientSummary(patient) {
        // Vérifier les informations disponibles
        const hasName = patient.name && patient.name.length > 0;
        const hasBirthDate = !!patient.birthDate;
        const hasAddress = patient.address && patient.address.length > 0;
        const hasTelecom = patient.telecom && patient.telecom.length > 0;
        
        return `
            <div style="padding: 15px 0; border-bottom: 1px solid #f0f0f0; margin-bottom: 20px;">
                <h3 style="margin-top: 0; color: #444;">Résumé des informations patient</h3>
                <p style="color: #666; margin-bottom: 20px;">Analyse basée uniquement sur les données disponibles dans le dossier.</p>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: .85; text-align: center; padding: 10px; background: ${hasName ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)'}; border-radius: 4px;">
                        <i class="fas ${hasName ? 'fa-check' : 'fa-times'}" style="color: ${hasName ? '#28a745' : '#dc3545'};"></i><br>
                        <span style="font-size: 0.9em;">Identité</span>
                    </div>
                    <div style="flex: .85; text-align: center; padding: 10px; background: ${hasBirthDate ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)'}; border-radius: 4px;">
                        <i class="fas ${hasBirthDate ? 'fa-check' : 'fa-times'}" style="color: ${hasBirthDate ? '#28a745' : '#dc3545'};"></i><br>
                        <span style="font-size: 0.9em;">Date naissance</span>
                    </div>
                    <div style="flex: .85; text-align: center; padding: 10px; background: ${hasAddress ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)'}; border-radius: 4px;">
                        <i class="fas ${hasAddress ? 'fa-check' : 'fa-times'}" style="color: ${hasAddress ? '#28a745' : '#dc3545'};"></i><br>
                        <span style="font-size: 0.9em;">Adresse</span>
                    </div>
                    <div style="flex: .85; text-align: center; padding: 10px; background: ${hasTelecom ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)'}; border-radius: 4px;">
                        <i class="fas ${hasTelecom ? 'fa-check' : 'fa-times'}" style="color: ${hasTelecom ? '#28a745' : '#dc3545'};"></i><br>
                        <span style="font-size: 0.9em;">Contact</span>
                    </div>
                </div>
                
                <div style="background: rgba(253, 126, 48, 0.1); padding: 10px; border-radius: 6px; margin-top: 15px; text-align: center;">
                    <p style="margin: 0; font-style: italic; color: #666;">
                        Cette analyse est purement factuelle, basée uniquement sur les données disponibles dans le dossier.
                    </p>
                </div>
            </div>
        `;
    }
    
    // Recherche des patients avec une implémentation robuste
    function searchPatients() {
        const searchValue = patientSearch.value.trim();
        
        if (!searchValue) {
            alert('Veuillez entrer un critère de recherche');
            return;
        }
        
        // IDENTITOVIGILANCE: Effacer toutes les données du patient précédent
        clearPatientData();
        
        // Cacher le conteneur du patient
        document.getElementById('patientContainer').style.display = 'none';
        
        const serverUrl = serverSelect.value;
        
        // Afficher l'état de chargement
        showStatus('<i class="fas fa-spinner fa-spin"></i> Recherche en cours...', 'info');
        
        // Fonction de traitement des résultats
        function processPatientResults(data) {
            if (data.entry && data.entry.length > 0) {
                // Vider le sélecteur de patients
                patientSelect.innerHTML = '<option value="">-- Sélectionnez un patient --</option>';
                
                // Ajouter les patients trouvés
                data.entry.forEach(entry => {
                    if (entry.resource && entry.resource.resourceType === 'Patient') {
                        const patient = entry.resource;
                        const name = formatPatientName(patient.name);
                        
                        const option = document.createElement('option');
                        option.value = patient.id;
                        option.textContent = `${name} (${patient.gender || '?'})`;
                        option.dataset.patient = JSON.stringify(patient);
                        
                        patientSelect.appendChild(option);
                    }
                });
                
                showStatus(`<i class="fas fa-check-circle"></i> ${data.entry.length} patients trouvés`, 'success');
                
                // Auto-sélectionner si un seul résultat
                if (data.entry.length === 1) {
                    patientSelect.selectedIndex = 1; // Premier patient
                }
                
                return true;
            }
            return false;
        }
        
        // Fonction de recherche sécurisée avec XMLHttpRequest
        function secureSearch(url, isSecondAttempt = false) {
            console.log(`Recherche de patients: ${url}`);
            
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        const hasResults = processPatientResults(data);
                        
                        // Si aucun résultat et c'est la première tentative, essayer une recherche plus large
                        if (!hasResults && !isSecondAttempt) {
                            const widerUrl = `${serverUrl}/Patient?name=${encodeURIComponent(searchValue)}&_sort=family&_count=1000`;
                            secureSearch(widerUrl, true);
                        } else if (!hasResults) {
                            patientSelect.innerHTML = '<option value="">-- Aucun patient trouvé --</option>';
                            showStatus('<i class="fas fa-exclamation-circle"></i> Aucun patient trouvé', 'error');
                        }
                    } catch (error) {
                        console.error('Erreur parsing JSON:', error);
                        patientSelect.innerHTML = '<option value="">-- Erreur de traitement des données --</option>';
                        showStatus('<i class="fas fa-exclamation-triangle"></i> Erreur de traitement des données', 'error');
                    }
                } else {
                    console.warn(`Problème de récupération: ${url}, statut: ${xhr.status}`);
                    patientSelect.innerHTML = '<option value="">-- Erreur de communication avec le serveur --</option>';
                    showStatus(`<i class="fas fa-exclamation-triangle"></i> Erreur: ${xhr.status}`, 'error');
                }
            };
            
            xhr.onerror = function() {
                console.error(`Erreur réseau lors de la récupération des patients: ${url}`);
                patientSelect.innerHTML = '<option value="">-- Erreur de connexion --</option>';
                showStatus('<i class="fas fa-exclamation-triangle"></i> Erreur de connexion au serveur', 'error');
            };
            
            xhr.send();
        }
        
        // Commencer par la recherche sur le nom de famille avec un nombre élevé de résultats (contexte hospitalier)
        const initialUrl = `${serverUrl}/Patient?family=${encodeURIComponent(searchValue)}&_sort=family&_count=1000`;
        secureSearch(initialUrl);
    }
    
    // Effacer la recherche et toutes les données du patient précédent
    function clearSearch() {
        // Réinitialiser la recherche
        patientSearch.value = '';
        patientSelect.innerHTML = '<option value="">-- Sélectionnez un patient --</option>';
        document.getElementById('serverStatus').style.display = 'none';
        document.getElementById('patientContainer').style.display = 'none';
        
        // IDENTITOVIGILANCE: Effacer toutes les données du patient précédent
        clearPatientData();
    }
    
    // Fonction pour effacer toutes les données du patient (identitovigilance)
    function clearPatientData() {
        // Réinitialiser la variable globale des données patient
        patientData = null;
        
        // Vider tous les conteneurs de contenu
        document.getElementById('summaryContent').innerHTML = '';
        document.getElementById('aiAnalysis').innerHTML = '';
        document.getElementById('aiAnalysis').style.display = 'none';
        
        // Vider tous les conteneurs d'onglets
        const contentContainers = [
            'conditionsContent', 
            'observationsContent', 
            'medicationsContent', 
            'encountersContent',
            'practitionersContent',
            'organizationsContent',
            'relatedContent',
            'coverageContent',
            'timelineContent',
            'bundleContent',
            'jsonContent'
        ];
        
        contentContainers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                const resourcesList = container.querySelector('.resources-list');
                if (resourcesList) resourcesList.innerHTML = '';
            }
        });
        
        console.log('IDENTITOVIGILANCE: Toutes les données du patient ont été effacées');
    }
    
    // Charger les détails d'un patient et ses ressources associées
    function loadPatient() {
        if (!patientSelect.value) {
            alert('Veuillez sélectionner un patient');
            return;
        }
        
        // IDENTITOVIGILANCE: Effacer toutes les données du patient précédent
        clearPatientData();
        
        const patientId = patientSelect.value;
        const server = serverSelect.value;
        
        console.log(`Chargement du patient ${patientId} depuis le serveur ${server}`);
        
        try {
            const selectedOption = patientSelect.options[patientSelect.selectedIndex];
            patientData = JSON.parse(selectedOption.dataset.patient);
            
            // Afficher les détails
            document.getElementById('patientName').textContent = formatPatientName(patientData.name);
            
            // Format plus détaillé pour l'en-tête du patient
            let patientDetails = '';
            
            if (patientData.gender) {
                patientDetails += `<span style="margin-right: 15px;"><i class="fas ${patientData.gender === 'male' ? 'fa-male' : patientData.gender === 'female' ? 'fa-female' : 'fa-user'}" style="margin-right: 5px;"></i> ${patientData.gender === 'male' ? 'Homme' : patientData.gender === 'female' ? 'Femme' : patientData.gender}</span>`;
            }
            
            if (patientData.birthDate) {
                const birthDate = new Date(patientData.birthDate);
                const today = new Date();
                const age = today.getFullYear() - birthDate.getFullYear();
                const formattedDate = birthDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                patientDetails += `<span style="margin-right: 15px;"><i class="fas fa-birthday-cake" style="margin-right: 5px;"></i> ${formattedDate} (${age} ans)</span>`;
            }
            
            if (patientData.telecom && patientData.telecom.length > 0) {
                const phone = patientData.telecom.find(t => t.system === 'phone');
                if (phone) {
                    patientDetails += `<span style="margin-right: 15px;"><i class="fas fa-phone" style="margin-right: 5px;"></i> ${phone.value}</span>`;
                }
                
                const email = patientData.telecom.find(t => t.system === 'email');
                if (email) {
                    patientDetails += `<span style="margin-right: 15px;"><i class="fas fa-envelope" style="margin-right: 5px;"></i> ${email.value}</span>`;
                }
            }
            
            document.getElementById('patientDetails').innerHTML = patientDetails || `ID: ${patientData.id}`;
            
            // Afficher le conteneur de patient
            document.getElementById('patientContainer').style.display = 'block';
            
            // Charger toutes les ressources associées au patient en parallèle
            // Utiliser Promise.allSettled pour continuer même si certaines requêtes échouent
            const loadingPromises = [
                { name: 'Conditions', promise: loadPatientConditions(patientId, server) },
                { name: 'Observations', promise: loadPatientObservations(patientId, server) },
                { name: 'Médicaments', promise: loadPatientMedications(patientId, server) },
                { name: 'Consultations', promise: loadPatientEncounters(patientId, server) },
                { name: 'Praticiens', promise: loadPatientPractitioners(patientId, server) },
                { name: 'Organisations', promise: loadPatientOrganizations(patientId, server) },
                { name: 'Personnes liées', promise: loadPatientRelatedPersons(patientId, server) },
                { name: 'Couvertures', promise: loadPatientCoverage(patientId, server) },
                { name: 'Chronologie', promise: generateTimeline(patientId, server) },
                { name: 'Bundle', promise: loadPatientBundle(patientId, server) }
            ];
            
            // Afficher un résumé global des résultats du chargement
            Promise.allSettled(loadingPromises.map(item => item.promise))
                .then(results => {
                    const summary = loadingPromises.map((item, index) => {
                        const result = results[index];
                        return {
                            name: item.name,
                            status: result.status,
                            error: result.status === 'rejected' ? result.reason?.message : null
                        };
                    });
                    
                    console.log('Résultats du chargement des ressources:', summary);
                })
                .finally(() => {
                    // Mettre à jour l'onglet JSON
                    updateJsonView();
                });
            
            // Résumé amélioré avec checkboxes et résumé clinique non-IA
            document.getElementById('summaryContent').innerHTML = `
                <div class="patient-summary">
                    <h3 style="color: #e83e28; margin-top: 0; font-size: 1.3rem; padding-bottom: 12px; border-bottom: 1px solid #f0f0f0;">Résumé du patient</h3>
                    
                    <!-- Indicateurs visuels de présence des données (via generatePatientSummary) -->
                    ${generatePatientSummary(patientData)}
                    
                    <!-- Résumé clinique par onglet -->
                    <div id="clinicalSummary" style="margin: 20px 0; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #f0f0f0;">
                        <h4 style="margin-top: 0; font-size: 1.1rem; color: #555; margin-bottom: 10px;">Résumé clinique:</h4>
                        <div id="clinicalSummaryContent" style="color: #666; font-size: 0.95rem;">
                            <p>Les informations cliniques seront chargées au fur et à mesure de l'exploration des onglets.</p>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 3px solid #e83e28;">
                            <h4 style="margin-top: 0; font-size: 1.1rem; color: #555;">Informations démographiques</h4>
                            <div style="margin-top: 12px;">
                                <p style="margin: 8px 0; display: flex; justify-content: space-between;">
                                    <span style="font-weight: 500; color: #666;">Identifiant:</span> 
                                    <span style="color: #333;">${patientData.id}</span>
                                </p>
                                <p style="margin: 8px 0; display: flex; justify-content: space-between;">
                                    <span style="font-weight: 500; color: #666;">Nom complet:</span> 
                                    <span style="color: #333;">${formatPatientName(patientData.name)}</span>
                                </p>
                                <p style="margin: 8px 0; display: flex; justify-content: space-between;">
                                    <span style="font-weight: 500; color: #666;">Genre:</span> 
                                    <span style="color: #333;">${patientData.gender || 'Non spécifié'}</span>
                                </p>
                                <p style="margin: 8px 0; display: flex; justify-content: space-between;">
                                    <span style="font-weight: 500; color: #666;">Date de naissance:</span> 
                                    <span style="color: #333;">${patientData.birthDate || 'Non spécifiée'}</span>
                                </p>
                            </div>
                        </div>
                        
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 3px solid #fd7e30;">
                            <h4 style="margin-top: 0; font-size: 1.1rem; color: #555;">Coordonnées</h4>
                            <div style="margin-top: 12px;">
                                <p style="color: #777; font-style: italic;">
                                    ${patientData.telecom ? 
                                      `<ul style="padding-left: 20px; margin: 10px 0;">
                                        ${patientData.telecom.map(t => `<li>${t.system}: ${t.value}</li>`).join('')}
                                       </ul>` 
                                      : 'Aucune information de contact disponible'}
                                </p>
                                <p style="color: #777; font-style: italic; margin-top: 15px;">
                                    ${patientData.address ? 
                                      `<strong>Adresse:</strong><br>${patientData.address.map(a => 
                                        `${a.line ? a.line.join(', ') : ''}<br>
                                         ${a.postalCode || ''} ${a.city || ''}<br>
                                         ${a.country || ''}`
                                      ).join('<br><br>')}` 
                                      : 'Aucune adresse disponible'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>`;
        } catch (error) {
            console.error('Erreur lors du chargement du patient:', error);
            alert('Erreur lors du chargement du patient: ' + error.message);
        }
    }
    
    // Fonctions pour charger les ressources liées au patient
    function loadPatientConditions(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            const container = document.querySelector('#conditionsContent');
            const loadingSection = container.querySelector('.loading-resources');
            const noResourcesSection = container.querySelector('.no-resources');
            const resourcesList = container.querySelector('.resources-list');
            
            // Réinitialiser les données des conditions
            conditionsData = [];
            
            loadingSection.style.display = 'block';
            noResourcesSection.style.display = 'none';
            resourcesList.style.display = 'none';
            
            // URL de la requête FHIR avec format correct pour référence patient (limite augmentée à 100)
            const url = `${serverUrl}/Condition?subject=Patient/${patientId}&_sort=-recorded-date&_count=100`;
            console.log(`Chargement des conditions depuis: ${url}`);
        
        // Utiliser XMLHttpRequest pour une meilleure compatibilité et gestion d'erreurs
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        
        xhr.onload = function() {
            loadingSection.style.display = 'none';
            
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    
                    if (data.entry && data.entry.length > 0) {
                        // Stocker toutes les conditions dans la variable globale
                        conditionsData = data.entry.map(entry => entry.resource);
                        console.log(`${conditionsData.length} conditions chargées et stockées`);
                        
                        resourcesList.innerHTML = '';
                        resourcesList.style.display = 'block';
                        
                        // Créer une liste de conditions
                        const conditionsList = document.createElement('div');
                        conditionsList.className = 'conditions-list';
                        
                        data.entry.forEach(entry => {
                            const condition = entry.resource;
                            const conditionElement = document.createElement('div');
                            conditionElement.className = 'condition-item';
                            conditionElement.style.padding = '12px';
                            conditionElement.style.margin = '8px 0';
                            conditionElement.style.backgroundColor = '#f9f9f9';
                            conditionElement.style.borderRadius = '6px';
                            conditionElement.style.borderLeft = '3px solid #e83e28';
                            
                            const severity = condition.severity?.coding?.[0]?.display || '';
                            const status = condition.clinicalStatus?.coding?.[0]?.display || condition.clinicalStatus?.coding?.[0]?.code || condition.clinicalStatus || '';
                            const recordedDate = condition.recordedDate ? new Date(condition.recordedDate).toLocaleDateString('fr-FR') : 'Non spécifiée';
                            
                            conditionElement.innerHTML = `
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                    <h4 style="margin: 0 0 8px 0; color: #444; font-size: 1.1rem;">
                                        ${condition.code?.coding?.[0]?.display || condition.code?.text || 'Condition non spécifiée'}
                                    </h4>
                                    <span style="font-size: 0.85rem; background: ${status === 'active' ? '#e8f4fd' : '#f8f9fa'}; color: ${status === 'active' ? '#0077cc' : '#6c757d'}; padding: 3px 8px; border-radius: 12px; display: inline-block;">
                                        ${status || 'Non spécifié'}
                                    </span>
                                </div>
                                <div style="margin-bottom: 5px; font-size: 0.9rem; color: #555;">
                                    <strong>Sévérité:</strong> ${severity || 'Non spécifiée'}
                                </div>
                                <div style="font-size: 0.9rem; color: #555;">
                                    <strong>Date d'enregistrement:</strong> ${recordedDate}
                                </div>
                            `;
                            
                            conditionsList.appendChild(conditionElement);
                        });
                        
                        resourcesList.appendChild(conditionsList);
                    } else {
                        noResourcesSection.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Erreur parsing JSON conditions:', error);
                    noResourcesSection.style.display = 'block';
                    reject(error);
                }
            } else {
                console.warn(`Problème de récupération: ${url}, statut: ${xhr.status}`);
                noResourcesSection.style.display = 'block';
                reject(new Error(`Problème de récupération des conditions: ${xhr.status}`));
            }
            resolve(conditionsData);
        };
        
        xhr.onerror = function() {
            console.error(`Erreur réseau lors de la récupération des conditions: ${url}`);
            loadingSection.style.display = 'none';
            noResourcesSection.style.display = 'block';
            reject(new Error("Erreur réseau lors de la récupération des conditions"));
        };
        
        xhr.send();
        });  // Fermeture de la Promise
    }
    
    function loadPatientObservations(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            const container = document.querySelector('#observationsContent');
            const loadingSection = container.querySelector('.loading-resources');
            const noResourcesSection = container.querySelector('.no-resources');
            const resourcesList = container.querySelector('.resources-list');
            
            // Réinitialiser les données des observations
            observationsData = [];
            
            loadingSection.style.display = 'block';
            noResourcesSection.style.display = 'none';
            resourcesList.style.display = 'none';
            
            // URL de la requête FHIR avec format correct pour référence patient (limite à 100)
            const url = `${serverUrl}/Observation?subject=Patient/${patientId}&_sort=-date&_count=100`;
            console.log(`Chargement des observations depuis: ${url}`);
            
            // Exécuter la requête FHIR pour récupérer les observations
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Erreur de récupération des observations: ${response.status}`);
                    }
                    return response.json();
                })
            .then(data => {
                loadingSection.style.display = 'none';
                
                if (data.entry && data.entry.length > 0) {
                    // Stocker toutes les observations dans la variable globale
                    observationsData = data.entry.map(entry => entry.resource);
                    console.log(`${observationsData.length} observations chargées et stockées`);
                    
                    resourcesList.innerHTML = '';
                    resourcesList.style.display = 'block';
                    
                    // Créer une liste d'observations
                    const observationsList = document.createElement('div');
                    observationsList.className = 'observations-list';
                    
                    data.entry.forEach(entry => {
                        const observation = entry.resource;
                        const observationElement = document.createElement('div');
                        observationElement.className = 'observation-item';
                        observationElement.style.padding = '12px';
                        observationElement.style.margin = '8px 0';
                        observationElement.style.backgroundColor = '#f9f9f9';
                        observationElement.style.borderRadius = '6px';
                        observationElement.style.borderLeft = '3px solid #fd7e30';
                        
                        const valueDisplay = getObservationValue(observation);
                        const effectiveDate = getEffectiveDate(observation);
                        
                        observationElement.innerHTML = `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <h4 style="margin: 0 0 8px 0; color: #444; font-size: 1.1rem;">
                                    ${observation.code?.coding?.[0]?.display || observation.code?.text || 'Observation non spécifiée'}
                                </h4>
                                <span style="font-size: 0.85rem; background: #f8f9fa; color: #6c757d; padding: 3px 8px; border-radius: 12px; display: inline-block;">
                                    ${observation.status || 'Non spécifié'}
                                </span>
                            </div>
                            <div style="margin-bottom: 5px; font-size: 0.9rem; color: #555;">
                                <strong>Valeur:</strong> ${valueDisplay}
                            </div>
                            <div style="font-size: 0.9rem; color: #555;">
                                <strong>Date:</strong> ${effectiveDate}
                            </div>
                        `;
                        
                        observationsList.appendChild(observationElement);
                    });
                    
                    resourcesList.appendChild(observationsList);
                } else {
                    noResourcesSection.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des observations:', error);
                loadingSection.style.display = 'none';
                noResourcesSection.style.display = 'block';
                reject(error);
            })
            .finally(() => {
                resolve(observationsData);
            });
        });
    }
    
    function loadPatientMedications(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            const container = document.querySelector('#medicationsContent');
            const loadingSection = container.querySelector('.loading-resources');
            const noResourcesSection = container.querySelector('.no-resources');
            const resourcesList = container.querySelector('.resources-list');
            
            // Réinitialiser les données des médicaments
            medicationsData = [];
            
            loadingSection.style.display = 'block';
            noResourcesSection.style.display = 'none';
            resourcesList.style.display = 'none';
            
            // URL de la requête FHIR avec format correct pour référence patient
            const url = `${serverUrl}/MedicationRequest?subject=Patient/${patientId}&_sort=-date&_count=100`;
            console.log(`Chargement des médicaments depuis: ${url}`);
            
            // Exécuter la requête FHIR pour récupérer les médicaments
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Erreur de récupération des médicaments: ${response.status}`);
                    }
                    return response.json();
                })
            .then(data => {
                loadingSection.style.display = 'none';
                
                if (data.entry && data.entry.length > 0) {
                    // Stocker tous les médicaments dans la variable globale
                    medicationsData = data.entry.map(entry => entry.resource);
                    console.log(`${medicationsData.length} médicaments chargés et stockés`);
                    
                    resourcesList.innerHTML = '';
                    resourcesList.style.display = 'block';
                    
                    // Créer une liste de médicaments
                    const medicationsList = document.createElement('div');
                    medicationsList.className = 'medications-list';
                    
                    data.entry.forEach(entry => {
                        const medication = entry.resource;
                        const medicationElement = document.createElement('div');
                        medicationElement.className = 'medication-item';
                        medicationElement.style.padding = '12px';
                        medicationElement.style.margin = '8px 0';
                        medicationElement.style.backgroundColor = '#f9f9f9';
                        medicationElement.style.borderRadius = '6px';
                        medicationElement.style.borderLeft = '3px solid #e83e28';
                        
                        const status = medication.status || 'Non spécifié';
                        const authDate = medication.authoredOn ? new Date(medication.authoredOn).toLocaleDateString('fr-FR') : 'Non spécifiée';
                        
                        medicationElement.innerHTML = `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <h4 style="margin: 0 0 8px 0; color: #444; font-size: 1.1rem;">
                                    ${medication.medicationCodeableConcept?.coding?.[0]?.display || 
                                      medication.medicationCodeableConcept?.text || 
                                      'Médicament non spécifié'}
                                </h4>
                                <span style="font-size: 0.85rem; background: ${status === 'active' ? '#e8f4fd' : '#f8f9fa'}; color: ${status === 'active' ? '#0077cc' : '#6c757d'}; padding: 3px 8px; border-radius: 12px; display: inline-block;">
                                    ${status}
                                </span>
                            </div>
                            <div style="margin-bottom: 5px; font-size: 0.9rem; color: #555;">
                                <strong>Dosage:</strong> ${medication.dosageInstruction?.[0]?.text || 'Non spécifié'}
                            </div>
                            <div style="font-size: 0.9rem; color: #555;">
                                <strong>Date de prescription:</strong> ${authDate}
                            </div>
                        `;
                        
                        medicationsList.appendChild(medicationElement);
                    });
                    
                    resourcesList.appendChild(medicationsList);
                } else {
                    noResourcesSection.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des médicaments:', error);
                loadingSection.style.display = 'none';
                noResourcesSection.style.display = 'block';
                reject(error);
            })
            .finally(() => {
                resolve(medicationsData);
            });
        });
    }
    
    function loadPatientEncounters(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            const container = document.querySelector('#encountersContent');
            const loadingSection = container.querySelector('.loading-resources');
            const noResourcesSection = container.querySelector('.no-resources');
            const resourcesList = container.querySelector('.resources-list');
            
            // Réinitialiser les données des consultations
            encountersData = [];
            
            loadingSection.style.display = 'block';
            noResourcesSection.style.display = 'none';
            resourcesList.style.display = 'none';
            
            // URL de la requête FHIR avec format correct pour référence patient
            const url = `${serverUrl}/Encounter?subject=Patient/${patientId}&_sort=-date&_count=100`;
            console.log(`Chargement des consultations depuis: ${url}`);
            
            // Exécuter la requête FHIR pour récupérer les consultations
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Erreur de récupération des consultations: ${response.status}`);
                    }
                    return response.json();
                })
            .then(data => {
                loadingSection.style.display = 'none';
                
                if (data.entry && data.entry.length > 0) {
                    // Stocker toutes les consultations dans la variable globale
                    encountersData = data.entry.map(entry => entry.resource);
                    console.log(`${encountersData.length} consultations chargées et stockées`);
                    
                    resourcesList.innerHTML = '';
                    resourcesList.style.display = 'block';
                    
                    // Créer une liste de consultations
                    const encountersList = document.createElement('div');
                    encountersList.className = 'encounters-list';
                    
                    data.entry.forEach(entry => {
                        const encounter = entry.resource;
                        const encounterElement = document.createElement('div');
                        encounterElement.className = 'encounter-item';
                        encounterElement.style.padding = '12px';
                        encounterElement.style.margin = '8px 0';
                        encounterElement.style.backgroundColor = '#f9f9f9';
                        encounterElement.style.borderRadius = '6px';
                        encounterElement.style.borderLeft = '3px solid #fd7e30';
                        
                        const status = encounter.status || 'Non spécifié';
                        const periodStart = encounter.period?.start ? new Date(encounter.period.start).toLocaleDateString('fr-FR') : 'Non spécifiée';
                        const periodEnd = encounter.period?.end ? new Date(encounter.period.end).toLocaleDateString('fr-FR') : 'En cours';
                        
                        encounterElement.innerHTML = `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <h4 style="margin: 0 0 8px 0; color: #444; font-size: 1.1rem;">
                                    ${encounter.type?.[0]?.coding?.[0]?.display || encounter.type?.[0]?.text || 'Consultation'}
                                </h4>
                                <span style="font-size: 0.85rem; background: ${status === 'finished' ? '#e8f4fd' : '#f8f9fa'}; color: ${status === 'finished' ? '#0077cc' : '#6c757d'}; padding: 3px 8px; border-radius: 12px; display: inline-block;">
                                    ${status}
                                </span>
                            </div>
                            <div style="margin-bottom: 5px; font-size: 0.9rem; color: #555;">
                                <strong>Début:</strong> ${periodStart}
                            </div>
                            <div style="font-size: 0.9rem; color: #555;">
                                <strong>Fin:</strong> ${periodEnd}
                            </div>
                            <div style="font-size: 0.9rem; color: #555; margin-top: 5px;">
                                <strong>Service:</strong> ${encounter.serviceType?.coding?.[0]?.display || encounter.serviceType?.text || 'Non spécifié'}
                            </div>
                        `;
                        
                        encountersList.appendChild(encounterElement);
                    });
                    
                    resourcesList.appendChild(encountersList);
                } else {
                    noResourcesSection.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des consultations:', error);
                loadingSection.style.display = 'none';
                noResourcesSection.style.display = 'block';
                reject(error);
            })
            .finally(() => {
                resolve(encountersData);
            });
        });
    }
    
    // Fonctions pour charger les ressources supplémentaires
    function loadPatientPractitioners(patientId, serverUrl) {
        const container = document.querySelector('#practitionersContent');
        const loadingSection = container.querySelector('.loading-resources');
        const noResourcesSection = container.querySelector('.no-resources');
        const resourcesList = container.querySelector('.resources-list');
        
        // Réinitialiser les données des praticiens
        practitionersData = [];
        
        loadingSection.style.display = 'block';
        noResourcesSection.style.display = 'none';
        resourcesList.style.display = 'none';
        
        fetch(`${serverUrl}/Practitioner?_has:PractitionerRole:practitioner:patient=${patientId}&_include=PractitionerRole:practitioner&_count=100`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur de récupération des praticiens: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                loadingSection.style.display = 'none';
                
                if (data.entry && data.entry.length > 0) {
                    resourcesList.style.display = 'block';
                    resourcesList.innerHTML = '';
                    
                    // Filtrer les praticiens (dans un Bundle, nous aurons aussi des PractitionerRole)
                    const practitioners = data.entry
                        .filter(entry => entry.resource.resourceType === 'Practitioner')
                        .map(entry => entry.resource);
                    
                    practitionersData = practitioners;
                    
                    // Créer une liste de praticiens
                    const practitionersList = document.createElement('div');
                    practitionersList.style.display = 'grid';
                    practitionersList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                    practitionersList.style.gap = '15px';
                    
                    practitioners.forEach(practitioner => {
                        const practitionerElement = document.createElement('div');
                        practitionerElement.style.backgroundColor = '#f9f9f9';
                        practitionerElement.style.borderRadius = '8px';
                        practitionerElement.style.padding = '15px';
                        practitionerElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                        practitionerElement.style.borderLeft = '3px solid #e83e28';
                        
                        const name = formatPractitionerName(practitioner.name);
                        const roles = findPractitionerRoles(practitioner.id, data.entry);
                        
                        practitionerElement.innerHTML = `
                            <h4 style="margin-top: 0; color: #333; font-size: 1.1rem; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-user-md" style="color: #e83e28;"></i> ${name}
                            </h4>
                            <div style="margin-top: 10px; color: #555;">
                                <p><strong>Identifiant:</strong> ${practitioner.id}</p>
                                ${practitioner.qualification ? 
                                  `<p><strong>Qualifications:</strong> ${formatQualifications(practitioner.qualification)}</p>` 
                                  : ''}
                                ${roles && roles.length > 0 ? 
                                  `<p><strong>Rôles:</strong> ${formatRoles(roles)}</p>` 
                                  : ''}
                            </div>
                        `;
                        
                        practitionersList.appendChild(practitionerElement);
                    });
                    
                    resourcesList.appendChild(practitionersList);
                } else {
                    noResourcesSection.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des praticiens:', error);
                loadingSection.style.display = 'none';
                noResourcesSection.style.display = 'block';
            });
    }
    
    function loadPatientOrganizations(patientId, serverUrl) {
        const container = document.querySelector('#organizationsContent');
        const loadingSection = container.querySelector('.loading-resources');
        const noResourcesSection = container.querySelector('.no-resources');
        const resourcesList = container.querySelector('.resources-list');
        
        // Réinitialiser les données des organisations
        organizationsData = [];
        
        loadingSection.style.display = 'block';
        noResourcesSection.style.display = 'none';
        resourcesList.style.display = 'none';
        
        fetch(`${serverUrl}/Organization?_has:Patient:organization:_id=${patientId}&_count=100`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur de récupération des organisations: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                loadingSection.style.display = 'none';
                
                if (data.entry && data.entry.length > 0) {
                    resourcesList.style.display = 'block';
                    resourcesList.innerHTML = '';
                    
                    const organizations = data.entry.map(entry => entry.resource);
                    organizationsData = organizations;
                    
                    // Créer une liste d'organisations
                    const organizationsList = document.createElement('div');
                    organizationsList.style.display = 'grid';
                    organizationsList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                    organizationsList.style.gap = '15px';
                    
                    organizations.forEach(organization => {
                        const organizationElement = document.createElement('div');
                        organizationElement.style.backgroundColor = '#f9f9f9';
                        organizationElement.style.borderRadius = '8px';
                        organizationElement.style.padding = '15px';
                        organizationElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                        organizationElement.style.borderLeft = '3px solid #fd7e30';
                        
                        organizationElement.innerHTML = `
                            <h4 style="margin-top: 0; color: #333; font-size: 1.1rem; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-hospital-alt" style="color: #fd7e30;"></i> ${organization.name || 'Organisation sans nom'}
                            </h4>
                            <div style="margin-top: 10px; color: #555;">
                                <p><strong>Identifiant:</strong> ${organization.id}</p>
                                ${organization.alias && organization.alias.length > 0 ? 
                                  `<p><strong>Alias:</strong> ${organization.alias.join(', ')}</p>` 
                                  : ''}
                                ${organization.telecom ? 
                                  `<p><strong>Contact:</strong> ${formatTelecom(organization.telecom)}</p>` 
                                  : ''}
                                ${organization.address ? 
                                  `<p><strong>Adresse:</strong> ${formatAddress(organization.address[0])}</p>` 
                                  : ''}
                            </div>
                        `;
                        
                        organizationsList.appendChild(organizationElement);
                    });
                    
                    resourcesList.appendChild(organizationsList);
                } else {
                    noResourcesSection.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des organisations:', error);
                loadingSection.style.display = 'none';
                noResourcesSection.style.display = 'block';
            });
    }
    
    function loadPatientRelatedPersons(patientId, serverUrl) {
        const container = document.querySelector('#relatedContent');
        const loadingSection = container.querySelector('.loading-resources');
        const noResourcesSection = container.querySelector('.no-resources');
        const resourcesList = container.querySelector('.resources-list');
        
        // Réinitialiser les données des personnes liées
        relatedPersonsData = [];
        
        loadingSection.style.display = 'block';
        noResourcesSection.style.display = 'none';
        resourcesList.style.display = 'none';
        
        fetch(`${serverUrl}/RelatedPerson?patient=${patientId}&_count=100`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur de récupération des personnes liées: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                loadingSection.style.display = 'none';
                
                if (data.entry && data.entry.length > 0) {
                    resourcesList.style.display = 'block';
                    resourcesList.innerHTML = '';
                    
                    const relatedPersons = data.entry.map(entry => entry.resource);
                    relatedPersonsData = relatedPersons;
                    
                    // Créer une liste de personnes liées
                    const relatedList = document.createElement('div');
                    relatedList.style.display = 'grid';
                    relatedList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                    relatedList.style.gap = '15px';
                    
                    relatedPersons.forEach(person => {
                        const personElement = document.createElement('div');
                        personElement.style.backgroundColor = '#f9f9f9';
                        personElement.style.borderRadius = '8px';
                        personElement.style.padding = '15px';
                        personElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                        personElement.style.borderLeft = '3px solid #e83e28';
                        
                        personElement.innerHTML = `
                            <h4 style="margin-top: 0; color: #333; font-size: 1.1rem; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-users" style="color: #e83e28;"></i> ${formatPatientName(person.name) || 'Personne sans nom'}
                            </h4>
                            <div style="margin-top: 10px; color: #555;">
                                <p><strong>Identifiant:</strong> ${person.id}</p>
                                ${person.relationship ? 
                                  `<p><strong>Relation:</strong> ${formatRelationship(person.relationship)}</p>` 
                                  : ''}
                                ${person.telecom ? 
                                  `<p><strong>Contact:</strong> ${formatTelecom(person.telecom)}</p>` 
                                  : ''}
                                ${person.address ? 
                                  `<p><strong>Adresse:</strong> ${formatAddress(person.address[0])}</p>` 
                                  : ''}
                            </div>
                        `;
                        
                        relatedList.appendChild(personElement);
                    });
                    
                    resourcesList.appendChild(relatedList);
                } else {
                    noResourcesSection.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des personnes liées:', error);
                loadingSection.style.display = 'none';
                noResourcesSection.style.display = 'block';
            });
    }
    
    function loadPatientCoverage(patientId, serverUrl) {
        const container = document.querySelector('#coverageContent');
        const loadingSection = container.querySelector('.loading-resources');
        const noResourcesSection = container.querySelector('.no-resources');
        const resourcesList = container.querySelector('.resources-list');
        
        // Réinitialiser les données des couvertures
        coverageData = [];
        
        loadingSection.style.display = 'block';
        noResourcesSection.style.display = 'none';
        resourcesList.style.display = 'none';
        
        fetch(`${serverUrl}/Coverage?beneficiary=${patientId}&_count=100`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur de récupération des couvertures: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                loadingSection.style.display = 'none';
                
                if (data.entry && data.entry.length > 0) {
                    resourcesList.style.display = 'block';
                    resourcesList.innerHTML = '';
                    
                    const coverages = data.entry.map(entry => entry.resource);
                    coverageData = coverages;
                    
                    // Créer une liste de couvertures
                    const coverageList = document.createElement('div');
                    coverageList.style.display = 'grid';
                    coverageList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                    coverageList.style.gap = '15px';
                    
                    coverages.forEach(coverage => {
                        const coverageElement = document.createElement('div');
                        coverageElement.style.backgroundColor = '#f9f9f9';
                        coverageElement.style.borderRadius = '8px';
                        coverageElement.style.padding = '15px';
                        coverageElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                        coverageElement.style.borderLeft = '3px solid #fd7e30';
                        
                        coverageElement.innerHTML = `
                            <h4 style="margin-top: 0; color: #333; font-size: 1.1rem; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-file-medical" style="color: #fd7e30;"></i> 
                                ${coverage.type?.coding?.[0]?.display || coverage.type?.text || 'Couverture'}
                            </h4>
                            <div style="margin-top: 10px; color: #555;">
                                <p><strong>Identifiant:</strong> ${coverage.id}</p>
                                <p><strong>Statut:</strong> ${coverage.status || 'Non spécifié'}</p>
                                ${coverage.period ? 
                                  `<p><strong>Période:</strong> ${formatPeriod(coverage.period)}</p>` 
                                  : ''}
                                ${coverage.payor ? 
                                  `<p><strong>Payeur:</strong> ${formatPayor(coverage.payor)}</p>` 
                                  : ''}
                            </div>
                        `;
                        
                        coverageList.appendChild(coverageElement);
                    });
                    
                    resourcesList.appendChild(coverageList);
                } else {
                    noResourcesSection.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des couvertures:', error);
                loadingSection.style.display = 'none';
                noResourcesSection.style.display = 'block';
            });
    }
    
    function loadPatientBundle(patientId, serverUrl) {
        const container = document.querySelector('#bundleContent');
        const bundleInfo = document.getElementById('bundleInfo');
        const bundleResourcesList = document.getElementById('bundleResourcesList');
        
        // Afficher un indicateur de chargement
        bundleInfo.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #e83e28; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 15px; color: #666;">Chargement du bundle patient...</p>
            </div>
        `;
        
        // Construction d'une URL qui récupère le patient et toutes ses références
        // Cette URL est compatible avec la plupart des serveurs FHIR
        const bundleUrl = `${serverUrl}/Patient/${patientId}?_include=Patient:organization&_include=Patient:general-practitioner&_revinclude=Condition:subject&_revinclude=Observation:subject&_revinclude=MedicationRequest:subject&_revinclude=Encounter:subject&_revinclude=Coverage:beneficiary&_revinclude=RelatedPerson:patient&_format=json`;
        
        console.log(`Chargement du bundle depuis: ${bundleUrl}`);
        
        fetch(bundleUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur de récupération du bundle: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Stocker le bundle pour référence future
                bundleData = data;
                
                // Afficher les informations sur le bundle
                if (data.resourceType === 'Bundle') {
                    // Simuler une response type "transaction-response" comme montré dans votre exemple
                    const resourceCount = data.entry ? data.entry.length : 0;
                    const resourceTypes = data.entry ? 
                        [...new Set(data.entry.map(e => e.resource.resourceType))].sort() : [];
                    
                    bundleInfo.innerHTML = `
                        <p><strong>Type de bundle:</strong> ${data.type || 'Inconnu'}</p>
                        <p><strong>Identifiant:</strong> ${data.id || 'Non spécifié'}</p>
                        <p><strong>Nombre de ressources:</strong> ${resourceCount}</p>
                        <p><strong>Types de ressources:</strong> ${resourceTypes.join(', ') || 'Aucun'}</p>
                    `;
                    
                    // Afficher les ressources de manière organisée
                    bundleResourcesList.innerHTML = '';
                    
                    if (data.entry && data.entry.length > 0) {
                        // Regrouper par type de ressource pour un affichage organisé
                        const resourceGroups = {};
                        data.entry.forEach(entry => {
                            const resourceType = entry.resource.resourceType;
                            if (!resourceGroups[resourceType]) {
                                resourceGroups[resourceType] = [];
                            }
                            resourceGroups[resourceType].push(entry.resource);
                        });
                        
                        // Créer une section pour chaque type de ressource
                        for (const [type, resources] of Object.entries(resourceGroups)) {
                            const sectionElement = document.createElement('div');
                            sectionElement.style.marginBottom = '20px';
                            
                            const sectionTitle = document.createElement('h4');
                            sectionTitle.style.marginTop = '20px';
                            sectionTitle.style.marginBottom = '10px';
                            sectionTitle.style.padding = '10px';
                            sectionTitle.style.backgroundColor = '#f5f5f5';
                            sectionTitle.style.borderRadius = '5px';
                            sectionTitle.innerHTML = `<i class="fas fa-folder-open"></i> ${type} (${resources.length})`;
                            
                            sectionElement.appendChild(sectionTitle);
                            
                            // Liste des ressources de ce type
                            const listElement = document.createElement('ul');
                            listElement.style.listStyle = 'none';
                            listElement.style.padding = '0';
                            listElement.style.margin = '0';
                            listElement.style.display = 'grid';
                            listElement.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                            listElement.style.gap = '10px';
                            
                            resources.forEach(resource => {
                                const listItem = document.createElement('li');
                                listItem.style.padding = '10px';
                                listItem.style.backgroundColor = '#f9f9f9';
                                listItem.style.borderRadius = '5px';
                                listItem.style.border = '1px solid #eee';
                                
                                // Afficher les informations de base sur la ressource
                                let resourceName = resource.id;
                                if (type === 'Patient' && resource.name) {
                                    resourceName = formatPatientName(resource.name);
                                } else if (type === 'Practitioner' && resource.name) {
                                    resourceName = formatPractitionerName(resource.name);
                                } else if (type === 'Organization' && resource.name) {
                                    resourceName = resource.name;
                                }
                                
                                listItem.innerHTML = `
                                    <div style="font-weight: bold;">${resourceName}</div>
                                    <div style="font-size: 0.8rem; color: #666;">ID: ${resource.id}</div>
                                `;
                                
                                listElement.appendChild(listItem);
                            });
                            
                            sectionElement.appendChild(listElement);
                            bundleResourcesList.appendChild(sectionElement);
                        }
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
                bundleInfo.innerHTML = `<p>Erreur lors du chargement du bundle: ${error.message}</p>`;
                bundleResourcesList.innerHTML = '';
            });
            
        // Si nous avons une réponse de transaction (comme l'exemple partagé)
        if (lastBundleResponse) {
            bundleInfo.innerHTML = `
                <p><strong>Type de bundle:</strong> ${lastBundleResponse.type || 'Inconnu'}</p>
                <p><strong>Identifiant:</strong> ${lastBundleResponse.id || 'Non spécifié'}</p>
                <p><strong>Ressources créées:</strong> ${lastBundleResponse.entry?.length || 0}</p>
            `;
            
            bundleResourcesList.innerHTML = '';
            
            if (lastBundleResponse.entry && lastBundleResponse.entry.length > 0) {
                const responsesElement = document.createElement('div');
                responsesElement.style.marginTop = '20px';
                
                lastBundleResponse.entry.forEach((entry, index) => {
                    const responseElement = document.createElement('div');
                    responseElement.style.padding = '10px';
                    responseElement.style.margin = '10px 0';
                    responseElement.style.backgroundColor = '#f9f9f9';
                    responseElement.style.borderRadius = '5px';
                    responseElement.style.border = '1px solid #eee';
                    
                    // Extraire les informations de la réponse
                    const status = entry.response?.status || 'Inconnu';
                    const location = entry.response?.location || 'Non spécifié';
                    const isSuccess = status.startsWith('2');
                    const resourceType = location.split('/')[0] || 'Ressource';
                    
                    responseElement.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-weight: bold;">
                                <i class="fas fa-${isSuccess ? 'check-circle' : 'times-circle'}" 
                                   style="color: ${isSuccess ? '#4caf50' : '#f44336'};"></i>
                                ${resourceType}
                            </div>
                            <div style="font-size: 0.8rem; padding: 2px 8px; background-color: ${isSuccess ? '#e8f5e9' : '#ffebee'}; 
                                        border-radius: 10px; color: ${isSuccess ? '#2e7d32' : '#c62828'};">
                                ${status}
                            </div>
                        </div>
                        <div style="font-size: 0.9rem; margin-top: 5px;">
                            <strong>Emplacement:</strong> ${location}
                        </div>
                    `;
                    
                    responsesElement.appendChild(responseElement);
                });
                
                bundleResourcesList.appendChild(responsesElement);
            }
        }
    }
    
    // Fonctions utilitaires pour le formatage des nouvelles ressources
    function formatPractitionerName(names) {
        if (!names || names.length === 0) return 'Sans nom';
        
        const name = names[0];
        let formattedName = '';
        
        if (name.prefix) formattedName += name.prefix.join(' ') + ' ';
        if (name.given) formattedName += name.given.join(' ') + ' ';
        if (name.family) formattedName += name.family;
        
        return formattedName.trim() || 'Sans nom';
    }
    
    function formatQualifications(qualifications) {
        if (!qualifications || qualifications.length === 0) return 'Aucune qualification';
        
        return qualifications.map(qual => {
            let text = '';
            if (qual.code && qual.code.coding && qual.code.coding.length > 0) {
                text += qual.code.coding[0].display || qual.code.coding[0].code;
            }
            if (qual.period && qual.period.start) {
                const start = new Date(qual.period.start).toLocaleDateString();
                text += ` (depuis ${start})`;
            }
            return text;
        }).join(', ');
    }
    
    function findPractitionerRoles(practitionerId, entries) {
        if (!entries) return [];
        
        return entries
            .filter(entry => 
                entry.resource.resourceType === 'PractitionerRole' && 
                entry.resource.practitioner && 
                entry.resource.practitioner.reference.includes(practitionerId))
            .map(entry => entry.resource);
    }
    
    function formatRoles(roles) {
        if (!roles || roles.length === 0) return 'Aucun rôle spécifié';
        
        return roles.map(role => {
            let text = '';
            if (role.code && role.code.length > 0 && role.code[0].coding && role.code[0].coding.length > 0) {
                text += role.code[0].coding[0].display || role.code[0].coding[0].code;
            } else if (role.specialty && role.specialty.length > 0) {
                text += role.specialty[0].coding[0].display || role.specialty[0].coding[0].code;
            } else {
                text += 'Rôle non spécifié';
            }
            return text;
        }).join(', ');
    }
    
    function formatTelecom(telecom) {
        if (!telecom || telecom.length === 0) return 'Non spécifié';
        
        return telecom.map(t => {
            const system = t.system ? t.system.charAt(0).toUpperCase() + t.system.slice(1) : '';
            return `${system}: ${t.value}`;
        }).join(', ');
    }
    
    function formatAddress(address) {
        if (!address) return 'Non spécifiée';
        
        let formattedAddress = '';
        if (address.line) formattedAddress += address.line.join(', ') + ', ';
        if (address.postalCode) formattedAddress += address.postalCode + ' ';
        if (address.city) formattedAddress += address.city + ', ';
        if (address.country) formattedAddress += address.country;
        
        return formattedAddress.trim() || 'Non spécifiée';
    }
    
    function formatRelationship(relationship) {
        if (!relationship || relationship.length === 0) return 'Non spécifiée';
        
        return relationship.map(r => {
            if (r.coding && r.coding.length > 0) {
                return r.coding[0].display || r.coding[0].code;
            }
            return r.text || 'Relation non spécifiée';
        }).join(', ');
    }
    
    function formatPeriod(period) {
        if (!period) return 'Non spécifiée';
        
        let result = '';
        if (period.start) {
            const start = new Date(period.start).toLocaleDateString();
            result += `Du ${start} `;
        }
        if (period.end) {
            const end = new Date(period.end).toLocaleDateString();
            result += `au ${end}`;
        } else if (period.start) {
            result += 'à aujourd\'hui';
        }
        
        return result || 'Non spécifiée';
    }
    
    function formatPayor(payor) {
        if (!payor || payor.length === 0) return 'Non spécifié';
        
        return payor.map(p => {
            if (p.display) return p.display;
            if (p.reference) {
                const parts = p.reference.split('/');
                return parts.length > 1 ? `${parts[0]} (${parts[1]})` : p.reference;
            }
            return 'Payeur non spécifié';
        }).join(', ');
    }
    
    function generateTimeline(patientId, serverUrl) {
        try {
            // Vérifier les paramètres d'entrée
            if (!patientId || !serverUrl) {
                console.error("Impossible de générer la chronologie: identifiant du patient ou URL du serveur manquant");
                return;
            }
            
            // Ajouter un message de logging pour debug
            console.log(`Génération de la chronologie pour le patient ${patientId} sur ${serverUrl}`);
            
            const container = document.querySelector('#timelineContent');
            if (!container) {
                console.error("Container #timelineContent non trouvé dans le DOM");
                return;
            }
            
            const loadingSection = container.querySelector('.loading-resources');
            const noResourcesSection = container.querySelector('.no-resources');
            const resourcesList = container.querySelector('.resources-list');
            
            if (!loadingSection || !noResourcesSection || !resourcesList) {
                console.error("Structure DOM incorrecte dans le container de chronologie");
                return;
            }
            
            loadingSection.style.display = 'block';
            noResourcesSection.style.display = 'none';
            resourcesList.style.display = 'none';
            
            // Fonction sécurisée pour récupérer les ressources
            const fetchSafely = async (url) => {
                try {
                    console.log(`Récupération des données depuis: ${url}`);
                    // Encoder correctement l'URL
                    const encodedUrl = url.replace(/&amp;/g, '&');
                    
                    // Utiliser xhr pour éviter les problèmes potentiels avec fetch dans certains navigateurs
                    return new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', encodedUrl);
                        xhr.onload = function() {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                try {
                                    const data = JSON.parse(xhr.responseText);
                                    resolve(data);
                                } catch (error) {
                                    console.warn(`Problème de parsing JSON: ${encodedUrl}`, error);
                                    resolve({ entry: [] });
                                }
                            } else {
                                console.warn(`Problème de récupération: ${encodedUrl}, statut: ${xhr.status}`);
                                resolve({ entry: [] });
                            }
                        };
                        xhr.onerror = function() {
                            console.error(`Erreur réseau lors de la récupération: ${encodedUrl}`);
                            resolve({ entry: [] });
                        };
                        xhr.send();
                    });
                } catch (error) {
                    console.error(`Erreur lors de la récupération: ${url}`, error);
                    return { entry: [] };
                }
            };
            
            // Récupérer toutes les ressources pour la chronologie avec les formats corrects pour les références patient
            console.log(`Génération de la chronologie pour le patient ${patientId}`);
            Promise.all([
                fetchSafely(`${serverUrl}/Encounter?subject=Patient/${patientId}&_count=100`),
                fetchSafely(`${serverUrl}/Observation?subject=Patient/${patientId}&_count=100`),
                fetchSafely(`${serverUrl}/MedicationRequest?subject=Patient/${patientId}&_count=100`),
                fetchSafely(`${serverUrl}/Condition?subject=Patient/${patientId}&_count=100`)
            ])
        .then(([encounters, observations, medications, conditions]) => {
            loadingSection.style.display = 'none';
            
            // Combiner toutes les entrées
            const timelineEntries = [];
            
            // Ajouter les consultations
            if (encounters.entry && encounters.entry.length > 0) {
                encounters.entry.forEach(entry => {
                    if (entry.resource.period && entry.resource.period.start) {
                        timelineEntries.push({
                            type: 'encounter',
                            resource: entry.resource,
                            date: new Date(entry.resource.period.start),
                            title: entry.resource.type?.[0]?.coding?.[0]?.display || 'Consultation',
                            icon: 'fa-hospital',
                            color: '#fd7e30'
                        });
                    }
                });
            }
            
            // Ajouter les observations
            if (observations.entry && observations.entry.length > 0) {
                observations.entry.forEach(entry => {
                    const effectiveDate = getEffectiveDate(entry.resource, true);
                    if (effectiveDate) {
                        timelineEntries.push({
                            type: 'observation',
                            resource: entry.resource,
                            date: new Date(effectiveDate),
                            title: entry.resource.code?.coding?.[0]?.display || 'Observation',
                            icon: 'fa-vial',
                            color: '#fd7e30'
                        });
                    }
                });
            }
            
            // Ajouter les médicaments
            if (medications.entry && medications.entry.length > 0) {
                medications.entry.forEach(entry => {
                    if (entry.resource.authoredOn) {
                        timelineEntries.push({
                            type: 'medication',
                            resource: entry.resource,
                            date: new Date(entry.resource.authoredOn),
                            title: entry.resource.medicationCodeableConcept?.coding?.[0]?.display || 'Médicament',
                            icon: 'fa-pills',
                            color: '#e83e28'
                        });
                    }
                });
            }
            
            // Ajouter les conditions
            if (conditions.entry && conditions.entry.length > 0) {
                conditions.entry.forEach(entry => {
                    if (entry.resource.recordedDate) {
                        timelineEntries.push({
                            type: 'condition',
                            resource: entry.resource,
                            date: new Date(entry.resource.recordedDate),
                            title: entry.resource.code?.coding?.[0]?.display || 'Condition',
                            icon: 'fa-heartbeat',
                            color: '#e83e28'
                        });
                    }
                });
            }
            
            // Trier les entrées chronologiquement
            timelineEntries.sort((a, b) => b.date - a.date);
            
            if (timelineEntries.length > 0) {
                resourcesList.innerHTML = '';
                resourcesList.style.display = 'block';
                
                // Créer la chronologie
                const timelineElement = document.createElement('div');
                timelineElement.className = 'timeline';
                timelineElement.style.position = 'relative';
                timelineElement.style.padding = '0 0 0 30px';
                
                timelineEntries.forEach((entry, index) => {
                    const entryElement = document.createElement('div');
                    entryElement.className = 'timeline-entry';
                    entryElement.style.position = 'relative';
                    entryElement.style.paddingBottom = '20px';
                    entryElement.style.borderLeft = '2px solid #ddd';
                    entryElement.style.paddingLeft = '20px';
                    entryElement.style.marginLeft = '-1px';
                    
                    // Formater la date
                    const formattedDate = entry.date.toLocaleDateString('fr-FR', {
                        day: '2-digit', 
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    entryElement.innerHTML = `
                        <div style="position: absolute; left: -10px; background-color: ${entry.color}; width: 18px; height: 18px; border-radius: 50%; text-align: center; color: white; top: 0;">
                            <i class="fas ${entry.icon}" style="font-size: 10px; line-height: 18px;"></i>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 10px 15px; border-radius: 6px; border-left: 3px solid ${entry.color};">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h4 style="margin: 0; font-size: 1rem; color: #333;">${entry.title}</h4>
                                <span style="font-size: 0.8rem; color: #777;">${formattedDate}</span>
                            </div>
                            <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #555;">
                                ${getTimelineDescription(entry)}
                            </p>
                        </div>
                    `;
                    
                    timelineElement.appendChild(entryElement);
                });
                
                resourcesList.appendChild(timelineElement);
            } else {
                noResourcesSection.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Erreur lors de la génération de la chronologie:', error);
            loadingSection.style.display = 'none';
            noResourcesSection.style.display = 'block';
            resourcesList.style.display = 'none';
            
            // Afficher un message d'erreur plus explicite
            noResourcesSection.innerHTML = `
                <div class="alert alert-warning">
                    <h4>Erreur lors de la génération de la chronologie</h4>
                    <p>Nous n'avons pas pu générer la chronologie pour ce patient. Veuillez réessayer ultérieurement.</p>
                    <details>
                        <summary>Détails techniques</summary>
                        <pre>${error.message || 'Erreur inconnue'}</pre>
                    </details>
                </div>
            `;
            
            // Résoudre la promesse avec les données de la chronologie
            const timelineData = {
                entries: timelineEntries,
                count: timelineEntries.length
            };
            resolve(timelineData);
        })
        .catch(error => {
            console.error('Erreur dans generateTimeline:', error);
            // Afficher un message d'erreur dans l'interface
            const container = document.querySelector('#timelineContent');
            if (container) {
                const noResourcesSection = container.querySelector('.no-resources');
                if (noResourcesSection) {
                    noResourcesSection.style.display = 'block';
                    noResourcesSection.innerHTML = `
                        <div class="alert alert-danger">
                            <h4>Erreur critique</h4>
                            <p>Une erreur est survenue lors de la génération de la chronologie.</p>
                            <details>
                                <summary>Détails techniques</summary>
                                <pre>${error.message || 'Erreur inconnue'}</pre>
                            </details>
                        </div>
                    `;
                }
            }
            reject(error);
        });
    } catch (error) {
        console.error('Exception globale dans generateTimeline:', error);
        // Afficher un message d'erreur dans l'interface si possible
        try {
            const container = document.querySelector('#timelineContent');
            if (container) {
                const noResourcesSection = container.querySelector('.no-resources');
                if (noResourcesSection) {
                    noResourcesSection.style.display = 'block';
                    noResourcesSection.innerHTML = `
                        <div class="alert alert-danger">
                            <h4>Erreur critique</h4>
                            <p>Une erreur est survenue lors de la génération de la chronologie.</p>
                            <details>
                                <summary>Détails techniques</summary>
                                <pre>${error.message || 'Erreur inconnue'}</pre>
                            </details>
                        </div>
                    `;
                }
            }
        } catch (displayError) {
            console.error('Impossible d\'afficher le message d\'erreur:', displayError);
        }
        reject(error);
    }
    });
}
    
    // Fonctions utilitaires
    function getObservationValue(observation) {
        if (observation.valueQuantity) {
            return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`;
        } else if (observation.valueCodeableConcept) {
            return observation.valueCodeableConcept.coding?.[0]?.display || observation.valueCodeableConcept.text || 'Non spécifiée';
        } else if (observation.valueString) {
            return observation.valueString;
        } else if (observation.valueBoolean !== undefined) {
            return observation.valueBoolean ? 'Oui' : 'Non';
        } else if (observation.valueInteger !== undefined) {
            return observation.valueInteger.toString();
        } else if (observation.valueRange) {
            return `${observation.valueRange.low?.value || '?'} - ${observation.valueRange.high?.value || '?'} ${observation.valueRange.low?.unit || ''}`;
        } else if (observation.valueRatio) {
            return `${observation.valueRatio.numerator?.value || '?'} : ${observation.valueRatio.denominator?.value || '?'}`;
        } else if (observation.component && observation.component.length > 0) {
            return 'Composants multiples';
        } else {
            return 'Non spécifiée';
        }
    }
    
    function getEffectiveDate(observation, returnRaw = false) {
        let date;
        if (observation.effectiveDateTime) {
            date = observation.effectiveDateTime;
        } else if (observation.effectivePeriod && observation.effectivePeriod.start) {
            date = observation.effectivePeriod.start;
        } else if (observation.issued) {
            date = observation.issued;
        } else {
            return returnRaw ? null : 'Non spécifiée';
        }
        
        return returnRaw ? date : new Date(date).toLocaleDateString('fr-FR');
    }
    
    function getTimelineDescription(entry) {
        switch (entry.type) {
            case 'encounter':
                return `${entry.resource.serviceType?.coding?.[0]?.display || 'Consultation'} - ${entry.resource.status || 'Non spécifié'}`;
            case 'observation':
                return `Valeur: ${getObservationValue(entry.resource)}`;
            case 'medication':
                return `${entry.resource.dosageInstruction?.[0]?.text || 'Posologie non spécifiée'}`;
            case 'condition':
                return `${entry.resource.clinicalStatus?.coding?.[0]?.display || entry.resource.clinicalStatus?.coding?.[0]?.code || 'Non spécifié'}`;
            default:
                return '';
        }
    }
    
    // Analyse IA (utilise le fournisseur d'IA actif) avec gestion d'erreurs robuste
    analyzeAIBtn.addEventListener('click', function() {
        if (!patientData) {
            alert('Veuillez charger un patient d\'abord');
            return;
        }
        
        const aiAnalysisDiv = document.getElementById('aiAnalysis');
        aiAnalysisDiv.style.display = 'block';
        
        // Montrer d'abord un indicateur de chargement
        aiAnalysisDiv.innerHTML = `
            <div style="text-align: center; padding: 30px;">
                <div style="display: inline-block; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #e83e28; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 15px; color: #666;">Analyse IA en cours...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        // Fonction pour afficher l'analyse locale en cas d'erreur
        function showLocalAnalysis(errorMessage) {
            console.log("Affichage de l'analyse locale car:", errorMessage);
            const localAnalysis = generatePatientSummary(patientData);
            aiAnalysisDiv.innerHTML = `
                <div style="background: #fff8f8; padding: 10px; border-radius: 5px; margin-bottom: 15px; border-left: 3px solid #e83e28;">
                    <p style="margin: 0; color: #e83e28;"><i class="fas fa-exclamation-circle"></i> Le service d'IA n'est pas disponible actuellement.</p>
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9em;">${errorMessage}</p>
                </div>
                ${localAnalysis}
            `;
        }
        
        // Appel API au backend en utilisant XMLHttpRequest pour une meilleure gestion des erreurs
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/ai/analyze-patient');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 30000; // 30 secondes de timeout
        
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success && data.analysis) {
                        aiAnalysisDiv.innerHTML = data.analysis;
                    } else {
                        // En cas d'erreur ou réponse vide, utiliser l'analyse locale comme fallback
                        showLocalAnalysis(data.error || "Pas de résultat d'analyse disponible");
                    }
                } catch (error) {
                    showLocalAnalysis("Erreur de traitement de la réponse IA");
                }
            } else {
                showLocalAnalysis(`Erreur de communication avec le service IA (${xhr.status})`);
            }
        };
        
        xhr.ontimeout = function() {
            showLocalAnalysis("Délai d'attente dépassé pour l'analyse IA");
        };
        
        xhr.onerror = function() {
            showLocalAnalysis("Erreur de connexion au service IA");
        };
        
        try {
            // Créer un objet complet avec toutes les données du patient de tous les onglets
            const completePatientData = {
                patient: patientData,
                conditions: conditionsData,
                observations: observationsData,
                medications: medicationsData,
                encounters: encountersData
            };
            
            console.log("Envoi de l'analyse IA avec données complètes:", 
                `Patient: ${patientData ? 'OK' : 'Manquant'}, ` +
                `Conditions: ${conditionsData.length}, ` +
                `Observations: ${observationsData.length}, ` + 
                `Médicaments: ${medicationsData.length}, ` +
                `Consultations: ${encountersData.length}`
            );
            
            xhr.send(JSON.stringify({
                patientId: patientData.id,
                serverUrl: serverSelect.value,
                patientData: completePatientData
            }));
        } catch (error) {
            showLocalAnalysis("Erreur lors de l'envoi de la requête IA");
        }
    });
    
    // Permettre la recherche avec la touche Entrée
    patientSearch.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            searchPatients();
        }
    });
    
    // Déclencher la recherche lors du clic sur le bouton
    searchPatientBtn.addEventListener('click', searchPatients);
    
    // Effacer la recherche lors du clic sur le bouton d'effacement
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Charger les détails du patient sélectionné
    loadPatientBtn.addEventListener('click', loadPatient);
    
    // Remplir le champ JSON
    function updateJsonView() {
        if (patientData) {
            document.getElementById('jsonContent').textContent = JSON.stringify(patientData, null, 2);
        }
    }
    
    // IDENTITOVIGILANCE: Effacer les données lorsque l'utilisateur change de serveur FHIR
    serverSelect.addEventListener('change', function() {
        // Effacer la recherche et toutes les données du patient
        patientSearch.value = '';
        patientSelect.innerHTML = '<option value="">-- Sélectionnez un patient --</option>';
        clearPatientData();
        
        // Cacher les conteneurs
        document.getElementById('serverStatus').style.display = 'none';
        document.getElementById('patientContainer').style.display = 'none';
        
        console.log('IDENTITOVIGILANCE: Changement de serveur FHIR - Données du patient effacées');
    });
});