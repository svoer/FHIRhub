# Messages ORU (Observation Results Unsolicited)

## Description

Les messages ORU contiennent des résultats d'observations non sollicités, comme des résultats de laboratoire, des mesures physiologiques, ou d'autres types d'observations cliniques. Ces messages sont utilisés pour transmettre des résultats d'examens d'un système à un autre.

## Structure de base

Un message ORU se compose généralement des segments suivants :

```
MSH - Message Header (obligatoire)
PID - Patient Identification (obligatoire)
[PV1] - Patient Visit (facultatif)
[ORC] - Common Order (facultatif)
OBR - Observation Request (obligatoire, peut être multiple)
[NTE] - Notes and Comments (facultatif, peut être multiple)
OBX - Observation Result (obligatoire, peut être multiple)
[NTE] - Notes and Comments (facultatif, peut être multiple)
```

## Segments clés

### OBR (Observation Request)
Contient des informations sur la demande d'observation, comme :
- Identifiants de la demande
- Date/heure de la demande
- Type d'observation
- Informations sur le prescripteur
- Informations sur le réalisateur

### OBX (Observation Result)
Contient les résultats d'observation, comme :
- Type de valeur (numérique, texte, etc.)
- Identifiant de l'observation
- Valeur de l'observation
- Unités
- Plages de référence
- Statut du résultat

## Événements courants

- **ORU^R01** : Unsolicited Observation Message (le plus courant)
- **ORU^R30** : Unsolicited Point-Of-Care Observation Message

## Ressources FHIR correspondantes

Les messages ORU se traduisent principalement en ces ressources FHIR :

1. **Observation** : Pour les résultats individuels (OBX)
2. **DiagnosticReport** : Pour le rapport complet (OBR + OBX regroupés)
3. **Patient** : Pour les informations patient (PID)
4. **Encounter** : Pour les informations de visite (PV1)
5. **ServiceRequest** : Pour la demande d'observation (ORC/OBR)
6. **Specimen** : Pour les informations sur les échantillons

## Exemples

Consultez le dossier `/examples` pour des exemples de messages ORU.