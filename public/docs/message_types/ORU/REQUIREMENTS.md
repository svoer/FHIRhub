# Exigences pour l'implémentation des messages ORU

Pour implémenter correctement la conversion des messages ORU vers FHIR, vous aurez besoin des éléments suivants.

## 1. Exemples de messages HL7

Fournir des exemples réels de messages ORU que vous souhaitez convertir. Ces exemples doivent :

- Être représentatifs des différents cas d'usage dans votre établissement
- Inclure tous les segments et champs que vous utilisez
- Couvrir différents types d'observations (labo, signes vitaux, imagerie, etc.)
- Inclure des cas particuliers (valeurs anormales, commentaires, etc.)

Idéalement, fournir entre 5 et 10 exemples couvrant différents scénarios.

## 2. Mappings spécifiques à votre établissement

Fournir des informations sur :

- Les codes d'observations spécifiques utilisés dans vos messages
- Les correspondances entre ces codes et les systèmes de codage standard (LOINC, SNOMED CT)
- Les formats des identifiants utilisés (patients, demandes, observations)
- Les spécificités liées à vos processus internes

## 3. Terminologies et vocabulaires

Fournir des informations sur les terminologies utilisées :

- Listes de codes utilisés pour les observations (noms des tests, etc.)
- Mappings entre vos codes internes et les terminologies standard
- Nomenclatures spécifiques à la France (NABM, CCAM, etc.)
- Unités de mesure utilisées et leurs équivalents UCUM

## 4. Validation

Définir les critères de validation des conversions :

- Format attendu des ressources FHIR générées
- Tests de non-régression à effectuer
- Conformité aux profils FHIR français (ANS)
- Règles métier spécifiques à vérifier

## 5. Documentation de référence

Fournir (ou indiquer) la documentation de référence :

- Spécifications HL7 v2.5 pour les messages ORU
- Profils d'intégration IHE applicables
- Spécifications FHIR R4 pour les ressources concernées
- Profils FHIR de l'ANS
- Documentation interne sur vos interfaçages existants

## 6. Développement requis

Les principales tâches de développement à réaliser sont :

1. Créer des parsers pour les segments OBR et OBX
2. Développer les convertisseurs pour les ressources FHIR DiagnosticReport et Observation
3. Gérer les relations entre ces ressources
4. Intégrer les terminologies spécifiques
5. Adapter le formatage des dates, nombres et identifiants
6. Gérer les cas particuliers (commentaires, sous-composants, etc.)
7. Développer les tests unitaires et d'intégration

## 7. Informations spécifiques à fournir

Pour adapter le convertisseur à vos besoins spécifiques, veuillez fournir :

| Information | Description | Exemple |
|-------------|-------------|---------|
| Systèmes émetteurs | Liste des systèmes qui envoient des ORU | LIS Laboratoire, SIR Radiologie |
| Types d'observations | Catégories d'observations à traiter | Biologie, Radiologie, ECG |
| Format des identifiants | Structure de vos identifiants patients/observations | IPP: 9 chiffres, Obs: préfixe+numéro |
| Règles métier | Règles spéciales à appliquer | Regrouper les résultats par panel |
| Extensions nécessaires | Extensions FHIR spécifiques à créer | Extension pour traçabilité, confidentialité |
| Terminologies | Systèmes de codage utilisés | LOINC-FR, NABM, nomenclature interne |

## 8. Planning recommandé

Voici un planning indicatif pour l'implémentation :

1. Analyse des exemples et définition des mappings : 1-2 semaines
2. Développement des parsers pour segments spécifiques : 1-2 semaines
3. Développement des convertisseurs vers ressources FHIR : 2-3 semaines
4. Intégration des terminologies : 1 semaine
5. Tests et validation : 1-2 semaines
6. Documentation et mise en production : 1 semaine

Total estimé : 7-11 semaines selon la complexité