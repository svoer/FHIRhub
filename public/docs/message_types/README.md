# Prise en charge des types de messages HL7

Ce répertoire contient la documentation et les procédures pour étendre le convertisseur FHIRHub afin de prendre en charge différents types de messages HL7.

## Types de messages pris en charge

Voici les types de messages actuellement documentés :

| Code | Description | Statut |
|------|-------------|--------|
| ADT | Admission, Discharge, Transfer | Implémenté |
| ORU | Observation Results | Documentation uniquement |
| ORM | Order Message | Documentation uniquement |
| SIU | Scheduling Information Unsolicited | Documentation uniquement |
| MDM | Medical Document Management | Documentation uniquement |
| BAR | Billing Account Record | Documentation uniquement |
| DFT | Detailed Financial Transaction | Documentation uniquement |
| MFN | Master Files Notification | Documentation uniquement |
| PPR | Patient Problem Records | Documentation uniquement |
| RDE | Pharmacy/Treatment Encoded Order | Documentation uniquement |
| REF | Patient Referral | Documentation uniquement |
| VXU | Vaccination Record Update | Documentation uniquement |

## Comment utiliser cette documentation

Chaque dossier contient :

1. Un fichier README.md expliquant le type de message et sa structure
2. Un fichier MAPPING.md décrivant les mappings entre les segments HL7 et les ressources FHIR
3. Un fichier REQUIREMENTS.md listant les informations nécessaires pour implémenter ce type de message
4. Des exemples de messages HL7 dans un sous-dossier `/examples`
5. Des exemples de résultats FHIR attendus dans un sous-dossier `/fhir_examples`

## Comment contribuer à l'extension du convertisseur

Pour ajouter la prise en charge d'un nouveau type de message :

1. Consultez la documentation dans le dossier correspondant
2. Fournissez des exemples réels de messages pour ce type
3. Implémentez les mappings selon les instructions du fichier MAPPING.md
4. Testez votre implémentation avec les exemples
5. Mettez à jour la documentation en conséquence

## Priorisation des types de messages

Il est recommandé d'implémenter les types de messages dans cet ordre de priorité, selon leur fréquence d'utilisation dans les systèmes de santé français :

1. ADT - Admission, Discharge, Transfer (déjà implémenté)
2. ORU - Observation Results
3. ORM - Order Message
4. SIU - Scheduling Information Unsolicited
5. MDM - Medical Document Management

Les autres types peuvent être implémentés selon les besoins spécifiques de votre établissement.