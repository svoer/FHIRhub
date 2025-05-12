/**
 * Fonctions de chargement pour le visualiseur patient
 * Implémente les fonctions pour charger les praticiens, organisations,
 * personnes liées et couvertures d'assurance du patient
 */

// Fonction pour charger les praticiens associés au patient
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
    
    // Exécuter une requête FHIR pour récupérer les praticiens liés aux consultations du patient
    fetch(`${serverUrl}/Encounter?patient=${patientId}&_include=Encounter:practitioner&_count=100`)
        .then(response => {
            if (!response.ok) throw new Error('Erreur lors de la récupération des praticiens');
            return response.json();
        })
        .then(data => {
            loadingSection.style.display = 'none';
            
            // Extraire les ressources Practitioner uniques
            const practitioners = [];
            if (data.entry && data.entry.length > 0) {
                data.entry.forEach(entry => {
                    if (entry.resource && entry.resource.resourceType === 'Practitioner') {
                        // Vérifier si ce praticien est déjà dans notre liste
                        const exists = practitioners.some(p => p.id === entry.resource.id);
                        if (!exists) {
                            practitioners.push(entry.resource);
                        }
                    }
                });
            }
            
            // Stocker les praticiens
            practitionersData = practitioners;
            console.log(`${practitionersData.length} praticiens chargés et stockés`);
            
            if (practitioners.length > 0) {
                resourcesList.innerHTML = '';
                resourcesList.style.display = 'block';
                
                // Créer une liste de praticiens
                const practitionersList = document.createElement('div');
                practitionersList.className = 'practitioners-list';
                practitionersList.style.display = 'grid';
                practitionersList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                practitionersList.style.gap = '20px';
                
                practitioners.forEach(practitioner => {
                    const practitionerCard = document.createElement('div');
                    practitionerCard.className = 'practitioner-card';
                    practitionerCard.style.padding = '20px';
                    practitionerCard.style.backgroundColor = '#f9f9f9';
                    practitionerCard.style.borderRadius = '10px';
                    practitionerCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    practitionerCard.style.display = 'flex';
                    practitionerCard.style.flexDirection = 'column';
                    
                    // Nom et photo/icône
                    const headerDiv = document.createElement('div');
                    headerDiv.style.display = 'flex';
                    headerDiv.style.alignItems = 'center';
                    headerDiv.style.marginBottom = '15px';
                    
                    const iconDiv = document.createElement('div');
                    iconDiv.style.width = '60px';
                    iconDiv.style.height = '60px';
                    iconDiv.style.borderRadius = '50%';
                    iconDiv.style.backgroundColor = '#e83e28';
                    iconDiv.style.display = 'flex';
                    iconDiv.style.alignItems = 'center';
                    iconDiv.style.justifyContent = 'center';
                    iconDiv.style.marginRight = '15px';
                    iconDiv.style.flexShrink = '0';
                    
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-user-md';
                    icon.style.fontSize = '24px';
                    icon.style.color = 'white';
                    
                    iconDiv.appendChild(icon);
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.style.flex = '1';
                    
                    const name = document.createElement('h3');
                    name.style.margin = '0 0 5px 0';
                    name.style.fontSize = '1.2rem';
                    name.style.color = '#333';
                    name.textContent = formatPractitionerName(practitioner.name);
                    
                    const qualifications = document.createElement('div');
                    qualifications.style.fontSize = '0.9rem';
                    qualifications.style.color = '#666';
                    qualifications.innerHTML = formatQualifications(practitioner.qualification);
                    
                    nameDiv.appendChild(name);
                    nameDiv.appendChild(qualifications);
                    
                    headerDiv.appendChild(iconDiv);
                    headerDiv.appendChild(nameDiv);
                    
                    // Détails du praticien
                    const detailsDiv = document.createElement('div');
                    detailsDiv.style.marginBottom = '15px';
                    
                    // Identifier (numéro professionnel)
                    if (practitioner.identifier && practitioner.identifier.length > 0) {
                        const identifierP = document.createElement('p');
                        identifierP.style.margin = '5px 0';
                        identifierP.style.fontSize = '0.9rem';
                        
                        // Trouver identifiant type RPPS ou ADELI
                        const rpps = practitioner.identifier.find(id => id.system && id.system.includes('rpps'));
                        const adeli = practitioner.identifier.find(id => id.system && id.system.includes('adeli'));
                        const identifier = rpps || adeli || practitioner.identifier[0];
                        
                        identifierP.innerHTML = `<strong>ID:</strong> ${identifier.value || 'Non spécifié'} ${
                            identifier.system ? `<span style="color:#888">(${
                                identifier.system.includes('rpps') ? 'RPPS' : 
                                identifier.system.includes('adeli') ? 'ADELI' : 
                                'Autre'
                            })</span>` : ''
                        }`;
                        
                        detailsDiv.appendChild(identifierP);
                    }
                    
                    // Informations de contact
                    if (practitioner.telecom && practitioner.telecom.length > 0) {
                        const contactDiv = document.createElement('div');
                        contactDiv.style.margin = '10px 0';
                        contactDiv.innerHTML = formatTelecom(practitioner.telecom);
                        detailsDiv.appendChild(contactDiv);
                    }
                    
                    // Adresse
                    if (practitioner.address && practitioner.address.length > 0) {
                        const addressDiv = document.createElement('div');
                        addressDiv.style.margin = '10px 0';
                        addressDiv.innerHTML = formatAddress(practitioner.address);
                        detailsDiv.appendChild(addressDiv);
                    }
                    
                    // Bouton pour afficher plus d'informations (à développer ultérieurement)
                    const moreButton = document.createElement('button');
                    moreButton.style.marginTop = 'auto';
                    moreButton.style.padding = '8px 15px';
                    moreButton.style.background = 'linear-gradient(135deg, #e83e28, #fd7e30)';
                    moreButton.style.color = 'white';
                    moreButton.style.border = 'none';
                    moreButton.style.borderRadius = '5px';
                    moreButton.style.cursor = 'pointer';
                    moreButton.style.display = 'flex';
                    moreButton.style.alignItems = 'center';
                    moreButton.style.justifyContent = 'center';
                    moreButton.style.gap = '5px';
                    moreButton.innerHTML = '<i class="fas fa-stethoscope"></i> Détails cliniques';
                    
                    // Ajouter l'événement pour afficher plus d'informations
                    moreButton.addEventListener('click', function() {
                        alert(`Informations supplémentaires pour ${formatPractitionerName(practitioner.name)} à venir dans une future version.`);
                    });
                    
                    practitionerCard.appendChild(headerDiv);
                    practitionerCard.appendChild(detailsDiv);
                    practitionerCard.appendChild(moreButton);
                    
                    practitionersList.appendChild(practitionerCard);
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
            noResourcesSection.querySelector('p').textContent = 
                'Erreur lors du chargement des praticiens. Veuillez réessayer ultérieurement.';
        });
}

// Fonction pour charger les organisations associées au patient
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
    
    // Exécuter les requêtes FHIR pour récupérer les organisations associées
    // 1. Via les consultations
    // 2. Via le praticien
    // 3. Via la couverture santé
    fetch(`${serverUrl}/Encounter?patient=${patientId}&_include=Encounter:service-provider&_count=100`)
        .then(response => {
            if (!response.ok) throw new Error('Erreur lors de la récupération des organisations');
            return response.json();
        })
        .then(data => {
            loadingSection.style.display = 'none';
            
            // Extraire les ressources Organization uniques
            const organizations = [];
            if (data.entry && data.entry.length > 0) {
                data.entry.forEach(entry => {
                    if (entry.resource && entry.resource.resourceType === 'Organization') {
                        // Vérifier si cette organisation est déjà dans notre liste
                        const exists = organizations.some(o => o.id === entry.resource.id);
                        if (!exists) {
                            organizations.push(entry.resource);
                        }
                    }
                });
            }
            
            // Stocker les organisations
            organizationsData = organizations;
            console.log(`${organizationsData.length} organisations chargées et stockées`);
            
            if (organizations.length > 0) {
                resourcesList.innerHTML = '';
                resourcesList.style.display = 'block';
                
                // Créer une liste d'organisations
                const organizationsList = document.createElement('div');
                organizationsList.className = 'organizations-list';
                organizationsList.style.display = 'grid';
                organizationsList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(350px, 1fr))';
                organizationsList.style.gap = '20px';
                
                organizations.forEach(organization => {
                    const orgCard = document.createElement('div');
                    orgCard.className = 'organization-card';
                    orgCard.style.padding = '20px';
                    orgCard.style.backgroundColor = '#f9f9f9';
                    orgCard.style.borderRadius = '10px';
                    orgCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    
                    // En-tête avec nom et type
                    const headerDiv = document.createElement('div');
                    headerDiv.style.display = 'flex';
                    headerDiv.style.alignItems = 'center';
                    headerDiv.style.marginBottom = '15px';
                    
                    const iconDiv = document.createElement('div');
                    iconDiv.style.width = '60px';
                    iconDiv.style.height = '60px';
                    iconDiv.style.borderRadius = '50%';
                    iconDiv.style.backgroundColor = '#fd7e30';
                    iconDiv.style.display = 'flex';
                    iconDiv.style.alignItems = 'center';
                    iconDiv.style.justifyContent = 'center';
                    iconDiv.style.marginRight = '15px';
                    iconDiv.style.flexShrink = '0';
                    
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-hospital-alt';
                    icon.style.fontSize = '24px';
                    icon.style.color = 'white';
                    
                    iconDiv.appendChild(icon);
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.style.flex = '1';
                    
                    const name = document.createElement('h3');
                    name.style.margin = '0 0 5px 0';
                    name.style.fontSize = '1.2rem';
                    name.style.color = '#333';
                    name.textContent = organization.name || 'Organisation sans nom';
                    
                    const type = document.createElement('div');
                    type.style.fontSize = '0.9rem';
                    type.style.color = '#666';
                    
                    if (organization.type && organization.type.length > 0) {
                        const typeName = organization.type[0].coding 
                            ? organization.type[0].coding[0].display || organization.type[0].coding[0].code 
                            : 'Type non spécifié';
                        type.textContent = typeName;
                    } else {
                        type.textContent = 'Type non spécifié';
                    }
                    
                    nameDiv.appendChild(name);
                    nameDiv.appendChild(type);
                    
                    headerDiv.appendChild(iconDiv);
                    headerDiv.appendChild(nameDiv);
                    
                    // Détails de l'organisation
                    const detailsDiv = document.createElement('div');
                    detailsDiv.style.marginBottom = '15px';
                    
                    // Identifier (numéro FINESS, SIRET, etc.)
                    if (organization.identifier && organization.identifier.length > 0) {
                        const identifierP = document.createElement('p');
                        identifierP.style.margin = '5px 0';
                        identifierP.style.fontSize = '0.9rem';
                        
                        // Déterminer le type d'identifiant
                        const finess = organization.identifier.find(id => id.system && id.system.includes('finess'));
                        const siret = organization.identifier.find(id => id.system && id.system.includes('siret'));
                        const identifier = finess || siret || organization.identifier[0];
                        
                        identifierP.innerHTML = `<strong>ID:</strong> ${identifier.value || 'Non spécifié'} ${
                            identifier.system ? `<span style="color:#888">(${
                                identifier.system.includes('finess') ? 'FINESS' : 
                                identifier.system.includes('siret') ? 'SIRET' : 
                                'Autre'
                            })</span>` : ''
                        }`;
                        
                        detailsDiv.appendChild(identifierP);
                    }
                    
                    // Informations de contact
                    if (organization.telecom && organization.telecom.length > 0) {
                        const contactDiv = document.createElement('div');
                        contactDiv.style.margin = '10px 0';
                        contactDiv.innerHTML = formatTelecom(organization.telecom);
                        detailsDiv.appendChild(contactDiv);
                    }
                    
                    // Adresse
                    if (organization.address && organization.address.length > 0) {
                        const addressDiv = document.createElement('div');
                        addressDiv.style.margin = '10px 0';
                        addressDiv.innerHTML = formatAddress(organization.address);
                        detailsDiv.appendChild(addressDiv);
                    }
                    
                    orgCard.appendChild(headerDiv);
                    orgCard.appendChild(detailsDiv);
                    
                    organizationsList.appendChild(orgCard);
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
            noResourcesSection.querySelector('p').textContent = 
                'Erreur lors du chargement des organisations. Veuillez réessayer ultérieurement.';
        });
}

// Fonction pour charger les personnes liées au patient
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
    
    // Exécuter la requête FHIR pour récupérer les personnes liées au patient
    fetch(`${serverUrl}/RelatedPerson?patient=${patientId}&_count=100`)
        .then(response => {
            if (!response.ok) throw new Error('Erreur lors de la récupération des personnes liées');
            return response.json();
        })
        .then(data => {
            loadingSection.style.display = 'none';
            
            // Extraire les ressources RelatedPerson
            const relatedPersons = [];
            if (data.entry && data.entry.length > 0) {
                relatedPersons.push(...data.entry.map(entry => entry.resource));
            }
            
            // Stocker les personnes liées
            relatedPersonsData = relatedPersons;
            console.log(`${relatedPersonsData.length} personnes liées chargées et stockées`);
            
            if (relatedPersons.length > 0) {
                resourcesList.innerHTML = '';
                resourcesList.style.display = 'block';
                
                // Créer une liste de personnes liées
                const relatedList = document.createElement('div');
                relatedList.className = 'related-persons-list';
                relatedList.style.display = 'grid';
                relatedList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                relatedList.style.gap = '20px';
                
                relatedPersons.forEach(person => {
                    const personCard = document.createElement('div');
                    personCard.className = 'related-person-card';
                    personCard.style.padding = '20px';
                    personCard.style.backgroundColor = '#f9f9f9';
                    personCard.style.borderRadius = '10px';
                    personCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    
                    // En-tête avec nom et relation
                    const headerDiv = document.createElement('div');
                    headerDiv.style.display = 'flex';
                    headerDiv.style.alignItems = 'center';
                    headerDiv.style.marginBottom = '15px';
                    
                    const iconDiv = document.createElement('div');
                    iconDiv.style.width = '60px';
                    iconDiv.style.height = '60px';
                    iconDiv.style.borderRadius = '50%';
                    iconDiv.style.backgroundColor = '#e83e28';
                    iconDiv.style.display = 'flex';
                    iconDiv.style.alignItems = 'center';
                    iconDiv.style.justifyContent = 'center';
                    iconDiv.style.marginRight = '15px';
                    iconDiv.style.flexShrink = '0';
                    
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-users';
                    icon.style.fontSize = '24px';
                    icon.style.color = 'white';
                    
                    iconDiv.appendChild(icon);
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.style.flex = '1';
                    
                    const name = document.createElement('h3');
                    name.style.margin = '0 0 5px 0';
                    name.style.fontSize = '1.2rem';
                    name.style.color = '#333';
                    name.textContent = formatPractitionerName(person.name);
                    
                    const relationshipDiv = document.createElement('div');
                    relationshipDiv.style.fontSize = '0.9rem';
                    relationshipDiv.style.color = '#666';
                    relationshipDiv.innerHTML = formatRelationship(person.relationship);
                    
                    nameDiv.appendChild(name);
                    nameDiv.appendChild(relationshipDiv);
                    
                    headerDiv.appendChild(iconDiv);
                    headerDiv.appendChild(nameDiv);
                    
                    // Détails de la personne liée
                    const detailsDiv = document.createElement('div');
                    detailsDiv.style.marginBottom = '15px';
                    
                    // Période de validité
                    if (person.period) {
                        const periodP = document.createElement('p');
                        periodP.style.margin = '5px 0';
                        periodP.style.fontSize = '0.9rem';
                        periodP.innerHTML = `<strong>Période:</strong> ${formatPeriod(person.period)}`;
                        detailsDiv.appendChild(periodP);
                    }
                    
                    // Informations de contact
                    if (person.telecom && person.telecom.length > 0) {
                        const contactDiv = document.createElement('div');
                        contactDiv.style.margin = '10px 0';
                        contactDiv.innerHTML = formatTelecom(person.telecom);
                        detailsDiv.appendChild(contactDiv);
                    }
                    
                    // Adresse
                    if (person.address) {
                        const addressDiv = document.createElement('div');
                        addressDiv.style.margin = '10px 0';
                        addressDiv.innerHTML = formatAddress([person.address]);
                        detailsDiv.appendChild(addressDiv);
                    }
                    
                    personCard.appendChild(headerDiv);
                    personCard.appendChild(detailsDiv);
                    
                    relatedList.appendChild(personCard);
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
            noResourcesSection.querySelector('p').textContent = 
                'Erreur lors du chargement des personnes liées. Veuillez réessayer ultérieurement.';
        });
}

// Fonction pour charger la couverture d'assurance du patient
function loadPatientCoverage(patientId, serverUrl) {
    const container = document.querySelector('#coverageContent');
    const loadingSection = container.querySelector('.loading-resources');
    const noResourcesSection = container.querySelector('.no-resources');
    const resourcesList = container.querySelector('.resources-list');
    
    // Réinitialiser les données de couverture
    coverageData = [];
    
    loadingSection.style.display = 'block';
    noResourcesSection.style.display = 'none';
    resourcesList.style.display = 'none';
    
    // Exécuter la requête FHIR pour récupérer les ressources Coverage
    fetch(`${serverUrl}/Coverage?beneficiary=${patientId}&_include=Coverage:payor&_count=100`)
        .then(response => {
            if (!response.ok) throw new Error('Erreur lors de la récupération des couvertures');
            return response.json();
        })
        .then(data => {
            loadingSection.style.display = 'none';
            
            // Extraire les ressources Coverage et les payeurs associés
            const coverages = [];
            const payors = [];
            
            if (data.entry && data.entry.length > 0) {
                data.entry.forEach(entry => {
                    if (entry.resource.resourceType === 'Coverage') {
                        coverages.push(entry.resource);
                    } else if (entry.resource.resourceType === 'Organization' || entry.resource.resourceType === 'Patient') {
                        payors.push(entry.resource);
                    }
                });
            }
            
            // Stocker les couvertures
            coverageData = coverages;
            console.log(`${coverageData.length} couvertures chargées et stockées`);
            
            if (coverages.length > 0) {
                resourcesList.innerHTML = '';
                resourcesList.style.display = 'block';
                
                // Créer une liste de couvertures
                const coverageList = document.createElement('div');
                coverageList.className = 'coverage-list';
                coverageList.style.display = 'grid';
                coverageList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(350px, 1fr))';
                coverageList.style.gap = '20px';
                
                coverages.forEach(coverage => {
                    const coverageCard = document.createElement('div');
                    coverageCard.className = 'coverage-card';
                    coverageCard.style.padding = '20px';
                    coverageCard.style.backgroundColor = '#f9f9f9';
                    coverageCard.style.borderRadius = '10px';
                    coverageCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    
                    // En-tête avec type de couverture
                    const headerDiv = document.createElement('div');
                    headerDiv.style.display = 'flex';
                    headerDiv.style.alignItems = 'center';
                    headerDiv.style.marginBottom = '15px';
                    
                    const iconDiv = document.createElement('div');
                    iconDiv.style.width = '60px';
                    iconDiv.style.height = '60px';
                    iconDiv.style.borderRadius = '50%';
                    iconDiv.style.backgroundColor = '#fd7e30';
                    iconDiv.style.display = 'flex';
                    iconDiv.style.alignItems = 'center';
                    iconDiv.style.justifyContent = 'center';
                    iconDiv.style.marginRight = '15px';
                    iconDiv.style.flexShrink = '0';
                    
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-file-medical';
                    icon.style.fontSize = '24px';
                    icon.style.color = 'white';
                    
                    iconDiv.appendChild(icon);
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.style.flex = '1';
                    
                    const coverageType = document.createElement('h3');
                    coverageType.style.margin = '0 0 5px 0';
                    coverageType.style.fontSize = '1.2rem';
                    coverageType.style.color = '#333';
                    
                    // Type de couverture
                    if (coverage.type && coverage.type.coding && coverage.type.coding.length > 0) {
                        coverageType.textContent = coverage.type.coding[0].display || coverage.type.coding[0].code || 'Type non spécifié';
                    } else {
                        coverageType.textContent = 'Couverture';
                    }
                    
                    // Status
                    const status = document.createElement('div');
                    status.style.fontSize = '0.9rem';
                    status.style.display = 'inline-block';
                    status.style.padding = '3px 8px';
                    status.style.borderRadius = '10px';
                    
                    if (coverage.status === 'active') {
                        status.style.backgroundColor = '#e8f5e9';
                        status.style.color = '#2e7d32';
                        status.textContent = 'Active';
                    } else if (coverage.status === 'cancelled') {
                        status.style.backgroundColor = '#ffebee';
                        status.style.color = '#c62828';
                        status.textContent = 'Annulée';
                    } else {
                        status.style.backgroundColor = '#e0e0e0';
                        status.style.color = '#616161';
                        status.textContent = coverage.status || 'Status inconnu';
                    }
                    
                    nameDiv.appendChild(coverageType);
                    nameDiv.appendChild(status);
                    
                    headerDiv.appendChild(iconDiv);
                    headerDiv.appendChild(nameDiv);
                    
                    // Détails de la couverture
                    const detailsDiv = document.createElement('div');
                    detailsDiv.style.marginBottom = '15px';
                    
                    // Identifiant de la couverture
                    if (coverage.identifier && coverage.identifier.length > 0) {
                        const identifierP = document.createElement('p');
                        identifierP.style.margin = '5px 0';
                        identifierP.style.fontSize = '0.9rem';
                        identifierP.innerHTML = `<strong>N° de contrat:</strong> ${coverage.identifier[0].value || 'Non spécifié'}`;
                        detailsDiv.appendChild(identifierP);
                    }
                    
                    // Période de validité
                    if (coverage.period) {
                        const periodP = document.createElement('p');
                        periodP.style.margin = '5px 0';
                        periodP.style.fontSize = '0.9rem';
                        periodP.innerHTML = `<strong>Période de validité:</strong> ${formatPeriod(coverage.period)}`;
                        detailsDiv.appendChild(periodP);
                    }
                    
                    // Payeur / Assureur
                    if (coverage.payor && coverage.payor.length > 0) {
                        const payorDiv = document.createElement('div');
                        payorDiv.style.margin = '10px 0';
                        payorDiv.style.padding = '10px';
                        payorDiv.style.backgroundColor = '#fff';
                        payorDiv.style.borderRadius = '5px';
                        payorDiv.style.border = '1px solid #eee';
                        
                        const payorTitle = document.createElement('h4');
                        payorTitle.style.margin = '0 0 10px 0';
                        payorTitle.style.fontSize = '0.95rem';
                        payorTitle.style.color = '#333';
                        payorTitle.innerHTML = '<i class="fas fa-building" style="margin-right: 5px;"></i> Organisme payeur';
                        
                        const payorContent = document.createElement('div');
                        payorContent.innerHTML = formatPayor(coverage.payor[0], payors);
                        
                        payorDiv.appendChild(payorTitle);
                        payorDiv.appendChild(payorContent);
                        detailsDiv.appendChild(payorDiv);
                    }
                    
                    coverageCard.appendChild(headerDiv);
                    coverageCard.appendChild(detailsDiv);
                    
                    coverageList.appendChild(coverageCard);
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
            noResourcesSection.querySelector('p').textContent = 
                'Erreur lors du chargement des couvertures. Veuillez réessayer ultérieurement.';
        });
}