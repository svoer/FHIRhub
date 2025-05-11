/**
 * Documentation complète des APIs de FHIRHub
 * Ce fichier contient les annotations Swagger pour toutes les APIs disponibles
 * 
 * @version 1.1.0
 * @updated 2025-05-01
 */

/**
 * @swagger
 * tags:
 *   - name: Authentification
 *     description: Gestion de l'authentification des utilisateurs
 *   - name: Conversion
 *     description: Conversion de messages HL7 vers FHIR
 *   - name: Terminologie
 *     description: Gestion des terminologies françaises
 *   - name: Applications
 *     description: Gestion des applications clientes
 *   - name: API Keys
 *     description: Gestion des clés API
 *   - name: Utilisateurs
 *     description: Gestion des utilisateurs
 *   - name: Système
 *     description: Informations et statistiques système
 *   - name: Cache
 *     description: Gestion du cache de conversion
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - password
 *         - role
 *       properties:
 *         id:
 *           type: integer
 *           description: ID unique de l'utilisateur
 *         username:
 *           type: string
 *           description: Nom d'utilisateur
 *         password:
 *           type: string
 *           format: password
 *           description: Mot de passe (non renvoyé dans les réponses)
 *         role:
 *           type: string
 *           enum: [admin, user]
 *           description: Rôle de l'utilisateur (admin ou user)
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Date de création du compte
 *     
 *     Application:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: ID unique de l'application
 *         name:
 *           type: string
 *           description: Nom de l'application
 *         description:
 *           type: string
 *           description: Description de l'application
 *         cors_origins:
 *           type: string
 *           description: Origines CORS autorisées (séparées par des virgules)
 *         settings:
 *           type: object
 *           description: Paramètres spécifiques à l'application (JSON)
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Date de création
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Date de dernière mise à jour
 *     
 *     ApiKey:
 *       type: object
 *       required:
 *         - application_id
 *       properties:
 *         id:
 *           type: integer
 *           description: ID unique de la clé API
 *         application_id:
 *           type: integer
 *           description: ID de l'application associée
 *         key:
 *           type: string
 *           description: Clé API (générée automatiquement)
 *         is_active:
 *           type: boolean
 *           description: Statut d'activation de la clé
 *         description:
 *           type: string
 *           description: Description de la clé
 *         expires_at:
 *           type: string
 *           format: date-time
 *           description: Date d'expiration (optionnelle)
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Date de création
 *         last_used_at:
 *           type: string
 *           format: date-time
 *           description: Dernière utilisation
 *     
 *     HL7Message:
 *       type: object
 *       required:
 *         - hl7Message
 *       properties:
 *         hl7Message:
 *           type: string
 *           description: Message HL7 v2.5 à convertir
 *     
 *     FHIRBundle:
 *       type: object
 *       properties:
 *         resourceType:
 *           type: string
 *           enum: [Bundle]
 *           description: Type de ressource FHIR (toujours Bundle)
 *         id:
 *           type: string
 *           description: Identifiant du bundle
 *         type:
 *           type: string
 *           enum: [collection, transaction]
 *           description: Type de bundle FHIR
 *         entry:
 *           type: array
 *           description: Entrées du bundle
 *           items:
 *             type: object
 *     
 *     ConversionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Statut de la conversion
 *         data:
 *           type: object
 *           description: Données de résultat
 *           properties:
 *             message:
 *               type: string
 *               description: Message d'information
 *             bundle:
 *               $ref: '#/components/schemas/FHIRBundle'
 *             processingTime:
 *               type: number
 *               description: Temps de traitement en millisecondes
 *     
 *     TerminologyInfo:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Statut de la requête
 *         data:
 *           type: object
 *           properties:
 *             version:
 *               type: string
 *               description: Version des mappings
 *             lastUpdated:
 *               type: string
 *               format: date-time
 *               description: Date de dernière mise à jour
 *             systems:
 *               type: object
 *               description: Systèmes de terminologie disponibles
 *             oids:
 *               type: object
 *               description: OIDs français disponibles
 *     
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Toujours false en cas d'erreur
 *         message:
 *           type: string
 *           description: Message d'erreur
 *         error:
 *           type: string
 *           description: Détails techniques de l'erreur (si disponible)
 */

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Authentification des utilisateurs
 *     description: Authentifie un utilisateur avec son nom d'utilisateur et mot de passe
 *     tags:
 *       - Authentification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Authentification réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT d'authentification
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Authentification échouée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Déconnexion de l'utilisateur
 *     description: Déconnecte l'utilisateur actuellement authentifié
 *     tags:
 *       - Authentification
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *       401:
 *         description: Non authentifié
 */

/**
 * @swagger
 * /api/user:
 *   get:
 *     summary: Obtenir les informations de l'utilisateur connecté
 *     description: Retourne les informations de l'utilisateur actuellement authentifié
 *     tags:
 *       - Authentification
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Informations utilisateur récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Non authentifié
 */

/**
 * @swagger
 * /api/convert:
 *   post:
 *     summary: Convertir un message HL7 en FHIR
 *     description: Convertit un message HL7 v2.5 en bundle FHIR R4 avec support des terminologies françaises
 *     tags:
 *       - Conversion
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HL7Message'
 *     responses:
 *       200:
 *         description: Conversion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversionResponse'
 *       400:
 *         description: Message HL7 invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/convert/validate:
 *   post:
 *     summary: Valider un message HL7 v2.5
 *     description: Vérifie la syntaxe d'un message HL7 v2.5 et retourne des informations sur les segments
 *     tags:
 *       - Conversion
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HL7Message'
 *     responses:
 *       200:
 *         description: Validation réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                     segmentCount:
 *                       type: integer
 *                     segmentTypes:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/terminology/french:
 *   get:
 *     summary: Obtenir les informations sur les terminologies françaises
 *     description: Retourne les informations sur les systèmes de terminologie français utilisés pour la conversion
 *     tags:
 *       - Terminologie
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Informations récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TerminologyInfo'
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/terminology/files:
 *   get:
 *     summary: Lister les fichiers de terminologie
 *     description: Récupère la liste des fichiers de terminologie disponibles
 *     tags:
 *       - Terminologie
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste récupérée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/terminology/files/{filename}:
 *   get:
 *     summary: Récupérer un fichier de terminologie
 *     description: Récupère le contenu d'un fichier de terminologie spécifique
 *     tags:
 *       - Terminologie
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         description: Nom du fichier à récupérer
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier récupéré avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 *
 *   delete:
 *     summary: Supprimer un fichier de terminologie
 *     description: Supprime un fichier de terminologie spécifique
 *     tags:
 *       - Terminologie
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         description: Nom du fichier à supprimer
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Opération non autorisée
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/terminology/refresh:
 *   post:
 *     summary: Rafraîchir les statistiques de terminologie
 *     description: Rafraîchit les statistiques des terminologies françaises
 *     tags:
 *       - Terminologie
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Rafraîchissement terminé avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/terminology/analyze:
 *   post:
 *     summary: Analyser les fichiers de terminologie
 *     description: Effectue une analyse approfondie des fichiers de terminologie
 *     tags:
 *       - Terminologie
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Analyse terminée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/terminology/check-duplicates:
 *   get:
 *     summary: Vérifier les fichiers de terminologie en doublon
 *     description: Identifie les fichiers de terminologie qui contiennent des données similaires
 *     tags:
 *       - Terminologie
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Vérification terminée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/terminology/remove-duplicates:
 *   post:
 *     summary: Supprimer les fichiers de terminologie en doublon
 *     description: Supprime automatiquement les fichiers de terminologie en doublon en gardant les plus récents
 *     tags:
 *       - Terminologie
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Suppression terminée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/terminology/import:
 *   post:
 *     summary: Importer un fichier de terminologie
 *     description: Importe un nouveau fichier de terminologie
 *     tags:
 *       - Terminologie
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Fichier de terminologie à importer (JSON)
 *               description:
 *                 type: string
 *                 description: Description du fichier
 *     responses:
 *       200:
 *         description: Importation réussie
 *       400:
 *         description: Fichier invalide
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/terminology/export:
 *   post:
 *     summary: Exporter les terminologies
 *     description: Exporte tous les fichiers de terminologie dans une archive ZIP
 *     tags:
 *       - Terminologie
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Exportation réussie
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Lister les applications
 *     description: Récupère la liste des applications enregistrées
 *     tags:
 *       - Applications
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Application'
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 *
 *   post:
 *     summary: Créer une application
 *     description: Crée une nouvelle application
 *     tags:
 *       - Applications
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Application'
 *     responses:
 *       201:
 *         description: Application créée avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/applications/{id}:
 *   get:
 *     summary: Récupérer une application
 *     description: Récupère les détails d'une application spécifique
 *     tags:
 *       - Applications
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de l'application
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Application récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Application'
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Application non trouvée
 *       500:
 *         description: Erreur serveur
 *
 *   put:
 *     summary: Mettre à jour une application
 *     description: Met à jour une application existante
 *     tags:
 *       - Applications
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de l'application
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Application'
 *     responses:
 *       200:
 *         description: Application mise à jour avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Application non trouvée
 *       500:
 *         description: Erreur serveur
 *
 *   delete:
 *     summary: Supprimer une application
 *     description: Supprime une application existante
 *     tags:
 *       - Applications
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de l'application
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Application supprimée avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Application non trouvée
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: Lister les clés API
 *     description: Récupère la liste des clés API
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ApiKey'
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 *
 *   post:
 *     summary: Créer une clé API
 *     description: Crée une nouvelle clé API pour une application
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - application_id
 *             properties:
 *               application_id:
 *                 type: integer
 *               description:
 *                 type: string
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Clé API créée avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/api-keys/{id}:
 *   get:
 *     summary: Récupérer une clé API
 *     description: Récupère les détails d'une clé API spécifique
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de la clé API
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Clé API récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKey'
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 *
 *   put:
 *     summary: Mettre à jour une clé API
 *     description: Met à jour le statut et les détails d'une clé API existante
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de la clé API
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_active:
 *                 type: boolean
 *               description:
 *                 type: string
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Clé API mise à jour avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 *
 *   delete:
 *     summary: Supprimer une clé API
 *     description: Supprime une clé API existante
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de la clé API
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Clé API supprimée avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lister les utilisateurs
 *     description: Récupère la liste des utilisateurs (admin uniquement)
 *     tags:
 *       - Utilisateurs
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès interdit
 *       500:
 *         description: Erreur serveur
 *
 *   post:
 *     summary: Créer un utilisateur
 *     description: Crée un nouvel utilisateur (admin uniquement)
 *     tags:
 *       - Utilisateurs
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès interdit
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Récupérer un utilisateur
 *     description: Récupère les détails d'un utilisateur spécifique (admin uniquement)
 *     tags:
 *       - Utilisateurs
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de l'utilisateur
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Utilisateur récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès interdit
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 *
 *   put:
 *     summary: Mettre à jour un utilisateur
 *     description: Met à jour un utilisateur existant (admin uniquement)
 *     tags:
 *       - Utilisateurs
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de l'utilisateur
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès interdit
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 *
 *   delete:
 *     summary: Supprimer un utilisateur
 *     description: Supprime un utilisateur existant (admin uniquement)
 *     tags:
 *       - Utilisateurs
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de l'utilisateur
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Utilisateur supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès interdit
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Obtenir les statistiques du système
 *     description: Retourne les statistiques de conversion et les informations du système
 *     tags:
 *       - Système
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversions:
 *                       type: integer
 *                       description: Nombre total de conversions effectuées
 *                     uptime:
 *                       type: number
 *                       format: float
 *                       description: Temps de fonctionnement du serveur en secondes
 *                     memory:
 *                       type: object
 *                       description: Informations sur la mémoire utilisée
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/cache/status:
 *   get:
 *     summary: Obtenir l'état du cache
 *     description: Retourne des informations sur le cache de conversion
 *     tags:
 *       - Cache
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Informations de cache récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                       description: État d'activation du cache
 *                     size:
 *                       type: integer
 *                       description: Nombre d'entrées dans le cache
 *                     maxSize:
 *                       type: integer
 *                       description: Taille maximale du cache
 *                     hits:
 *                       type: integer
 *                       description: Nombre de hits de cache
 *                     misses:
 *                       type: integer
 *                       description: Nombre de miss de cache
 *                     hitRate:
 *                       type: number
 *                       format: float
 *                       description: Taux de succès du cache (0-1)
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */