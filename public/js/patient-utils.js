/**
 * Fonctions utilitaires pour le visualiseur patient
 * Contient les fonctions réutilisables pour le formatage et l'affichage des données
 */

// Formatage des noms de praticiens
function formatPractitionerName(names) {
    if (!names || !Array.isArray(names) || names.length === 0) {
        return 'Praticien sans nom';
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
    
    return formattedName.trim() || 'Praticien sans nom';
}

// Formatage des qualifications des praticiens
function formatQualifications(qualifications) {
    if (!qualifications || !Array.isArray(qualifications) || qualifications.length === 0) {
        return 'Aucune qualification enregistrée';
    }
    
    // Créer des badges pour chaque qualification
    return qualifications.map(qual => {
        let text = '';
        
        if (qual.code && qual.code.coding && qual.code.coding.length > 0) {
            text = qual.code.coding[0].display || qual.code.coding[0].code || '';
        }
        
        if (!text && qual.code && qual.code.text) {
            text = qual.code.text;
        }
        
        // Ajouter la période si disponible
        let period = '';
        if (qual.period) {
            if (qual.period.start) {
                const startDate = new Date(qual.period.start);
                period += ` (depuis ${startDate.getFullYear()})`;
            }
        }
        
        return `<span style="display: inline-block; background-color: #f1f1f1; color: #333; padding: 2px 8px; margin: 2px; border-radius: 12px; font-size: 0.8rem;">
            ${text}${period}
        </span>`;
    }).join(' ');
}

// Recherche des rôles associés aux praticiens
function findPractitionerRoles(practitionerId, entries) {
    if (!entries || !Array.isArray(entries)) return [];
    
    return entries.filter(entry => 
        entry.resource && 
        entry.resource.resourceType === 'PractitionerRole' && 
        entry.resource.practitioner && 
        entry.resource.practitioner.reference.includes(practitionerId)
    ).map(e => e.resource);
}

// Formatage des rôles des praticiens
function formatRoles(roles) {
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
        return 'Aucun rôle enregistré';
    }
    
    return roles.map(role => {
        let text = '';
        
        if (role.code && role.code.length > 0 && role.code[0].coding && role.code[0].coding.length > 0) {
            text = role.code[0].coding[0].display || role.code[0].coding[0].code || '';
        }
        
        if (!text && role.code && role.code.length > 0 && role.code[0].text) {
            text = role.code[0].text;
        }
        
        // Ajouter l'organisation si disponible
        let org = '';
        if (role.organization && role.organization.display) {
            org = ` @ ${role.organization.display}`;
        }
        
        return `<span style="display: inline-block; background-color: #e1f5fe; color: #0277bd; padding: 2px 8px; margin: 2px; border-radius: 12px; font-size: 0.8rem;">
            ${text || 'Rôle non spécifié'}${org}
        </span>`;
    }).join(' ');
}

// Formatage des coordonnées téléphoniques/email
function formatTelecom(telecom) {
    if (!telecom || !Array.isArray(telecom) || telecom.length === 0) {
        return '<p style="color: #666; font-style: italic;">Aucune information de contact</p>';
    }
    
    return telecom.map(contact => {
        let icon;
        let label;
        
        switch (contact.system) {
            case 'phone':
                icon = 'fa-phone';
                label = 'Téléphone';
                break;
            case 'email':
                icon = 'fa-envelope';
                label = 'Email';
                break;
            case 'fax':
                icon = 'fa-fax';
                label = 'Fax';
                break;
            case 'url':
                icon = 'fa-globe';
                label = 'Site web';
                break;
            default:
                icon = 'fa-comment';
                label = contact.system || 'Contact';
        }
        
        let useLabel = '';
        if (contact.use) {
            switch (contact.use) {
                case 'home':
                    useLabel = ' (domicile)';
                    break;
                case 'work':
                    useLabel = ' (professionnel)';
                    break;
                case 'mobile':
                    useLabel = ' (mobile)';
                    break;
                default:
                    useLabel = ` (${contact.use})`;
            }
        }
        
        return `<p style="margin: 5px 0; display: flex; align-items: center;">
            <i class="fas ${icon}" style="width: 20px; color: #666; margin-right: 8px;"></i>
            <span><strong>${label}${useLabel}:</strong> ${contact.value}</span>
        </p>`;
    }).join('');
}

// Formatage des adresses
function formatAddress(addresses) {
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
        return '<p style="color: #666; font-style: italic;">Aucune information d\'adresse</p>';
    }
    
    return addresses.map(address => {
        let icon;
        let label;
        
        if (address.use) {
            switch (address.use) {
                case 'home':
                    icon = 'fa-home';
                    label = 'Domicile';
                    break;
                case 'work':
                    icon = 'fa-building';
                    label = 'Professionnel';
                    break;
                case 'temp':
                    icon = 'fa-hotel';
                    label = 'Temporaire';
                    break;
                default:
                    icon = 'fa-map-marker-alt';
                    label = 'Adresse';
            }
        } else {
            icon = 'fa-map-marker-alt';
            label = 'Adresse';
        }
        
        let formattedAddress = '';
        
        if (address.line && address.line.length > 0) {
            formattedAddress += address.line.join('<br>') + '<br>';
        }
        
        if (address.postalCode) {
            formattedAddress += address.postalCode + ' ';
        }
        
        if (address.city) {
            formattedAddress += address.city + '<br>';
        }
        
        if (address.country) {
            formattedAddress += address.country;
        }
        
        return `<p style="margin: 5px 0; display: flex; align-items: top;">
            <i class="fas ${icon}" style="width: 20px; color: #666; margin-right: 8px; margin-top: 3px;"></i>
            <span>
                <strong>${label}:</strong><br>
                ${formattedAddress || 'Adresse non spécifiée'}
            </span>
        </p>`;
    }).join('<div style="margin: 8px 0;"></div>');
}

// Formatage des relations pour les "related persons"
function formatRelationship(relationship) {
    if (!relationship || !Array.isArray(relationship) || relationship.length === 0) {
        return 'Relation non spécifiée';
    }
    
    return relationship.map(rel => {
        let text = '';
        
        if (rel.coding && rel.coding.length > 0) {
            text = rel.coding[0].display || rel.coding[0].code || '';
        }
        
        if (!text && rel.text) {
            text = rel.text;
        }
        
        // Définir des codes de couleur par type de relation
        let color = '#607d8b'; // couleur par défaut
        let bgColor = '#eceff1';
        
        if (text.toLowerCase().includes('parent') || 
            text.toLowerCase().includes('mère') || 
            text.toLowerCase().includes('père')) {
            color = '#2e7d32';
            bgColor = '#e8f5e9';
        } else if (text.toLowerCase().includes('enfant') || 
                   text.toLowerCase().includes('fils') || 
                   text.toLowerCase().includes('fille')) {
            color = '#d84315';
            bgColor = '#fbe9e7';
        } else if (text.toLowerCase().includes('conjoint') || 
                   text.toLowerCase().includes('époux') || 
                   text.toLowerCase().includes('épouse') ||
                   text.toLowerCase().includes('partenaire')) {
            color = '#1565c0';
            bgColor = '#e3f2fd';
        }
        
        return `<span style="display: inline-block; background-color: ${bgColor}; color: ${color}; 
            padding: 3px 10px; margin: 2px; border-radius: 12px; font-size: 0.9rem; font-weight: 500;">
            ${text || 'Relation non spécifiée'}
        </span>`;
    }).join(' ');
}

// Formatage des périodes
function formatPeriod(period) {
    if (!period) return 'Non spécifiée';
    
    let result = '';
    
    if (period.start) {
        const startDate = new Date(period.start);
        result += `Du ${startDate.toLocaleDateString('fr-FR')}`;
    }
    
    if (period.end) {
        const endDate = new Date(period.end);
        result += result ? ` au ${endDate.toLocaleDateString('fr-FR')}` : `Jusqu'au ${endDate.toLocaleDateString('fr-FR')}`;
    } else if (period.start) {
        result += ' à aujourd\'hui';
    }
    
    return result || 'Non spécifiée';
}

// Formatage des organismes payeurs (assurances)
function formatPayor(payorReference, payorResources) {
    if (!payorReference) return '<p style="color: #666; font-style: italic;">Organisme non spécifié</p>';
    
    // Si nous avons la référence directe à un organisme, chercher ses détails
    let payorId = '';
    if (typeof payorReference === 'string') {
        payorId = payorReference.split('/').pop();
    } else if (payorReference.reference) {
        payorId = payorReference.reference.split('/').pop();
    }
    
    // Chercher l'organisme dans la liste des ressources
    const payorResource = payorResources.find(p => p.id === payorId);
    
    if (!payorResource) {
        // Si nous avons uniquement la référence sans détails
        return `<p style="margin: 5px 0;">
            <strong>Organisme:</strong> ${payorReference.display || 'Référence: ' + payorId}
        </p>`;
    }
    
    // Si nous avons les détails de l'organisme
    if (payorResource.resourceType === 'Organization') {
        return `
            <p style="margin: 5px 0;"><strong>Organisation:</strong> ${payorResource.name || 'Non spécifié'}</p>
            ${payorResource.telecom ? formatTelecom(payorResource.telecom) : ''}
            ${payorResource.address ? formatAddress(payorResource.address) : ''}
        `;
    } else if (payorResource.resourceType === 'Patient') {
        // Si le payeur est un patient (rare mais possible)
        return `
            <p style="margin: 5px 0;"><strong>Patient:</strong> ${formatPatientName(payorResource.name)}</p>
            ${payorResource.telecom ? formatTelecom(payorResource.telecom) : ''}
        `;
    }
    
    return '<p style="color: #666; font-style: italic;">Détails de l\'organisme non disponibles</p>';
}

// Exporter les fonctions pour les rendre disponibles
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatPractitionerName,
        formatQualifications,
        findPractitionerRoles,
        formatRoles,
        formatTelecom,
        formatAddress,
        formatRelationship,
        formatPeriod,
        formatPayor
    };
}