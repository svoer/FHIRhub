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
                // Le style est maintenant géré par CSS
            });
            
            // Désactiver tous les contenus
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });
            
            // Activer l'onglet sélectionné
            this.classList.add('active');
            
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
        
        try {
            const selectedOption = patientSelect.options[patientSelect.selectedIndex];
            patientData = JSON.parse(selectedOption.dataset.patient);
            
            // Afficher les détails
            document.getElementById('patientName').textContent = formatPatientName(patientData.name);
            document.getElementById('patientDetails').textContent = 
                `ID: ${patientData.id} | Genre: ${patientData.gender || 'Non spécifié'} | Naissance: ${patientData.birthDate || 'Non spécifiée'}`;
            
            // Afficher le conteneur de patient
            document.getElementById('patientContainer').style.display = 'block';
            
            // Afficher un status de chargement
            showStatus('Chargement de toutes les données médicales du patient...', 'info');
            
            // Tenter de charger toutes les ressources en une seule requête avec $everything
            fetch(`${server}/Patient/${patientId}/$everything`)
                .then(response => {
                    if (!response.ok) {
                        // Si $everything n'est pas supporté, on utilise l'approche traditionnelle
                        console.warn("L'opération $everything n'est pas supportée, chargement individuel des ressources");
                        throw new Error("$everything non supporté");
                    }
                    return response.json();
                })
                .then(bundle => {
                    console.log("Bundle complet récupéré via $everything:", bundle);
                    showStatus('Chargement complet des données réussi via $everything', 'success');
                    
                    // Traiter le bundle et extraire les différentes ressources par type
                    if (bundle.entry && bundle.entry.length > 0) {
                        // Grouper les ressources par type
                        const resourcesByType = {};
                        
                        bundle.entry.forEach(entry => {
                            if (entry.resource) {
                                const type = entry.resource.resourceType;
                                if (!resourcesByType[type]) {
                                    resourcesByType[type] = [];
                                }
                                resourcesByType[type].push(entry.resource);
                            }
                        });
                        
                        // Mettre à jour tous les onglets en fonction des données disponibles
                        if (resourcesByType.Condition) {
                            conditionsData = resourcesByType.Condition;
                            updateConditionsTab(conditionsData);
                        }
                        
                        if (resourcesByType.Observation) {
                            observationsData = resourcesByType.Observation;
                            updateObservationsTab(observationsData);
                        }
                        
                        if (resourcesByType.MedicationRequest) {
                            medicationsData = resourcesByType.MedicationRequest;
                            updateMedicationsTab(medicationsData);
                        }
                        
                        if (resourcesByType.Encounter) {
                            encountersData = resourcesByType.Encounter;
                            updateEncountersTab(encountersData);
                        }
                        
                        if (resourcesByType.Practitioner) {
                            practitionersData = resourcesByType.Practitioner;
                            updatePractitionersTab(practitionersData);
                        }
                        
                        if (resourcesByType.Organization) {
                            organizationsData = resourcesByType.Organization;
                            updateOrganizationsTab(organizationsData);
                        }
                        
                        if (resourcesByType.RelatedPerson) {
                            relatedPersonsData = resourcesByType.RelatedPerson;
                            updateRelatedPersonsTab(relatedPersonsData);
                        }
                        
                        if (resourcesByType.Coverage) {
                            coverageData = resourcesByType.Coverage;
                            updateCoverageTab(coverageData);
                        }
                        
                        // Mettre à jour l'onglet bundle avec les données complètes
                        bundleData = bundle;
                        updateBundleView(bundle);
                        
                        // Générer la chronologie à partir des données du bundle
                        generateTimelineFromBundle(bundle);
                    } else {
                        showStatus('Le bundle est vide ou mal formaté, utilisation de la méthode traditionnelle', 'warning');
                        loadResourcesTraditionnally();
                    }
                })
                .catch(error => {
                    console.error("Erreur avec $everything:", error);
                    loadResourcesTraditionnally();
                });
                
            // Fonction pour charger les ressources de façon traditionnelle
            function loadResourcesTraditionnally() {
                showStatus('Chargement individuel des ressources...', 'info');
                // Charger toutes les ressources associées au patient individuellement
                loadPatientConditions(patientId, server);
                loadPatientObservations(patientId, server);
                loadPatientMedications(patientId, server);
                loadPatientEncounters(patientId, server);
                loadPatientPractitioners(patientId, server);
                loadPatientOrganizations(patientId, server);
                loadPatientRelatedPersons(patientId, server);
                loadPatientCoverage(patientId, server);
                generateTimeline(patientId, server);
                loadPatientBundle(patientId, server);
            }
            
            // Fonction pour générer une chronologie à partir d'un bundle
            function generateTimelineFromBundle(bundle) {
                if (!bundle || !bundle.entry || bundle.entry.length === 0) {
                    console.warn("Bundle vide ou invalide pour la génération de chronologie");
                    return;
                }
                
                console.log("Génération de chronologie à partir du bundle complet...");
                
                const timelineItems = [];
                
                // Parcourir toutes les ressources du bundle et extraire les éléments pour la chronologie
                bundle.entry.forEach(entry => {
                    if (!entry.resource) return;
                    
                    const resource = entry.resource;
                    let date = null;
                    let description = '';
                    let category = '';
                    let icon = '';
                    let value = '';
                    
                    switch(resource.resourceType) {
                        case 'Encounter':
                            date = resource.period ? (resource.period.start || resource.period.end) : null;
                            description = (resource.type && resource.type[0] && 
                                        ((resource.type[0].coding && resource.type[0].coding[0] && 
                                          (resource.type[0].coding[0].display || resource.type[0].coding[0].code)) || 
                                         resource.type[0].text)) || 'Consultation';
                            category = 'encounter';
                            icon = 'stethoscope';
                            break;
                            
                        case 'Condition':
                            date = resource.onsetDateTime || (resource.recordedDate || null);
                            description = (resource.code && 
                                        ((resource.code.coding && resource.code.coding[0] && 
                                          (resource.code.coding[0].display || resource.code.coding[0].code)) || 
                                         resource.code.text)) || 'Condition';
                            category = 'condition';
                            icon = 'heartbeat';
                            break;
                            
                        case 'Observation':
                            date = resource.effectiveDateTime || resource.issued || null;
                            description = (resource.code && 
                                        ((resource.code.coding && resource.code.coding[0] && 
                                          (resource.code.coding[0].display || resource.code.coding[0].code)) || 
                                         resource.code.text)) || 'Observation';
                            
                            // Extraire la valeur
                            if (resource.valueQuantity) {
                                value = resource.valueQuantity.value + ' ' + (resource.valueQuantity.unit || '');
                            } else if (resource.valueString) {
                                value = resource.valueString;
                            } else if (resource.valueCodeableConcept && resource.valueCodeableConcept.coding && resource.valueCodeableConcept.coding[0]) {
                                value = resource.valueCodeableConcept.coding[0].display || resource.valueCodeableConcept.coding[0].code;
                            } else if (resource.valueCodeableConcept && resource.valueCodeableConcept.text) {
                                value = resource.valueCodeableConcept.text;
                            }
                            
                            category = 'observation';
                            icon = 'microscope';
                            break;
                            
                        case 'MedicationRequest':
                            date = resource.authoredOn || null;
                            description = (resource.medicationCodeableConcept && 
                                        ((resource.medicationCodeableConcept.coding && resource.medicationCodeableConcept.coding[0] && 
                                          (resource.medicationCodeableConcept.coding[0].display || resource.medicationCodeableConcept.coding[0].code)) || 
                                         resource.medicationCodeableConcept.text)) || 'Médicament';
                            
                            if (resource.dosageInstruction && resource.dosageInstruction[0] && resource.dosageInstruction[0].text) {
                                value = resource.dosageInstruction[0].text;
                            }
                            
                            category = 'medication';
                            icon = 'pills';
                            break;
                            
                        case 'Procedure':
                            date = resource.performedDateTime || (resource.performedPeriod ? resource.performedPeriod.start : null);
                            description = (resource.code && 
                                        ((resource.code.coding && resource.code.coding[0] && 
                                          (resource.code.coding[0].display || resource.code.coding[0].code)) || 
                                         resource.code.text)) || 'Procédure';
                            category = 'procedure';
                            icon = 'procedures';
                            break;
                            
                        case 'AllergyIntolerance':
                            date = resource.recordedDate || resource.onsetDateTime || null;
                            description = (resource.code && 
                                        ((resource.code.coding && resource.code.coding[0] && 
                                          ('Allergie: ' + (resource.code.coding[0].display || resource.code.coding[0].code))) || 
                                         ('Allergie: ' + resource.code.text))) || 'Allergie';
                            category = 'allergy';
                            icon = 'allergies';
                            break;
                    }
                    
                    if (date && description) {
                        timelineItems.push({
                            date: date,
                            description: description,
                            value: value,
                            category: category,
                            icon: icon,
                            resource: resource
                        });
                    }
                });
                
                // Trier par date
                timelineItems.sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    return dateB - dateA; // Tri décroissant (plus récent d'abord)
                });
                
                // Afficher la chronologie
                if (timelineItems.length === 0) {
                    document.querySelector('#timelineContent .no-resources').style.display = 'block';
                    document.querySelector('#timelineContent .loading-resources').style.display = 'none';
                    return;
                }
                
                // Récupérer le conteneur et préparer l'affichage
                const container = document.querySelector('#timelineContent');
                const loadingSection = document.querySelector('#timelineContent .loading-resources');
                const noResourcesSection = document.querySelector('#timelineContent .no-resources');
                const resourcesList = document.querySelector('#timelineContent .resources-list');
                
                if (!container || !loadingSection || !noResourcesSection || !resourcesList) {
                    console.error("Structure DOM incorrecte pour la chronologie");
                    return;
                }
                
                loadingSection.style.display = 'none';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'block';
                resourcesList.innerHTML = '';
                
                // Ajouter chaque élément à la chronologie
                timelineItems.forEach(item => {
                    const itemDate = new Date(item.date);
                    const formattedDate = itemDate.toLocaleDateString('fr-FR', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    const formattedTime = itemDate.toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    
                    let color;
                    switch(item.category) {
                        case 'observation': color = '#1abc9c'; break;
                        case 'condition': color = '#c0392b'; break;
                        case 'encounter': color = '#9b59b6'; break;
                        case 'medication': color = '#3498db'; break;
                        case 'procedure': color = '#f39c12'; break;
                        case 'allergy': color = '#e74c3c'; break;
                        default: color = '#e83e28';
                    }
                    
                    const element = document.createElement('div');
                    element.className = 'timeline-item';
                    element.dataset.type = item.category;
                    element.dataset.date = item.date;
                    element.innerHTML = `
                        <div class="timeline-date">
                            <div class="date">${formattedDate}</div>
                            <div class="time">${formattedTime}</div>
                        </div>
                        <div class="timeline-icon" style="background-color: ${color}">
                            <i class="fas fa-${item.icon}"></i>
                        </div>
                        <div class="timeline-content">
                            <h4 style="color: ${color}">${item.description}</h4>
                            ${item.value ? `<p>${item.value}</p>` : ''}
                            <button class="btn-view-json" data-resource-type="${item.resource.resourceType}" data-resource-id="${item.resource.id}">
                                Voir JSON <i class="fas fa-code"></i>
                            </button>
                        </div>
                    `;
                    
                    resourcesList.appendChild(element);
                    
                    // Ajouter un gestionnaire d'événement pour voir le JSON
                    const btn = element.querySelector('.btn-view-json');
                    if (btn) {
                        btn.addEventListener('click', function() {
                            const resourceJson = JSON.stringify(item.resource, null, 2);
                            document.getElementById('json-content').textContent = resourceJson;
                            
                            // Activer l'onglet JSON
                            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                            document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
                            document.querySelector('.tab[data-tab="json"]').classList.add('active');
                            document.getElementById('json').style.display = 'block';
                        });
                    }
                });
                
                console.log(`${timelineItems.length} éléments ajoutés à la chronologie`);
            }
            
            // Fonction pour mettre à jour l'affichage du bundle
            function updateBundleView(bundle) {
                // S'assurer que le bundle existe
                if (!bundle) {
                    console.error("Impossible de mettre à jour l'affichage du bundle: bundle manquant");
                    return;
                }
                
                // Récupérer les éléments du DOM nécessaires
                const bundleTab = document.getElementById('bundleContent');
                if (!bundleTab) {
                    console.error("Élément #bundleContent introuvable");
                    return;
                }
                
                const loadingSection = bundleTab.querySelector('.loading-resources');
                const noResourcesSection = bundleTab.querySelector('.no-resources');
                const resourcesList = bundleTab.querySelector('.resources-list');
                const resourceCount = bundleTab.querySelector('.resource-count');
                const resourceTypes = bundleTab.querySelector('.resource-types');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    console.error("Structure DOM incorrecte pour l'affichage du bundle");
                    return;
                }
                
                // Masquer le chargement
                loadingSection.style.display = 'none';
                
                // Vérifier si le bundle contient des entrées
                if (!bundle.entry || bundle.entry.length === 0) {
                    noResourcesSection.style.display = 'block';
                    resourcesList.style.display = 'none';
                    resourceCount.textContent = '0';
                    resourceTypes.textContent = 'aucun';
                    return;
                }
                
                // Afficher les ressources
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'block';
                resourcesList.innerHTML = '';
                
                // Compter les types de ressources
                const typeCount = {};
                bundle.entry.forEach(entry => {
                    if (entry.resource && entry.resource.resourceType) {
                        const type = entry.resource.resourceType;
                        typeCount[type] = (typeCount[type] || 0) + 1;
                    }
                });
                
                // Mettre à jour les informations
                resourceCount.textContent = bundle.entry.length.toString();
                resourceTypes.textContent = Object.keys(typeCount).join(', ');
                
                // Organiser les ressources par type
                const resourcesByType = {};
                bundle.entry.forEach(entry => {
                    if (!entry.resource) return;
                    
                    const type = entry.resource.resourceType;
                    if (!resourcesByType[type]) {
                        resourcesByType[type] = [];
                    }
                    resourcesByType[type].push(entry.resource);
                });
                
                // Afficher les groupes de ressources
                Object.entries(resourcesByType).forEach(([type, resources]) => {
                    // Créer l'en-tête du groupe
                    const groupElement = document.createElement('div');
                    groupElement.className = 'resource-group';
                    
                    // Déterminer la couleur et l'icône en fonction du type
                    let typeColor = '#e83e28';  // Couleur par défaut
                    let typeIcon = 'cube';     // Icône par défaut
                    
                    switch(type) {
                        case 'Patient':
                            typeColor = '#2980b9';
                            typeIcon = 'user';
                            break;
                        case 'Practitioner':
                            typeColor = '#27ae60';
                            typeIcon = 'user-md';
                            break;
                        case 'Organization':
                            typeColor = '#f39c12';
                            typeIcon = 'hospital-alt';
                            break;
                        case 'Encounter':
                            typeColor = '#9b59b6';
                            typeIcon = 'stethoscope';
                            break;
                        case 'Condition':
                            typeColor = '#c0392b';
                            typeIcon = 'heartbeat';
                            break;
                        case 'Observation':
                            typeColor = '#1abc9c';
                            typeIcon = 'microscope';
                            break;
                        case 'MedicationRequest':
                            typeColor = '#3498db';
                            typeIcon = 'pills';
                            break;
                        case 'Coverage':
                            typeColor = '#8e44ad';
                            typeIcon = 'file-medical';
                            break;
                    }
                    
                    // Créer l'en-tête du groupe
                    const header = document.createElement('div');
                    header.className = 'group-header';
                    header.innerHTML = `
                        <div class="group-icon" style="background-color: ${typeColor}">
                            <i class="fas fa-${typeIcon}"></i>
                        </div>
                        <div class="group-title">${type} (${resources.length})</div>
                        <div class="group-toggle">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    `;
                    
                    // Créer le contenu du groupe
                    const content = document.createElement('div');
                    content.className = 'group-content';
                    
                    // Ajouter chaque ressource au groupe
                    resources.forEach(resource => {
                        const resourceElement = document.createElement('div');
                        resourceElement.className = 'resource-item';
                        
                        // Obtenir le nom de la ressource en fonction de son type
                        let resourceName = '';
                        let resourceDetail = '';
                        
                        if (type === 'Patient' && resource.name && resource.name.length > 0) {
                            resourceName = formatPatientName(resource.name);
                            resourceDetail = `ID: ${resource.id}`;
                            if (resource.birthDate) resourceDetail += ` | Né(e) le: ${resource.birthDate}`;
                        } 
                        else if (type === 'Practitioner' && resource.name && resource.name.length > 0) {
                            resourceName = formatPractitionerName(resource.name);
                            resourceDetail = `ID: ${resource.id}`;
                        }
                        else if (type === 'Organization' && resource.name) {
                            resourceName = resource.name;
                            resourceDetail = `ID: ${resource.id}`;
                        }
                        else if (type === 'Condition' && resource.code && resource.code.coding && resource.code.coding.length > 0) {
                            resourceName = resource.code.coding[0].display || resource.code.coding[0].code || `Condition #${resource.id}`;
                            resourceDetail = `ID: ${resource.id}`;
                            if (resource.recordedDate) resourceDetail += ` | Date: ${resource.recordedDate.split('T')[0]}`;
                        }
                        else if (type === 'Observation' && resource.code && resource.code.coding && resource.code.coding.length > 0) {
                            resourceName = resource.code.coding[0].display || resource.code.coding[0].code || `Observation #${resource.id}`;
                            resourceDetail = `ID: ${resource.id}`;
                            if (resource.effectiveDateTime) resourceDetail += ` | Date: ${resource.effectiveDateTime.split('T')[0]}`;
                            
                            if (resource.valueQuantity) {
                                resourceDetail += ` | Valeur: ${resource.valueQuantity.value} ${resource.valueQuantity.unit || ''}`;
                            }
                        }
                        else if (type === 'MedicationRequest' && resource.medicationCodeableConcept) {
                            if (resource.medicationCodeableConcept.coding && resource.medicationCodeableConcept.coding.length > 0) {
                                resourceName = resource.medicationCodeableConcept.coding[0].display || resource.medicationCodeableConcept.coding[0].code;
                            } else if (resource.medicationCodeableConcept.text) {
                                resourceName = resource.medicationCodeableConcept.text;
                            } else {
                                resourceName = `Médicament #${resource.id}`;
                            }
                            resourceDetail = `ID: ${resource.id}`;
                            if (resource.authoredOn) resourceDetail += ` | Date: ${resource.authoredOn.split('T')[0]}`;
                        }
                        else if (type === 'Encounter') {
                            if (resource.type && resource.type.length > 0 && resource.type[0].coding && resource.type[0].coding.length > 0) {
                                resourceName = resource.type[0].coding[0].display || resource.type[0].coding[0].code;
                            } else {
                                resourceName = `Consultation #${resource.id}`;
                            }
                            resourceDetail = `ID: ${resource.id}`;
                            if (resource.period && resource.period.start) resourceDetail += ` | Début: ${resource.period.start.split('T')[0]}`;
                        }
                        else {
                            resourceName = `${type} #${resource.id}`;
                            resourceDetail = `ID: ${resource.id}`;
                        }
                        
                        resourceElement.innerHTML = `
                            <div class="resource-header">
                                <div class="resource-name">${resourceName}</div>
                                <button class="btn-view-json" data-resource-type="${resource.resourceType}" data-resource-id="${resource.id}">
                                    <i class="fas fa-code"></i>
                                </button>
                            </div>
                            <div class="resource-details">${resourceDetail}</div>
                        `;
                        
                        content.appendChild(resourceElement);
                        
                        // Ajouter un gestionnaire d'événement pour voir le JSON
                        const btn = resourceElement.querySelector('.btn-view-json');
                        if (btn) {
                            btn.addEventListener('click', function() {
                                const resourceJson = JSON.stringify(resource, null, 2);
                                document.getElementById('json-content').textContent = resourceJson;
                                
                                // Activer l'onglet JSON
                                document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                                document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
                                document.querySelector('.tab[data-tab="json"]').classList.add('active');
                                document.getElementById('json').style.display = 'block';
                            });
                        }
                    });
                    
                    // Ajouter un comportement d'expansion/réduction au groupe
                    header.addEventListener('click', function() {
                        this.classList.toggle('collapsed');
                        const content = this.nextElementSibling;
                        content.style.display = content.style.display === 'none' ? 'block' : 'none';
                        
                        // Rotation de l'icône
                        const icon = this.querySelector('.fa-chevron-down');
                        if (icon) {
                            icon.style.transform = content.style.display === 'none' ? 'rotate(0deg)' : 'rotate(180deg)';
                        }
                    });
                    
                    // Ajouter l'en-tête et le contenu au groupe
                    groupElement.appendChild(header);
                    groupElement.appendChild(content);
                    
                    // Ajouter le groupe à la liste
                    resourcesList.appendChild(groupElement);
                });
                
                console.log(`Bundle affiché avec ${bundle.entry.length} ressources`);
            }
            
            // Mettre à jour l'onglet JSON
            updateJsonView();
            
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
        const container = document.querySelector('#conditionsContent');
        const loadingSection = container.querySelector('.loading-resources');
        const noResourcesSection = container.querySelector('.no-resources');
        const resourcesList = container.querySelector('.resources-list');
        
        // Réinitialiser les données des conditions
        conditionsData = [];
        
        loadingSection.style.display = 'block';
        noResourcesSection.style.display = 'none';
        resourcesList.style.display = 'none';
        
        // URL de la requête FHIR (limite augmentée à 1000 pour avoir toutes les données)
        const url = `${serverUrl}/Condition?patient=${patientId}&_sort=-recorded-date&_count=1000`;
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
                }
            } else {
                console.warn(`Problème de récupération: ${url}, statut: ${xhr.status}`);
                noResourcesSection.style.display = 'block';
            }
        };
        
        xhr.onerror = function() {
            console.error(`Erreur réseau lors de la récupération des conditions: ${url}`);
            loadingSection.style.display = 'none';
            noResourcesSection.style.display = 'block';
        };
        
        xhr.send();
    }
    
    function loadPatientObservations(patientId, serverUrl) {
        const container = document.querySelector('#observationsContent');
        const loadingSection = container.querySelector('.loading-resources');
        const noResourcesSection = container.querySelector('.no-resources');
        const resourcesList = container.querySelector('.resources-list');
        
        // Réinitialiser les données des observations
        observationsData = [];
        
        loadingSection.style.display = 'block';
        noResourcesSection.style.display = 'none';
        resourcesList.style.display = 'none';
        
        // Exécuter la requête FHIR pour récupérer les observations (limite augmentée à 1000 pour avoir toutes les données)
        fetch(`${serverUrl}/Observation?patient=${patientId}&_sort=-date&_count=1000`)
            .then(response => response.json())
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
            });
    }
    
    function loadPatientMedications(patientId, serverUrl) {
        const container = document.querySelector('#medicationsContent');
        const loadingSection = container.querySelector('.loading-resources');
        const noResourcesSection = container.querySelector('.no-resources');
        const resourcesList = container.querySelector('.resources-list');
        
        // Réinitialiser les données des médicaments
        medicationsData = [];
        
        loadingSection.style.display = 'block';
        noResourcesSection.style.display = 'none';
        resourcesList.style.display = 'none';
        
        // Exécuter la requête FHIR pour récupérer les médicaments (limite augmentée à 1000 pour avoir toutes les données)
        fetch(`${serverUrl}/MedicationRequest?patient=${patientId}&_sort=-date&_count=1000`)
            .then(response => response.json())
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
            });
    }
    
    function loadPatientEncounters(patientId, serverUrl) {
        const container = document.querySelector('#encountersContent');
        const loadingSection = container.querySelector('.loading-resources');
        const noResourcesSection = container.querySelector('.no-resources');
        const resourcesList = container.querySelector('.resources-list');
        
        // Réinitialiser les données des consultations
        encountersData = [];
        
        loadingSection.style.display = 'block';
        noResourcesSection.style.display = 'none';
        resourcesList.style.display = 'none';
        
        // Exécuter la requête FHIR pour récupérer les consultations (limite augmentée à 1000 pour avoir toutes les données)
        fetch(`${serverUrl}/Encounter?patient=${patientId}&_sort=-date&_count=1000`)
            .then(response => response.json())
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
        const loadingSection = container.querySelector('.loading-resources');
        const noResourcesSection = container.querySelector('.no-resources');
        
        if (loadingSection) loadingSection.style.display = 'block';
        if (noResourcesSection) noResourcesSection.style.display = 'none';
        if (bundleResourcesList) bundleResourcesList.innerHTML = '';
        
        // On récupère directement le bundle associé au patient, incluant les références
        fetch(`${serverUrl}/Patient/${patientId}/$everything?_count=100&_include=*`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur de récupération du bundle: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Stocker le bundle pour référence future
                bundleData = data;
                
                if (loadingSection) loadingSection.style.display = 'none';
                
                // Afficher les informations sur le bundle
                if (data.resourceType === 'Bundle') {
                    const resourceCount = data.entry ? data.entry.length : 0;
                    const resourceTypes = data.entry ? 
                        [...new Set(data.entry.map(e => e.resource.resourceType))].sort() : [];
                    
                    // Calculer d'abord les types de ressources qui ne sont pas déjà dans d'autres onglets
                    const existingTabTypes = ['Patient', 'Encounter', 'Condition', 'Observation', 
                                             'MedicationRequest', 'Practitioner', 'Organization', 
                                             'RelatedPerson', 'Coverage'];
                                             
                    const uniqueResourceTypes = resourceTypes.filter(type => !existingTabTypes.includes(type));
                    
                    bundleInfo.innerHTML = `
                        <p><strong>Type de bundle:</strong> ${data.type || 'Inconnu'}</p>
                        <p><strong>Identifiant:</strong> ${data.id || 'Non spécifié'}</p>
                        <p><strong>Nombre total de ressources:</strong> ${resourceCount}</p>
                        <p><strong>Types de ressources (uniquement celles non présentes dans les onglets dédiés):</strong> ${uniqueResourceTypes.join(', ') || 'Aucun'}</p>
                        <p><em>Note: Les ressources déjà affichées dans leurs onglets dédiés ne sont pas répétées ici.</em></p>
                    `;
                    
                    if (resourceCount > 0) {
                        // Grouper les ressources par type
                        const resourcesByType = {};
                        
                        // Stocker les types de ressources déjà présents dans d'autres onglets
                        const existingTabTypes = [];
                        if (document.getElementById('patientContent')) existingTabTypes.push('Patient');
                        if (document.getElementById('encountersContent')) existingTabTypes.push('Encounter');
                        if (document.getElementById('conditionsContent')) existingTabTypes.push('Condition');
                        if (document.getElementById('observationsContent')) existingTabTypes.push('Observation');
                        if (document.getElementById('medicationsContent')) existingTabTypes.push('MedicationRequest');
                        if (document.getElementById('practitionersContent')) existingTabTypes.push('Practitioner');
                        if (document.getElementById('organizationsContent')) existingTabTypes.push('Organization');
                        if (document.getElementById('relatedPersonsContent')) existingTabTypes.push('RelatedPerson');
                        if (document.getElementById('coverageContent')) existingTabTypes.push('Coverage');
                        
                        // Compter uniquement les ressources qui ne sont pas déjà affichées dans d'autres onglets
                        let uniqueResourceCount = 0;
                        
                        data.entry.forEach(entry => {
                            if (entry.resource && entry.resource.resourceType) {
                                const type = entry.resource.resourceType;
                                
                                // Si le type n'est pas dans les onglets existants, on l'ajoute au groupe
                                if (!resourcesByType[type]) {
                                    resourcesByType[type] = [];
                                }
                                resourcesByType[type].push(entry.resource);
                                
                                // Si le type n'est pas dans un onglet existant, le compter comme unique
                                if (!existingTabTypes.includes(type)) {
                                    uniqueResourceCount++;
                                }
                            }
                        });
                        
                        // Mettre à jour l'affichage du nombre de ressources pour n'indiquer que les ressources uniques
                        const bundleResourceCount = document.getElementById('bundleResourceCount');
                        if (bundleResourceCount) {
                            bundleResourceCount.textContent = uniqueResourceCount;
                        }
                        
                        // Pour chaque type, créer une section dépliable
                        Object.keys(resourcesByType).sort().forEach(type => {
                            // Pour éviter le doublon avec les onglets spécifiques, on vérifie si le type a déjà un onglet dédié
                            if (type === 'Patient' && document.getElementById('patientContent')) {
                                // Ne pas ajouter de section pour Patient, car déjà affiché dans son propre onglet
                                return;
                            }
                            
                            // Pour les autres types de ressources déjà affichés dans des onglets dédiés
                            // ne pas les répéter dans l'onglet Bundle
                            if ((type === 'Encounter' && document.getElementById('encountersContent')) ||
                                (type === 'Condition' && document.getElementById('conditionsContent')) ||
                                (type === 'Observation' && document.getElementById('observationsContent')) ||
                                (type === 'MedicationRequest' && document.getElementById('medicationsContent')) ||
                                (type === 'Practitioner' && document.getElementById('practitionersContent')) ||
                                (type === 'Organization' && document.getElementById('organizationsContent')) ||
                                (type === 'RelatedPerson' && document.getElementById('relatedPersonsContent')) ||
                                (type === 'Coverage' && document.getElementById('coverageContent'))) {
                                // Ne pas ajouter de section pour ce type car déjà affiché dans son propre onglet
                                return;
                            }
                            
                            const resources = resourcesByType[type];
                            const typeSection = document.createElement('div');
                            typeSection.className = 'resource-type-section';
                            typeSection.style.marginBottom = '20px';
                            typeSection.style.border = '1px solid #eee';
                            typeSection.style.borderRadius = '8px';
                            typeSection.style.overflow = 'hidden';
                            
                            const typeHeader = document.createElement('div');
                            typeHeader.className = 'resource-type-header';
                            typeHeader.style.padding = '12px 16px';
                            typeHeader.style.background = 'linear-gradient(135deg, #f8f8f8, #f2f2f2)';
                            typeHeader.style.borderBottom = '1px solid #eee';
                            typeHeader.style.fontWeight = 'bold';
                            typeHeader.style.cursor = 'pointer';
                            typeHeader.style.display = 'flex';
                            typeHeader.style.justifyContent = 'space-between';
                            typeHeader.style.alignItems = 'center';
                            // Définir une couleur différente pour chaque type de ressource
                            let typeColor = '#e83e28';  // Couleur par défaut
                            let typeIcon = 'cube';     // Icône par défaut
                            
                            switch(type) {
                                case 'Patient':
                                    typeColor = '#2980b9';
                                    typeIcon = 'user';
                                    break;
                                case 'Practitioner':
                                    typeColor = '#27ae60';
                                    typeIcon = 'user-md';
                                    break;
                                case 'Organization':
                                    typeColor = '#f39c12';
                                    typeIcon = 'hospital-alt';
                                    break;
                                case 'Encounter':
                                    typeColor = '#9b59b6';
                                    typeIcon = 'stethoscope';
                                    break;
                                case 'Condition':
                                    typeColor = '#c0392b';
                                    typeIcon = 'heartbeat';
                                    break;
                                case 'Observation':
                                    typeColor = '#1abc9c';
                                    typeIcon = 'microscope';
                                    break;
                                case 'MedicationRequest':
                                    typeColor = '#3498db';
                                    typeIcon = 'pills';
                                    break;
                                case 'Coverage':
                                    typeColor = '#8e44ad';
                                    typeIcon = 'file-medical';
                                    break;
                                case 'RelatedPerson':
                                    typeColor = '#e67e22';
                                    typeIcon = 'users';
                                    break;
                            }
                            
                            typeHeader.innerHTML = `
                                <span style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-${typeIcon}" style="color: ${typeColor};"></i>
                                    <span style="color: ${typeColor}; font-weight: 600;">${type} (${resources.length})</span>
                                </span>
                                <i class="fas fa-chevron-down" style="color: #999;"></i>
                            `;
                            
                            const typeContent = document.createElement('div');
                            typeContent.className = 'resource-type-content';
                            typeContent.style.padding = '0';
                            typeContent.style.maxHeight = '0';
                            typeContent.style.overflow = 'hidden';
                            typeContent.style.transition = 'max-height 0.3s ease, padding 0.3s ease';
                            
                            // Ajouter les ressources de ce type
                            resources.forEach(resource => {
                                const resourceItem = document.createElement('div');
                                resourceItem.className = 'resource-item';
                                resourceItem.style.padding = '12px 16px';
                                resourceItem.style.borderBottom = '1px solid #f0f0f0';
                                
                                let resourceName = resource.id;
                                let resourceDetails = '';
                                
                                // Si c'est une référence simple (de transaction-response)
                                if (resource._sourceType === 'reference') {
                                    resourceName = `${resource.id}`;
                                    resourceDetails = `ID: ${resource.id}`;
                                }
                                // Si c'est une ressource complète
                                else {
                                    if (type === 'Patient' && resource.name && resource.name.length > 0) {
                                        resourceName = formatPatientName(resource.name);
                                        resourceDetails = `ID: ${resource.id}`;
                                        if (resource.birthDate) {
                                            resourceDetails += ` | Né(e) le: ${resource.birthDate}`;
                                        }
                                        if (resource.gender) {
                                            let gender = resource.gender === 'male' ? 'Homme' : 
                                                         resource.gender === 'female' ? 'Femme' : resource.gender;
                                            resourceDetails += ` | Genre: ${gender}`;
                                        }
                                    } 
                                    else if (type === 'Practitioner' && resource.name && resource.name.length > 0) {
                                        resourceName = formatPractitionerName(resource.name);
                                        resourceDetails = `ID: ${resource.id}`;
                                        if (resource.identifier && resource.identifier.length > 0) {
                                            const mainId = resource.identifier[0];
                                            resourceDetails += ` | ${mainId.system ? mainId.system.split('/').pop() : 'ID'}: ${mainId.value}`;
                                        }
                                    } 
                                    else if (type === 'Organization' && resource.name) {
                                        resourceName = resource.name;
                                        resourceDetails = `ID: ${resource.id}`;
                                        if (resource.identifier && resource.identifier.length > 0) {
                                            resourceDetails += ` | Identifiant: ${resource.identifier[0].value}`;
                                        }
                                    } 
                                    else if (type === 'Encounter') {
                                        resourceName = `Rencontre ${resource.id}`;
                                        resourceDetails = `ID: ${resource.id}`;
                                        if (resource.status) {
                                            const statusMap = {
                                                'planned': 'Planifiée',
                                                'arrived': 'Arrivée',
                                                'triaged': 'Triée',
                                                'in-progress': 'En cours',
                                                'onleave': 'En congé',
                                                'finished': 'Terminée',
                                                'cancelled': 'Annulée'
                                            };
                                            resourceDetails += ` | Statut: ${statusMap[resource.status] || resource.status}`;
                                        }
                                        if (resource.class && resource.class.code) {
                                            const classMap = {
                                                'AMB': 'Ambulatoire',
                                                'IMP': 'Hospitalisation',
                                                'EMER': 'Urgence',
                                                'VR': 'Consultation virtuelle'
                                            };
                                            resourceDetails += ` | Type: ${classMap[resource.class.code] || resource.class.code}`;
                                        }
                                    } 
                                    else if (type === 'RelatedPerson') {
                                        if (resource.name && resource.name.length > 0) {
                                            resourceName = formatPatientName(resource.name);
                                        }
                                        resourceDetails = `ID: ${resource.id}`;
                                        if (resource.relationship && resource.relationship.length > 0) {
                                            if (resource.relationship[0].coding) {
                                                const rel = resource.relationship[0].coding[0];
                                                const relationMap = {
                                                    'SPO': 'Conjoint(e)',
                                                    'CHILD': 'Enfant',
                                                    'FAMMEMB': 'Famille',
                                                    'WIFE': 'Épouse',
                                                    'HUSB': 'Époux',
                                                    'AUNT': 'Tante',
                                                    'BRO': 'Frère',
                                                    'DAU': 'Fille',
                                                    'DAUFOST': 'Fille d\'accueil',
                                                    'SIS': 'Sœur'
                                                };
                                                resourceDetails += ` | Relation: ${relationMap[rel.code] || rel.display || rel.code}`;
                                            }
                                            else if (resource.relationship[0].text) {
                                                resourceDetails += ` | Relation: ${resource.relationship[0].text}`;
                                            }
                                        }
                                    } 
                                    else if (type === 'Coverage') {
                                        resourceName = `Couverture ${resource.id}`;
                                        resourceDetails = `ID: ${resource.id}`;
                                        if (resource.type && resource.type.coding && resource.type.coding.length > 0) {
                                            const coverageMap = {
                                                'AMO': 'Assurance Maladie Obligatoire',
                                                'AMC': 'Assurance Maladie Complémentaire'
                                            };
                                            const coverageType = resource.type.coding[0];
                                            resourceDetails += ` | Type: ${coverageMap[coverageType.code] || coverageType.display || coverageType.code}`;
                                        }
                                        if (resource.period) {
                                            if (resource.period.start) {
                                                resourceDetails += ` | Début: ${resource.period.start.split('T')[0]}`;
                                            }
                                            if (resource.period.end) {
                                                resourceDetails += ` | Fin: ${resource.period.end.split('T')[0]}`;
                                            }
                                        }
                                    }
                                    else if (type === 'PractitionerRole') {
                                        resourceName = `Rôle ${resource.id}`;
                                        resourceDetails = `ID: ${resource.id}`;
                                        if (resource.code && resource.code.length > 0 && resource.code[0].coding && resource.code[0].coding.length > 0) {
                                            resourceDetails += ` | Code: ${resource.code[0].coding[0].display || resource.code[0].coding[0].code}`;
                                        }
                                    }
                                }
                                
                                resourceItem.innerHTML = `
                                    <div style="display: flex; flex-direction: column; gap: 6px; padding: 5px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="font-weight: 600; color: #333;">${resourceName || resource.id}</span>
                                            <button 
                                                class="view-json-btn"
                                                style="background: linear-gradient(135deg, #e83e28, #fd7e30); 
                                                      color: white; 
                                                      border: none; 
                                                      border-radius: 4px; 
                                                      padding: 4px 8px; 
                                                      font-size: 12px;
                                                      cursor: pointer;"
                                                      data-resource='${JSON.stringify(resource).replace(/'/g, "&apos;")}'>
                                                Voir JSON
                                            </button>
                                        </div>
                                        <div style="color: #666; font-size: 13px;">
                                            ${resourceDetails}
                                        </div>
                                    </div>
                                `;
                                
                                typeContent.appendChild(resourceItem);
                            });
                            
                            // Ajouter les événements pour le dépliant
                            typeHeader.addEventListener('click', function() {
                                const content = this.nextElementSibling;
                                const icon = this.querySelector('i');
                                
                                if (content.style.maxHeight === '0px' || content.style.maxHeight === '') {
                                    content.style.maxHeight = content.scrollHeight + 'px';
                                    content.style.padding = '8px 0';
                                    icon.className = 'fas fa-chevron-up';
                                } else {
                                    content.style.maxHeight = '0';
                                    content.style.padding = '0';
                                    icon.className = 'fas fa-chevron-down';
                                }
                            });
                            
                            typeSection.appendChild(typeHeader);
                            typeSection.appendChild(typeContent);
                            bundleResourcesList.appendChild(typeSection);
                        });
                        
                        // Ajouter les événements pour les boutons "Voir JSON"
                        document.querySelectorAll('.view-json-btn').forEach(btn => {
                            btn.addEventListener('click', function(e) {
                                e.stopPropagation();
                                const resourceData = JSON.parse(this.getAttribute('data-resource'));
                                const jsonStr = JSON.stringify(resourceData, null, 2);
                                
                                // Changer l'onglet actif vers JSON
                                document.querySelector('#jsonContent').textContent = jsonStr;
                                document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                                document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
                                document.querySelector('.tab[data-tab="json"]').classList.add('active');
                                document.querySelector('#json').style.display = 'block';
                            });
                        });
                    } else {
                        // Aucune ressource
                        if (noResourcesSection) noResourcesSection.style.display = 'block';
                    }
                    
                    if (data.entry && data.entry.length > 0) {
                        // Regrouper par type de ressource pour un affichage organisé
                        const resourceGroups = {};
                        const processedResources = []; // Pour éviter les doublons
                        const referenceMap = {}; // Stocker les ressources par référence
                        
                        // Traitement différent selon le type de bundle
                        if (data.type === 'transaction' || data.type === 'batch') {
                            // Dans un bundle transaction, les ressources sont directement dans entry.resource
                            data.entry.forEach(entry => {
                                if (entry.resource) {
                                    const resourceType = entry.resource.resourceType;
                                    if (!resourceGroups[resourceType]) {
                                        resourceGroups[resourceType] = [];
                                    }
                                    
                                    // Ajouter la ressource au groupe
                                    resourceGroups[resourceType].push(entry.resource);
                                    
                                    // Ajouter à la liste des ressources traitées pour référence future
                                    processedResources.push(`${resourceType}/${entry.resource.id}`);
                                    
                                    // Ajouter au mapping de référence
                                    if (entry.fullUrl) {
                                        referenceMap[entry.fullUrl] = entry.resource;
                                    }
                                }
                            });
                            
                            // Seconde passe pour résoudre les références
                            Object.values(resourceGroups).forEach(group => {
                                group.forEach(resource => {
                                    resolveReferences(resource, referenceMap);
                                });
                            });
                        } 
                        else if (data.type === 'transaction-response' || data.type === 'batch-response') {
                            showStatus('Récupération des ressources depuis le serveur FHIR...', 'info');
                            
                            // Trouver la ressource Patient pour utiliser l'opération $everything
                            let patientReference = null;
                            
                            // Rechercher l'ID du patient dans les réponses
                            data.entry.forEach(entry => {
                                if (entry.response && entry.response.location && entry.response.location.startsWith('Patient/')) {
                                    // Format typique: "Patient/12345/_history/1"
                                    const parts = entry.response.location.split('/');
                                    if (parts.length >= 2) {
                                        patientReference = {
                                            resourceType: 'Patient',
                                            id: parts[1].split('_')[0] // Enlever la partie _history
                                        };
                                    }
                                }
                            });
                            
                            if (patientReference) {
                                // Utiliser l'opération $everything pour obtenir toutes les ressources liées au patient
                                fetch(`${serverUrl}/Patient/${patientReference.id}/$everything`)
                                    .then(response => {
                                        if (!response.ok) {
                                            // Si $everything échoue, réessayer avec une recherche par référence
                                            if (response.status === 404 || response.status === 501) {
                                                showStatus("L'opération $everything n'est pas supportée, utilisation d'une méthode alternative...", 'info');
                                                return fetchResourcesManually(patientReference.id);
                                            }
                                            throw new Error(`L'opération $everything a échoué: ${response.status}`);
                                        }
                                        return response.json();
                                    })
                                    .then(bundle => {
                                        if (bundle.resourceType === 'Bundle' && bundle.entry && bundle.entry.length > 0) {
                                            // Traiter le bundle tout-en-un
                                            bundle.entry.forEach(entry => {
                                                if (entry.resource) {
                                                    const resourceType = entry.resource.resourceType;
                                                    if (!resourceGroups[resourceType]) {
                                                        resourceGroups[resourceType] = [];
                                                    }
                                                    resourceGroups[resourceType].push(entry.resource);
                                                }
                                            });
                                            
                                            showStatus(`${bundle.entry.length} ressources récupérées depuis le serveur FHIR`, 'success');
                                        } else {
                                            showStatus('Aucune ressource associée trouvée pour ce patient', 'warning');
                                        }
                                        
                                        // Mise à jour de l'affichage avec les données récupérées
                                        updateBundleDisplay(resourceGroups, bundleResourcesList, bundleResourceTypesElement, 
                                                          bundleResourceCountElement, bundleIdElement, bundleTypeElement,
                                                          bundleInfoContainer, loadingSection, serverUrl);
                                    })
                                    .catch(error => {
                                        console.error("Erreur lors de la récupération des données complètes:", error);
                                        showStatus(`Erreur: ${error.message}. Utilisation d'une méthode alternative...`, 'warning');
                                        
                                        // En cas d'échec de $everything, récupérer manuellement
                                        fetchResourcesManually(patientReference.id)
                                            .then(altBundle => {
                                                // Traitement du bundle alternatif
                                                altBundle.entry.forEach(entry => {
                                                    if (entry.resource) {
                                                        const resourceType = entry.resource.resourceType;
                                                        if (!resourceGroups[resourceType]) {
                                                            resourceGroups[resourceType] = [];
                                                        }
                                                        resourceGroups[resourceType].push(entry.resource);
                                                    }
                                                });
                                                
                                                showStatus(`${altBundle.entry.length} ressources récupérées en mode alternatif`, 'success');
                                                
                                                // Mise à jour de l'affichage
                                                updateBundleDisplay(resourceGroups, bundleResourcesList, bundleResourceTypesElement, 
                                                                  bundleResourceCountElement, bundleIdElement, bundleTypeElement,
                                                                  bundleInfoContainer, loadingSection, serverUrl);
                                            })
                                            .catch(altError => {
                                                console.error("Échec de la récupération alternative:", altError);
                                                showStatus(`Impossible de récupérer les données: ${altError.message}`, 'error');
                                            });
                                    });
                            } else {
                                // Aucun patient trouvé, récupérer chaque ressource individuellement
                                showStatus('Aucun patient trouvé, récupération individuelle des ressources...', 'info');
                                
                                // Récupérer les références depuis la réponse
                                const resourceReferences = [];
                                data.entry.forEach(entry => {
                                    if (entry.response && entry.response.location) {
                                        // Format typique: "Resource/12345/_history/1"
                                        const parts = entry.response.location.split('/');
                                        if (parts.length >= 2) {
                                            const resourceType = parts[0];
                                            const resourceId = parts[1].split('_')[0]; // Enlever la partie _history
                                            resourceReferences.push({
                                                resourceType,
                                                id: resourceId
                                            });
                                        }
                                    }
                                });
                                
                                if (resourceReferences.length === 0) {
                                    showStatus('Aucune référence de ressource trouvée dans la réponse', 'error');
                                    return;
                                }
                                
                                // Créer un bundle avec les références
                                const refBundle = {
                                    resourceType: 'Bundle',
                                    type: 'collection',
                                    entry: []
                                };
                                
                                // Récupérer toutes les ressources individuellement
                                const promises = resourceReferences.map(ref => {
                                    return fetch(`${serverUrl}/${ref.resourceType}/${ref.id}`)
                                        .then(response => {
                                            if (!response.ok) {
                                                throw new Error(`Erreur lors de la récupération de ${ref.resourceType}/${ref.id}: ${response.status}`);
                                            }
                                            return response.json();
                                        })
                                        .then(resource => {
                                            // Ajouter au bundle de référence
                                            refBundle.entry.push({ resource });
                                            
                                            // Ajouter la ressource au groupe correspondant
                                            const resourceType = resource.resourceType;
                                            if (!resourceGroups[resourceType]) {
                                                resourceGroups[resourceType] = [];
                                            }
                                            resourceGroups[resourceType].push(resource);
                                            return resource;
                                        })
                                        .catch(error => {
                                            console.error(`Erreur de récupération de ${ref.resourceType}/${ref.id}:`, error);
                                            return null; // Ignorer les erreurs individuelles
                                        });
                                });
                                
                                // Attendre toutes les récupérations
                                Promise.all(promises)
                                    .then(results => {
                                        const validResults = results.filter(r => r !== null);
                                        showStatus(`${validResults.length} ressources récupérées sur ${resourceReferences.length}`, 
                                                  validResults.length === resourceReferences.length ? 'success' : 'warning');
                                        
                                        // Mise à jour de l'affichage
                                        updateBundleDisplay(resourceGroups, bundleResourcesList, bundleResourceTypesElement, 
                                                          bundleResourceCountElement, bundleIdElement, bundleTypeElement,
                                                          bundleInfoContainer, loadingSection, serverUrl);
                                    })
                                    .catch(error => {
                                        console.error("Erreur générale lors de la récupération:", error);
                                        showStatus(`Erreur: ${error.message}`, 'error');
                                    });
                            }
                            
                            // Fonction pour récupérer les ressources manuellement si $everything ne fonctionne pas
                            async function fetchResourcesManually(patientId) {
                                // Créer un bundle composite
                                const compositeBundle = {
                                    resourceType: 'Bundle',
                                    type: 'collection',
                                    entry: []
                                };
                                
                                // 1. Récupérer le patient
                                const patientResponse = await fetch(`${serverUrl}/Patient/${patientId}`);
                                if (!patientResponse.ok) throw new Error(`Échec de récupération du patient: ${patientResponse.status}`);
                                const patient = await patientResponse.json();
                                compositeBundle.entry.push({ resource: patient });
                                
                                // 2. Récupérer les ressources associées
                                const resourceTypes = ['Encounter', 'Observation', 'Condition', 'MedicationRequest', 
                                                     'Procedure', 'AllergyIntolerance', 'CarePlan', 'RelatedPerson', 'Coverage'];
                                
                                // Récupérer chaque type en parallèle
                                const fetchPromises = resourceTypes.map(async resourceType => {
                                    try {
                                        const response = await fetch(`${serverUrl}/${resourceType}?patient=${patientId}`);
                                        if (!response.ok) return [];
                                        
                                        const bundle = await response.json();
                                        return bundle.entry || [];
                                    } catch (e) {
                                        console.warn(`Échec de récupération pour ${resourceType}:`, e);
                                        return [];
                                    }
                                });
                                
                                // Attendre toutes les réponses
                                const results = await Promise.all(fetchPromises);
                                
                                // Fusionner les résultats
                                results.forEach(entries => {
                                    entries.forEach(entry => {
                                        compositeBundle.entry.push(entry);
                                    });
                                });
                                
                                return compositeBundle;
                            }
                            
                            // Sortir de la fonction, car l'affichage sera mis à jour par une promesse
                            return;
                        }
                        else if (data.type === 'searchset') {
                            // Dans un bundle searchset, les ressources sont dans entry.resource
                            data.entry.forEach(entry => {
                                if (entry.resource) {
                                    const resourceType = entry.resource.resourceType;
                                    if (!resourceGroups[resourceType]) {
                                        resourceGroups[resourceType] = [];
                                    }
                                    resourceGroups[resourceType].push(entry.resource);
                                }
                            });
                        }
                        else {
                            // Par défaut, essayer l'ancienne méthode comme fallback
                            try {
                                data.entry.forEach(entry => {
                                    if (entry.resource) {
                                        const resourceType = entry.resource.resourceType;
                                        if (!resourceGroups[resourceType]) {
                                            resourceGroups[resourceType] = [];
                                        }
                                        resourceGroups[resourceType].push(entry.resource);
                                    }
                                });
                            } catch (e) {
                                console.warn("Erreur lors de l'analyse du bundle:", e);
                            }
                        }
                        
                        // Fonction pour résoudre les références entre les ressources
                        function resolveReferences(resource, referenceMap) {
                            if (!resource || typeof resource !== 'object') return;
                            
                            // Parcourir toutes les propriétés
                            for (const key in resource) {
                                const value = resource[key];
                                
                                // Si c'est une référence
                                if (key === 'reference' && typeof value === 'string' && value.startsWith('urn:uuid:')) {
                                    // Lier directement à la ressource
                                    const refResource = referenceMap[value];
                                    if (refResource) {
                                        resource._resolvedReference = refResource;
                                    }
                                }
                                // Si c'est un objet, récursivement résoudre les références
                                else if (value && typeof value === 'object') {
                                    resolveReferences(value, referenceMap);
                                }
                            }
                        }
                        
                        // Fonction pour mettre à jour l'affichage du bundle
                        function updateBundleDisplay(resourceGroups, bundleResourcesList, bundleResourceTypesElement, 
                                                    bundleResourceCountElement, bundleIdElement, bundleTypeElement,
                                                    bundleInfoContainer, loadingSection, serverUrl) {
                            // Masquer le chargement
                            if (loadingSection) loadingSection.style.display = 'none';
                            
                            // Afficher le nombre total de ressources
                            let totalResources = 0;
                            let resourceTypes = [];
                            
                            for (const [type, resources] of Object.entries(resourceGroups)) {
                                totalResources += resources.length;
                                resourceTypes.push(type);
                            }
                            
                            // Mettre à jour les informations du bundle
                            bundleResourceCountElement.textContent = totalResources;
                            bundleResourceTypesElement.textContent = resourceTypes.join(', ');
                            
                            // Mettre à jour l'ID du bundle et le type
                            bundleIdElement.textContent = 'bundle-retrieved';
                            bundleTypeElement.textContent = 'collection (récupéré)';
                            
                            // Afficher le conteneur
                            bundleInfoContainer.style.display = 'block';
                            
                            // Nettoyer la liste existante
                            bundleResourcesList.innerHTML = '';
                            
                            // Créer une section pour chaque type de ressource
                            for (const [type, resources] of Object.entries(resourceGroups)) {
                                const sectionElement = document.createElement('div');
                                sectionElement.className = 'resource-type-section';
                                sectionElement.style.marginBottom = '20px';
                                
                                const typeHeader = document.createElement('div');
                                typeHeader.className = 'resource-type-header';
                                typeHeader.style.padding = '12px 16px';
                                typeHeader.style.backgroundColor = '#f9f9f9';
                                typeHeader.style.borderRadius = '8px';
                                typeHeader.style.cursor = 'pointer';
                                typeHeader.style.display = 'flex';
                                typeHeader.style.justifyContent = 'space-between';
                                typeHeader.style.alignItems = 'center';
                                
                                // Définir une couleur différente pour chaque type de ressource
                                let typeColor = '#e83e28';  // Couleur par défaut
                                let typeIcon = 'cube';     // Icône par défaut
                                
                                switch(type) {
                                    case 'Patient':
                                        typeColor = '#2980b9';
                                        typeIcon = 'user';
                                        break;
                                    case 'Practitioner':
                                        typeColor = '#27ae60';
                                        typeIcon = 'user-md';
                                        break;
                                    case 'Organization':
                                        typeColor = '#f39c12';
                                        typeIcon = 'hospital-alt';
                                        break;
                                    case 'Encounter':
                                        typeColor = '#9b59b6';
                                        typeIcon = 'stethoscope';
                                        break;
                                    case 'Condition':
                                        typeColor = '#c0392b';
                                        typeIcon = 'heartbeat';
                                        break;
                                    case 'Observation':
                                        typeColor = '#1abc9c';
                                        typeIcon = 'microscope';
                                        break;
                                    case 'MedicationRequest':
                                        typeColor = '#3498db';
                                        typeIcon = 'pills';
                                        break;
                                    case 'Coverage':
                                        typeColor = '#8e44ad';
                                        typeIcon = 'file-medical';
                                        break;
                                    case 'RelatedPerson':
                                        typeColor = '#e67e22';
                                        typeIcon = 'users';
                                        break;
                                }
                                
                                typeHeader.innerHTML = `
                                    <span style="display: flex; align-items: center; gap: 8px;">
                                        <i class="fas fa-${typeIcon}" style="color: ${typeColor};"></i>
                                        <span style="color: ${typeColor}; font-weight: 600;">${type} (${resources.length})</span>
                                    </span>
                                    <i class="fas fa-chevron-down" style="color: #999;"></i>
                                `;
                                
                                const typeContent = document.createElement('div');
                                typeContent.className = 'resource-type-content';
                                typeContent.style.padding = '0';
                                typeContent.style.overflow = 'auto';
                                typeContent.style.maxHeight = '400px';
                                typeContent.style.display = 'block'; // Visible par défaut
                                
                                resources.forEach(resource => {
                                    const resourceItem = document.createElement('div');
                                    resourceItem.className = 'resource-item';
                                    resourceItem.style.padding = '12px 16px';
                                    resourceItem.style.borderBottom = '1px solid #f0f0f0';
                                    
                                    // Fonction pour afficher les détails des ressources
                                    displayResourceDetails(resourceItem, resource, type);
                                    
                                    typeContent.appendChild(resourceItem);
                                });
                                
                                // Comportement d'accordéon pour la section
                                typeHeader.addEventListener('click', function() {
                                    const isVisible = typeContent.style.display === 'block';
                                    typeContent.style.display = isVisible ? 'none' : 'block';
                                    
                                    // Rotation de l'icône de chevron
                                    const chevron = this.querySelector('.fa-chevron-down');
                                    if (chevron) {
                                        chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                                        chevron.style.transition = 'transform 0.3s ease';
                                    }
                                });
                                
                                sectionElement.appendChild(typeHeader);
                                sectionElement.appendChild(typeContent);
                                bundleResourcesList.appendChild(sectionElement);
                            }
                        }
                        
                        // Fonction pour afficher les détails d'une ressource
                        function displayResourceDetails(resourceItem, resource, type) {
                            let resourceName = resource.id;
                            let resourceDetails = '';
                            
                            // Si c'est une référence simple (de transaction-response)
                            if (resource._sourceType === 'reference') {
                                resourceName = `${resource.id}`;
                                resourceDetails = `ID: ${resource.id}`;
                                if (resource._error) {
                                    resourceDetails += ` | Erreur: ${resource._error}`;
                                }
                            }
                            // Si c'est une ressource complète
                            else {
                                if (type === 'Patient' && resource.name && resource.name.length > 0) {
                                    resourceName = formatPatientName(resource.name);
                                    resourceDetails = `ID: ${resource.id}`;
                                    if (resource.birthDate) {
                                        resourceDetails += ` | Né(e) le: ${resource.birthDate}`;
                                    }
                                    if (resource.gender) {
                                        let gender = resource.gender === 'male' ? 'Homme' : 
                                                     resource.gender === 'female' ? 'Femme' : resource.gender;
                                        resourceDetails += ` | Genre: ${gender}`;
                                    }
                                } 
                                else if (type === 'Practitioner' && resource.name && resource.name.length > 0) {
                                    resourceName = formatPractitionerName(resource.name);
                                    resourceDetails = `ID: ${resource.id}`;
                                    if (resource.identifier && resource.identifier.length > 0) {
                                        const mainId = resource.identifier[0];
                                        resourceDetails += ` | ${mainId.system ? mainId.system.split('/').pop() : 'ID'}: ${mainId.value}`;
                                    }
                                } 
                                else if (type === 'Organization' && resource.name) {
                                    resourceName = resource.name;
                                    resourceDetails = `ID: ${resource.id}`;
                                    if (resource.identifier && resource.identifier.length > 0) {
                                        resourceDetails += ` | Identifiant: ${resource.identifier[0].value}`;
                                    }
                                } 
                                else if (type === 'Encounter') {
                                    resourceName = `Rencontre ${resource.id}`;
                                    resourceDetails = `ID: ${resource.id}`;
                                    if (resource.status) {
                                        const statusMap = {
                                            'planned': 'Planifiée',
                                            'arrived': 'Arrivée',
                                            'triaged': 'Triée',
                                            'in-progress': 'En cours',
                                            'onleave': 'En congé',
                                            'finished': 'Terminée',
                                            'cancelled': 'Annulée'
                                        };
                                        resourceDetails += ` | Statut: ${statusMap[resource.status] || resource.status}`;
                                    }
                                    if (resource.class && resource.class.code) {
                                        const classMap = {
                                            'AMB': 'Ambulatoire',
                                            'IMP': 'Hospitalisation',
                                            'EMER': 'Urgence',
                                            'VR': 'Consultation virtuelle'
                                        };
                                        resourceDetails += ` | Type: ${classMap[resource.class.code] || resource.class.code}`;
                                    }
                                } 
                                else if (type === 'RelatedPerson') {
                                    if (resource.name && resource.name.length > 0) {
                                        resourceName = formatPatientName(resource.name);
                                    }
                                    resourceDetails = `ID: ${resource.id}`;
                                    if (resource.relationship && resource.relationship.length > 0) {
                                        if (resource.relationship[0].coding) {
                                            const rel = resource.relationship[0].coding[0];
                                            const relationMap = {
                                                'SPO': 'Conjoint(e)',
                                                'CHILD': 'Enfant',
                                                'FAMMEMB': 'Famille',
                                                'WIFE': 'Épouse',
                                                'HUSB': 'Époux',
                                                'AUNT': 'Tante',
                                                'BRO': 'Frère',
                                                'DAU': 'Fille',
                                                'DAUFOST': 'Fille d\'accueil',
                                                'SIS': 'Sœur'
                                            };
                                            resourceDetails += ` | Relation: ${relationMap[rel.code] || rel.display || rel.code}`;
                                        }
                                        else if (resource.relationship[0].text) {
                                            resourceDetails += ` | Relation: ${resource.relationship[0].text}`;
                                        }
                                    }
                                } 
                                else if (type === 'Coverage') {
                                    resourceName = `Couverture ${resource.id}`;
                                    resourceDetails = `ID: ${resource.id}`;
                                    if (resource.type && resource.type.coding && resource.type.coding.length > 0) {
                                        const coverageMap = {
                                            'AMO': 'Assurance Maladie Obligatoire',
                                            'AMC': 'Assurance Maladie Complémentaire'
                                        };
                                        const coverageType = resource.type.coding[0];
                                        resourceDetails += ` | Type: ${coverageMap[coverageType.code] || coverageType.display || coverageType.code}`;
                                    }
                                    if (resource.period) {
                                        if (resource.period.start) {
                                            resourceDetails += ` | Début: ${resource.period.start.split('T')[0]}`;
                                        }
                                        if (resource.period.end) {
                                            resourceDetails += ` | Fin: ${resource.period.end.split('T')[0]}`;
                                        }
                                    }
                                }
                                else if (type === 'PractitionerRole') {
                                    resourceName = `Rôle ${resource.id}`;
                                    resourceDetails = `ID: ${resource.id}`;
                                    if (resource.code && resource.code.length > 0 && resource.code[0].coding && resource.code[0].coding.length > 0) {
                                        resourceDetails += ` | Code: ${resource.code[0].coding[0].display || resource.code[0].coding[0].code}`;
                                    }
                                }
                            }
                            
                            resourceItem.innerHTML = `
                                <div style="display: flex; flex-direction: column; gap: 6px; padding: 5px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-weight: 600; color: #333;">${resourceName || resource.id}</span>
                                        <button 
                                            class="view-json-btn"
                                            style="background: linear-gradient(135deg, #e83e28, #fd7e30); 
                                                  color: white; 
                                                  border: none; 
                                                  border-radius: 4px; 
                                                  padding: 4px 8px; 
                                                  font-size: 12px;
                                                  cursor: pointer;"
                                                  data-resource='${JSON.stringify(resource).replace(/'/g, "&apos;")}'>
                                            Voir JSON
                                        </button>
                                    </div>
                                    <div style="color: #666; font-size: 13px;">
                                        ${resourceDetails}
                                    </div>
                                </div>
                            `;
                            
                            // Ajouter l'événement pour afficher le JSON
                            setTimeout(() => {
                                const jsonBtn = resourceItem.querySelector('.view-json-btn');
                                if (jsonBtn) {
                                    jsonBtn.addEventListener('click', function() {
                                        const resourceData = JSON.parse(this.getAttribute('data-resource'));
                                        document.getElementById('json-content').textContent = JSON.stringify(resourceData, null, 2);
                                        // Activer l'onglet JSON
                                        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                                        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
                                        document.querySelector('.tab[data-tab="json"]').classList.add('active');
                                        document.querySelector('#json').style.display = 'block';
                                    });
                                }
                            }, 0);
                        }
                        
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
            
            // Récupérer toutes les ressources pour la chronologie (consultations, médicaments, observations, etc.)
            // Utiliser _count=1000 pour récupérer beaucoup plus de résultats (presque tous)
            Promise.all([
                fetchSafely(`${serverUrl}/Encounter?patient=${patientId}&_count=1000`),
                fetchSafely(`${serverUrl}/Observation?patient=${patientId}&_count=1000`),
                fetchSafely(`${serverUrl}/MedicationRequest?patient=${patientId}&_count=1000`),
                fetchSafely(`${serverUrl}/Condition?patient=${patientId}&_count=1000`)
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
    }
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