#!/usr/bin/env node

/**
 * Script de validation FRCore pour les ressources générées
 * Vérifie la conformité aux profils français
 */

const fs = require('fs');
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Valide qu'une ressource respecte les exigences FRCore
 */
function validateFRCoreResource(resource) {
    const validations = [];
    
    // 1. Vérifier meta.profile
    if (!resource.meta?.profile || resource.meta.profile.length === 0) {
        validations.push({ type: 'error', message: 'meta.profile manquant' });
    } else {
        const hasFrencProfile = resource.meta.profile.some(p => p.includes('hl7.fr/ig/fhir/core'));
        if (!hasFrencProfile) {
            validations.push({ type: 'warning', message: 'Aucun profil FR Core détecté' });
        } else {
            validations.push({ type: 'success', message: 'Profil FR Core présent' });
        }
    }
    
    // 2. Validation spécifique par type de ressource
    switch (resource.resourceType) {
        case 'Patient':
            validations.push(...validatePatientFRCore(resource));
            break;
        case 'Appointment':
            validations.push(...validateAppointmentFRCore(resource));
            break;
        case 'ServiceRequest':
            validations.push(...validateServiceRequestFRCore(resource));
            break;
        case 'MessageHeader':
            validations.push(...validateMessageHeaderFRCore(resource));
            break;
        case 'Location':
            validations.push(...validateLocationFRCore(resource));
            break;
    }
    
    return validations;
}

function validatePatientFRCore(patient) {
    const validations = [];
    
    // Identifiants avec type obligatoire
    if (patient.identifier) {
        let hasTypedIdentifier = false;
        patient.identifier.forEach(id => {
            if (id.type?.coding?.[0]?.code) {
                hasTypedIdentifier = true;
                validations.push({ type: 'success', message: `Identifiant typé: ${id.type.coding[0].code}` });
            }
        });
        if (!hasTypedIdentifier) {
            validations.push({ type: 'error', message: 'Identifiants sans type (required)' });
        }
    }
    
    // Nom structuré avec use
    if (patient.name?.[0]?.use) {
        validations.push({ type: 'success', message: `Nom avec use: ${patient.name[0].use}` });
    } else {
        validations.push({ type: 'warning', message: 'Nom sans attribut use' });
    }
    
    return validations;
}

function validateAppointmentFRCore(appointment) {
    const validations = [];
    
    // Identifiant avec use et type obligatoires
    if (appointment.identifier?.[0]?.use && appointment.identifier?.[0]?.type) {
        validations.push({ type: 'success', message: 'Identifiant Appointment conforme' });
    } else {
        validations.push({ type: 'error', message: 'Identifiant Appointment sans use/type' });
    }
    
    // Status obligatoire
    if (appointment.status) {
        validations.push({ type: 'success', message: `Status: ${appointment.status}` });
    } else {
        validations.push({ type: 'error', message: 'Status obligatoire manquant' });
    }
    
    // Dates cohérentes
    if (appointment.start && appointment.end) {
        const start = new Date(appointment.start);
        const end = new Date(appointment.end);
        if (end > start) {
            validations.push({ type: 'success', message: 'Dates start/end cohérentes' });
        } else {
            validations.push({ type: 'error', message: 'Dates start/end incohérentes' });
        }
    }
    
    return validations;
}

function validateServiceRequestFRCore(serviceRequest) {
    const validations = [];
    
    // Status et intent obligatoires
    if (serviceRequest.status && serviceRequest.intent) {
        validations.push({ type: 'success', message: `ServiceRequest: ${serviceRequest.status}/${serviceRequest.intent}` });
    } else {
        validations.push({ type: 'error', message: 'Status ou intent manquant' });
    }
    
    // Code obligatoire avec system
    if (serviceRequest.code?.coding?.[0]?.system) {
        validations.push({ type: 'success', message: 'Code avec system présent' });
    } else {
        validations.push({ type: 'error', message: 'Code sans system (required)' });
    }
    
    return validations;
}

function validateMessageHeaderFRCore(messageHeader) {
    const validations = [];
    
    // EventCoding obligatoire
    if (messageHeader.eventCoding?.code) {
        validations.push({ type: 'success', message: `Event: ${messageHeader.eventCoding.code}` });
    } else {
        validations.push({ type: 'error', message: 'eventCoding manquant' });
    }
    
    // Source et destination
    if (messageHeader.source?.endpoint && messageHeader.destination?.[0]?.endpoint) {
        validations.push({ type: 'success', message: 'Source/destination présentes' });
    } else {
        validations.push({ type: 'error', message: 'Source ou destination manquante' });
    }
    
    // Focus pour Bundle message
    if (messageHeader.focus && messageHeader.focus.length > 0) {
        validations.push({ type: 'success', message: `Focus: ${messageHeader.focus.length} ressource(s)` });
    } else {
        validations.push({ type: 'warning', message: 'Aucun focus défini' });
    }
    
    return validations;
}

function validateLocationFRCore(location) {
    const validations = [];
    
    // Identifiant obligatoire avec type
    if (location.identifier?.[0]?.type?.coding?.[0]?.code) {
        validations.push({ type: 'success', message: 'Location identifier conforme' });
    } else {
        validations.push({ type: 'error', message: 'Location identifier sans type' });
    }
    
    // Type obligatoire
    if (location.type?.[0]?.coding?.[0]?.system) {
        validations.push({ type: 'success', message: 'Location type avec system' });
    } else {
        validations.push({ type: 'error', message: 'Location type sans system' });
    }
    
    return validations;
}

/**
 * Valide un Bundle complet
 */
function validateBundle(bundle) {
    log(`\\n🔍 VALIDATION BUNDLE: ${bundle.type}`, 'bold');
    log('='.repeat(50), 'cyan');
    
    const bundleValidations = [];
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalSuccess = 0;
    
    // Validation du Bundle lui-même
    if (bundle.type === 'message') {
        const hasMessageHeader = bundle.entry?.some(e => e.resource.resourceType === 'MessageHeader');
        if (hasMessageHeader) {
            bundleValidations.push({ type: 'success', message: 'MessageHeader présent pour Bundle message' });
        } else {
            bundleValidations.push({ type: 'error', message: 'MessageHeader manquant pour Bundle message' });
        }
    }
    
    if (bundle.timestamp) {
        bundleValidations.push({ type: 'success', message: 'Timestamp Bundle présent' });
    } else {
        bundleValidations.push({ type: 'warning', message: 'Timestamp Bundle manquant' });
    }
    
    // Validation de chaque ressource
    bundle.entry?.forEach((entry, index) => {
        const resource = entry.resource;
        log(`\\n📋 Ressource ${index + 1}: ${resource.resourceType} (${resource.id})`, 'cyan');
        
        const validations = validateFRCoreResource(resource);
        validations.forEach(validation => {
            const icon = validation.type === 'error' ? '❌' : validation.type === 'warning' ? '⚠️' : '✅';
            const color = validation.type === 'error' ? 'red' : validation.type === 'warning' ? 'yellow' : 'green';
            log(`  ${icon} ${validation.message}`, color);
            
            if (validation.type === 'error') totalErrors++;
            else if (validation.type === 'warning') totalWarnings++;
            else totalSuccess++;
        });
    });
    
    // Résumé
    log(`\\n📊 RÉSUMÉ VALIDATION`, 'bold');
    log(`✅ Succès: ${totalSuccess}`, 'green');
    log(`⚠️ Avertissements: ${totalWarnings}`, 'yellow');
    log(`❌ Erreurs: ${totalErrors}`, 'red');
    
    const score = totalSuccess / (totalSuccess + totalWarnings + totalErrors) * 100;
    log(`🎯 Score conformité FRCore: ${score.toFixed(1)}%`, score > 80 ? 'green' : score > 60 ? 'yellow' : 'red');
    
    return { totalSuccess, totalWarnings, totalErrors, score };
}

async function main() {
    log('🇫🇷 VALIDATION CONFORMITÉ FRCORE', 'bold');
    log('='.repeat(60), 'cyan');
    
    // Tester les fichiers générés
    const testFiles = [
        'test_output_siu_fixed.json',
        'test_output_siu.json',
        'test_output_orm.json'
    ];
    
    let globalScore = 0;
    let validatedFiles = 0;
    
    for (const file of testFiles) {
        if (fs.existsSync(file)) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                const bundle = JSON.parse(content);
                
                log(`\\n📄 Validation de ${file}`, 'bold');
                const result = validateBundle(bundle);
                globalScore += result.score;
                validatedFiles++;
                
            } catch (error) {
                log(`❌ Erreur lecture ${file}: ${error.message}`, 'red');
            }
        } else {
            log(`⚠️ Fichier non trouvé: ${file}`, 'yellow');
        }
    }
    
    if (validatedFiles > 0) {
        const avgScore = globalScore / validatedFiles;
        log(`\\n🏆 SCORE GLOBAL CONFORMITÉ FRCORE: ${avgScore.toFixed(1)}%`, avgScore > 80 ? 'green' : 'yellow');
        
        if (avgScore > 90) {
            log('🎉 Excellente conformité aux profils FR Core !', 'green');
        } else if (avgScore > 70) {
            log('👍 Bonne conformité, quelques améliorations possibles', 'yellow');
        } else {
            log('🔧 Conformité à améliorer, voir erreurs ci-dessus', 'red');
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { validateBundle, validateFRCoreResource };