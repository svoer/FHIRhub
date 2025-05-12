/**
 * Script pour le visualiseur de patient
 * Récupère et affiche toutes les ressources liées à un patient dans une interface utilisateur moderne
 * Supporte les conditions, observations, médicaments, consultations et chronologie
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Patient Viewer initialisé');
    
    // Afficher les fonctionnalités actives/inactives dans la version démo
    const demoVersionBanner = document.getElementById('demoVersionBanner');
    if (demoVersionBanner) {
        demoVersionBanner.style.display = 'block';
    }
    
    // Initialisation du système
    setupEventListeners();
    initializeServerUrlField();
    clearPatientData();
    
    // Auto-chargement du patient spécifié dans l'URL (si présent)
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('id');
    
    const serverUrlField = document.getElementById('serverUrl');
    const serverUrl = urlParams.get('server') || (serverUrlField ? serverUrlField.value : 'https://hapi.fhir.org/baseR4');
    
    if (patientId) {
        const patientIdField = document.getElementById('patientId');
        if (patientIdField) {
            patientIdField.value = patientId;
        }
        
        if (serverUrlField) {
            serverUrlField.value = serverUrl;
        }
        
        loadPatient();
    }
    
    // Configuration des options d'affichage
    toggleResourceSections();
    setupTabNavigation();
    
    // Mettre en place l'indicateur de fournisseur d'IA
    if (typeof initializeAIProviderIndicator === 'function') {
        initializeAIProviderIndicator();
    }
    
    function setupEventListeners() {
        // Bouton de recherche patient
        const searchButton = document.getElementById('searchPatientBtn');
        if (searchButton) {
            searchButton.addEventListener('click', searchPatients);
        } else {
            console.error("Élément searchPatientBtn non trouvé dans le DOM");
        }
        
        // Champ de recherche avec Enter
        const searchField = document.getElementById('patientSearch');
        if (searchField) {
            searchField.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchPatients();
                }
            });
        } else {
            console.error("Élément patientSearch non trouvé dans le DOM");
        }
        
        // Sélection d'un patient dans la liste déroulante
        const patientSelect = document.getElementById('patientSelect');
        if (patientSelect) {
            patientSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                if (selectedOption && selectedOption.value) {
                    const patientIdField = document.getElementById('patientId');
                    if (patientIdField) {
                        patientIdField.value = selectedOption.value;
                        loadPatient();
                    }
                }
            });
        } else {
            console.error("Élément patientSelect non trouvé dans le DOM");
        }
        
        // Bouton d'effacement de recherche
        const clearSearchButton = document.getElementById('clearSearchBtn');
        if (clearSearchButton) {
            clearSearchButton.addEventListener('click', clearSearch);
        } else {
            console.error("Élément clearSearchBtn non trouvé dans le DOM");
        }
        
        // Bouton de chargement direct via ID
        const loadButton = document.getElementById('loadPatientBtn');
        if (loadButton) {
            loadButton.addEventListener('click', loadPatient);
        } else {
            console.error("Élément loadPatientBtn non trouvé dans le DOM");
        }
        
        // Options d'affichage
        const resourceSectionCheckboxes = document.querySelectorAll('.resource-section-toggle');
        resourceSectionCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', toggleResourceSections);
        });
        
        // Onglets
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
        
        // Vue JSON
        const jsonViewButtons = document.querySelectorAll('.view-json-button');
        jsonViewButtons.forEach(button => {
            button.addEventListener('click', function() {
                const resourceId = this.getAttribute('data-resource-id');
                const resourceType = this.getAttribute('data-resource-type');
                openJsonView(resourceId, resourceType);
            });
        });
        
        // Fermeture de la vue JSON
        const closeJsonViewButton = document.getElementById('closeJsonView');
        if (closeJsonViewButton) {
            closeJsonViewButton.addEventListener('click', function() {
                document.getElementById('jsonViewModal').style.display = 'none';
            });
        }
        
        // Générer rapport IA
        const generateAIReport = document.getElementById('generateAIReport');
        if (generateAIReport) {
            generateAIReport.addEventListener('click', function() {
                const patientIdField = document.getElementById('patientId');
                const serverUrlField = document.getElementById('serverUrl');
                
                const patientId = patientIdField ? patientIdField.value : null;
                const serverUrl = serverUrlField ? serverUrlField.value : null;
                
                if (patientId && serverUrl) {
                    analyzePatientWithAI(patientId, serverUrl);
                } else {
                    showStatus('<i class="fas fa-exclamation-triangle"></i> Veuillez d\'abord charger un patient', 'warning');
                }
            });
        }
    }
    
    function initializeServerUrlField() {
        // Initialiser avec le serveur par défaut
        const serverUrlField = document.getElementById('serverUrl');
        if (serverUrlField) {
            serverUrlField.value = serverUrlField.value || 'https://hapi.fhir.org/baseR4';
        } else {
            console.warn("Élément serverUrl non trouvé dans le DOM");
        }
    }
    
    function toggleResourceSections() {
        document.querySelectorAll('.resource-section-toggle').forEach(checkbox => {
            const sectionId = checkbox.getAttribute('data-section');
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = checkbox.checked ? 'block' : 'none';
            }
        });
    }
    
    function setupTabNavigation() {
        // Activer le premier onglet par défaut
        switchTab('basic');
    }
    
    function switchTab(tabId) {
        // Masquer tous les contenus d'onglets
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Désactiver tous les boutons d'onglets
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Activer l'onglet sélectionné
        document.getElementById(`${tabId}Tab`).classList.add('active');
        document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
    }
    
    function openJsonView(resourceId, resourceType) {
        const jsonViewModal = document.getElementById('jsonViewModal');
        const jsonContent = document.getElementById('jsonContent');
        const jsonTitle = document.getElementById('jsonViewTitle');
        
        if (jsonViewModal && jsonContent && window.patientData) {
            let resource = null;
            
            // Trouver la ressource dans les données du patient
            if (resourceType === 'Patient' && window.patientData.patient) {
                resource = window.patientData.patient;
            } else if (resourceType === 'Condition' && window.patientData.conditions) {
                resource = window.patientData.conditions.find(c => c.id === resourceId);
            } else if (resourceType === 'Observation' && window.patientData.observations) {
                resource = window.patientData.observations.find(o => o.id === resourceId);
            } else if (resourceType === 'MedicationRequest' && window.patientData.medications) {
                resource = window.patientData.medications.find(m => m.id === resourceId);
            } else if (resourceType === 'Encounter' && window.patientData.encounters) {
                resource = window.patientData.encounters.find(e => e.id === resourceId);
            } else if (resourceType === 'Practitioner' && window.patientData.practitioners) {
                resource = window.patientData.practitioners.find(p => p.id === resourceId);
            } else if (resourceType === 'Organization' && window.patientData.organizations) {
                resource = window.patientData.organizations.find(o => o.id === resourceId);
            } else if (resourceType === 'RelatedPerson' && window.patientData.relatedPersons) {
                resource = window.patientData.relatedPersons.find(r => r.id === resourceId);
            } else if (resourceType === 'Coverage' && window.patientData.coverages) {
                resource = window.patientData.coverages.find(c => c.id === resourceId);
            }
            
            if (resource) {
                jsonContent.textContent = JSON.stringify(resource, null, 2);
                jsonTitle.textContent = `${resourceType} (${resourceId})`;
                jsonViewModal.style.display = 'block';
                
                // Mettre en surbrillance le JSON
                if (typeof hljs !== 'undefined') {
                    hljs.highlightAll();
                }
            } else {
                console.error(`Ressource non trouvée: ${resourceType}/${resourceId}`);
            }
        }
    }
    
    function analyzePatientWithAI(patientId, serverUrl) {
        const aiReportSection = document.getElementById('aiReportSection');
        const aiReportContent = document.getElementById('aiReportContent');
        const aiReportLoading = document.getElementById('aiReportLoading');
        const aiReportError = document.getElementById('aiReportError');
        
        if (!aiReportSection || !aiReportContent || !aiReportLoading || !aiReportError) {
            console.error('Éléments DOM manquants pour le rapport IA');
            return;
        }
        
        // Afficher la section et l'indicateur de chargement
        aiReportSection.style.display = 'block';
        aiReportLoading.style.display = 'block';
        aiReportContent.style.display = 'none';
        aiReportError.style.display = 'none';
        
        // Faire défiler jusqu'à la section
        aiReportSection.scrollIntoView({ behavior: 'smooth' });
        
        // Appeler l'API d'analyse IA
        fetch(`/api/ai/analyze-patient?patientId=${patientId}&serverUrl=${encodeURIComponent(serverUrl)}`)
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Erreur ${response.status}: ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                // Masquer l'indicateur de chargement et afficher le contenu
                aiReportLoading.style.display = 'none';
                aiReportContent.style.display = 'block';
                
                // Formatter et afficher le rapport
                aiReportContent.innerHTML = formatAIReport(data);
                
                // Mettre en surbrillance le code si nécessaire
                if (typeof hljs !== 'undefined') {
                    document.querySelectorAll('pre code').forEach(block => {
                        hljs.highlightBlock(block);
                    });
                }
            })
            .catch(error => {
                console.error('Erreur lors de l\'analyse IA:', error);
                
                // Masquer l'indicateur de chargement et afficher l'erreur
                aiReportLoading.style.display = 'none';
                aiReportError.style.display = 'block';
                
                // Afficher le message d'erreur
                aiReportError.innerHTML = `
                    <div class="alert alert-danger">
                        <h4><i class="fas fa-exclamation-triangle"></i> Erreur lors de l'analyse</h4>
                        <p>${error.message || 'Une erreur est survenue lors de l\'analyse du patient.'}</p>
                        <button class="btn btn-outline-secondary btn-sm mt-2" id="showLocalAnalysisButton">
                            <i class="fas fa-code"></i> Utiliser l'analyse locale
                        </button>
                    </div>
                `;
                
                // Configurer le bouton d'analyse locale
                const showLocalAnalysisButton = document.getElementById('showLocalAnalysisButton');
                if (showLocalAnalysisButton) {
                    showLocalAnalysisButton.addEventListener('click', () => showLocalAnalysis(error.message));
                }
            });
    }
    
    function formatAIReport(data) {
        if (!data || !data.report) {
            return '<div class="alert alert-warning">Le rapport est vide ou mal formaté.</div>';
        }
        
        // Convertir les sauts de ligne en balises HTML et conserver le formatage
        let formattedReport = data.report
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Encapsuler dans des balises de paragraphe
        formattedReport = `<p>${formattedReport}</p>`;
        
        // Ajouter une mise en forme pour les sections
        formattedReport = formattedReport
            .replace(/<p>#+\s*(.*?)<\/p>/g, '<h4>$1</h4>')
            .replace(/<p>---+<\/p>/g, '<hr>');
        
        return `
            <div class="ai-report-header">
                <h3><i class="fas fa-robot"></i> Analyse IA du patient</h3>
                <div class="ai-report-metadata">
                    <span><i class="fas fa-clock"></i> Généré le: ${new Date().toLocaleString()}</span>
                    <span><i class="fas fa-microchip"></i> Modèle: ${data.model || 'Non spécifié'}</span>
                </div>
            </div>
            <div class="ai-report-body">
                ${formattedReport}
            </div>
        `;
    }
    
    function showLocalAnalysis(errorMessage) {
        const aiReportContent = document.getElementById('aiReportContent');
        const aiReportLoading = document.getElementById('aiReportLoading');
        const aiReportError = document.getElementById('aiReportError');
        
        if (!aiReportContent || !aiReportLoading || !aiReportError || !window.patientData) {
            console.error('Éléments DOM ou données patient manquants');
            return;
        }
        
        // Masquer l'erreur et l'indicateur de chargement
        aiReportError.style.display = 'none';
        aiReportLoading.style.display = 'none';
        
        // Afficher le contenu
        aiReportContent.style.display = 'block';
        
        // Générer un rapport simple basé sur les données disponibles
        const patient = window.patientData.patient;
        const conditions = window.patientData.conditions || [];
        const observations = window.patientData.observations || [];
        const medications = window.patientData.medications || [];
        const encounters = window.patientData.encounters || [];
        
        const patientName = formatPatientName(patient.name);
        const patientGender = patient.gender ? (patient.gender === 'male' ? 'Homme' : patient.gender === 'female' ? 'Femme' : patient.gender) : 'Non spécifié';
        const patientBirth = patient.birthDate ? new Date(patient.birthDate).toLocaleDateString() : 'Non spécifiée';
        const patientAge = patient.birthDate ? calculateAge(patient.birthDate) : 'Non spécifié';
        
        const report = `
            <div class="ai-report-header">
                <h3><i class="fas fa-clipboard-list"></i> Synthèse du dossier patient</h3>
                <div class="ai-report-metadata">
                    <span><i class="fas fa-clock"></i> Généré le: ${new Date().toLocaleString()}</span>
                    <span><i class="fas fa-exclamation-triangle"></i> Analyse IA indisponible: ${errorMessage || 'Erreur inconnue'}</span>
                </div>
            </div>
            <div class="ai-report-body">
                <h4>Informations personnelles</h4>
                <p>
                    <strong>Nom:</strong> ${patientName}<br>
                    <strong>Genre:</strong> ${patientGender}<br>
                    <strong>Date de naissance:</strong> ${patientBirth}<br>
                    <strong>Âge:</strong> ${patientAge}<br>
                    <strong>Identifiant:</strong> ${patient.id}
                </p>
                
                <h4>Problèmes de santé (${conditions.length})</h4>
                ${conditions.length > 0 ? `
                    <ul>
                        ${conditions.map(c => `
                            <li>
                                <strong>${c.code?.coding?.[0]?.display || 'Problème non codé'}</strong>
                                ${c.onsetDateTime ? ` - Début: ${new Date(c.onsetDateTime).toLocaleDateString()}` : ''}
                                ${c.clinicalStatus?.coding?.[0]?.code ? ` (${c.clinicalStatus.coding[0].code === 'active' ? 'Actif' : 'Résolu'})` : ''}
                            </li>
                        `).join('')}
                    </ul>
                ` : '<p>Aucun problème de santé enregistré.</p>'}
                
                <h4>Mesures récentes (${Math.min(observations.length, 5)}/${observations.length})</h4>
                ${observations.length > 0 ? `
                    <ul>
                        ${observations.slice(0, 5).map(o => `
                            <li>
                                <strong>${o.code?.coding?.[0]?.display || 'Observation non codée'}</strong>:
                                ${getObservationValue(o)}
                                ${o.effectiveDateTime ? ` (${new Date(o.effectiveDateTime).toLocaleDateString()})` : ''}
                            </li>
                        `).join('')}
                    </ul>
                ` : '<p>Aucune mesure enregistrée.</p>'}
                
                <h4>Médicaments (${medications.length})</h4>
                ${medications.length > 0 ? `
                    <ul>
                        ${medications.map(m => `
                            <li>
                                <strong>${m.medicationCodeableConcept?.coding?.[0]?.display || 'Médicament non codé'}</strong>
                                ${m.dosageInstruction?.[0]?.text ? ` - ${m.dosageInstruction[0].text}` : ''}
                                ${m.authoredOn ? ` (Prescrit le: ${new Date(m.authoredOn).toLocaleDateString()})` : ''}
                            </li>
                        `).join('')}
                    </ul>
                ` : '<p>Aucun médicament enregistré.</p>'}
                
                <h4>Consultations récentes (${Math.min(encounters.length, 3)}/${encounters.length})</h4>
                ${encounters.length > 0 ? `
                    <ul>
                        ${encounters.slice(0, 3).map(e => `
                            <li>
                                <strong>${e.type?.[0]?.coding?.[0]?.display || 'Consultation'}</strong>
                                ${e.period?.start ? ` - ${new Date(e.period.start).toLocaleDateString()}` : ''}
                                ${e.serviceProvider?.display ? ` avec ${e.serviceProvider.display}` : ''}
                            </li>
                        `).join('')}
                    </ul>
                ` : '<p>Aucune consultation enregistrée.</p>'}
                
                <div class="alert alert-info mt-3">
                    <p><i class="fas fa-info-circle"></i> <strong>Note:</strong> Cette synthèse a été générée localement et ne remplace pas l'analyse complète de l'IA.</p>
                </div>
            </div>
        `;
        
        aiReportContent.innerHTML = report;
    }
    
    // Fonction pour calculer l'âge à partir de la date de naissance
    function calculateAge(birthDate) {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age + ' ans';
    }
    
    // Formatage des noms
    function formatPatientName(nameArray) {
        if (!nameArray || nameArray.length === 0) {
            return 'Nom inconnu';
        }
        
        const name = nameArray[0];
        let formattedName = '';
        
        if (name.prefix && name.prefix.length > 0) {
            formattedName += name.prefix.join(' ') + ' ';
        }
        
        if (name.given && name.given.length > 0) {
            formattedName += name.given.join(' ') + ' ';
        }
        
        if (name.family) {
            formattedName += name.family;
        }
        
        return formattedName || 'Nom inconnu';
    }
    
    // Affichage des messages de statut
    function showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('statusMessages');
        if (!statusDiv) return;
        
        const statusMessage = document.createElement('div');
        statusMessage.className = `alert alert-${type} alert-dismissible fade show`;
        statusMessage.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button>
        `;
        
        statusDiv.appendChild(statusMessage);
        
        // Auto-suppression après 5 secondes pour les messages non critiques
        if (type !== 'danger') {
            setTimeout(() => {
                statusMessage.classList.remove('show');
                setTimeout(() => statusMessage.remove(), 500);
            }, 5000);
        }
    }
    
    // Génération d'un résumé du patient
    function generatePatientSummary(patient) {
        if (!patient) return '';
        
        const patientName = formatPatientName(patient.name);
        const patientGender = patient.gender ? (patient.gender === 'male' ? 'Homme' : patient.gender === 'female' ? 'Femme' : patient.gender) : 'Non spécifié';
        const patientBirth = patient.birthDate ? new Date(patient.birthDate).toLocaleDateString() : 'Non spécifiée';
        
        let summary = `
            <div class="card mb-3">
                <div class="card-header bg-primary text-white">
                    <h3 class="card-title mb-0">
                        <i class="fas fa-user-circle me-2"></i>${patientName}
                    </h3>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Genre:</strong> ${patientGender}</p>
                            <p><strong>Date de naissance:</strong> ${patientBirth}</p>
        `;
        
        if (patient.birthDate) {
            const age = calculateAge(patient.birthDate);
            summary += `<p><strong>Âge:</strong> ${age}</p>`;
        }
        
        summary += `<p><strong>Identifiant:</strong> ${patient.id}</p>`;
        
        // Ajouter le contact si disponible
        if (patient.telecom && patient.telecom.length > 0) {
            summary += '<p><strong>Contact:</strong> ';
            patient.telecom.forEach((t, i) => {
                if (i > 0) summary += ', ';
                summary += `${t.system === 'phone' ? '<i class="fas fa-phone-alt"></i>' : t.system === 'email' ? '<i class="fas fa-envelope"></i>' : ''} ${t.value} (${t.use || 'non spécifié'})`;
            });
            summary += '</p>';
        }
        
        summary += `
                        </div>
                        <div class="col-md-6">
        `;
        
        // Ajouter l'adresse si disponible
        if (patient.address && patient.address.length > 0) {
            const address = patient.address[0];
            summary += '<p><strong>Adresse:</strong><br>';
            
            if (address.line && address.line.length > 0) {
                address.line.forEach(line => {
                    summary += `${line}<br>`;
                });
            }
            
            if (address.postalCode || address.city) {
                summary += `${address.postalCode || ''} ${address.city || ''}<br>`;
            }
            
            if (address.country) {
                summary += `${address.country}`;
            }
            
            summary += '</p>';
        }
        
        // Ajouter le contact d'urgence si disponible
        if (patient.contact && patient.contact.length > 0) {
            const contact = patient.contact[0];
            summary += '<p><strong>Contact d\'urgence:</strong><br>';
            
            if (contact.name) {
                summary += `${formatPatientName([contact.name])}<br>`;
            }
            
            if (contact.relationship && contact.relationship.length > 0) {
                const relationships = contact.relationship.map(r => r.text || r.coding?.[0]?.display || 'Non spécifié').join(', ');
                summary += `Relation: ${relationships}<br>`;
            }
            
            if (contact.telecom && contact.telecom.length > 0) {
                const telecom = contact.telecom[0];
                summary += `${telecom.system === 'phone' ? '<i class="fas fa-phone-alt"></i>' : telecom.system === 'email' ? '<i class="fas fa-envelope"></i>' : ''} ${telecom.value}`;
            }
            
            summary += '</p>';
        }
        
        summary += `
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return summary;
    }
    
    // Recherche de patients
    function searchPatients() {
        const searchField = document.getElementById('patientSearch');
        const serverUrlField = document.getElementById('serverUrl');
        
        if (!searchField) {
            console.error("Élément patientSearch non trouvé dans le DOM");
            return;
        }
        
        const searchTerm = searchField.value.trim();
        const serverUrl = serverUrlField ? serverUrlField.value : '';
        
        if (!searchTerm) {
            showStatus('<i class="fas fa-exclamation-triangle"></i> Veuillez entrer un terme de recherche', 'warning');
            return;
        }
        
        if (!serverUrl) {
            showStatus('<i class="fas fa-exclamation-triangle"></i> Veuillez spécifier l\'URL du serveur FHIR', 'warning');
            return;
        }
        
        // Afficher l'état de la recherche
        const searchStatus = document.getElementById('searchStatus');
        const patientSelect = document.getElementById('patientSelect');
        
        if (searchStatus) {
            searchStatus.style.display = 'block';
            searchStatus.textContent = 'Recherche en cours...';
        }
        
        if (patientSelect) {
            patientSelect.innerHTML = '<option value="">Chargement des résultats...</option>';
        }
        
        // Construire l'URL de recherche
        let searchUrl = `${serverUrl}/Patient?_count=100&_format=json`;
        
        // Déterminer si le terme de recherche est un nom ou un identifiant
        if (searchTerm.match(/^[0-9]+$/)) {
            // Si le terme est numérique, chercher par ID
            searchUrl = `${serverUrl}/Patient?_id=${searchTerm}`;
        } else {
            // Sinon, chercher par nom
            searchUrl += `&name=${encodeURIComponent(searchTerm)}`;
        }
        
        // Effectuer la recherche sécurisée (avec retry)
        secureSearch(searchUrl)
            .then(processPatientResults)
            .catch(error => {
                console.error('Erreur lors de la recherche:', error);
                
                if (searchStatus) {
                    searchStatus.style.display = 'block';
                    searchStatus.innerHTML = `<span class="text-danger">Erreur: ${error.message}</span>`;
                }
                
                if (patientSelect) {
                    patientSelect.innerHTML = '<option value="">-- Erreur de recherche --</option>';
                }
                
                showStatus(`<i class="fas fa-exclamation-triangle"></i> Erreur lors de la recherche: ${error.message}`, 'danger');
            });
        
        // Traitement des résultats de recherche
        function processPatientResults(data) {
            if (!data || !data.entry || data.entry.length === 0) {
                if (searchStatus) {
                    searchStatus.style.display = 'block';
                    searchStatus.textContent = 'Aucun patient trouvé';
                }
                
                if (patientSelect) {
                    patientSelect.innerHTML = '<option value="">-- Aucun résultat --</option>';
                }
                
                showStatus('<i class="fas fa-info-circle"></i> Aucun patient ne correspond à votre recherche', 'info');
                return;
            }
            
            // Patients trouvés
            const count = data.entry.length;
            
            if (searchStatus) {
                searchStatus.style.display = 'block';
                searchStatus.textContent = `${count} patient(s) trouvé(s)`;
            }
            
            if (patientSelect) {
                try {
                    // Trier les patients par nom
                    const sortedPatients = data.entry.sort((a, b) => {
                        const nameA = a.resource.name?.[0]?.family || '';
                        const nameB = b.resource.name?.[0]?.family || '';
                        return nameA.localeCompare(nameB);
                    });
                    
                    // Générer les options
                    patientSelect.innerHTML = '<option value="">-- Sélectionnez un patient --</option>';
                    
                    sortedPatients.forEach(entry => {
                        const patient = entry.resource;
                        const option = document.createElement('option');
                        option.value = patient.id;
                        
                        const name = formatPatientName(patient.name);
                        const birth = patient.birthDate ? ` (${patient.birthDate})` : '';
                        const gender = patient.gender ? ` - ${patient.gender}` : '';
                        
                        option.textContent = `${name}${gender}${birth}`;
                        patientSelect.appendChild(option);
                    });
                    
                    // Si un seul patient est trouvé, le sélectionner automatiquement
                    if (count === 1) {
                        patientSelect.selectedIndex = 1;
                        document.getElementById('patientId').value = patientSelect.value;
                        loadPatient();
                    }
                    
                    showStatus(`<i class="fas fa-check-circle"></i> ${count} patient(s) trouvé(s)`, 'success');
                } catch (error) {
                    console.error('Erreur parsing JSON:', error);
                    patientSelect.innerHTML = '<option value="">-- Erreur de traitement des données --</option>';
                    showStatus('<i class="fas fa-exclamation-triangle"></i> Erreur de traitement des données', 'error');
                }
            } else {
                console.error('Element patientSelect non trouvé dans le DOM');
            }
        }
        
        // Fonction de recherche sécurisée avec retry pour les problèmes CORS
        function secureSearch(url, isSecondAttempt = false) {
            return fetch(url)
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 404) {
                            throw new Error('Serveur FHIR introuvable ou URL incorrecte');
                        } else if (response.status === 401) {
                            throw new Error('Accès non autorisé au serveur FHIR');
                        } else {
                            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                        }
                    }
                    return response.json();
                })
                .catch(error => {
                    // Si l'erreur est liée à CORS et que c'est la première tentative,
                    // essayer via le proxy du serveur
                    if (!isSecondAttempt && (error.message.includes('CORS') || error.message.includes('Failed to fetch'))) {
                        console.log('Tentative de contournement CORS via proxy...');
                        return fetch(`/api/fhir-proxy?url=${encodeURIComponent(url)}`).then(response => {
                            if (!response.ok) {
                                throw new Error(`Erreur proxy ${response.status}: ${response.statusText}`);
                            }
                            return response.json();
                        });
                    }
                    throw error;
                });
        }
    }
    
    // Effacement de la recherche
    function clearSearch() {
        document.getElementById('patientSearch').value = '';
        document.getElementById('patientSelect').innerHTML = '<option value="">-- Recherchez des patients --</option>';
        document.getElementById('searchStatus').style.display = 'none';
    }
    
    // Effacement des données patient
    function clearPatientData() {
        // Effacer les conteneurs de données
        document.querySelectorAll('.resources-list').forEach(el => {
            el.innerHTML = '';
            el.style.display = 'none';
        });
        
        // Afficher les indicateurs de chargement
        document.querySelectorAll('.loading-resources').forEach(el => {
            el.style.display = 'none';
        });
        
        // Afficher les messages d'absence de ressources
        document.querySelectorAll('.no-resources').forEach(el => {
            el.style.display = 'block';
        });
        
        // Effacer le conteneur de patient
        document.getElementById('patientContainer').innerHTML = '';
        
        // Cacher la section de rapport IA
        const aiReportSection = document.getElementById('aiReportSection');
        if (aiReportSection) {
            aiReportSection.style.display = 'none';
        }
        
        // Réinitialiser les données globales
        window.patientData = null;
    }
    
    // Chargement d'un patient
    function loadPatient() {
        const patientIdField = document.getElementById('patientId');
        const serverUrlField = document.getElementById('serverUrl');
        
        if (!patientIdField) {
            console.error("Élément patientId non trouvé dans le DOM");
            return;
        }
        
        const patientId = patientIdField.value;
        const serverUrl = serverUrlField ? serverUrlField.value : '';
        
        if (!patientId) {
            showStatus('<i class="fas fa-exclamation-triangle"></i> Veuillez spécifier l\'ID du patient', 'warning');
            return;
        }
        
        if (!serverUrl) {
            showStatus('<i class="fas fa-exclamation-triangle"></i> Veuillez spécifier l\'URL du serveur FHIR', 'warning');
            return;
        }
        
        // Initialiser l'interface
        clearPatientData();
        
        const patientIdDisplay = document.getElementById('patientIdDisplay');
        const patientServerDisplay = document.getElementById('patientServerDisplay');
        const patientDataContainer = document.getElementById('patientDataContainer');
        
        if (patientIdDisplay) {
            patientIdDisplay.textContent = patientId;
        }
        
        if (patientServerDisplay) {
            patientServerDisplay.textContent = serverUrl;
        }
        
        if (patientDataContainer) {
            patientDataContainer.style.display = 'block';
        }
        
        // Mettre à jour l'URL pour permettre le partage
        const newUrl = `${window.location.pathname}?id=${patientId}&server=${encodeURIComponent(serverUrl)}`;
        window.history.pushState({ patientId, serverUrl }, '', newUrl);
        
        // Initialiser l'objet global de données patient
        window.patientData = {
            patient: null,
            conditions: [],
            observations: [],
            medications: [],
            encounters: [],
            practitioners: [],
            organizations: [],
            relatedPersons: [],
            coverages: []
        };
        
        // Charger les données du patient principal
        fetch(`${serverUrl}/Patient/${patientId}?_format=json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                window.patientData.patient = data;
                
                // Afficher le résumé du patient
                const patientContainer = document.getElementById('patientContainer');
                patientContainer.innerHTML = generatePatientSummary(data);
                
                // Charger les ressources liées au patient
                Promise.all([
                    loadPatientConditions(patientId, serverUrl),
                    loadPatientObservations(patientId, serverUrl),
                    loadPatientMedications(patientId, serverUrl),
                    loadPatientEncounters(patientId, serverUrl),
                    loadPatientPractitioners(patientId, serverUrl),
                    loadPatientOrganizations(patientId, serverUrl),
                    loadPatientRelatedPersons(patientId, serverUrl),
                    loadPatientCoverage(patientId, serverUrl),
                    loadPatientBundle(patientId, serverUrl),
                    generateTimeline(patientId, serverUrl)
                ])
                .then(results => {
                    console.log('Toutes les ressources ont été chargées');
                    showStatus('<i class="fas fa-check-circle"></i> Données patient chargées avec succès', 'success');
                    
                    // Mettre à jour le compteur global de ressources
                    updateResourceCounts();
                })
                .catch(error => {
                    console.error('Erreur lors du chargement des ressources:', error);
                    showStatus(`<i class="fas fa-exclamation-triangle"></i> Certaines ressources n'ont pas pu être chargées: ${error.message}`, 'warning');
                    
                    // Mettre à jour le compteur quand même
                    updateResourceCounts();
                });
            })
            .catch(error => {
                console.error('Erreur lors du chargement du patient:', error);
                
                document.getElementById('patientContainer').innerHTML = `
                    <div class="alert alert-danger">
                        <h4><i class="fas fa-exclamation-triangle"></i> Erreur lors du chargement du patient</h4>
                        <p>${error.message}</p>
                        <p>Vérifiez l'ID du patient et l'URL du serveur FHIR.</p>
                    </div>
                `;
                
                showStatus(`<i class="fas fa-exclamation-triangle"></i> Erreur: ${error.message}`, 'danger');
            });
        
        // Fonction pour mettre à jour les compteurs de ressources
        function updateResourceCounts() {
            if (!window.patientData) return;
            
            const updateCount = (elementId, count) => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = count;
                }
            };
            
            updateCount('conditionsCount', window.patientData.conditions.length);
            updateCount('observationsCount', window.patientData.observations.length);
            updateCount('medicationsCount', window.patientData.medications.length);
            updateCount('encountersCount', window.patientData.encounters.length);
            updateCount('practitionersCount', window.patientData.practitioners.length);
            updateCount('organizationsCount', window.patientData.organizations.length);
            updateCount('relatedPersonsCount', window.patientData.relatedPersons.length);
            updateCount('coveragesCount', window.patientData.coverages.length);
        }
    }
    
    // Chargement des conditions du patient
    function loadPatientConditions(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                const container = document.querySelector('#conditionsContent');
                if (!container) {
                    reject(new Error("Container #conditionsContent non trouvé dans le DOM"));
                    return;
                }
                
                const loadingSection = container.querySelector('.loading-resources');
                const noResourcesSection = container.querySelector('.no-resources');
                const resourcesList = container.querySelector('.resources-list');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    reject(new Error("Structure DOM incorrecte dans le container de conditions"));
                    return;
                }
                
                // Afficher l'indicateur de chargement
                loadingSection.style.display = 'block';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'none';
                resourcesList.innerHTML = '';
                
                // Charger les conditions
                fetch(`${serverUrl}/Condition?patient=${patientId}&_count=100&_format=json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        loadingSection.style.display = 'none';
                        
                        if (!data.entry || data.entry.length === 0) {
                            noResourcesSection.style.display = 'block';
                            resourcesList.style.display = 'none';
                            resolve([]);
                            return;
                        }
                        
                        // Conditions trouvées
                        noResourcesSection.style.display = 'none';
                        resourcesList.style.display = 'block';
                        
                        // Trier les conditions par date (les plus récentes d'abord)
                        const conditions = data.entry.map(entry => entry.resource).sort((a, b) => {
                            const dateA = a.recordedDate || a.onsetDateTime || '';
                            const dateB = b.recordedDate || b.onsetDateTime || '';
                            return dateB.localeCompare(dateA);
                        });
                        
                        // Stocker les conditions dans l'objet global
                        window.patientData.conditions = conditions;
                        
                        // Générer la liste des conditions
                        conditions.forEach(condition => {
                            const conditionElement = document.createElement('div');
                            conditionElement.className = 'resource-item';
                            
                            const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code || 'unknown';
                            const verificationStatus = condition.verificationStatus?.coding?.[0]?.code || 'unknown';
                            const severity = condition.severity?.coding?.[0]?.display || '';
                            const category = condition.category?.[0]?.coding?.[0]?.display || 'Non catégorisé';
                            
                            const statusClass = clinicalStatus === 'active' ? 'badge bg-danger' : 
                                               clinicalStatus === 'resolved' ? 'badge bg-success' : 
                                               'badge bg-secondary';
                            
                            const verificationClass = verificationStatus === 'confirmed' ? 'badge bg-success' : 
                                                     verificationStatus === 'provisional' ? 'badge bg-warning' : 
                                                     'badge bg-secondary';
                            
                            const conditionName = condition.code?.coding?.[0]?.display || 'Condition sans nom';
                            const conditionSystem = condition.code?.coding?.[0]?.system || '';
                            const conditionCode = condition.code?.coding?.[0]?.code || '';
                            
                            let dateInfo = '';
                            if (condition.onsetDateTime) {
                                dateInfo = `Début: ${new Date(condition.onsetDateTime).toLocaleDateString()}`;
                            } else if (condition.recordedDate) {
                                dateInfo = `Enregistré: ${new Date(condition.recordedDate).toLocaleDateString()}`;
                            }
                            
                            conditionElement.innerHTML = `
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h4 class="resource-item-title">
                                        ${conditionName}
                                        <button class="btn btn-sm btn-outline-secondary ms-2 view-json-button" 
                                                data-resource-id="${condition.id}" 
                                                data-resource-type="Condition"
                                                title="Voir JSON">
                                            <i class="fas fa-code"></i>
                                        </button>
                                    </h4>
                                    <div>
                                        <span class="${statusClass}">${clinicalStatus}</span>
                                        <span class="${verificationClass}">${verificationStatus}</span>
                                    </div>
                                </div>
                                <div class="resource-item-details">
                                    ${dateInfo ? `<div><strong>Date:</strong> ${dateInfo}</div>` : ''}
                                    ${severity ? `<div><strong>Sévérité:</strong> ${severity}</div>` : ''}
                                    <div><strong>Catégorie:</strong> ${category}</div>
                                    <div class="mt-1"><strong>Code:</strong> ${conditionSystem ? `<span title="${conditionSystem}">${conditionCode}</span>` : 'Non codé'}</div>
                                    ${condition.note && condition.note.length > 0 ? 
                                        `<div class="mt-2 fst-italic">${condition.note[0].text}</div>` : 
                                        ''}
                                </div>
                            `;
                            
                            resourcesList.appendChild(conditionElement);
                        });
                        
                        // Configurer les boutons de visualisation JSON
                        document.querySelectorAll('.view-json-button').forEach(button => {
                            button.addEventListener('click', function() {
                                const resourceId = this.getAttribute('data-resource-id');
                                const resourceType = this.getAttribute('data-resource-type');
                                openJsonView(resourceId, resourceType);
                            });
                        });
                        
                        resolve(conditions);
                    })
                    .catch(error => {
                        console.error('Erreur lors du chargement des conditions:', error);
                        
                        loadingSection.style.display = 'none';
                        noResourcesSection.style.display = 'block';
                        noResourcesSection.innerHTML = `
                            <div class="alert alert-warning">
                                <h4><i class="fas fa-exclamation-triangle"></i> Erreur</h4>
                                <p>Impossible de charger les conditions: ${error.message}</p>
                            </div>
                        `;
                        
                        reject(error);
                    });
            } catch (error) {
                console.error('Exception dans loadPatientConditions:', error);
                reject(error);
            }
        });
    }
    
    // Chargement des observations du patient
    function loadPatientObservations(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                const container = document.querySelector('#observationsContent');
                if (!container) {
                    reject(new Error("Container #observationsContent non trouvé dans le DOM"));
                    return;
                }
                
                const loadingSection = container.querySelector('.loading-resources');
                const noResourcesSection = container.querySelector('.no-resources');
                const resourcesList = container.querySelector('.resources-list');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    reject(new Error("Structure DOM incorrecte dans le container d'observations"));
                    return;
                }
                
                // Afficher l'indicateur de chargement
                loadingSection.style.display = 'block';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'none';
                resourcesList.innerHTML = '';
                
                // Charger les observations
                fetch(`${serverUrl}/Observation?patient=${patientId}&_count=100&_format=json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        loadingSection.style.display = 'none';
                        
                        if (!data.entry || data.entry.length === 0) {
                            noResourcesSection.style.display = 'block';
                            resourcesList.style.display = 'none';
                            resolve([]);
                            return;
                        }
                        
                        // Observations trouvées
                        noResourcesSection.style.display = 'none';
                        resourcesList.style.display = 'block';
                        
                        // Trier les observations par date (les plus récentes d'abord)
                        const observations = data.entry.map(entry => entry.resource).sort((a, b) => {
                            const dateA = a.effectiveDateTime || a.issued || '';
                            const dateB = b.effectiveDateTime || b.issued || '';
                            return dateB.localeCompare(dateA);
                        });
                        
                        // Stocker les observations dans l'objet global
                        window.patientData.observations = observations;
                        
                        // Générer la liste des observations
                        observations.forEach(observation => {
                            const observationElement = document.createElement('div');
                            observationElement.className = 'resource-item';
                            
                            const observationName = observation.code?.coding?.[0]?.display || 'Observation sans nom';
                            const observationSystem = observation.code?.coding?.[0]?.system || '';
                            const observationCode = observation.code?.coding?.[0]?.code || '';
                            const observationValue = getObservationValue(observation);
                            const observationDate = getEffectiveDate(observation);
                            const observationStatus = observation.status || 'unknown';
                            
                            const statusClass = observationStatus === 'final' ? 'badge bg-success' : 
                                              observationStatus === 'preliminary' ? 'badge bg-warning' : 
                                              'badge bg-secondary';
                            
                            observationElement.innerHTML = `
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h4 class="resource-item-title">
                                        ${observationName}
                                        <button class="btn btn-sm btn-outline-secondary ms-2 view-json-button" 
                                                data-resource-id="${observation.id}" 
                                                data-resource-type="Observation"
                                                title="Voir JSON">
                                            <i class="fas fa-code"></i>
                                        </button>
                                    </h4>
                                    <div>
                                        <span class="${statusClass}">${observationStatus}</span>
                                    </div>
                                </div>
                                <div class="resource-item-details">
                                    <div class="fs-5 fw-bold my-2">${observationValue}</div>
                                    ${observationDate ? `<div><strong>Date:</strong> ${observationDate}</div>` : ''}
                                    <div class="mt-1"><strong>Code:</strong> ${observationSystem ? `<span title="${observationSystem}">${observationCode}</span>` : 'Non codé'}</div>
                                    ${observation.note && observation.note.length > 0 ? 
                                        `<div class="mt-2 fst-italic">${observation.note[0].text}</div>` : 
                                        ''}
                                </div>
                            `;
                            
                            resourcesList.appendChild(observationElement);
                        });
                        
                        // Configurer les boutons de visualisation JSON
                        document.querySelectorAll('.view-json-button').forEach(button => {
                            button.addEventListener('click', function() {
                                const resourceId = this.getAttribute('data-resource-id');
                                const resourceType = this.getAttribute('data-resource-type');
                                openJsonView(resourceId, resourceType);
                            });
                        });
                        
                        resolve(observations);
                    })
                    .catch(error => {
                        console.error('Erreur lors du chargement des observations:', error);
                        
                        loadingSection.style.display = 'none';
                        noResourcesSection.style.display = 'block';
                        noResourcesSection.innerHTML = `
                            <div class="alert alert-warning">
                                <h4><i class="fas fa-exclamation-triangle"></i> Erreur</h4>
                                <p>Impossible de charger les observations: ${error.message}</p>
                            </div>
                        `;
                        
                        reject(error);
                    });
            } catch (error) {
                console.error('Exception dans loadPatientObservations:', error);
                reject(error);
            }
        });
    }
    
    // Chargement des médicaments du patient
    function loadPatientMedications(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                const container = document.querySelector('#medicationsContent');
                if (!container) {
                    reject(new Error("Container #medicationsContent non trouvé dans le DOM"));
                    return;
                }
                
                const loadingSection = container.querySelector('.loading-resources');
                const noResourcesSection = container.querySelector('.no-resources');
                const resourcesList = container.querySelector('.resources-list');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    reject(new Error("Structure DOM incorrecte dans le container de médicaments"));
                    return;
                }
                
                // Afficher l'indicateur de chargement
                loadingSection.style.display = 'block';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'none';
                resourcesList.innerHTML = '';
                
                // Charger les prescriptions de médicaments
                fetch(`${serverUrl}/MedicationRequest?patient=${patientId}&_count=100&_format=json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        loadingSection.style.display = 'none';
                        
                        if (!data.entry || data.entry.length === 0) {
                            noResourcesSection.style.display = 'block';
                            resourcesList.style.display = 'none';
                            resolve([]);
                            return;
                        }
                        
                        // Médicaments trouvés
                        noResourcesSection.style.display = 'none';
                        resourcesList.style.display = 'block';
                        
                        // Trier les médicaments par date (les plus récents d'abord)
                        const medications = data.entry.map(entry => entry.resource).sort((a, b) => {
                            const dateA = a.authoredOn || '';
                            const dateB = b.authoredOn || '';
                            return dateB.localeCompare(dateA);
                        });
                        
                        // Stocker les médicaments dans l'objet global
                        window.patientData.medications = medications;
                        
                        // Générer la liste des médicaments
                        medications.forEach(medication => {
                            const medicationElement = document.createElement('div');
                            medicationElement.className = 'resource-item';
                            
                            const medicationName = medication.medicationCodeableConcept?.coding?.[0]?.display || 
                                                medication.medicationReference?.display || 
                                                'Médicament sans nom';
                            
                            const medicationSystem = medication.medicationCodeableConcept?.coding?.[0]?.system || '';
                            const medicationCode = medication.medicationCodeableConcept?.coding?.[0]?.code || '';
                            const medicationStatus = medication.status || 'unknown';
                            const medicationIntent = medication.intent || 'unknown';
                            
                            const statusClass = medicationStatus === 'active' ? 'badge bg-success' : 
                                              medicationStatus === 'stopped' ? 'badge bg-danger' : 
                                              'badge bg-secondary';
                            
                            const intentClass = medicationIntent === 'order' ? 'badge bg-primary' : 
                                             medicationIntent === 'plan' ? 'badge bg-info' : 
                                             'badge bg-secondary';
                            
                            let dateInfo = '';
                            if (medication.authoredOn) {
                                dateInfo = `Prescrit le: ${new Date(medication.authoredOn).toLocaleDateString()}`;
                            }
                            
                            const dosageText = medication.dosageInstruction?.[0]?.text || '';
                            const noteText = medication.note?.[0]?.text || '';
                            
                            medicationElement.innerHTML = `
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h4 class="resource-item-title">
                                        ${medicationName}
                                        <button class="btn btn-sm btn-outline-secondary ms-2 view-json-button" 
                                                data-resource-id="${medication.id}" 
                                                data-resource-type="MedicationRequest"
                                                title="Voir JSON">
                                            <i class="fas fa-code"></i>
                                        </button>
                                    </h4>
                                    <div>
                                        <span class="${statusClass}">${medicationStatus}</span>
                                        <span class="${intentClass}">${medicationIntent}</span>
                                    </div>
                                </div>
                                <div class="resource-item-details">
                                    ${dateInfo ? `<div><strong>Date:</strong> ${dateInfo}</div>` : ''}
                                    ${dosageText ? `<div class="mt-2"><strong>Posologie:</strong> ${dosageText}</div>` : ''}
                                    <div class="mt-1"><strong>Code:</strong> ${medicationSystem ? `<span title="${medicationSystem}">${medicationCode}</span>` : 'Non codé'}</div>
                                    ${noteText ? `<div class="mt-2 fst-italic">${noteText}</div>` : ''}
                                </div>
                            `;
                            
                            resourcesList.appendChild(medicationElement);
                        });
                        
                        // Configurer les boutons de visualisation JSON
                        document.querySelectorAll('.view-json-button').forEach(button => {
                            button.addEventListener('click', function() {
                                const resourceId = this.getAttribute('data-resource-id');
                                const resourceType = this.getAttribute('data-resource-type');
                                openJsonView(resourceId, resourceType);
                            });
                        });
                        
                        resolve(medications);
                    })
                    .catch(error => {
                        console.error('Erreur lors du chargement des médicaments:', error);
                        
                        loadingSection.style.display = 'none';
                        noResourcesSection.style.display = 'block';
                        noResourcesSection.innerHTML = `
                            <div class="alert alert-warning">
                                <h4><i class="fas fa-exclamation-triangle"></i> Erreur</h4>
                                <p>Impossible de charger les médicaments: ${error.message}</p>
                            </div>
                        `;
                        
                        reject(error);
                    });
            } catch (error) {
                console.error('Exception dans loadPatientMedications:', error);
                reject(error);
            }
        });
    }
    
    // Chargement des consultations du patient
    function loadPatientEncounters(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                const container = document.querySelector('#encountersContent');
                if (!container) {
                    reject(new Error("Container #encountersContent non trouvé dans le DOM"));
                    return;
                }
                
                const loadingSection = container.querySelector('.loading-resources');
                const noResourcesSection = container.querySelector('.no-resources');
                const resourcesList = container.querySelector('.resources-list');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    reject(new Error("Structure DOM incorrecte dans le container de consultations"));
                    return;
                }
                
                // Afficher l'indicateur de chargement
                loadingSection.style.display = 'block';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'none';
                resourcesList.innerHTML = '';
                
                // Charger les consultations
                fetch(`${serverUrl}/Encounter?patient=${patientId}&_count=100&_format=json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        loadingSection.style.display = 'none';
                        
                        if (!data.entry || data.entry.length === 0) {
                            noResourcesSection.style.display = 'block';
                            resourcesList.style.display = 'none';
                            resolve([]);
                            return;
                        }
                        
                        // Consultations trouvées
                        noResourcesSection.style.display = 'none';
                        resourcesList.style.display = 'block';
                        
                        // Trier les consultations par date (les plus récentes d'abord)
                        const encounters = data.entry.map(entry => entry.resource).sort((a, b) => {
                            const dateA = a.period?.start || '';
                            const dateB = b.period?.start || '';
                            return dateB.localeCompare(dateA);
                        });
                        
                        // Stocker les consultations dans l'objet global
                        window.patientData.encounters = encounters;
                        
                        // Générer la liste des consultations
                        encounters.forEach(encounter => {
                            const encounterElement = document.createElement('div');
                            encounterElement.className = 'resource-item';
                            
                            const encounterType = encounter.type?.[0]?.coding?.[0]?.display || 'Consultation';
                            const encounterClass = encounter.class?.display || encounter.class?.code || '';
                            const encounterStatus = encounter.status || 'unknown';
                            
                            const statusClass = encounterStatus === 'finished' ? 'badge bg-success' : 
                                               encounterStatus === 'in-progress' ? 'badge bg-primary' : 
                                               encounterStatus === 'planned' ? 'badge bg-info' :
                                               'badge bg-secondary';
                            
                            let dateInfo = '';
                            if (encounter.period?.start) {
                                const startDate = new Date(encounter.period.start).toLocaleDateString();
                                if (encounter.period?.end) {
                                    const endDate = new Date(encounter.period.end).toLocaleDateString();
                                    if (startDate === endDate) {
                                        dateInfo = `Date: ${startDate}`;
                                    } else {
                                        dateInfo = `Période: ${startDate} → ${endDate}`;
                                    }
                                } else {
                                    dateInfo = `Date: ${startDate}`;
                                }
                            }
                            
                            encounterElement.innerHTML = `
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h4 class="resource-item-title">
                                        ${encounterType}
                                        <button class="btn btn-sm btn-outline-secondary ms-2 view-json-button" 
                                                data-resource-id="${encounter.id}" 
                                                data-resource-type="Encounter"
                                                title="Voir JSON">
                                            <i class="fas fa-code"></i>
                                        </button>
                                    </h4>
                                    <div>
                                        <span class="${statusClass}">${encounterStatus}</span>
                                    </div>
                                </div>
                                <div class="resource-item-details">
                                    ${dateInfo ? `<div><strong>Date:</strong> ${dateInfo}</div>` : ''}
                                    ${encounterClass ? `<div><strong>Classe:</strong> ${encounterClass}</div>` : ''}
                                    
                                    ${encounter.serviceProvider ? 
                                        `<div><strong>Établissement:</strong> ${encounter.serviceProvider.display || 'Non spécifié'}</div>` : 
                                        ''}
                                    
                                    ${encounter.participant && encounter.participant.length > 0 ? 
                                        `<div><strong>Participants:</strong> ${encounter.participant.map(p => 
                                            p.individual?.display || 'Non spécifié'
                                        ).join(', ')}</div>` : 
                                        ''}
                                        
                                    ${encounter.location && encounter.location.length > 0 ? 
                                        `<div><strong>Lieux:</strong> ${encounter.location.map(l => 
                                            l.location?.display || 'Non spécifié'
                                        ).join(', ')}</div>` : 
                                        ''}
                                        
                                    ${encounter.reasonCode && encounter.reasonCode.length > 0 ? 
                                        `<div><strong>Motif:</strong> ${encounter.reasonCode.map(r => 
                                            r.coding?.[0]?.display || r.text || 'Non spécifié'
                                        ).join(', ')}</div>` : 
                                        ''}
                                </div>
                            `;
                            
                            resourcesList.appendChild(encounterElement);
                        });
                        
                        // Configurer les boutons de visualisation JSON
                        document.querySelectorAll('.view-json-button').forEach(button => {
                            button.addEventListener('click', function() {
                                const resourceId = this.getAttribute('data-resource-id');
                                const resourceType = this.getAttribute('data-resource-type');
                                openJsonView(resourceId, resourceType);
                            });
                        });
                        
                        resolve(encounters);
                    })
                    .catch(error => {
                        console.error('Erreur lors du chargement des consultations:', error);
                        
                        loadingSection.style.display = 'none';
                        noResourcesSection.style.display = 'block';
                        noResourcesSection.innerHTML = `
                            <div class="alert alert-warning">
                                <h4><i class="fas fa-exclamation-triangle"></i> Erreur</h4>
                                <p>Impossible de charger les consultations: ${error.message}</p>
                            </div>
                        `;
                        
                        reject(error);
                    });
            } catch (error) {
                console.error('Exception dans loadPatientEncounters:', error);
                reject(error);
            }
        });
    }
    
    // Chargement des professionnels de santé liés au patient
    function loadPatientPractitioners(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                const container = document.querySelector('#practitionersContent');
                if (!container) {
                    reject(new Error("Container #practitionersContent non trouvé dans le DOM"));
                    return;
                }
                
                const loadingSection = container.querySelector('.loading-resources');
                const noResourcesSection = container.querySelector('.no-resources');
                const resourcesList = container.querySelector('.resources-list');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    reject(new Error("Structure DOM incorrecte dans le container de praticiens"));
                    return;
                }
                
                // Afficher l'indicateur de chargement
                loadingSection.style.display = 'block';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'none';
                resourcesList.innerHTML = '';
                
                // Charger d'abord tous les praticiens depuis les rencontres
                loadPractitionersFromEncounters()
                    .then(practitioners => {
                        loadingSection.style.display = 'none';
                        
                        if (practitioners.length === 0) {
                            noResourcesSection.style.display = 'block';
                            resourcesList.style.display = 'none';
                            resolve([]);
                            return;
                        }
                        
                        // Praticiens trouvés
                        noResourcesSection.style.display = 'none';
                        resourcesList.style.display = 'block';
                        
                        // Stocker les praticiens dans l'objet global
                        window.patientData.practitioners = practitioners;
                        
                        // Générer la liste des praticiens
                        practitioners.forEach(practitioner => {
                            const practitionerElement = document.createElement('div');
                            practitionerElement.className = 'resource-item';
                            
                            const practitionerName = formatPractitionerName(practitioner.name);
                            const practitionerQualifications = formatQualifications(practitioner.qualification);
                            const practitionerTelecom = formatTelecom(practitioner.telecom);
                            const practitionerAddress = formatAddress(practitioner.address);
                            
                            // Trouver les rôles associés à ce praticien (si on a chargé un bundle)
                            let practitionerRoles = [];
                            if (window.patientData && window.patientData.bundle && window.patientData.bundle.entry) {
                                practitionerRoles = findPractitionerRoles(practitioner.id, window.patientData.bundle.entry);
                            }
                            
                            const practitionerRolesFormatted = formatRoles(practitionerRoles);
                            
                            practitionerElement.innerHTML = `
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h4 class="resource-item-title">
                                        ${practitionerName}
                                        <button class="btn btn-sm btn-outline-secondary ms-2 view-json-button" 
                                                data-resource-id="${practitioner.id}" 
                                                data-resource-type="Practitioner"
                                                title="Voir JSON">
                                            <i class="fas fa-code"></i>
                                        </button>
                                    </h4>
                                </div>
                                <div class="resource-item-details">
                                    ${practitionerQualifications ? `<div><strong>Qualifications:</strong> ${practitionerQualifications}</div>` : ''}
                                    ${practitionerRolesFormatted ? `<div><strong>Rôles:</strong> ${practitionerRolesFormatted}</div>` : ''}
                                    ${practitionerTelecom ? `<div><strong>Contact:</strong> ${practitionerTelecom}</div>` : ''}
                                    ${practitionerAddress ? `<div><strong>Adresse:</strong> ${practitionerAddress}</div>` : ''}
                                </div>
                            `;
                            
                            resourcesList.appendChild(practitionerElement);
                        });
                        
                        // Configurer les boutons de visualisation JSON
                        document.querySelectorAll('.view-json-button').forEach(button => {
                            button.addEventListener('click', function() {
                                const resourceId = this.getAttribute('data-resource-id');
                                const resourceType = this.getAttribute('data-resource-type');
                                openJsonView(resourceId, resourceType);
                            });
                        });
                        
                        resolve(practitioners);
                    })
                    .catch(error => {
                        console.error('Erreur lors du chargement des praticiens:', error);
                        
                        loadingSection.style.display = 'none';
                        noResourcesSection.style.display = 'block';
                        noResourcesSection.innerHTML = `
                            <div class="alert alert-warning">
                                <h4><i class="fas fa-exclamation-triangle"></i> Erreur</h4>
                                <p>Impossible de charger les praticiens: ${error.message}</p>
                            </div>
                        `;
                        
                        reject(error);
                    });
                
                // Fonction pour charger les praticiens à partir des rencontres
                function loadPractitionersFromEncounters() {
                    return new Promise((resolveInner, rejectInner) => {
                        if (!window.patientData || !window.patientData.encounters || window.patientData.encounters.length === 0) {
                            // Si nous n'avons pas encore les rencontres, les charger
                            if (!window.patientData) window.patientData = {};
                            fetch(`${serverUrl}/Encounter?patient=${patientId}&_count=100&_format=json`)
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                                    }
                                    return response.json();
                                })
                                .then(data => {
                                    if (!data.entry || data.entry.length === 0) {
                                        resolveInner([]);
                                        return;
                                    }
                                    
                                    window.patientData.encounters = data.entry.map(entry => entry.resource);
                                    processPractitionersReferences();
                                })
                                .catch(error => {
                                    console.error('Erreur lors du chargement des rencontres pour les praticiens:', error);
                                    resolveInner([]);
                                });
                        } else {
                            processPractitionersReferences();
                        }
                        
                        function processPractitionersReferences() {
                            // Extraire toutes les références aux praticiens des rencontres
                            const practitionerReferences = new Set();
                            window.patientData.encounters.forEach(encounter => {
                                if (encounter.participant) {
                                    encounter.participant.forEach(participant => {
                                        if (participant.individual && participant.individual.reference && 
                                            participant.individual.reference.startsWith('Practitioner/')) {
                                            practitionerReferences.add(participant.individual.reference);
                                        }
                                    });
                                }
                            });
                            
                            if (practitionerReferences.size === 0) {
                                resolveInner([]);
                                return;
                            }
                            
                            // Charger tous les praticiens référencés
                            const practitionerPromises = Array.from(practitionerReferences).map(reference => {
                                const practitionerId = reference.split('/')[1];
                                return fetch(`${serverUrl}/Practitioner/${practitionerId}?_format=json`)
                                    .then(response => {
                                        if (!response.ok) {
                                            if (response.status === 404) {
                                                console.warn(`Praticien non trouvé: ${practitionerId}`);
                                                return null;
                                            }
                                            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                                        }
                                        return response.json();
                                    })
                                    .catch(error => {
                                        console.error(`Erreur lors du chargement du praticien ${practitionerId}:`, error);
                                        return null;
                                    });
                            });
                            
                            Promise.all(practitionerPromises)
                                .then(results => {
                                    const practitioners = results.filter(p => p !== null);
                                    resolveInner(practitioners);
                                })
                                .catch(error => {
                                    console.error('Erreur lors du chargement des praticiens:', error);
                                    rejectInner(error);
                                });
                        }
                    });
                }
            } catch (error) {
                console.error('Exception dans loadPatientPractitioners:', error);
                reject(error);
            }
        });
    }
    
    // Chargement des organisations liées au patient
    function loadPatientOrganizations(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                const container = document.querySelector('#organizationsContent');
                if (!container) {
                    reject(new Error("Container #organizationsContent non trouvé dans le DOM"));
                    return;
                }
                
                const loadingSection = container.querySelector('.loading-resources');
                const noResourcesSection = container.querySelector('.no-resources');
                const resourcesList = container.querySelector('.resources-list');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    reject(new Error("Structure DOM incorrecte dans le container d'organisations"));
                    return;
                }
                
                // Afficher l'indicateur de chargement
                loadingSection.style.display = 'block';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'none';
                resourcesList.innerHTML = '';
                
                // Charger d'abord toutes les organisations depuis les rencontres et autres références
                loadOrganizationsFromReferences()
                    .then(organizations => {
                        loadingSection.style.display = 'none';
                        
                        if (organizations.length === 0) {
                            noResourcesSection.style.display = 'block';
                            resourcesList.style.display = 'none';
                            resolve([]);
                            return;
                        }
                        
                        // Organisations trouvées
                        noResourcesSection.style.display = 'none';
                        resourcesList.style.display = 'block';
                        
                        // Stocker les organisations dans l'objet global
                        window.patientData.organizations = organizations;
                        
                        // Générer la liste des organisations
                        organizations.forEach(organization => {
                            const organizationElement = document.createElement('div');
                            organizationElement.className = 'resource-item';
                            
                            const organizationName = organization.name || 'Organisation sans nom';
                            const organizationType = organization.type?.[0]?.coding?.[0]?.display || 'Type non spécifié';
                            const organizationTelecom = formatTelecom(organization.telecom);
                            const organizationAddress = formatAddress(organization.address);
                            
                            organizationElement.innerHTML = `
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h4 class="resource-item-title">
                                        ${organizationName}
                                        <button class="btn btn-sm btn-outline-secondary ms-2 view-json-button" 
                                                data-resource-id="${organization.id}" 
                                                data-resource-type="Organization"
                                                title="Voir JSON">
                                            <i class="fas fa-code"></i>
                                        </button>
                                    </h4>
                                </div>
                                <div class="resource-item-details">
                                    <div><strong>Type:</strong> ${organizationType}</div>
                                    ${organizationTelecom ? `<div><strong>Contact:</strong> ${organizationTelecom}</div>` : ''}
                                    ${organizationAddress ? `<div><strong>Adresse:</strong> ${organizationAddress}</div>` : ''}
                                    ${organization.alias && organization.alias.length > 0 ? 
                                        `<div><strong>Alias:</strong> ${organization.alias.join(', ')}</div>` : 
                                        ''}
                                </div>
                            `;
                            
                            resourcesList.appendChild(organizationElement);
                        });
                        
                        // Configurer les boutons de visualisation JSON
                        document.querySelectorAll('.view-json-button').forEach(button => {
                            button.addEventListener('click', function() {
                                const resourceId = this.getAttribute('data-resource-id');
                                const resourceType = this.getAttribute('data-resource-type');
                                openJsonView(resourceId, resourceType);
                            });
                        });
                        
                        resolve(organizations);
                    })
                    .catch(error => {
                        console.error('Erreur lors du chargement des organisations:', error);
                        
                        loadingSection.style.display = 'none';
                        noResourcesSection.style.display = 'block';
                        noResourcesSection.innerHTML = `
                            <div class="alert alert-warning">
                                <h4><i class="fas fa-exclamation-triangle"></i> Erreur</h4>
                                <p>Impossible de charger les organisations: ${error.message}</p>
                            </div>
                        `;
                        
                        reject(error);
                    });
                
                // Fonction pour charger les organisations à partir des rencontres et autres références
                function loadOrganizationsFromReferences() {
                    return new Promise((resolveInner, rejectInner) => {
                        // Collecter toutes les références d'organisations
                        const organizationReferences = new Set();
                        
                        // Extraire des encounters
                        if (window.patientData && window.patientData.encounters) {
                            window.patientData.encounters.forEach(encounter => {
                                if (encounter.serviceProvider && encounter.serviceProvider.reference && 
                                    encounter.serviceProvider.reference.startsWith('Organization/')) {
                                    organizationReferences.add(encounter.serviceProvider.reference);
                                }
                            });
                        }
                        
                        // Extraire du patient (managingOrganization)
                        if (window.patientData && window.patientData.patient && 
                            window.patientData.patient.managingOrganization && 
                            window.patientData.patient.managingOrganization.reference && 
                            window.patientData.patient.managingOrganization.reference.startsWith('Organization/')) {
                            organizationReferences.add(window.patientData.patient.managingOrganization.reference);
                        }
                        
                        // Extraire des médicaments
                        if (window.patientData && window.patientData.medications) {
                            window.patientData.medications.forEach(medication => {
                                if (medication.requester && medication.requester.agent && 
                                    medication.requester.agent.reference && 
                                    medication.requester.agent.reference.startsWith('Organization/')) {
                                    organizationReferences.add(medication.requester.agent.reference);
                                }
                            });
                        }
                        
                        if (organizationReferences.size === 0) {
                            resolveInner([]);
                            return;
                        }
                        
                        // Charger toutes les organisations référencées
                        const organizationPromises = Array.from(organizationReferences).map(reference => {
                            const organizationId = reference.split('/')[1];
                            return fetch(`${serverUrl}/Organization/${organizationId}?_format=json`)
                                .then(response => {
                                    if (!response.ok) {
                                        if (response.status === 404) {
                                            console.warn(`Organisation non trouvée: ${organizationId}`);
                                            return null;
                                        }
                                        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                                    }
                                    return response.json();
                                })
                                .catch(error => {
                                    console.error(`Erreur lors du chargement de l'organisation ${organizationId}:`, error);
                                    return null;
                                });
                        });
                        
                        Promise.all(organizationPromises)
                            .then(results => {
                                const organizations = results.filter(org => org !== null);
                                resolveInner(organizations);
                            })
                            .catch(error => {
                                console.error('Erreur lors du chargement des organisations:', error);
                                rejectInner(error);
                            });
                    });
                }
            } catch (error) {
                console.error('Exception dans loadPatientOrganizations:', error);
                reject(error);
            }
        });
    }
    
    // Chargement des personnes liées au patient
    function loadPatientRelatedPersons(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                const container = document.querySelector('#relatedPersonsContent');
                if (!container) {
                    reject(new Error("Container #relatedPersonsContent non trouvé dans le DOM"));
                    return;
                }
                
                const loadingSection = container.querySelector('.loading-resources');
                const noResourcesSection = container.querySelector('.no-resources');
                const resourcesList = container.querySelector('.resources-list');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    reject(new Error("Structure DOM incorrecte dans le container de personnes liées"));
                    return;
                }
                
                // Afficher l'indicateur de chargement
                loadingSection.style.display = 'block';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'none';
                resourcesList.innerHTML = '';
                
                // Charger les personnes liées
                fetch(`${serverUrl}/RelatedPerson?patient=${patientId}&_count=100&_format=json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        loadingSection.style.display = 'none';
                        
                        if (!data.entry || data.entry.length === 0) {
                            noResourcesSection.style.display = 'block';
                            resourcesList.style.display = 'none';
                            resolve([]);
                            return;
                        }
                        
                        // Personnes liées trouvées
                        noResourcesSection.style.display = 'none';
                        resourcesList.style.display = 'block';
                        
                        // Stocker les personnes liées dans l'objet global
                        const relatedPersons = data.entry.map(entry => entry.resource);
                        window.patientData.relatedPersons = relatedPersons;
                        
                        // Générer la liste des personnes liées
                        relatedPersons.forEach(person => {
                            const personElement = document.createElement('div');
                            personElement.className = 'resource-item';
                            
                            const personName = formatPatientName(person.name);
                            const relationship = formatRelationship(person.relationship);
                            const personTelecom = formatTelecom(person.telecom);
                            const personAddress = formatAddress(person.address);
                            const period = formatPeriod(person.period);
                            
                            personElement.innerHTML = `
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h4 class="resource-item-title">
                                        ${personName}
                                        <button class="btn btn-sm btn-outline-secondary ms-2 view-json-button" 
                                                data-resource-id="${person.id}" 
                                                data-resource-type="RelatedPerson"
                                                title="Voir JSON">
                                            <i class="fas fa-code"></i>
                                        </button>
                                    </h4>
                                    ${person.active !== undefined ? 
                                        `<div><span class="badge ${person.active ? 'bg-success' : 'bg-secondary'}">${person.active ? 'Actif' : 'Inactif'}</span></div>` : 
                                        ''}
                                </div>
                                <div class="resource-item-details">
                                    ${relationship ? `<div><strong>Relation:</strong> ${relationship}</div>` : ''}
                                    ${period ? `<div><strong>Période:</strong> ${period}</div>` : ''}
                                    ${personTelecom ? `<div><strong>Contact:</strong> ${personTelecom}</div>` : ''}
                                    ${personAddress ? `<div><strong>Adresse:</strong> ${personAddress}</div>` : ''}
                                    ${person.gender ? `<div><strong>Genre:</strong> ${person.gender === 'male' ? 'Homme' : person.gender === 'female' ? 'Femme' : person.gender}</div>` : ''}
                                    ${person.birthDate ? `<div><strong>Date de naissance:</strong> ${new Date(person.birthDate).toLocaleDateString()}</div>` : ''}
                                </div>
                            `;
                            
                            resourcesList.appendChild(personElement);
                        });
                        
                        // Configurer les boutons de visualisation JSON
                        document.querySelectorAll('.view-json-button').forEach(button => {
                            button.addEventListener('click', function() {
                                const resourceId = this.getAttribute('data-resource-id');
                                const resourceType = this.getAttribute('data-resource-type');
                                openJsonView(resourceId, resourceType);
                            });
                        });
                        
                        resolve(relatedPersons);
                    })
                    .catch(error => {
                        console.error('Erreur lors du chargement des personnes liées:', error);
                        
                        loadingSection.style.display = 'none';
                        noResourcesSection.style.display = 'block';
                        noResourcesSection.innerHTML = `
                            <div class="alert alert-warning">
                                <h4><i class="fas fa-exclamation-triangle"></i> Erreur</h4>
                                <p>Impossible de charger les personnes liées: ${error.message}</p>
                            </div>
                        `;
                        
                        reject(error);
                    });
            } catch (error) {
                console.error('Exception dans loadPatientRelatedPersons:', error);
                reject(error);
            }
        });
    }
    
    // Chargement des couvertures d'assurance du patient
    function loadPatientCoverage(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                const container = document.querySelector('#coverageContent');
                if (!container) {
                    reject(new Error("Container #coverageContent non trouvé dans le DOM"));
                    return;
                }
                
                const loadingSection = container.querySelector('.loading-resources');
                const noResourcesSection = container.querySelector('.no-resources');
                const resourcesList = container.querySelector('.resources-list');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    reject(new Error("Structure DOM incorrecte dans le container de couvertures"));
                    return;
                }
                
                // Afficher l'indicateur de chargement
                loadingSection.style.display = 'block';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'none';
                resourcesList.innerHTML = '';
                
                // Charger les couvertures
                fetch(`${serverUrl}/Coverage?patient=${patientId}&_count=100&_format=json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        loadingSection.style.display = 'none';
                        
                        if (!data.entry || data.entry.length === 0) {
                            noResourcesSection.style.display = 'block';
                            resourcesList.style.display = 'none';
                            resolve([]);
                            return;
                        }
                        
                        // Couvertures trouvées
                        noResourcesSection.style.display = 'none';
                        resourcesList.style.display = 'block';
                        
                        // Stocker les couvertures dans l'objet global
                        const coverages = data.entry.map(entry => entry.resource);
                        window.patientData.coverages = coverages;
                        
                        // Générer la liste des couvertures
                        coverages.forEach(coverage => {
                            const coverageElement = document.createElement('div');
                            coverageElement.className = 'resource-item';
                            
                            const coverageType = coverage.type?.coding?.[0]?.display || 'Type non spécifié';
                            const status = coverage.status || 'unknown';
                            const period = formatPeriod(coverage.period);
                            const payor = formatPayor(coverage.payor);
                            
                            coverageElement.innerHTML = `
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h4 class="resource-item-title">
                                        ${coverageType}
                                        <button class="btn btn-sm btn-outline-secondary ms-2 view-json-button" 
                                                data-resource-id="${coverage.id}" 
                                                data-resource-type="Coverage"
                                                title="Voir JSON">
                                            <i class="fas fa-code"></i>
                                        </button>
                                    </h4>
                                    <div>
                                        <span class="badge ${status === 'active' ? 'bg-success' : 'bg-secondary'}">${status}</span>
                                    </div>
                                </div>
                                <div class="resource-item-details">
                                    ${period ? `<div><strong>Période:</strong> ${period}</div>` : ''}
                                    ${payor ? `<div><strong>Payeur(s):</strong> ${payor}</div>` : ''}
                                    ${coverage.relationship?.coding?.[0]?.display ? 
                                        `<div><strong>Relation:</strong> ${coverage.relationship.coding[0].display}</div>` : 
                                        ''}
                                    ${coverage.subscriberId ? 
                                        `<div><strong>ID d'adhérent:</strong> ${coverage.subscriberId}</div>` : 
                                        ''}
                                    ${coverage.dependent ? 
                                        `<div><strong>ID de dépendant:</strong> ${coverage.dependent}</div>` : 
                                        ''}
                                </div>
                            `;
                            
                            resourcesList.appendChild(coverageElement);
                        });
                        
                        // Configurer les boutons de visualisation JSON
                        document.querySelectorAll('.view-json-button').forEach(button => {
                            button.addEventListener('click', function() {
                                const resourceId = this.getAttribute('data-resource-id');
                                const resourceType = this.getAttribute('data-resource-type');
                                openJsonView(resourceId, resourceType);
                            });
                        });
                        
                        resolve(coverages);
                    })
                    .catch(error => {
                        console.error('Erreur lors du chargement des couvertures:', error);
                        
                        loadingSection.style.display = 'none';
                        noResourcesSection.style.display = 'block';
                        noResourcesSection.innerHTML = `
                            <div class="alert alert-warning">
                                <h4><i class="fas fa-exclamation-triangle"></i> Erreur</h4>
                                <p>Impossible de charger les couvertures: ${error.message}</p>
                            </div>
                        `;
                        
                        reject(error);
                    });
            } catch (error) {
                console.error('Exception dans loadPatientCoverage:', error);
                reject(error);
            }
        });
    }
    
    // Chargement d'un bundle complet pour le patient (si disponible)
    function loadPatientBundle(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                // Tenter de récupérer un Bundle complet pour le patient
                fetch(`${serverUrl}/Patient/${patientId}/$everything?_count=100&_format=json`)
                    .then(response => {
                        if (!response.ok) {
                            // Si 4xx ou 5xx, considérer que le serveur ne supporte pas $everything
                            if (response.status >= 400) {
                                console.warn('Opération $everything non supportée par ce serveur');
                                return null;
                            }
                            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data && data.resourceType === 'Bundle') {
                            // Stocker le bundle dans l'objet global
                            window.patientData.bundle = data;
                            console.log('Bundle patient complet récupéré', data);
                        } else {
                            console.warn('Bundle patient non disponible');
                        }
                        resolve(data);
                    })
                    .catch(error => {
                        console.error('Erreur lors du chargement du bundle patient:', error);
                        resolve(null); // Résoudre quand même pour ne pas bloquer les autres chargements
                    });
            } catch (error) {
                console.error('Exception dans loadPatientBundle:', error);
                resolve(null); // Résoudre quand même pour ne pas bloquer les autres chargements
            }
        });
    }
    
    // Formatage des noms de praticiens
    function formatPractitionerName(names) {
        if (!names || names.length === 0) {
            return 'Nom inconnu';
        }
        
        const name = names[0];
        let formattedName = '';
        
        if (name.prefix && name.prefix.length > 0) {
            formattedName += name.prefix.join(' ') + ' ';
        }
        
        if (name.given && name.given.length > 0) {
            formattedName += name.given.join(' ') + ' ';
        }
        
        if (name.family) {
            formattedName += name.family;
        }
        
        return formattedName || 'Nom inconnu';
    }
    
    // Formatage des qualifications
    function formatQualifications(qualifications) {
        if (!qualifications || qualifications.length === 0) {
            return '';
        }
        
        return qualifications.map(qual => {
            let qualification = '';
            
            if (qual.code && qual.code.coding && qual.code.coding.length > 0) {
                qualification += qual.code.coding[0].display || qual.code.text || qual.code.coding[0].code || '';
            } else if (qual.code && qual.code.text) {
                qualification += qual.code.text;
            }
            
            if (qual.period && qual.period.start) {
                const startYear = new Date(qual.period.start).getFullYear();
                qualification += ` (${startYear})`;
            }
            
            return qualification;
        }).filter(q => q).join(', ');
    }
    
    // Recherche des rôles de praticiens
    function findPractitionerRoles(practitionerId, entries) {
        if (!entries || !practitionerId) return [];
        
        return entries
            .filter(entry => 
                entry.resource && 
                entry.resource.resourceType === 'PractitionerRole' && 
                entry.resource.practitioner && 
                entry.resource.practitioner.reference === `Practitioner/${practitionerId}`
            )
            .map(entry => entry.resource);
    }
    
    // Formatage des rôles
    function formatRoles(roles) {
        if (!roles || roles.length === 0) {
            return '';
        }
        
        return roles.map(role => {
            let formattedRole = '';
            
            if (role.code && role.code.length > 0) {
                const roleCode = role.code[0];
                formattedRole += roleCode.coding?.[0]?.display || roleCode.text || '';
            }
            
            if (role.specialty && role.specialty.length > 0) {
                const specialty = role.specialty[0];
                if (formattedRole) formattedRole += ' - ';
                formattedRole += specialty.coding?.[0]?.display || specialty.text || '';
            }
            
            if (role.organization && role.organization.display) {
                formattedRole += ` (${role.organization.display})`;
            }
            
            return formattedRole;
        }).filter(r => r).join(', ');
    }
    
    // Formatage des contacts
    function formatTelecom(telecom) {
        if (!telecom || telecom.length === 0) {
            return '';
        }
        
        return telecom.map(t => {
            let icon = '';
            if (t.system === 'phone') {
                icon = '<i class="fas fa-phone-alt"></i> ';
            } else if (t.system === 'email') {
                icon = '<i class="fas fa-envelope"></i> ';
            } else if (t.system === 'fax') {
                icon = '<i class="fas fa-fax"></i> ';
            } else if (t.system === 'url') {
                icon = '<i class="fas fa-globe"></i> ';
            }
            
            return `${icon}${t.value}${t.use ? ` (${t.use})` : ''}`;
        }).join(', ');
    }
    
    // Formatage des adresses
    function formatAddress(address) {
        if (!address || address.length === 0) {
            return '';
        }
        
        const addr = address[0];
        let formattedAddress = '';
        
        if (addr.line && addr.line.length > 0) {
            formattedAddress += addr.line.join(', ');
        }
        
        if (addr.postalCode || addr.city) {
            if (formattedAddress) formattedAddress += ', ';
            formattedAddress += `${addr.postalCode || ''} ${addr.city || ''}`;
        }
        
        if (addr.country) {
            if (formattedAddress) formattedAddress += ', ';
            formattedAddress += addr.country;
        }
        
        return formattedAddress;
    }
    
    // Formatage des relations
    function formatRelationship(relationship) {
        if (!relationship || relationship.length === 0) {
            return '';
        }
        
        return relationship.map(r => {
            if (r.coding && r.coding.length > 0) {
                return r.coding[0].display || r.coding[0].code;
            } else if (r.text) {
                return r.text;
            }
            return 'Non spécifiée';
        }).join(', ');
    }
    
    // Formatage des périodes
    function formatPeriod(period) {
        if (!period) {
            return '';
        }
        
        let formattedPeriod = '';
        
        if (period.start) {
            formattedPeriod += `Du ${new Date(period.start).toLocaleDateString()}`;
        }
        
        if (period.end) {
            formattedPeriod += ` au ${new Date(period.end).toLocaleDateString()}`;
        } else if (period.start) {
            formattedPeriod += ' (en cours)';
        }
        
        return formattedPeriod;
    }
    
    // Formatage des payeurs
    function formatPayor(payor) {
        if (!payor || payor.length === 0) {
            return '';
        }
        
        return payor.map(p => {
            if (p.display) {
                return p.display;
            } else if (p.reference) {
                return p.reference;
            }
            return 'Payeur non spécifié';
        }).join(', ');
    }
    
    // Génération de la chronologie
    function generateTimeline(patientId, serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                // Vérifier les paramètres d'entrée
                if (!patientId || !serverUrl) {
                    const error = new Error("Impossible de générer la chronologie: identifiant du patient ou URL du serveur manquant");
                    console.error(error.message);
                    reject(error);
                    return;
                }
                
                // Ajouter un message de logging pour debug
                console.log(`Génération de la chronologie pour le patient ${patientId} sur ${serverUrl}`);
                
                const container = document.querySelector('#timelineContent');
                if (!container) {
                    console.error("Container #timelineContent non trouvé dans le DOM");
                    reject(new Error("Container #timelineContent non trouvé dans le DOM"));
                    return;
                }
                
                const loadingSection = container.querySelector('.loading-resources');
                const noResourcesSection = container.querySelector('.no-resources');
                const resourcesList = container.querySelector('.resources-list');
                
                if (!loadingSection || !noResourcesSection || !resourcesList) {
                    console.error("Structure DOM incorrecte dans le container de chronologie");
                    reject(new Error("Structure DOM incorrecte dans le container de chronologie"));
                    return;
                }
                
                // Afficher l'indicateur de chargement
                loadingSection.style.display = 'block';
                noResourcesSection.style.display = 'none';
                resourcesList.style.display = 'none';
                resourcesList.innerHTML = '';
                
                // Préparer la collection d'entrées de chronologie
                const timelineEntries = [];
                
                // Ajouter les conditions à la chronologie
                if (window.patientData && window.patientData.conditions) {
                    window.patientData.conditions.forEach(condition => {
                        const date = condition.onsetDateTime || condition.recordedDate;
                        if (date) {
                            timelineEntries.push({
                                resourceType: 'Condition',
                                resource: condition,
                                date: date,
                                title: condition.code?.coding?.[0]?.display || 'Condition sans nom',
                                color: '#e74c3c', // Rouge
                                icon: 'fa-heartbeat'
                            });
                        }
                    });
                }
                
                // Ajouter les observations à la chronologie
                if (window.patientData && window.patientData.observations) {
                    window.patientData.observations.forEach(observation => {
                        const date = getEffectiveDate(observation, true);
                        if (date) {
                            timelineEntries.push({
                                resourceType: 'Observation',
                                resource: observation,
                                date: date,
                                title: observation.code?.coding?.[0]?.display || 'Observation sans nom',
                                color: '#3498db', // Bleu
                                icon: 'fa-flask'
                            });
                        }
                    });
                }
                
                // Ajouter les médicaments à la chronologie
                if (window.patientData && window.patientData.medications) {
                    window.patientData.medications.forEach(medication => {
                        const date = medication.authoredOn;
                        if (date) {
                            timelineEntries.push({
                                resourceType: 'MedicationRequest',
                                resource: medication,
                                date: date,
                                title: medication.medicationCodeableConcept?.coding?.[0]?.display || 'Médicament sans nom',
                                color: '#2ecc71', // Vert
                                icon: 'fa-pills'
                            });
                        }
                    });
                }
                
                // Ajouter les consultations à la chronologie
                if (window.patientData && window.patientData.encounters) {
                    window.patientData.encounters.forEach(encounter => {
                        const date = encounter.period?.start || encounter.period?.end;
                        if (date) {
                            timelineEntries.push({
                                resourceType: 'Encounter',
                                resource: encounter,
                                date: date,
                                title: encounter.type?.[0]?.coding?.[0]?.display || 'Consultation',
                                color: '#9b59b6', // Violet
                                icon: 'fa-hospital'
                            });
                        }
                    });
                }
                
                // Trier les entrées par date (les plus anciennes d'abord)
                timelineEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
                
                // Afficher la chronologie
                loadingSection.style.display = 'none';
                
                if (timelineEntries.length === 0) {
                    noResourcesSection.style.display = 'block';
                    resourcesList.style.display = 'none';
                    resolve({ entries: [], count: 0 });
                } else {
                    noResourcesSection.style.display = 'none';
                    resourcesList.style.display = 'block';
                    
                    // Créer l'élément de chronologie
                    const timelineElement = document.createElement('div');
                    timelineElement.className = 'timeline-container';
                    
                    timelineEntries.forEach((entry, index) => {
                        const entryElement = document.createElement('div');
                        entryElement.className = 'timeline-entry';
                        
                        const formattedDate = new Date(entry.date).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                        
                        entryElement.innerHTML = `
                        <div class="timeline-icon" style="background-color: ${entry.color};">
                            <i class="fas ${entry.icon}"></i>
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
                
                // Résoudre la promesse avec les données de la chronologie
                resolve({
                    entries: timelineEntries,
                    count: timelineEntries.length
                });
            }
        } catch (error) {
            console.error('Erreur lors de la génération de la chronologie:', error);
            
            // Afficher un message d'erreur plus explicite
            if (container) {
                loadingSection.style.display = 'none';
                noResourcesSection.style.display = 'block';
                resourcesList.style.display = 'none';
                
                noResourcesSection.innerHTML = `
                    <div class="alert alert-warning">
                        <h4>Erreur lors de la génération de la chronologie</h4>
                        <p>Nous n'avons pas pu générer la chronologie pour ce patient: ${error.message}</p>
                    </div>
                `;
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
            return observation.valueCodeableConcept.coding?.[0]?.display || 
                   observation.valueCodeableConcept.text || 
                   'Valeur codée';
        } else if (observation.valueString) {
            return observation.valueString;
        } else if (observation.valueBoolean !== undefined) {
            return observation.valueBoolean ? 'Oui' : 'Non';
        } else if (observation.valueInteger !== undefined) {
            return observation.valueInteger.toString();
        } else if (observation.valueRange) {
            return `${observation.valueRange.low?.value || '?'} - ${observation.valueRange.high?.value || '?'} ${observation.valueRange.low?.unit || ''}`;
        } else if (observation.valueRatio) {
            return `${observation.valueRatio.numerator?.value || '?'} / ${observation.valueRatio.denominator?.value || '?'}`;
        } else if (observation.component && observation.component.length > 0) {
            return observation.component.map(comp => {
                const name = comp.code?.coding?.[0]?.display || comp.code?.text || 'Composant';
                let value = '';
                
                if (comp.valueQuantity) {
                    value = `${comp.valueQuantity.value} ${comp.valueQuantity.unit || ''}`;
                } else if (comp.valueCodeableConcept) {
                    value = comp.valueCodeableConcept.coding?.[0]?.display || 
                           comp.valueCodeableConcept.text || 
                           'Valeur codée';
                } else if (comp.valueString) {
                    value = comp.valueString;
                }
                
                return `${name}: ${value}`;
            }).join(', ');
        } else {
            return 'Valeur non disponible';
        }
}

// Obtenir la date effective d'une observation
function getEffectiveDate(observation, returnRaw = false) {
    let date = null;
    
    if (observation.effectiveDateTime) {
        date = observation.effectiveDateTime;
    } else if (observation.effectiveInstant) {
        date = observation.effectiveInstant;
    } else if (observation.effectivePeriod && observation.effectivePeriod.start) {
        date = observation.effectivePeriod.start;
    } else if (observation.issued) {
        date = observation.issued;
    }
    
    if (!date) {
        return returnRaw ? null : '';
    }
    
    return returnRaw ? date : new Date(date).toLocaleDateString();
}

// Obtenir une description pour la chronologie
function getTimelineDescription(entry) {
    switch (entry.resourceType) {
        case 'Condition':
            const status = entry.resource.clinicalStatus?.coding?.[0]?.code || '';
            const verification = entry.resource.verificationStatus?.coding?.[0]?.code || '';
            const severity = entry.resource.severity?.coding?.[0]?.display || '';
            
            return `${status === 'active' ? 'Actif' : status === 'resolved' ? 'Résolu' : status}${severity ? ', ' + severity : ''}`;
            
        case 'Observation':
            return getObservationValue(entry.resource);
            
        case 'MedicationRequest':
            const dosage = entry.resource.dosageInstruction?.[0]?.text || '';
            return dosage || 'Pas de posologie spécifiée';
            
        case 'Encounter':
            const serviceProvider = entry.resource.serviceProvider?.display || '';
            const participants = entry.resource.participant ? 
                entry.resource.participant
                    .filter(p => p.individual && p.individual.display)
                    .map(p => p.individual.display)
                    .join(', ') : '';
            
            return serviceProvider ? 
                     (participants ? `${serviceProvider} avec ${participants}` : serviceProvider) : 
                     (participants ? `Avec ${participants}` : 'Aucun détail disponible');
            
        default:
            return '';
    }
}

// Mise à jour de la vue JSON
function updateJsonView() {
    const jsonContent = document.getElementById('jsonContent');
    if (jsonContent && typeof hljs !== 'undefined') {
        hljs.highlightElement(jsonContent);
    }
}

});