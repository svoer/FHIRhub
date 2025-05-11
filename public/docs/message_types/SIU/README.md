# Messages SIU (Scheduling Information Unsolicited)

## Description

Les messages SIU contiennent des informations sur les rendez-vous et la planification. Ils sont utilisés pour communiquer des créations, modifications, annulations de rendez-vous entre systèmes.

## Structure de base

Un message SIU se compose généralement des segments suivants :

```
MSH - Message Header (obligatoire)
SCH - Scheduling Activity Information (obligatoire)
PID - Patient Identification (obligatoire pour les rendez-vous patients)
[PV1] - Patient Visit Information (facultatif)
[RGS] - Resource Group (peut être multiple)
[AIS] - Appointment Information (peut être multiple)
[AIG] - Appointment Information - General Resource (peut être multiple)
[AIL] - Appointment Information - Location Resource (peut être multiple)
[AIP] - Appointment Information - Personnel Resource (peut être multiple)
[NTE] - Notes and Comments (facultatif)
```

## Segments clés

### SCH (Scheduling Activity Information)
Contient les informations principales sur le rendez-vous :
- Identifiant du rendez-vous
- Type d'événement (création, modification, annulation)
- Raison du rendez-vous
- Type de rendez-vous
- Durée
- Priorité
- Statut

### RGS (Resource Group)
Groupe les ressources associées au rendez-vous.

### AIS (Appointment Information - Service)
Détaille les services planifiés.

### AIL (Appointment Information - Location)
Détaille les lieux du rendez-vous.

### AIP (Appointment Information - Personnel)
Détaille le personnel associé au rendez-vous.

## Événements courants

- **SIU^S12** : Notification of new appointment booking
- **SIU^S13** : Notification of appointment rescheduling
- **SIU^S14** : Notification of appointment modification
- **SIU^S15** : Notification of appointment cancellation
- **SIU^S16** : Notification of appointment discontinuation
- **SIU^S17** : Notification of appointment deletion
- **SIU^S26** : Notification that patient did not show up for scheduled appointment

## Ressources FHIR correspondantes

Les messages SIU se traduisent principalement en ces ressources FHIR :

1. **Appointment** : Pour l'information principale du rendez-vous (SCH)
2. **AppointmentResponse** : Pour les réponses aux rendez-vous
3. **Schedule** : Pour les plannings des ressources
4. **Slot** : Pour les créneaux disponibles
5. **Patient** : Pour les informations patient (PID)
6. **Practitioner** : Pour les informations sur les professionnels (AIP)
7. **Location** : Pour les informations sur les lieux (AIL)
8. **HealthcareService** : Pour les services associés (AIS)

## Exemples

Consultez le dossier `/examples` pour des exemples de messages SIU.