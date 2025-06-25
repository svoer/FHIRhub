#!/usr/bin/env node

/**
 * Script CI pour validation FHIR FR-Core
 * Usage: npm run validate-fhir <bundle.json>
 */

const fs = require('fs');
const path = require('path');
const { validateFRCoreBundle } = require('../validation/frcore-validator');

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npm run validate-fhir <bundle.json>');
    process.exit(1);
  }
  
  const bundlePath = args[0];
  
  if (!fs.existsSync(bundlePath)) {
    console.error(`Erreur: Fichier ${bundlePath} introuvable`);
    process.exit(1);
  }
  
  try {
    console.log(`[FHIR-VALIDATOR] Chargement Bundle: ${bundlePath}`);
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    const bundle = JSON.parse(bundleContent);
    
    console.log(`[FHIR-VALIDATOR] Validation contre profils FR-Core...`);
    const validationResult = validateFRCoreBundle(bundle);
    
    // Affichage résultat
    console.log('\n' + '='.repeat(60));
    console.log('RÉSULTAT VALIDATION FR-CORE');
    console.log('='.repeat(60));
    
    console.log(`Bundle: ${bundle.resourceType || 'Inconnu'}`);
    console.log(`Ressources totales: ${validationResult.summary.totalResources}`);
    console.log(`Ressources validées: ${validationResult.summary.validatedResources}`);
    console.log(`Statut: ${validationResult.valid ? '✅ CONFORME' : '❌ NON CONFORME'}`);
    
    if (validationResult.errors.length > 0) {
      console.log('\n❌ ERREURS:');
      validationResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    if (validationResult.warnings.length > 0) {
      console.log('\n⚠️  AVERTISSEMENTS:');
      validationResult.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Code de sortie
    if (validationResult.valid) {
      console.log('✅ Validation réussie - Bundle conforme FR-Core');
      process.exit(0);
    } else {
      console.log('❌ Validation échouée - Bundle non conforme FR-Core');
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`[FHIR-VALIDATOR] Erreur: ${error.message}`);
    process.exit(1);
  }
}

// Validation en mode batch
function validateBatch(directory) {
  const files = fs.readdirSync(directory)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(directory, file));
  
  let totalFiles = 0;
  let validFiles = 0;
  
  console.log(`[BATCH-VALIDATOR] Validation de ${files.length} fichiers...`);
  
  files.forEach(file => {
    try {
      const bundleContent = fs.readFileSync(file, 'utf8');
      const bundle = JSON.parse(bundleContent);
      
      if (bundle.resourceType === 'Bundle') {
        totalFiles++;
        const result = validateFRCoreBundle(bundle);
        
        if (result.valid) {
          validFiles++;
          console.log(`✅ ${path.basename(file)} - CONFORME`);
        } else {
          console.log(`❌ ${path.basename(file)} - NON CONFORME (${result.errors.length} erreurs)`);
        }
      }
    } catch (error) {
      console.log(`⚠️  ${path.basename(file)} - ERREUR: ${error.message}`);
    }
  });
  
  console.log(`\nRésultat batch: ${validFiles}/${totalFiles} fichiers conformes`);
  return validFiles === totalFiles;
}

// Ajout support batch si argument --batch
if (process.argv.includes('--batch')) {
  const directory = process.argv[process.argv.indexOf('--batch') + 1] || './test/fixtures';
  const allValid = validateBatch(directory);
  process.exit(allValid ? 0 : 1);
} else {
  main();
}