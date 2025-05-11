# Messages MDM (Medical Document Management)

## Description

Les messages MDM sont utilisés pour transmettre des informations sur les documents médicaux. Ils permettent de notifier la création, l'archivage, l'édition ou l'annulation de documents médicaux tels que des comptes rendus d'hospitalisation, des lettres de sortie, des résultats d'analyses, etc.

## Structure de base

Un message MDM se compose généralement des segments suivants :

```
MSH - Message Header (obligatoire)
PID - Patient Identification (obligatoire)
[PV1] - Patient Visit Information (facultatif)
TXA - Transcription Document Header (obligatoire)
[OBX] - Observation/Result (peut être multiple pour contenir le document)
```

## Segments clés

### TXA (Transcription Document Header)
Contient les métadonnées du document médical :
- Identifiant du document
- Type de document
- Date/heure de création
- Date/heure d'édition
- Statut du document
- Auteur
- Authentification et signature électronique
- Contenu du document ou référence

### OBX (Observation/Result)
Utilisé pour transporter le contenu du document ou des références vers le document, qui peut être :
- Texte brut
- Texte formaté (RTF)
- Format binaire (PDF, JPEG, etc.)
- Référence à un document stocké ailleurs

## Événements courants

- **MDM^T01** : Document originaire d'un traitement de texte
- **MDM^T02** : Document originaire d'un traitement de texte avec contenu
- **MDM^T03** : Document envoyé par un système externe
- **MDM^T04** : Document envoyé par un système externe avec contenu
- **MDM^T05** : Document originaire d'un traitement de texte, remplacement
- **MDM^T06** : Document originaire d'un traitement de texte avec contenu, remplacement
- **MDM^T07** : Document envoyé par un système externe, remplacement
- **MDM^T08** : Document envoyé par un système externe avec contenu, remplacement
- **MDM^T09** : Document originaire d'un traitement de texte, annulation
- **MDM^T10** : Document originaire d'un traitement de texte avec contenu, annulation
- **MDM^T11** : Document envoyé par un système externe, annulation

## Ressources FHIR correspondantes

Les messages MDM se traduisent principalement en ces ressources FHIR :

1. **DocumentReference** : Pour les métadonnées du document (TXA)
2. **Binary** : Pour le contenu binaire du document
3. **Patient** : Pour les informations patient (PID)
4. **Encounter** : Pour les informations de visite (PV1)
5. **Practitioner** : Pour les auteurs et les responsables

En fonction du type de document, d'autres ressources peuvent être générées :
- **DiagnosticReport** : Pour les rapports diagnostiques
- **Composition** : Pour les documents structurés
- **Media** : Pour les images ou autres médias

## Exemples

Consultez le dossier `/examples` pour des exemples de messages MDM.