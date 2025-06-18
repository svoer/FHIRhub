# 🛡️ CHECKLIST AUDIT SÉCURITÉ - FHIRHUB

## 📋 Vue d'ensemble

Cette checklist couvre tous les aspects de sécurité des clés API et de la configuration CORS dans FHIRHub. Elle sert de guide pour les audits réguliers et la validation des configurations de sécurité.

## 🔑 AUDIT DES CLÉS API

### ✅ Génération et stockage sécurisé

- [ ] **Entropie cryptographique**
  - [ ] Utilisation de `crypto.randomBytes()` avec 32 bytes minimum
  - [ ] Longueur des clés ≥ 64 caractères hexadécimaux
  - [ ] Test d'unicité (pas de collision sur 10000 générations)
  - [ ] Préfixes identifiables par environnement

- [ ] **Stockage sécurisé en base**
  - [ ] Hachage SHA-256 avec salt unique par clé
  - [ ] Clés en clair non stockées (sauf dev-key en développement)
  - [ ] Index sur hash pour performance
  - [ ] Chiffrement de la base de données au repos

- [ ] **Validation des entrées**
  - [ ] Longueur maximale des clés (1000 caractères)
  - [ ] Caractères autorisés (alphanumériques + tirets)
  - [ ] Protection contre injection SQL
  - [ ] Échappement XSS dans les interfaces admin

### ✅ Authentification et autorisation

- [ ] **Mécanismes d'authentification**
  - [ ] Authentification dual JWT + API Keys fonctionnelle
  - [ ] Priorité JWT sur API Keys respectée
  - [ ] Fallback API Keys en cas d'échec JWT
  - [ ] Headers d'authentification multiples supportés

- [ ] **Validation des clés API**
  - [ ] Vérification existence en base de données
  - [ ] Contrôle statut actif/inactif
  - [ ] Vérification date d'expiration
  - [ ] Mise à jour compteur d'utilisation
  - [ ] Logging des tentatives d'authentification

- [ ] **Gestion des permissions**
  - [ ] Scopes définis par application
  - [ ] Validation des permissions par endpoint
  - [ ] Isolation des environnements (dev/prod)
  - [ ] Principe du moindre privilège appliqué

### ✅ Rate limiting et protection

- [ ] **Rate limiting global**
  - [ ] Limite globale: 1000 req/15min par IP configurée
  - [ ] Limite conversions: 30 req/min par IP+clé configurée
  - [ ] Limite authentification: 10 tentatives/15min par IP
  - [ ] Limite IA: 10 req/min par IP configurée

- [ ] **Protection contre les abus**
  - [ ] Headers Rate-Limit-* présents dans les réponses
  - [ ] Messages d'erreur informatifs sans exposition de données
  - [ ] Logging des tentatives de dépassement
  - [ ] Backoff exponentiel côté client documenté

- [ ] **Détection d'anomalies**
  - [ ] Alertes sur volume anormal de requêtes
  - [ ] Détection de patterns d'attaque
  - [ ] Géolocalisation des accès suspects
  - [ ] Blacklist automatique des IP malveillantes

### ✅ Cycle de vie des clés

- [ ] **Création de clés**
  - [ ] Interface admin sécurisée pour création
  - [ ] Affichage unique de la clé à la création
  - [ ] Description obligatoire pour traçabilité
  - [ ] Application associée requise

- [ ] **Gestion des expirations**
  - [ ] Date d'expiration configurable
  - [ ] Notification avant expiration (7 jours)
  - [ ] Désactivation automatique des clés expirées
  - [ ] Processus de renouvellement documenté

- [ ] **Révocation et suppression**
  - [ ] Révocation immédiate fonctionnelle
  - [ ] Audit trail des révocations
  - [ ] Raison de révocation obligatoire
  - [ ] Suppression définitive après délai de grâce

### ✅ Audit et monitoring

- [ ] **Logging complet**
  - [ ] Tentatives d'authentification (succès/échec)
  - [ ] Utilisation des clés avec métadonnées
  - [ ] Modifications des clés (création/révocation)
  - [ ] Erreurs et incidents de sécurité

- [ ] **Métriques de sécurité**
  - [ ] Dashboard temps réel des accès
  - [ ] Statistiques d'utilisation par clé
  - [ ] Rapport de sécurité hebdomadaire
  - [ ] Alertes automatiques configurées

## 🌐 AUDIT CORS

### ✅ Configuration de base

- [ ] **Validation des origines**
  - [ ] Liste blanche explicite des domaines autorisés
  - [ ] Pas de wildcard (*) avec credentials en production
  - [ ] Validation stricte des sous-domaines
  - [ ] Environnement dev vs prod correctement configuré

- [ ] **Méthodes HTTP autorisées**
  - [ ] Méthodes GET, POST, PUT, DELETE autorisées
  - [ ] Méthodes dangereuses (TRACE, CONNECT) bloquées
  - [ ] OPTIONS géré pour preflight
  - [ ] Validation des méthodes par endpoint

- [ ] **Headers autorisés**
  - [ ] Content-Type autorisé
  - [ ] Authorization autorisé pour JWT
  - [ ] x-api-key autorisé pour clés API
  - [ ] Headers personnalisés validés

### ✅ Configuration avancée

- [ ] **Credentials et cookies**
  - [ ] Access-Control-Allow-Credentials configuré correctement
  - [ ] Gestion des cookies secure et httpOnly
  - [ ] Sessions cross-domain sécurisées
  - [ ] Validation combinaison origin/credentials

- [ ] **Cache et performance**
  - [ ] Access-Control-Max-Age optimisé (86400s)
  - [ ] Headers Vary présents pour cache correct
  - [ ] Preflight mis en cache efficacement
  - [ ] Réponses OPTIONS optimisées

- [ ] **Headers de sécurité complémentaires**
  - [ ] X-Frame-Options: DENY configuré
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-XSS-Protection activé
  - [ ] Referrer-Policy configuré

### ✅ Validation et tests

- [ ] **Tests d'origines**
  - [ ] Origines autorisées acceptées
  - [ ] Origines non autorisées rejetées
  - [ ] Sous-domaines gérés correctement
  - [ ] Ports non standard testés

- [ ] **Tests de méthodes**
  - [ ] Preflight pour méthodes complexes
  - [ ] Méthodes simples sans preflight
  - [ ] Rejet méthodes non autorisées
  - [ ] Gestion des erreurs appropriée

- [ ] **Tests de headers**
  - [ ] Headers autorisés passent
  - [ ] Headers non autorisés rejetés
  - [ ] Headers sensibles protégés
  - [ ] Casse des headers gérée

## 🔒 TESTS DE SÉCURITÉ AUTOMATISÉS

### ✅ Script d'audit automatique

- [ ] **Exécution du script**
  ```bash
  node scripts/security-audit-api-cors.js
  ```
  - [ ] Tests API Keys passent (score > 80%)
  - [ ] Tests CORS passent (score > 80%)
  - [ ] Aucune vulnérabilité critique
  - [ ] Rapport généré sans erreur

- [ ] **Validation manuelle**
  - [ ] Test avec curl/Postman
  - [ ] Validation depuis navigateur
  - [ ] Test cross-domain réel
  - [ ] Performance des requêtes

### ✅ Tests de pénétration

- [ ] **Tests d'injection**
  - [ ] Injection SQL dans clés API
  - [ ] XSS dans interfaces admin
  - [ ] Injection headers HTTP
  - [ ] Path traversal dans paramètres

- [ ] **Tests de contournement**
  - [ ] Bypass authentification
  - [ ] Contournement rate limiting
  - [ ] Manipulation headers CORS
  - [ ] Exploitation des erreurs

## 🚨 GESTION DES INCIDENTS

### ✅ Plan de réponse aux incidents

- [ ] **Détection**
  - [ ] Alertes automatiques configurées
  - [ ] Monitoring 24/7 en place
  - [ ] Escalade définie
  - [ ] Contact équipe sécurité

- [ ] **Réponse**
  - [ ] Procédure d'isolement rapide
  - [ ] Révocation d'urgence des clés
  - [ ] Blocage IP malveillantes
  - [ ] Communication stakeholders

- [ ] **Récupération**
  - [ ] Sauvegarde des configurations
  - [ ] Plan de restauration testé
  - [ ] Validation post-incident
  - [ ] Rapport d'incident structuré

## 📊 MÉTRIQUES ET KPI

### ✅ Indicateurs de sécurité

- [ ] **Métriques techniques**
  - [ ] Taux d'authentification réussie > 99%
  - [ ] Temps de réponse rate limiting < 100ms
  - [ ] Disponibilité API > 99.9%
  - [ ] Zéro vulnérabilité critique

- [ ] **Métriques opérationnelles**
  - [ ] Temps de détection incidents < 5min
  - [ ] Temps de réponse incidents < 30min
  - [ ] Formation équipe à jour
  - [ ] Documentation synchronisée

## 🔄 AMÉLIORATION CONTINUE

### ✅ Processus d'amélioration

- [ ] **Audit régulier**
  - [ ] Audit sécurité mensuel
  - [ ] Révision configuration trimestrielle
  - [ ] Tests de pénétration semestriels
  - [ ] Certification sécurité annuelle

- [ ] **Mise à jour**
  - [ ] Veille sécurité active
  - [ ] Correctifs appliqués rapidement
  - [ ] Formation continue équipe
  - [ ] Partage bonnes pratiques

## 📋 VALIDATION FINALE

### ✅ Certification de conformité

- [ ] **Conformité réglementaire**
  - [ ] RGPD: Protection données personnelles
  - [ ] HDS: Hébergement données de santé
  - [ ] ISO 27001: Management sécurité
  - [ ] ANSSI: Recommandations nationales

- [ ] **Validation technique**
  - [ ] Tests automatisés passent
  - [ ] Documentation complète
  - [ ] Équipe formée
  - [ ] Processus documentés

**Date d'audit:** _________________
**Responsable:** _________________
**Score global:** ____/100
**Statut:** ☐ Conforme ☐ Non conforme ☐ Amélioration requise

---

## 📞 CONTACTS D'URGENCE

- **Équipe sécurité:** security@hopital.fr
- **Administrateur système:** admin@hopital.fr
- **Responsable données:** dpo@hopital.fr
- **ANSSI:** cert-fr@ssi.gouv.fr (incidents majeurs)