# Messages ORM (Order Message)

## Description

Les messages ORM sont utilisés pour transmettre des informations sur les demandes d'actes, les prescriptions, ou toute autre forme de commande dans un contexte médical. Ils servent à créer, modifier ou annuler des demandes d'examens, de médicaments, ou d'autres services.

## Structure de base

Un message ORM se compose généralement des segments suivants :

```
MSH - Message Header (obligatoire)
PID - Patient Identification (obligatoire)
[PV1] - Patient Visit (facultatif)
ORC - Common Order (obligatoire, peut être multiple)
[RXO/RXE] - Pharmacy Order / Pharmacy Encoded Order (pour médicaments)
[OM1/OM2/OM3/OM4] - General Observation / Numeric Observation / Categorical Observation / Observation that Requires Specimens (pour examens)
[OBR] - Observation Request (pour examens)
[RQD] - Requisition Detail (pour produits)
[BLG] - Billing (facultatif)
[DG1] - Diagnosis (facultatif)
[NTE] - Notes and Comments (facultatif)
```

## Segments clés

### ORC (Common Order)
Contient les informations communes à toutes les commandes :
- Identifiant de la commande
- Identifiant du prescripteur
- Date/heure de la commande
- Statut de la commande
- Date/heure d'exécution prévue
- Commentaires

### RXO/RXE (Pharmacy Order/Pharmacy Encoded Order)
Pour les prescriptions de médicaments :
- Médicament prescrit (code, nom)
- Posologie, voie d'administration
- Durée du traitement
- Instructions pour le patient

### OBR (Observation Request)
Pour les demandes d'examens :
- Identifiant de la demande
- Type d'examen demandé
- Priorité de la demande
- Motif clinique
- Instructions spéciales

## Événements courants

- **ORM^O01** : Order Message (le plus courant)
- **ORM^O02** : Order Response Message

## Ressources FHIR correspondantes

Les messages ORM se traduisent principalement en ces ressources FHIR :

1. **ServiceRequest** : Pour les demandes d'examens ou de procédures (OBR)
2. **MedicationRequest** : Pour les prescriptions médicamenteuses (RXO/RXE)
3. **Task** : Pour le suivi de l'état des demandes
4. **Patient** : Pour les informations patient (PID)
5. **Encounter** : Pour les informations de visite (PV1)
6. **Practitioner** : Pour le prescripteur
7. **Organization** : Pour l'établissement
8. **Coverage** : Pour les informations de facturation (BLG)

En fonction du type de commande, d'autres ressources peuvent être générées :
- **NutritionOrder** : Pour les commandes diététiques
- **DeviceRequest** : Pour les demandes de dispositifs médicaux
- **SupplyRequest** : Pour les demandes de fournitures

## Exemples

Consultez le dossier `/examples` pour des exemples de messages ORM.