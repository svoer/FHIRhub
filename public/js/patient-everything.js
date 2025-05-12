/**
 * Module pour charger efficacement toutes les données patient à partir d'un seul appel FHIR $everything
 * Ce module implémente la stratégie recommandée d'utiliser un seul appel réseau pour récupérer
 * toutes les ressources associées à un patient, puis de les répartir dans les différents onglets.
 */

// Fonction pour récupérer toutes les données patient en une requête
async function fetchPatientEverything(serverUrl, patientId) {
    try {
        showStatus('Chargement de toutes les données médicales via $everything...', 'info');
        const url = `${serverUrl}/Patient/${patientId}/$everything?_count=1000`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn(`L'opération $everything a échoué: ${response.status}`);
            throw new Error(`$everything non supporté: ${response.status}`);
        }
        
        const bundle = await response.json();
        console.log("Bundle complet récupéré via $everything:", bundle);
        showStatus('Chargement complet des données réussi via $everything', 'success');
        return bundle;
    } catch (error) {
        console.error("Erreur avec $everything:", error);
        showStatus('Erreur lors du chargement complet, utilisation de la méthode traditionnelle', 'warning');
        throw error;
    }
}

// Fonction pour grouper les ressources par type
function groupResourcesByType(bundle) {
    const byType = {};
    
    if (bundle && bundle.entry) {
        bundle.entry.forEach(entry => {
            if (entry.resource) {
                const type = entry.resource.resourceType;
                byType[type] = byType[type] || [];
                byType[type].push(entry.resource);
            }
        });
    }
    
    return byType;
}

// Fonction pour tout charger et peupler tous les onglets
async function loadPatientEverything() {
    const patientId = patientSelect.value;
    const server = serverSelect.value;
    
    if (!patientId || !server) {
        console.error("Impossible de charger les données: ID patient ou serveur manquant");
        return;
    }
    
    try {
        // 1. Récupérer le bundle complet
        const bundle = await fetchPatientEverything(server, patientId);
        
        // 2. Stocker le bundle pour référence future
        bundleData = bundle;
        
        // 3. Grouper les ressources par type
        const resourcesByType = groupResourcesByType(bundle);
        
        // 4. Remplir chaque onglet avec les données correspondantes
        
        // Conditions médicales (problèmes de santé)
        conditionsData = resourcesByType['Condition'] || [];
        updateConditionsTab(conditionsData);
        
        // Observations (signes vitaux, résultats de laboratoire, etc.)
        observationsData = resourcesByType['Observation'] || [];
        updateObservationsTab(observationsData);
        
        // Prescriptions médicamenteuses
        medicationsData = resourcesByType['MedicationRequest'] || [];
        updateMedicationsTab(medicationsData);
        
        // Consultations et hospitalisations
        encountersData = resourcesByType['Encounter'] || [];
        updateEncountersTab(encountersData);
        
        // Professionnels de santé
        practitionersData = resourcesByType['Practitioner'] || [];
        updatePractitionersTab(practitionersData);
        
        // Organisations de santé (cliniques, hôpitaux)
        organizationsData = resourcesByType['Organization'] || [];
        updateOrganizationsTab(organizationsData);
        
        // Personnes liées au patient
        if (resourcesByType['RelatedPerson'] && resourcesByType['RelatedPerson'].length > 0) {
            relatedPersonsData = resourcesByType['RelatedPerson'];
            updateRelatedPersonsTab(relatedPersonsData);
        } else if (patientData && patientData.contact && patientData.contact.length > 0) {
            // Si pas de RelatedPerson mais des contacts dans Patient
            const relatedFromContacts = patientData.contact.map(contact => {
                // Créer une ressource RelatedPerson à partir des contacts
                return {
                    resourceType: "RelatedPerson",
                    id: `generated-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                    patient: {
                        reference: `Patient/${patientId}`
                    },
                    relationship: contact.relationship,
                    name: contact.name,
                    telecom: contact.telecom,
                    address: contact.address,
                    gender: contact.gender,
                    _generatedFromContact: true
                };
            });
            
            if (relatedFromContacts.length > 0) {
                relatedPersonsData = relatedFromContacts;
                updateRelatedPersonsTab(relatedPersonsData);
            }
        }
        
        // Couverture d'assurance
        coverageData = resourcesByType['Coverage'] || [];
        updateCoverageTab(coverageData);
        
        // Mettre à jour l'onglet Bundle avec les données complètes
        loadPatientBundle(patientId, server, bundle);
        
        // Générer la chronologie à partir des données du bundle
        generateTimelineFromBundle(bundle);
        
    } catch (error) {
        console.error("Erreur lors du chargement global:", error);
        // Fallback vers la méthode traditionnelle en cas d'erreur
        loadResourcesTraditionnally();
    }
}

// Fonction de secours pour charger les ressources individuellement
function loadResourcesTraditionnally() {
    showStatus('Chargement individuel des ressources...', 'info');
    
    const patientId = patientSelect.value;
    const server = serverSelect.value;
    
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