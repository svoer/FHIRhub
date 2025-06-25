# FHIRHub 3.0 - Architecture Modulaire Industrielle

## Vue d'ensemble

FHIRHub 3.0 implémente une architecture modulaire complète pour la conversion HL7 v2 → FHIR R4 avec conformité stricte aux profils FR-Core. Le système supporte tous les types de flux critiques des systèmes de santé français.

## Architecture Pipeline

```
HL7 Message Input
      ↓
  Parse Segments
      ↓
  Detect MSH-9 Type
      ↓
┌─────────────────────┐
│   Message Router    │
├─────────────────────┤
│ ADT^Axx → handleADT │
│ SIU^Sxx → handleSIU │
│ ORM^O01 → handleORM │
│ ORU^R01 → handleORU │
└─────────────────────┘
      ↓
  Segment Handlers
      ↓
  FHIR Bundle + Validation
      ↓
  FR-Core Conformance
```

## Handlers Modulaires

### 1. Message Handlers (`handlers/messageHandlers.js`)
- **Dispatch principal** par type MSH-9
- **Construction Bundle** incrémentale
- **MessageHeader** obligatoire en première position
- **Gestion erreurs** avec OperationOutcome

#### Types supportés:
- `ADT^A01-A08`: Admission/Discharge/Transfer
- `SIU^S12-S15`: Scheduling Information
- `ORM^O01`: Order Message
- `ORU^R01`: Observation Result

### 2. Segment Handlers (`handlers/segmentHandlers.js`)
Handlers dédiés par segment HL7:

- **MSH**: MessageHeader avec profil FR-Core
- **PID**: Patient avec slices PI/INS-NIR/INS-NIA
- **PV1**: Encounter avec extensions mode-prise-en-charge
- **NK1**: RelatedPerson avec relationship ValueSet
- **IN1/IN2**: Coverage avec payor Organization
- **ROL**: PractitionerRole avec profession
- **SCH**: Appointment (SIU)
- **ORC/OBR**: ServiceRequest/DiagnosticReport (ORM/ORU)
- **OBX**: Observation (ORU)

## Conformité FR-Core

### Profils Obligatoires
```json
{
  "Patient": "fr-core-patient + fr-core-patient-ins",
  "Encounter": "fr-core-encounter",
  "Practitioner": "fr-core-practitioner",
  "RelatedPerson": "fr-core-related-person",
  "Coverage": "fr-core-coverage",
  "Location": "fr-core-location",
  "Organization": "fr-core-organization"
}
```

### Slicing Automatique
- **PID-3** → `identifier:PI` (system: 1.2.250.1.71.4.2.7)
- **PID-3** → `identifier:INS-NIR` (system: 1.2.250.1.213.1.4.8)
- **PV1-19** → `identifier:VN` (system: 1.2.250.1.71.4.2.7)
- **ROL** → `identifier:RPPS/ADELI` (system: 1.2.250.1.71.4.2.1)

### Extensions Canoniques
- `fr-core-identity-reliability` (VALI/UNDI)
- `fr-core-mode-prise-en-charge`
- `fr-core-encounter-healthevent-type`
- `fr-core-coverage-insured-id`
- `fr-core-patient-ins-status`

## Validation & Qualité

### Validation Automatique (`validation/frcore-validator.js`)
- Vérification **profils FR-Core**
- Validation **slices obligatoires**
- Contrôle **extensions canoniques**
- Vérification **ValueSets bindés**

### Script CI (`scripts/validate-fhir.js`)
```bash
npm run validate-fhir bundle.json    # Validation simple
npm run validate-batch directory/    # Validation batch
npm run ci                           # Pipeline complet
```

### Type Safety
- Validation `typeof` avant `.toLowerCase()`
- Gestion **arrays vs strings**
- Try/catch avec **OperationOutcome**
- Logs détaillés de traçabilité

## Définitions Centralisées

### FR-Core Definitions (`handlers/frcore-definitions.json`)
```json
{
  "profiles": { "canonical URLs par resourceType" },
  "extensions": { "URLs + ValueSets" },
  "valueSets": { "codes autorisés" },
  "codeSystems": { "systèmes français" },
  "oids": { "identifiants nationaux" }
}
```

### Résolution URLs
```javascript
resolveFRCoreUrl('Patient', 'profile')          // → canonical URL
resolveFRCoreUrl('Patient', 'identifier:PI')    // → slice definition
```

## Pipeline CI/CD

### GitHub Actions (`.github/workflows/fhir-validation.yml`)
1. **Build** application
2. **Generate** test bundles tous flux
3. **Validate** conformité FR-Core
4. **Exit code** ≠ 0 si non conforme
5. **Artifacts** upload résultats

### Scripts NPM
```json
{
  "validate-fhir": "Validation bundle unique",
  "validate-batch": "Validation répertoire complet",
  "build": "Build application",
  "ci": "Pipeline complet avec validation"
}
```

## Tests Automatisés

### Test All Flows (`test/test-all-flows.js`)
- Messages **ADT, SIU, ORM, ORU**
- Conversion + **Validation FR-Core**
- Génération **fixtures** automatique
- Rapport **conformité détaillé**

## Architecture Fichiers

```
handlers/
├── messageHandlers.js      # Dispatch principal
├── segmentHandlers.js      # Handlers par segment
└── frcore-definitions.json # Définitions centralisées

validation/
└── frcore-validator.js     # Validateur FR-Core

scripts/
└── validate-fhir.js        # Script CI validation

test/
├── test-all-flows.js       # Tests automatisés
└── fixtures/               # Bundles générés

.github/workflows/
└── fhir-validation.yml     # Pipeline CI/CD
```

## Migration Legacy

Le système maintient la **compatibilité** avec l'ancien convertisseur via fallback automatique si échec du système modulaire.

```javascript
function convertHL7ToFHIR(hl7Message) {
  try {
    return moduleHandlers.convertHL7ToFHIR(segments);  // Nouveau
  } catch (error) {
    return convertHL7ToFHIRLegacy(hl7Message);         // Fallback
  }
}
```

## Industrialisation

### Qualité Production
- **Exit codes** appropriés pour CI
- **Logs structurés** avec timestamps
- **Gestion erreurs** sans interruption
- **Validation automatique** contre IG officiel

### Scalabilité
- **Handlers modulaires** extensibles
- **Définitions centralisées** maintenables
- **Type safety** robuste
- **Pipeline automatisé** reproductible

---

**FHIRHub 3.0** - Moteur de conversion HL7→FHIR industriel conforme FR-Core pour systèmes de santé critiques français.