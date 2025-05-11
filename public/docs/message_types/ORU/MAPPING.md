# Mappings HL7 ORU vers FHIR

Ce document détaille les mappings entre les segments/champs HL7 ORU et les ressources/éléments FHIR.

## Bundle FHIR

Tout message ORU sera converti en Bundle FHIR de type `transaction`.

```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    // Ressources générées à partir du message ORU
  ]
}
```

## Mappings principaux

### 1. Segment MSH vers MessageHeader

| HL7 Champ | FHIR Élément | Notes |
|-----------|--------------|-------|
| MSH-3 | MessageHeader.source.name | Application émettrice |
| MSH-4 | MessageHeader.source.endpoint | Établissement émetteur |
| MSH-5 | MessageHeader.destination.name | Application destinataire |
| MSH-6 | MessageHeader.destination.endpoint | Établissement destinataire |
| MSH-7 | MessageHeader.timestamp | Horodatage du message |
| MSH-9 | MessageHeader.eventCoding | Type d'événement |
| MSH-10 | MessageHeader.id | Identifiant du message |

### 2. Segment PID vers Patient

Voir le mapping standard dans le dossier ADT.

### 3. Segment OBR vers ServiceRequest

| HL7 Champ | FHIR Élément | Notes |
|-----------|--------------|-------|
| OBR-1 | ServiceRequest.identifier | Identifiant de groupe |
| OBR-2 | ServiceRequest.identifier | Identifiant de la demande |
| OBR-3 | ServiceRequest.identifier | Identifiant du système demandeur |
| OBR-4 | ServiceRequest.code | Code de l'examen demandé |
| OBR-7 | ServiceRequest.occurrenceDateTime | Date/heure de l'observation |
| OBR-13 | ServiceRequest.reasonCode | Motif clinique |
| OBR-16 | ServiceRequest.requester | Prescripteur |
| OBR-24 | ServiceRequest.status | Statut |
| OBR-25 | ServiceRequest.priority | Priorité |

### 4. Segment OBR vers DiagnosticReport

| HL7 Champ | FHIR Élément | Notes |
|-----------|--------------|-------|
| OBR-2 | DiagnosticReport.identifier | Identifiant du rapport |
| OBR-3 | DiagnosticReport.identifier | Identifiant du système |
| OBR-4 | DiagnosticReport.code | Type de rapport |
| OBR-7 | DiagnosticReport.effectiveDateTime | Date/heure du rapport |
| OBR-14 | DiagnosticReport.specimen | Référence aux spécimens |
| OBR-16 | DiagnosticReport.performer | Réalisateur |
| OBR-22 | DiagnosticReport.resultsInterpreter | Interprétant |
| OBR-25 | DiagnosticReport.status | Statut |
| OBR-27 | DiagnosticReport.category | Catégorie |

### 5. Segment OBX vers Observation

| HL7 Champ | FHIR Élément | Notes |
|-----------|--------------|-------|
| OBX-1 | Observation.identifier | ID de séquence |
| OBX-2 | Observation.valueQuantity, valueString, etc. | Type de valeur |
| OBX-3 | Observation.code | Code de l'observation |
| OBX-4 | Observation.identifier | Sous-ID |
| OBX-5 | Observation.value[x] | Valeur de l'observation |
| OBX-6 | Observation.valueQuantity.unit | Unité |
| OBX-7 | Observation.referenceRange | Plage de référence |
| OBX-8 | Observation.interpretation | Interprétation anormale |
| OBX-11 | Observation.status | Statut |
| OBX-13 | Observation.method | Méthode utilisée |
| OBX-14 | Observation.effectiveDateTime | Date/heure |
| OBX-16 | Observation.performer | Réalisateur |

### 6. Segment NTE vers Annotation

| HL7 Champ | FHIR Élément | Notes |
|-----------|--------------|-------|
| NTE-3 | Observation.note.text ou DiagnosticReport.note.text | Texte du commentaire |
| NTE-4 | Observation.note.author ou DiagnosticReport.note.author | Auteur du commentaire |

## Relations entre ressources

Les ressources FHIR générées doivent être liées entre elles par des références :

1. DiagnosticReport.subject → Patient
2. DiagnosticReport.encounter → Encounter (si PV1 présent)
3. DiagnosticReport.result → tableau d'Observations
4. DiagnosticReport.basedOn → ServiceRequest
5. Observation.subject → Patient
6. Observation.encounter → Encounter (si PV1 présent)
7. Observation.partOf → DiagnosticReport
8. ServiceRequest.subject → Patient
9. ServiceRequest.encounter → Encounter (si PV1 présent)

## Spécificités françaises

Pour les messages ORU français, il faut tenir compte des spécificités suivantes :

1. Utiliser les terminologies françaises pour les codes (LOINC-FR, NABM, etc.)
2. Gérer les identifiants patients selon les normes françaises (INS, IPP, etc.)
3. Gérer les identifiants des professionnels selon les normes françaises (RPPS, ADELI, etc.)
4. Générer les ressources conformes aux spécifications françaises de l'ANS

## Extensions FHIR spécifiques

Il peut être nécessaire d'ajouter des extensions FHIR pour gérer certaines informations spécifiques :

1. Extension pour les secteurs hospitaliers français
2. Extension pour les identifiants du Répertoire Partagé des Professionnels de Santé (RPPS)