# Messages ADT (Admission, Discharge, Transfer)

## Description

Les messages ADT sont utilisés pour communiquer les événements liés aux mouvements des patients dans un établissement de santé. Ils couvrent les admissions, les sorties, les transferts, les pré-admissions, les fusionnements d'identités, et d'autres événements liés au séjour et à l'identité des patients.

## Structure de base

Un message ADT se compose généralement des segments suivants :

```
MSH - Message Header (obligatoire)
EVN - Event Type (obligatoire)
PID - Patient Identification (obligatoire)
[PD1] - Patient Additional Demographic (facultatif)
[PV1] - Patient Visit (obligatoire pour la plupart des événements)
[PV2] - Patient Visit - Additional Info (facultatif)
[ZFD] - Segments personnalisés (spécifiques à chaque implémentation)
```

## Segments clés

### EVN (Event Type)
Contient des informations sur l'événement qui a déclenché le message, comme :
- Code de l'événement
- Date/heure de l'événement
- Raison de l'événement

### PID (Patient Identification)
Contient les informations d'identification du patient, comme :
- Identifiants du patient (IPP, INS, etc.)
- Nom, prénom
- Date de naissance
- Sexe
- Adresse
- Contacts

### PV1 (Patient Visit)
Contient les informations sur le séjour du patient, comme :
- Identifiant du séjour
- Type d'hospitalisation (hospitalisé, externe, urgence, etc.)
- Lit, chambre, unité fonctionnelle, service, pôle
- Médecin responsable, médecin traitant
- Dates d'admission, de sortie

## Événements courants

- **ADT^A01** : Admission d'un patient
- **ADT^A02** : Transfert d'un patient
- **ADT^A03** : Sortie d'un patient
- **ADT^A04** : Inscription d'un patient en consultation externe
- **ADT^A05** : Pré-admission d'un patient
- **ADT^A06** : Changement de type d'hospitalisation
- **ADT^A08** : Mise à jour des informations patient
- **ADT^A11** : Annulation d'admission
- **ADT^A13** : Annulation de sortie
- **ADT^A28** : Création d'un nouveau patient
- **ADT^A31** : Mise à jour des informations patient
- **ADT^A40** : Fusion d'identités patient

## Ressources FHIR correspondantes

Les messages ADT se traduisent principalement en ces ressources FHIR :

1. **Patient** : Pour les informations d'identité du patient (PID)
2. **Encounter** : Pour les informations de séjour (PV1)
3. **Location** : Pour les informations de lieu (lit, chambre, service)
4. **Practitioner** : Pour les médecins et soignants
5. **RelatedPerson** : Pour les contacts et personnes de confiance
6. **EpisodeOfCare** : Pour les épisodes de soins globaux

## Statut d'implémentation

Les messages ADT sont actuellement **complètement implémentés** dans FHIRHub avec :

- Prise en charge de tous les événements courants
- Gestion des spécificités françaises (INS, FINESS, etc.)
- Mappings optimisés vers les ressources FHIR R4
- Conformité avec les spécifications de l'ANS

## Exemples

Consultez le dossier `/examples` pour des exemples de messages ADT.