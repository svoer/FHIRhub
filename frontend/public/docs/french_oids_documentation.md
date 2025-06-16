# Documentation des OIDs français pour l'interopérabilité FHIR

Ce document référence les Object Identifiers (OIDs) standards français utilisés dans le cadre de l'interopérabilité FHIR, conformément aux spécifications de l'Agence du Numérique en Santé (ANS).

## Identifiants patients et professionnels

| Type d'identifiant | OID                      | Description                                      | Exemple d'utilisation                           |
|--------------------|--------------------------|--------------------------------------------------|------------------------------------------------|
| INS-NIR            | 1.2.250.1.213.1.4.8      | Identifiant National de Santé basé sur le NIR    | Identifiant unique du patient dans le DMP       |
| INS-C              | 1.2.250.1.213.1.4.2      | Identifiant National de Santé Calculé            | Version calculée de l'INS pour certains usages  |
| RPPS               | 1.2.250.1.71.4.2.1       | Répertoire Partagé des Professionnels de Santé   | Identifiant national des médecins et pharmaciens|
| ADELI              | 1.2.250.1.71.4.2.2       | Automatisation DEs LIstes                        | Identifiant pour certains professionnels de santé|
| FINESS             | 1.2.250.1.71.4.2.3       | Fichier National des Établissements Sanitaires et Sociaux | Identifiant des établissements de santé |
| SIRET              | 1.2.250.1.71.4.2.4       | Système d'Identification du Répertoire des ÉTablissements | Identifiant des structures privées      |

## Systèmes de terminologie (CodeSystems)

| Terminologie                         | OID                      | Description                                      | URL FHIR                                       |
|--------------------------------------|--------------------------|--------------------------------------------------|------------------------------------------------|
| CCAM                                 | 1.2.250.1.213.2.5        | Classification Commune des Actes Médicaux        | https://mos.esante.gouv.fr/NOS/CCAM_2/FHIR/CCAM |
| CIM-10                               | 1.2.250.1.213.2.12       | Classification Internationale des Maladies       | https://mos.esante.gouv.fr/NOS/CIM-10/FHIR/CIM-10 |
| NABM                                 | 1.2.250.1.213.1.1.4.351  | Nomenclature des Actes de Biologie Médicale      | https://mos.esante.gouv.fr/NOS/NABM/FHIR/NABM   |
| TRE-R316-AutreCategorieEtablissement | 1.2.250.1.213.1.6.1.239  | Autre catégorie d'établissement                  | https://mos.esante.gouv.fr/NOS/TRE_R316-AutreCategorieEtablissement/FHIR/TRE-R316-AutreCategorieEtablissement |
| TRE-R51-DESCGroupe2Diplome           | 1.2.250.1.213.1.6.1.49   | DESC Groupe 2 Diplôme                           | https://mos.esante.gouv.fr/NOS/TRE_R51-DESCGroupe2Diplome/FHIR/TRE-R51-DESCGroupe2Diplome |
| TRE-G02-TypeProduit                  | 1.2.250.1.71.1.2.2       | Type de produit                                  | https://mos.esante.gouv.fr/NOS/TRE_G02-TypeProduit/FHIR/TRE-G02-TypeProduit |
| TRE-R217-ProtectionJuridique         | 1.2.250.1.213.1.1.4.327  | Protection juridique (tutelle, curatelle, etc.)  | https://mos.esante.gouv.fr/NOS/TRE_R217-ProtectionJuridique/FHIR/TRE-R217-ProtectionJuridique |
| TRE-R302-ContexteCodeComplementaire  | 1.2.250.1.213.3.3.70     | Contexte de code complémentaire                  | https://mos.esante.gouv.fr/NOS/TRE_R302-ContexteCodeComplementaire/FHIR/TRE-R302-ContexteCodeComplementaire |
| TRE-R239-PublicPrisEnCharge          | 1.2.250.1.213.3.3.29     | Public pris en charge                            | https://mos.esante.gouv.fr/NOS/TRE_R239-PublicPrisEnCharge/FHIR/TRE-R239-PublicPrisEnCharge |
| TRE-A01-CadreExercice                | 1.2.250.1.213.1.1.4.9    | Cadre d'exercice                                 | https://mos.esante.gouv.fr/NOS/TRE_A01-CadreExercice/FHIR/TRE-A01-CadreExercice |
| TRE-R303-HL7v3AdministrativeGender   | 1.2.250.1.213.1.1.5.596  | Genre administratif HL7v3                        | https://mos.esante.gouv.fr/NOS/TRE_R303-HL7v3AdministrativeGender/FHIR/TRE-R303-HL7v3AdministrativeGender |
| LOINC                                | 2.16.840.1.113883.6.1    | Logical Observation Identifiers Names and Codes  | http://loinc.org |
| SNOMED CT                            | 2.16.840.1.113883.6.96   | Systematized Nomenclature of Medicine - Clinical Terms | http://snomed.info/sct |

## Utilisation dans les ressources FHIR

### Exemple d'identification de patient

```json
"identifier": [
  {
    "use": "official",
    "type": {
      "coding": [
        {
          "system": "https://mos.esante.gouv.fr/NOS/TRE_G07-NIR/FHIR/TRE-G07-NIR",
          "code": "NIR",
          "display": "NIR"
        }
      ]
    },
    "system": "urn:oid:1.2.250.1.213.1.4.8",
    "value": "1234567890123"
  }
]
```

### Exemple d'identification de professionnel

```json
"identifier": [
  {
    "use": "official",
    "system": "urn:oid:1.2.250.1.71.4.2.1",
    "value": "10101010101"
  }
]
```

### Exemple de code CCAM

```json
"code": {
  "coding": [
    {
      "system": "urn:oid:1.2.250.1.213.2.5",
      "code": "AHQP003",
      "display": "Électrocardiographie"
    }
  ]
}
```

## Notes d'implémentation

1. Pour les identifiants INS, utiliser le format sans espaces ni tirets.
2. Pour les numéros RPPS, toujours utiliser les 11 chiffres complets.
3. Pour les structures d'identifiants plus complexes, se référer aux spécifications de l'ANS.
4. Les OIDs doivent être préfixés par `urn:oid:` lors de leur utilisation dans les ressources FHIR.

## Références

- [Serveur Multi-Terminologies (SMT) de l'ANS](https://smt.esante.gouv.fr)
- [Espace de Nomenclatures Ouvertes en Santé (ENOS)](https://mos.esante.gouv.fr)
- [Guide d'implémentation FHIR R4 de l'ANS](https://interop.esante.gouv.fr)