/**
 * Routes de gestion des terminologies françaises
 * Permet l'import, l'export et la gestion des fichiers de terminologie
 * @module routes/terminology
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
const authCombined = require('../middleware/authCombined');

// Middleware pour vérifier si l'utilisateur est administrateur
const jwtAuth = require('../middleware/jwtAuth');

// Support du mode hors-ligne pour les terminologies
const { offlineAdminMiddleware } = require('../middleware/offlineAuthMiddleware');

// Middleware d'authentification administrateur combinée (JWT ou API Key)
// Le middleware authCombined ne bloque pas la requête, il ajoute juste req.isAuthenticated()
// Nous continuons à utiliser jwtAuth pour les routes qui nécessitent un rôle spécifique
const adminAuthMiddleware = offlineAdminMiddleware; // Remplacement par notre middleware avec support hors-ligne

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function(req, file, cb) {
    // Utiliser le nom original du fichier 
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: function(req, file, cb) {
    // Accepter uniquement les fichiers JSON
    if (file.mimetype !== 'application/json' && !file.originalname.endsWith('.json')) {
      return cb(new Error('Seuls les fichiers JSON sont acceptés'), false);
    }
    cb(null, true);
  }
});

// Répertoire des terminologies - Simplification après nettoyage des dossiers inutiles
// Utilisation d'un seul répertoire principal pour éviter les confusions
const TERMINOLOGY_DIR = path.join(__dirname, '../french_terminology');

// Vérification de l'existence du répertoire
if (!fs.existsSync(TERMINOLOGY_DIR)) {
  try {
    console.log(`[TERMINOLOGY] Création du répertoire principal de terminologie: ${TERMINOLOGY_DIR}`);
    fs.mkdirSync(TERMINOLOGY_DIR, { recursive: true });
  } catch (error) {
    console.error(`[TERMINOLOGY] ERREUR CRITIQUE: Impossible de créer le répertoire de terminologie: ${TERMINOLOGY_DIR}`, error);
  }
} else {
  const files = fs.readdirSync(TERMINOLOGY_DIR).filter(file => file.endsWith('.json'));
  console.log(`[TERMINOLOGY] Répertoire principal de terminologie: ${TERMINOLOGY_DIR}`);
  console.log(`[TERMINOLOGY] Nombre de fichiers JSON disponibles: ${files.length}`);
}

/**
 * @swagger
 * /api/terminology/french:
 *   get:
 *     summary: Obtenir les informations sur les terminologies françaises
 *     description: Retourne les informations sur les systèmes de terminologie français utilisés pour la conversion
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Informations récupérées avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/french', adminAuthMiddleware, async (req, res) => {
  try {
    // Récupérer les données des terminologies de base
    const systems = getJsonFileContent('ans_terminology_systems.json');
    const oids = getJsonFileContent('ans_oids.json');
    const commonCodes = getJsonFileContent('ans_common_codes.json');
    
    // Compter le nombre d'éléments dans les fichiers de base
    let systemsCount = systems ? Object.keys(systems).length : 0;
    let oidsCount = oids?.identifier_systems ? Object.keys(oids.identifier_systems).length : 0;
    
    // Analyse détaillée de tous les fichiers
    const allFiles = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json'));
    
    // Variables pour suivre les informations supplémentaires
    let codeSystemsCount = 0;  // Nombre total de CodeSystems
    let valueSetsCount = 0;    // Nombre total de ValueSets
    let conceptMapCount = 0;   // Nombre total de ConceptMaps
    let lastModifiedDate = null;
    let systemsSummary = {};   // Résumé des types de systèmes trouvés
    
    // Parcourir tous les fichiers
    for (const filename of allFiles) {
      try {
        const filePath = path.join(TERMINOLOGY_DIR, filename);
        const stats = fs.statSync(filePath);
        
        // Mettre à jour la date de dernière modification si ce fichier est plus récent
        if (!lastModifiedDate || new Date(stats.mtime) > new Date(lastModifiedDate)) {
          lastModifiedDate = stats.mtime;
        }
        
        // Analyser le contenu du fichier avec un traitement spécial pour les fichiers volumineux
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const jsonData = JSON.parse(content);
          
          // Détecter le type de fichier et compter les éléments
          if (jsonData.resourceType === 'Bundle' && jsonData.entry) {
            // Pour les bundles, compter directement les types de ressources
            jsonData.entry.forEach(entry => {
              if (entry.resource && entry.resource.resourceType) {
                const resourceType = entry.resource.resourceType;
                systemsSummary[resourceType] = (systemsSummary[resourceType] || 0) + 1;
                
                if (resourceType === 'CodeSystem') {
                  codeSystemsCount++;
                } else if (resourceType === 'ValueSet') {
                  valueSetsCount++;
                } else if (resourceType === 'ConceptMap') {
                  conceptMapCount++;
                }
              }
            });
          } else if (jsonData.resourceType === 'CodeSystem') {
            codeSystemsCount++;
            systemsSummary['CodeSystem'] = (systemsSummary['CodeSystem'] || 0) + 1;
          } else if (jsonData.resourceType === 'ValueSet') {
            valueSetsCount++;
            systemsSummary['ValueSet'] = (systemsSummary['ValueSet'] || 0) + 1;
          } else if (jsonData.resourceType === 'ConceptMap') {
            conceptMapCount++;
            systemsSummary['ConceptMap'] = (systemsSummary['ConceptMap'] || 0) + 1;
          } else if (jsonData.systems) {
            // Fichier de systèmes ANS
            systemsSummary['ANS-Systems'] = (systemsSummary['ANS-Systems'] || 0) + Object.keys(jsonData.systems).length;
          } else if (jsonData.identifier_systems) {
            // Fichier d'OIDs ANS
            systemsSummary['ANS-OIDs'] = (systemsSummary['ANS-OIDs'] || 0) + Object.keys(jsonData.identifier_systems).length;
            oidsCount = Object.keys(jsonData.identifier_systems).length;
          }
        } catch (parseError) {
          console.error(`[TERMINOLOGY] Erreur d'analyse JSON pour ${filename}:`, parseError.message);
          // Comptage basé sur grep si le fichier est trop gros
          if (stats.size > 1000000) { // > 1MB
            try {
              // Utiliser des expressions régulières sur le contenu pour détecter les ressources
              const content = fs.readFileSync(filePath, 'utf8');
              const codeSystemMatches = content.match(/"resourceType"\s*:\s*"CodeSystem"/g);
              const valueSetMatches = content.match(/"resourceType"\s*:\s*"ValueSet"/g);
              
              if (codeSystemMatches) {
                const count = codeSystemMatches.length;
                codeSystemsCount += count;
                systemsSummary['CodeSystem'] = (systemsSummary['CodeSystem'] || 0) + count;
              }
              
              if (valueSetMatches) {
                const count = valueSetMatches.length;
                valueSetsCount += count;
                systemsSummary['ValueSet'] = (systemsSummary['ValueSet'] || 0) + count;
              }
            } catch (regexError) {
              console.error(`[TERMINOLOGY] Erreur d'analyse regex pour ${filename}:`, regexError.message);
            }
          }
        }
      } catch (error) {
        console.error(`[TERMINOLOGY] Erreur lors de l'analyse du fichier ${filename}:`, error);
        // Continuer avec le fichier suivant
      }
    }
    
    // Total des systèmes : valeur de base + CodeSystems + ValueSets
    systemsCount = systemsCount + codeSystemsCount + valueSetsCount;
    
    // Utiliser la date de dernière modification la plus récente ou la date actuelle
    const lastUpdated = lastModifiedDate ? new Date(lastModifiedDate).toISOString() : new Date().toISOString();
    
    res.json({
      success: true,
      data: {
        version: '1.0.0', // Valeur par défaut hardcodée
        lastUpdated: lastUpdated,
        systems: systems || {},
        oids: oids?.identifier_systems || {},
        systemsCount: systemsCount,
        oidsCount: oidsCount,
        codeSystemsCount: codeSystemsCount,
        valueSetsCount: valueSetsCount,
        conceptMapCount: conceptMapCount,
        totalFiles: allFiles.length,
        systemsSummary: systemsSummary
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des terminologies :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des terminologies françaises',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/files:
 *   get:
 *     summary: Obtenir la liste des fichiers de terminologie
 *     description: Retourne la liste des fichiers de terminologie disponibles
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Liste récupérée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/files', adminAuthMiddleware, async (req, res) => {
  try {
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const stats = fs.statSync(path.join(TERMINOLOGY_DIR, file));
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        };
      });
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des fichiers de terminologie :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers de terminologie',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/files/{filename}:
 *   get:
 *     summary: Obtenir le contenu d'un fichier de terminologie
 *     description: Retourne le contenu d'un fichier de terminologie spécifique
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contenu récupéré avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/files/:filename', adminAuthMiddleware, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    const content = getJsonFileContent(filename);
    res.json(content);
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération du fichier ${req.params.filename} :`, error);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la récupération du fichier ${req.params.filename}`,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/files/{filename}/download:
 *   get:
 *     summary: Télécharger un fichier de terminologie
 *     description: Télécharge un fichier de terminologie spécifique
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier téléchargé avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/files/:filename/download', adminAuthMiddleware, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/json');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error(`[API] Erreur lors du téléchargement du fichier ${req.params.filename} :`, error);
    res.status(500).json({
      success: false,
      message: `Erreur lors du téléchargement du fichier ${req.params.filename}`,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/import:
 *   post:
 *     summary: Importer un fichier de terminologie
 *     description: Importe un fichier de terminologie au format JSON
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
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
 *               type:
 *                 type: string
 *                 description: Type de terminologie (oids, common_codes, systems, valuesets, r4_systems, r5_systems, auto)
 *               description:
 *                 type: string
 *                 description: Description personnalisée pour ce fichier de terminologie
 *     responses:
 *       200:
 *         description: Fichier importé avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/import', adminAuthMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }
    
    // Lire le fichier téléchargé
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    let jsonData;
    
    try {
      jsonData = JSON.parse(fileContent);
    } catch (err) {
      // Supprimer le fichier temporaire
      fs.unlinkSync(req.file.path);
      
      return res.status(400).json({
        success: false,
        message: 'Le fichier n\'est pas un JSON valide',
        error: err.message
      });
    }
    
    // Déterminer le nom du fichier de destination
    let destFilename = '';
    const type = req.body.type || 'auto';
    
    if (type === 'oids' || req.file.originalname.includes('oids')) {
      destFilename = 'ans_oids.json';
    } else if (type === 'common_codes' || req.file.originalname.includes('common_codes')) {
      destFilename = 'ans_common_codes.json';
    } else if (type === 'systems' || req.file.originalname.includes('terminology_systems')) {
      destFilename = 'ans_terminology_systems.json';
    } else if (type === 'valuesets' || req.file.originalname.includes('valuesets')) {
      destFilename = 'fhir_valuesets.json';
    } else if (type === 'codesystems' || req.file.originalname.includes('codesystems')) {
      destFilename = 'fhir_codesystems.json';
    } else if (type === 'r4_systems' || req.file.originalname.includes('r4_french')) {
      destFilename = 'fhir_r4_french_systems.json';
    } else if (type === 'r5_systems' || req.file.originalname.includes('r5_french')) {
      destFilename = 'fhir_r5_french_systems.json';
    } else {
      // Déterminer le type en fonction du contenu
      if (jsonData.systems && (jsonData.systems.ins || jsonData.systems.rpps)) {
        destFilename = 'ans_oids.json';
      } else if (jsonData.codeSystemMap && (jsonData.codeSystemMap.profession || jsonData.codeSystemMap.movement)) {
        destFilename = 'ans_common_codes.json';
      } else if (jsonData.systems || jsonData.codeSystemMap) {
        destFilename = 'ans_terminology_systems.json';
      } else {
        // Utiliser le nom original du fichier mais le préfixer avec ans_ pour les nouveaux fichiers
        destFilename = req.file.originalname.startsWith('ans_') 
          ? req.file.originalname 
          : `ans_${req.file.originalname}`;
      }
    }
    
    // S'assurer que jsonData a une date de mise à jour
    if (!jsonData.lastUpdated) {
      jsonData.lastUpdated = new Date().toISOString();
    }
    
    // S'assurer que jsonData a une version
    if (!jsonData.version) {
      jsonData.version = '1.0.0';
    }
    
    // Ajouter des métadonnées personnalisées
    if (!jsonData.metadata) {
      jsonData.metadata = {};
    }
    
    // Ajouter ou mettre à jour la description
    if (req.body.description) {
      jsonData.metadata.description = req.body.description;
    } else if (!jsonData.metadata.description) {
      jsonData.metadata.description = `Importé le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
    }
    
    // Ajouter des informations d'import
    jsonData.metadata.importDate = new Date().toISOString();
    jsonData.metadata.importedBy = req.user ? req.user.username : 'admin';
    jsonData.metadata.originalFilename = req.file.originalname;
    
    // Analyser le contenu pour des statistiques détaillées
    const stats = analyzeTerminologyContent(jsonData);
    jsonData.metadata.stats = stats;
    
    // Écrire le fichier de destination
    const destPath = path.join(TERMINOLOGY_DIR, destFilename);
    fs.writeFileSync(destPath, JSON.stringify(jsonData, null, 2));
    
    // Supprimer le fichier temporaire
    fs.unlinkSync(req.file.path);
    
    // Log détaillé
    console.log(`[TERMINOLOGY] Fichier ${destFilename} importé avec succès`);
    console.log(`[TERMINOLOGY] Contenu analysé: ${JSON.stringify(stats)}`);
    
    // Calculer le nombre de systèmes et d'éléments pour une meilleure visibilité dans l'UI
    let systemsCount = 0;
    let elementsCount = 0;
    
    // Déterminer les compteurs selon le type de fichier
    if (stats.detectedTypes.includes('ANS-Systems')) {
      systemsCount = stats.totalSystems || 0;
    } else if (stats.detectedTypes.includes('ANS-OIDs')) {
      // Pour les OIDs, nous comptons également comme des systèmes
      systemsCount = stats.totalSystems || 0;
    } else if (stats.resourceType === 'Bundle') {
      // Pour les bundles, compter les différents types de ressources
      if (stats.resourceTypes) {
        if (stats.resourceTypes.CodeSystem) {
          systemsCount += stats.resourceTypes.CodeSystem;
        }
        if (stats.resourceTypes.ValueSet) {
          systemsCount += stats.resourceTypes.ValueSet;
        }
        if (stats.resourceTypes.ConceptMap) {
          elementsCount += stats.resourceTypes.ConceptMap;
        }
      }
      // Compter tous les éléments du bundle
      elementsCount += stats.totalElements || 0;
    } else if (stats.resourceType === 'CodeSystem' || stats.detectedTypes.includes('CodeSystem')) {
      systemsCount = 1;
      elementsCount = stats.totalElements || 0;
    } else if (stats.resourceType === 'ValueSet' || stats.detectedTypes.includes('ValueSet')) {
      systemsCount = 1;
      elementsCount = stats.totalElements || 0;
    }
    
    res.json({
      success: true,
      message: 'Fichier importé avec succès',
      data: {
        originalName: req.file.originalname,
        destinationName: destFilename,
        size: req.file.size,
        description: jsonData.metadata.description,
        stats: stats,
        systemsCount: systemsCount,
        elementsCount: elementsCount
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'importation du fichier :', error);
    
    // Supprimer le fichier temporaire si existe
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'importation du fichier',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/export:
 *   get:
 *     summary: Exporter toutes les terminologies
 *     description: Exporte toutes les terminologies au format ZIP
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Terminologies exportées avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/export', adminAuthMiddleware, async (req, res) => {
  try {
    const exportFilename = `terminologies_export_${new Date().toISOString().substring(0, 10)}.zip`;
    
    // Créer un fichier ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${exportFilename}`);
    
    const archive = archiver('zip', {
      zlib: { level: 9 } // Niveau de compression maximum
    });
    
    // Gérer les erreurs
    archive.on('error', (err) => {
      console.error('[API] Erreur lors de la création du ZIP :', err);
      res.status(500).send('Erreur lors de la création du fichier ZIP');
    });
    
    // Pipe l'archive vers la réponse
    archive.pipe(res);
    
    // Ajouter tous les fichiers JSON du répertoire de terminologies
    const files = fs.readdirSync(TERMINOLOGY_DIR).filter(file => file.endsWith('.json'));
    files.forEach(file => {
      const filePath = path.join(TERMINOLOGY_DIR, file);
      archive.file(filePath, { name: file });
    });
    
    // Finaliser l'archive
    archive.finalize();
  } catch (error) {
    console.error('[API] Erreur lors de l\'exportation des terminologies :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'exportation des terminologies',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/files/{filename}:
 *   delete:
 *     summary: Supprimer un fichier de terminologie
 *     description: Supprime un fichier de terminologie spécifique
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.delete('/files/:filename', adminAuthMiddleware, async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Vérifier que ce n'est pas un fichier système essentiel
    const systemFiles = ['ans_oids.json', 'ans_common_codes.json', 'ans_terminology_systems.json'];
    if (systemFiles.includes(filename)) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un fichier système. Vous pouvez le remplacer en important une nouvelle version.'
      });
    }
    
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    fs.unlinkSync(filePath);
    
    console.log(`[TERMINOLOGY] Fichier ${filename} supprimé avec succès`);
    
    res.json({
      success: true,
      message: 'Fichier supprimé avec succès'
    });
  } catch (error) {
    console.error(`[API] Erreur lors de la suppression du fichier ${req.params.filename} :`, error);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la suppression du fichier`,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/files/{filename}/metadata:
 *   put:
 *     summary: Mettre à jour les métadonnées d'un fichier de terminologie
 *     description: Met à jour la description et autres métadonnées d'un fichier
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Métadonnées mises à jour avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.put('/files/:filename/metadata', adminAuthMiddleware, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    if (!req.body || typeof req.body.description !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Description invalide'
      });
    }
    
    // Lire le fichier
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let jsonData = JSON.parse(fileContent);
    
    // Ajouter/mettre à jour les métadonnées
    if (!jsonData.metadata) {
      jsonData.metadata = {};
    }
    
    // Mettre à jour la description
    jsonData.metadata.description = req.body.description;
    jsonData.metadata.lastUpdated = new Date().toISOString();
    jsonData.metadata.updatedBy = req.user ? req.user.username : 'admin';
    
    // Écrire le fichier mis à jour
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    
    console.log(`[TERMINOLOGY] Métadonnées du fichier ${filename} mises à jour avec succès`);
    
    res.json({
      success: true,
      message: 'Métadonnées mises à jour avec succès',
      data: {
        filename,
        description: jsonData.metadata.description
      }
    });
  } catch (error) {
    console.error(`[API] Erreur lors de la mise à jour des métadonnées du fichier ${req.params.filename} :`, error);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la mise à jour des métadonnées`,
      error: error.message
    });
  }
});

/**
 * Récupérer le contenu d'un fichier JSON avec gestion robuste des erreurs
 * @param {string} filename - Nom du fichier
 * @returns {Object} Contenu du fichier JSON
 */
function getJsonFileContent(filename) {
  try {
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    console.log(`[TERMINOLOGY] Lecture du fichier: ${filename}`);
    
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      console.warn(`[TERMINOLOGY] Fichier non trouvé: ${filename}`);
      
      // Vérifier s'il existe une sauvegarde
      const backupPath = path.join(TERMINOLOGY_DIR, `backup_${filename}`);
      if (fs.existsSync(backupPath)) {
        console.log(`[TERMINOLOGY] Utilisation du fichier de sauvegarde: backup_${filename}`);
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        return JSON.parse(backupContent);
      }
      
      // Créer un fichier par défaut selon le type
      console.log(`[TERMINOLOGY] Création d'un fichier par défaut pour ${filename}`);
      let defaultContent = {};
      
      if (filename === 'ans_common_codes.json') {
        defaultContent = { 
          metadata: {
            version: "1.0.0",
            description: "Fichier par défaut pour common_codes",
            created: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          },
          common_codes: {}
        };
      } else if (filename === 'ans_oids.json') {
        defaultContent = {
          metadata: {
            version: "1.0.0",
            description: "Fichier par défaut pour oids",
            created: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          },
          identifier_systems: {}
        };
      } else if (filename === 'ans_terminology_systems.json') {
        defaultContent = {
          metadata: {
            version: "1.0.0",
            description: "Fichier par défaut pour terminology_systems",
            created: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          },
          systems: {}
        };
      } else {
        // Fichier inconnu
        return {};
      }
      
      // Enregistrer le fichier par défaut
      try {
        fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf8');
        console.log(`[TERMINOLOGY] Fichier par défaut créé: ${filename}`);
      } catch (writeError) {
        console.error(`[TERMINOLOGY] Impossible de créer le fichier par défaut:`, writeError);
      }
      
      return defaultContent;
    }
    
    // Lire le contenu du fichier existant
    const fileStats = fs.statSync(filePath);
    if (fileStats.size === 0) {
      console.warn(`[TERMINOLOGY] Fichier vide: ${filename}`);
      return {};
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Tenter de parser le JSON
    try {
      const jsonData = JSON.parse(content);
      
      // Créer une sauvegarde automatique du fichier
      try {
        const backupPath = path.join(TERMINOLOGY_DIR, `backup_${filename}`);
        fs.writeFileSync(backupPath, content, 'utf8');
      } catch (backupError) {
        console.error(`[TERMINOLOGY] Erreur lors de la création de la sauvegarde:`, backupError);
      }
      
      return jsonData;
    } catch (parseError) {
      console.error(`[TERMINOLOGY] Erreur de parsing JSON: ${filename}`, parseError);
      
      // Vérifier la sauvegarde en cas d'erreur de parsing
      const backupPath = path.join(TERMINOLOGY_DIR, `backup_${filename}`);
      if (fs.existsSync(backupPath)) {
        try {
          console.log(`[TERMINOLOGY] Tentative de récupération depuis la sauvegarde`);
          const backupContent = fs.readFileSync(backupPath, 'utf8');
          return JSON.parse(backupContent);
        } catch (backupError) {
          console.error(`[TERMINOLOGY] Echec de récupération depuis la sauvegarde:`, backupError);
        }
      }
      
      // En dernier recours, renvoyer un objet par défaut selon le type
      if (filename === 'ans_common_codes.json') {
        return { common_codes: {} };
      } else if (filename === 'ans_oids.json') {
        return { identifier_systems: {} };
      } else if (filename === 'ans_terminology_systems.json') {
        return { systems: {} };
      }
      
      return {};
    }
  } catch (error) {
    console.error(`[TERMINOLOGY] Erreur critique:`, error);
    return {};
  }
}

/**
 * Analyser le contenu d'un fichier de terminologie pour générer des statistiques détaillées
 * @param {Object} jsonData - Contenu JSON d'un fichier de terminologie
 * @returns {Object} Statistiques sur le contenu du fichier
 */
function analyzeTerminologyContent(jsonData) {
  const stats = {
    resourceType: jsonData.resourceType || 'Unknown',
    totalElements: 0,
    totalSystems: 0,
    detectedTypes: [],
    keyElements: []
  };
  
  // Analyser en fonction du type de ressource FHIR
  if (jsonData.resourceType === 'CodeSystem') {
    stats.detectedTypes.push('CodeSystem');
    stats.url = jsonData.url;
    stats.version = jsonData.version;
    stats.totalElements = jsonData.concept ? jsonData.concept.length : 0;
    stats.name = jsonData.name || jsonData.title;
    
    // Extraire quelques concepts clés pour montrer dans les logs
    if (jsonData.concept && jsonData.concept.length > 0) {
      stats.keyElements = jsonData.concept.slice(0, 5).map(c => ({
        code: c.code,
        display: c.display
      }));
    }
  } else if (jsonData.resourceType === 'ValueSet') {
    stats.detectedTypes.push('ValueSet');
    stats.url = jsonData.url;
    stats.version = jsonData.version;
    stats.name = jsonData.name || jsonData.title;
    
    if (jsonData.compose && jsonData.compose.include) {
      stats.totalSystems = jsonData.compose.include.length;
      stats.systems = jsonData.compose.include.map(i => i.system);
    }
  } else if (jsonData.resourceType === 'Bundle') {
    stats.detectedTypes.push('Bundle');
    stats.totalElements = jsonData.entry ? jsonData.entry.length : 0;
    
    // Analyser les types de ressources dans le bundle
    if (jsonData.entry && jsonData.entry.length > 0) {
      const resourceTypes = {};
      jsonData.entry.forEach(entry => {
        if (entry.resource && entry.resource.resourceType) {
          const type = entry.resource.resourceType;
          resourceTypes[type] = (resourceTypes[type] || 0) + 1;
        }
      });
      stats.resourceTypes = resourceTypes;
    }
  } else if (jsonData.resourceType === 'TerminologyCapabilities') {
    stats.detectedTypes.push('TerminologyCapabilities');
    stats.url = jsonData.url;
    stats.version = jsonData.version;
    stats.name = jsonData.name || jsonData.title;
    
    if (jsonData.codeSystem) {
      stats.totalSystems = jsonData.codeSystem.length;
      stats.systems = jsonData.codeSystem.map(cs => cs.uri);
    }
  } else if (jsonData.systems) {
    // Format spécifique des systèmes de terminologie ANS
    stats.detectedTypes.push('ANS-Systems');
    stats.totalSystems = Object.keys(jsonData.systems).length;
    stats.systems = Object.keys(jsonData.systems);
    
    // Récupérer quelques systèmes clés
    stats.keyElements = Object.entries(jsonData.systems)
      .slice(0, 5)
      .map(([key, value]) => ({
        key,
        url: typeof value === 'object' ? value.url : value
      }));
  } else if (jsonData.identifier_systems) {
    // Format spécifique des OIDs ANS
    stats.detectedTypes.push('ANS-OIDs');
    stats.totalSystems = Object.keys(jsonData.identifier_systems).length;
    stats.systems = Object.keys(jsonData.identifier_systems);
    
    // Récupérer quelques OIDs clés
    stats.keyElements = Object.entries(jsonData.identifier_systems)
      .slice(0, 5)
      .map(([key, value]) => ({
        key,
        oid: value
      }));
  } else if (jsonData.codeSystemMap) {
    // Format spécifique des codes communs ANS
    stats.detectedTypes.push('ANS-CommonCodes');
    stats.totalSystems = Object.keys(jsonData.codeSystemMap).length;
    stats.systems = Object.keys(jsonData.codeSystemMap);
    
    let totalCodes = 0;
    Object.values(jsonData.codeSystemMap).forEach(system => {
      if (typeof system === 'object') {
        totalCodes += Object.keys(system).length;
      }
    });
    stats.totalElements = totalCodes;
  }
  
  return stats;
}

/**
 * @swagger
 * /api/terminology/analyze:
 *   post:
 *     summary: Analyser tous les fichiers de terminologie
 *     description: Analyse le contenu de tous les fichiers de terminologie pour fournir des statistiques détaillées
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Analyse terminée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/analyze', adminAuthMiddleware, async (req, res) => {
  try {
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json'));
    
    // Résultats d'analyse
    const results = {
      filesAnalyzed: files.length,
      totalItems: 0,
      systemsFound: 0,
      oidsFound: 0,
      codeSystemsCount: 0,
      valueSetsCount: 0,
      conceptMapCount: 0,
      fileTypes: {},
      details: [],
      possibleDuplicates: []
    };
    
    // Structure pour suivre les URL des systèmes pour détection des doublons
    const urlTracker = {
      codeSystems: {},
      valueSets: {},
      conceptMaps: {},
      oids: {}
    };
    
    // Analyser chaque fichier
    for (const filename of files) {
      const filePath = path.join(TERMINOLOGY_DIR, filename);
      const stats = fs.statSync(filePath);
      
      try {
        // Lire et analyser le contenu
        const content = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(content);
        
        // Détection spéciale pour les fichiers volumineux
        let fileAnalysis;
        let resourceCounts = { CodeSystem: 0, ValueSet: 0, ConceptMap: 0 };
        
        // Traitement spécial pour les fichiers volumineux
        if (stats.size > 200000) { // > 200KB
          // Essayer d'abord un comptage rapide avec regex pour les bundles
          if (content.includes('"resourceType":"Bundle"')) {
            const codeSystemMatches = content.match(/"resourceType"\s*:\s*"CodeSystem"/g);
            const valueSetMatches = content.match(/"resourceType"\s*:\s*"ValueSet"/g);
            const conceptMapMatches = content.match(/"resourceType"\s*:\s*"ConceptMap"/g);
            const oidMatches = content.match(/"oid"\s*:\s*"[^"]+"/g);
            
            resourceCounts.CodeSystem = codeSystemMatches ? codeSystemMatches.length : 0;
            resourceCounts.ValueSet = valueSetMatches ? valueSetMatches.length : 0;
            resourceCounts.ConceptMap = conceptMapMatches ? conceptMapMatches.length : 0;
            
            // Ajouter ces comptages au total
            results.codeSystemsCount += resourceCounts.CodeSystem;
            results.valueSetsCount += resourceCounts.ValueSet;
            results.conceptMapCount += resourceCounts.ConceptMap;
            results.oidsFound += oidMatches ? oidMatches.length : 0;
            
            // Utiliser quand même la fonction d'analyse complète
            fileAnalysis = analyzeTerminologyContent(jsonData);
            fileAnalysis.resourceTypes = fileAnalysis.resourceTypes || {};
            fileAnalysis.resourceTypes.CodeSystem = resourceCounts.CodeSystem;
            fileAnalysis.resourceTypes.ValueSet = resourceCounts.ValueSet;
            fileAnalysis.resourceTypes.ConceptMap = resourceCounts.ConceptMap;
          } else {
            // Analyse standard pour les autres types de fichiers
            fileAnalysis = analyzeTerminologyContent(jsonData);
          }
        } else {
          // Analyse standard pour les petits fichiers
          fileAnalysis = analyzeTerminologyContent(jsonData);
        }
        
        // Ajouter à l'analyse globale
        results.totalItems += fileAnalysis.totalElements || 0;
        
        // Détection selon le type de ressource
        if (jsonData.resourceType === 'CodeSystem') {
          results.codeSystemsCount++;
          results.systemsFound++;
          
          // Tracker pour les doublons
          if (jsonData.url) {
            if (urlTracker.codeSystems[jsonData.url]) {
              urlTracker.codeSystems[jsonData.url].push(filename);
            } else {
              urlTracker.codeSystems[jsonData.url] = [filename];
            }
          }
        } else if (jsonData.resourceType === 'ValueSet') {
          results.valueSetsCount++;
          results.systemsFound++;
          
          // Tracker pour les doublons
          if (jsonData.url) {
            if (urlTracker.valueSets[jsonData.url]) {
              urlTracker.valueSets[jsonData.url].push(filename);
            } else {
              urlTracker.valueSets[jsonData.url] = [filename];
            }
          }
        } else if (jsonData.resourceType === 'Bundle' && jsonData.entry) {
          // Pour les bundles, compter par type de ressource
          if (fileAnalysis.resourceTypes) {
            results.codeSystemsCount += fileAnalysis.resourceTypes.CodeSystem || 0;
            results.valueSetsCount += fileAnalysis.resourceTypes.ValueSet || 0;
            results.conceptMapCount += fileAnalysis.resourceTypes.ConceptMap || 0;
            results.systemsFound += (fileAnalysis.resourceTypes.CodeSystem || 0) + 
                                    (fileAnalysis.resourceTypes.ValueSet || 0);
                                    
            // Analyse plus détaillée pour détecter les doublons dans les bundles
            try {
              jsonData.entry.forEach(entry => {
                if (entry.resource && entry.resource.url) {
                  const resource = entry.resource;
                  if (resource.resourceType === 'CodeSystem') {
                    if (urlTracker.codeSystems[resource.url]) {
                      urlTracker.codeSystems[resource.url].push(`${filename}#${resource.id || resource.url}`);
                    } else {
                      urlTracker.codeSystems[resource.url] = [`${filename}#${resource.id || resource.url}`];
                    }
                  } else if (resource.resourceType === 'ValueSet') {
                    if (urlTracker.valueSets[resource.url]) {
                      urlTracker.valueSets[resource.url].push(`${filename}#${resource.id || resource.url}`);
                    } else {
                      urlTracker.valueSets[resource.url] = [`${filename}#${resource.id || resource.url}`];
                    }
                  }
                }
              });
            } catch (bundleAnalysisError) {
              console.error(`[TERMINOLOGY] Erreur lors de l'analyse détaillée du bundle ${filename}:`, bundleAnalysisError);
            }
          }
        } else if (jsonData.identifier_systems) {
          // Fichier spécifique d'OIDs
          const oidsCount = Object.keys(jsonData.identifier_systems).length;
          results.oidsFound += oidsCount;
          
          // Tracer les OIDs
          Object.entries(jsonData.identifier_systems).forEach(([name, data]) => {
            const oid = typeof data === 'object' ? data.oid : data;
            if (oid) {
              if (urlTracker.oids[oid]) {
                urlTracker.oids[oid].push(`${filename}#${name}`);
              } else {
                urlTracker.oids[oid] = [`${filename}#${name}`];
              }
            }
          });
        } else if (jsonData.systems) {
          // Fichier de systèmes ANS
          const systemsCount = Object.keys(jsonData.systems).length;
          results.systemsFound += systemsCount;
        }
        
        // Compter les types de fichiers
        const fileType = fileAnalysis.detectedTypes[0] || 'Unknown';
        results.fileTypes[fileType] = (results.fileTypes[fileType] || 0) + 1;
        
        // Ajouter aux détails
        results.details.push({
          filename,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          type: fileType,
          itemCount: fileAnalysis.totalElements || 0,
          systemsCount: fileAnalysis.totalSystems || 0,
          resourceCounts: resourceCounts.CodeSystem > 0 || resourceCounts.ValueSet > 0 ? resourceCounts : undefined
        });
      } catch (error) {
        console.error(`[TERMINOLOGY] Erreur lors de l'analyse du fichier ${filename}:`, error);
        
        // Ajouter quand même aux détails mais avec une erreur
        results.details.push({
          filename,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          error: error.message
        });
      }
    }
    
    // Détecter les doublons à partir des trackers
    const findDuplicates = (tracker, type) => {
      return Object.entries(tracker)
        .filter(([url, files]) => files.length > 1)
        .map(([url, files]) => ({
          type,
          url,
          files,
          count: files.length
        }));
    };
    
    // Chercher les doublons dans chaque catégorie
    const codeSystemDuplicates = findDuplicates(urlTracker.codeSystems, 'CodeSystem');
    const valueSetDuplicates = findDuplicates(urlTracker.valueSets, 'ValueSet');
    const oidDuplicates = findDuplicates(urlTracker.oids, 'OID');
    
    // Ajouter tous les doublons trouvés
    results.possibleDuplicates = [
      ...codeSystemDuplicates,
      ...valueSetDuplicates,
      ...oidDuplicates
    ];
    
    // Trier les doublons par nombre d'occurrences décroissant
    results.possibleDuplicates.sort((a, b) => b.count - a.count);
    
    // Limiter à 20 résultats pour éviter une réponse trop volumineuse
    if (results.possibleDuplicates.length > 20) {
      results.possibleDuplicates = results.possibleDuplicates.slice(0, 20);
    }
    
    // Total des systèmes (CodeSystems + ValueSets)
    results.systemsFound = Math.max(results.systemsFound, results.codeSystemsCount + results.valueSetsCount);
    
    console.log(`[TERMINOLOGY] Analyse de ${files.length} fichiers terminée. ${results.totalItems} éléments trouvés, ${results.systemsFound} systèmes et ${results.oidsFound} OIDs.`);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'analyse des fichiers de terminologie :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse des fichiers de terminologie',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/refresh:
 *   post:
 *     summary: Rafraîchir les statistiques de terminologie
 *     description: Recharge tous les fichiers de terminologie et met à jour les statistiques
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Rafraîchissement terminé avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/refresh', adminAuthMiddleware, async (req, res) => {
  try {
    console.log('[TERMINOLOGY] Démarrage du rafraîchissement des statistiques');
    
    // Récupérer les fichiers de terminologie
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json'));
    
    // Résultats du rafraîchissement
    const results = {
      filesRefreshed: files.length,
      systemsCount: 0,
      oidsCount: 0,
      codeSystemsCount: 0,
      valueSetsCount: 0
    };
    
    // Parcourir chaque fichier pour compter les éléments
    for (const filename of files) {
      const filePath = path.join(TERMINOLOGY_DIR, filename);
      
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileContent);
        
        // Analyser les types de contenu
        if (filename === 'ans_terminology_systems.json') {
          // Fichier de systèmes principal
          results.systemsCount += Object.keys(jsonData).length;
        } else if (filename === 'ans_oids.json' && jsonData.identifier_systems) {
          // Fichier d'OIDs
          results.oidsCount += Object.keys(jsonData.identifier_systems).length;
        } else if (jsonData.resourceType === 'CodeSystem') {
          // Fichier contenant un CodeSystem individuel
          results.codeSystemsCount++;
        } else if (jsonData.resourceType === 'ValueSet') {
          // Fichier contenant un ValueSet individuel
          results.valueSetsCount++;
        } else if (Array.isArray(jsonData)) {
          // Fichier contenant un tableau d'éléments
          for (const item of jsonData) {
            if (item.resourceType === 'CodeSystem') {
              results.codeSystemsCount++;
            } else if (item.resourceType === 'ValueSet') {
              results.valueSetsCount++;
            }
          }
        } else if (jsonData.entry && Array.isArray(jsonData.entry)) {
          // Fichier contenant un Bundle FHIR
          for (const entry of jsonData.entry) {
            if (entry.resource) {
              if (entry.resource.resourceType === 'CodeSystem') {
                results.codeSystemsCount++;
              } else if (entry.resource.resourceType === 'ValueSet') {
                results.valueSetsCount++;
              }
            }
          }
        }
      } catch (err) {
        console.error(`[TERMINOLOGY] Erreur lors de l'analyse du fichier ${filename}:`, err);
        // Continuer avec le fichier suivant
      }
    }
    
    const logMessage = `[TERMINOLOGY] Rafraîchissement terminé. ${results.systemsCount} systèmes, ${results.oidsCount} OIDs, ${results.codeSystemsCount} CodeSystems, ${results.valueSetsCount} ValueSets.`;
    console.log(logMessage);
    
    // Insertion du message dans la réponse pour l'affichage dans le journal des mises à jour
    res.json({
      success: true,
      data: {
        ...results,
        message: logMessage.replace('[TERMINOLOGY] ', '')
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors du rafraîchissement des terminologies :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rafraîchissement des terminologies',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/check-duplicates:
 *   get:
 *     summary: Vérifier les fichiers de terminologie en doublon
 *     description: Identifie les fichiers de terminologie qui contiennent des données similaires
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Vérification terminée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/check-duplicates', adminAuthMiddleware, async (req, res) => {
  try {
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const stats = fs.statSync(path.join(TERMINOLOGY_DIR, file));
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        };
      });
    
    // Résultats de l'analyse
    const results = {
      totalFiles: files.length,
      duplicates: {
        bySize: [],
        byName: [],
        byContent: [] 
      },
      urlDuplicates: {
        codeSystems: [],
        valueSets: [],
        oids: []
      },
      summary: {}
    };
    
    // 1. Regrouper les fichiers par taille similaire (taille à ±10%)
    const sizeGroups = {};
    files.forEach(file => {
      const sizeKey = Math.floor(file.size / 1000) * 1000; // Arrondir à 1KB près
      sizeGroups[sizeKey] = sizeGroups[sizeKey] || [];
      sizeGroups[sizeKey].push(file);
    });
    
    // Garder uniquement les groupes avec plus d'un fichier
    const potentialDuplicateGroups = Object.values(sizeGroups)
      .filter(group => group.length > 1);
    
    // Analyser les groupes
    for (const group of potentialDuplicateGroups) {
      if (group.length > 1) {
        results.duplicates.bySize.push({
          size: `${group[0].size} bytes`,
          count: group.length,
          files: group.map(f => f.name)
        });
      }
    }
    
    // 2. Grouper par noms similaires
    const nameGroups = {};
    
    files.forEach(file => {
      // Créer une clé de base de nom sans dates/nombres
      const baseNameKey = file.name
        .replace(/\d+/g, 'X')         // Remplacer tous les chiffres par X
        .replace(/response_/g, '')    // Supprimer le préfixe response_
        .replace(/ans_/g, '')         // Supprimer le préfixe ans_
        .replace(/[-_\.]/g, '')       // Ignorer les tirets, underscore et points
        .toLowerCase();
      
      nameGroups[baseNameKey] = nameGroups[baseNameKey] || [];
      nameGroups[baseNameKey].push(file);
    });
    
    // Garder les groupes avec plusieurs fichiers
    const duplicateNameGroups = Object.entries(nameGroups)
      .filter(([key, group]) => group.length > 1)
      .sort((a, b) => b[1].length - a[1].length); // Trier par nombre de fichiers décroissant
      
    duplicateNameGroups.forEach(([baseNameKey, nameGroup]) => {
      // Trier par date de dernière modification (du plus récent au plus ancien)
      nameGroup.sort((a, b) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
      
      results.duplicates.byName.push({
        basePattern: baseNameKey,
        count: nameGroup.length,
        newestFile: nameGroup[0].name,
        allFiles: nameGroup.map(f => ({ name: f.name, modified: f.lastModified }))
      });
    });
    
    // 3. Analyser le contenu des fichiers pour trouver des doublons par URL/OID
    const urlTracker = {
      codeSystems: {},
      valueSets: {},
      oids: {}
    };
    
    // Explorer chaque fichier pour extraire les URL et OIDs
    for (const file of files) {
      try {
        const filePath = path.join(TERMINOLOGY_DIR, file.name);
        const content = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(content);
        
        // Détection par type de fichier
        if (jsonData.resourceType === 'Bundle' && jsonData.entry) {
          // Pour les bundles, parcourir chaque entrée
          jsonData.entry.forEach(entry => {
            if (entry.resource) {
              const resource = entry.resource;
              if (resource.url) {
                if (resource.resourceType === 'CodeSystem') {
                  urlTracker.codeSystems[resource.url] = urlTracker.codeSystems[resource.url] || [];
                  urlTracker.codeSystems[resource.url].push(file.name);
                } else if (resource.resourceType === 'ValueSet') {
                  urlTracker.valueSets[resource.url] = urlTracker.valueSets[resource.url] || [];
                  urlTracker.valueSets[resource.url].push(file.name);
                }
              }
              
              // Chercher les OIDs dans la ressource
              if (resource.identifier) {
                resource.identifier.forEach(id => {
                  if (id.system === 'urn:ietf:rfc:3986' && id.value && id.value.startsWith('urn:oid:')) {
                    const oid = id.value.replace('urn:oid:', '');
                    urlTracker.oids[oid] = urlTracker.oids[oid] || [];
                    urlTracker.oids[oid].push(file.name);
                  }
                });
              }
            }
          });
        } else if (jsonData.resourceType === 'CodeSystem' && jsonData.url) {
          urlTracker.codeSystems[jsonData.url] = urlTracker.codeSystems[jsonData.url] || [];
          urlTracker.codeSystems[jsonData.url].push(file.name);
        } else if (jsonData.resourceType === 'ValueSet' && jsonData.url) {
          urlTracker.valueSets[jsonData.url] = urlTracker.valueSets[jsonData.url] || [];
          urlTracker.valueSets[jsonData.url].push(file.name);
        } else if (jsonData.identifier_systems) {
          // Fichier spécifique d'OIDs
          Object.entries(jsonData.identifier_systems).forEach(([name, data]) => {
            const oid = typeof data === 'object' ? data.oid : data;
            if (oid) {
              urlTracker.oids[oid] = urlTracker.oids[oid] || [];
              urlTracker.oids[oid].push(file.name);
            }
          });
        }
      } catch (error) {
        console.error(`[TERMINOLOGY] Erreur lors de l'analyse du fichier ${file.name} pour doublons:`, error.message);
      }
    }
    
    // Trouver les doublons dans les URL et OIDs
    const findUrlDuplicates = (tracker, type) => {
      return Object.entries(tracker)
        .filter(([url, fileList]) => fileList.length > 1)
        .map(([url, fileList]) => ({
          url,
          count: fileList.length,
          files: fileList
        }))
        .sort((a, b) => b.count - a.count);
    };
    
    results.urlDuplicates.codeSystems = findUrlDuplicates(urlTracker.codeSystems, 'CodeSystem');
    results.urlDuplicates.valueSets = findUrlDuplicates(urlTracker.valueSets, 'ValueSet');
    results.urlDuplicates.oids = findUrlDuplicates(urlTracker.oids, 'OID');
    
    // Préparer un résumé
    results.summary = {
      totalFiles: files.length,
      duplicatesBySize: results.duplicates.bySize.length,
      duplicatesByName: results.duplicates.byName.length,
      duplicateCodeSystems: results.urlDuplicates.codeSystems.length,
      duplicateValueSets: results.urlDuplicates.valueSets.length,
      duplicateOids: results.urlDuplicates.oids.length,
      totalDuplicates: results.duplicates.byName.reduce((sum, group) => sum + group.count - 1, 0)
    };
    
    // Limiter le nombre de résultats pour éviter les réponses trop volumineuses
    if (results.duplicates.bySize.length > 10) {
      results.duplicates.bySize = results.duplicates.bySize.slice(0, 10);
    }
    if (results.duplicates.byName.length > 10) {
      results.duplicates.byName = results.duplicates.byName.slice(0, 10);
    }
    if (results.urlDuplicates.codeSystems.length > 10) {
      results.urlDuplicates.codeSystems = results.urlDuplicates.codeSystems.slice(0, 10);
    }
    if (results.urlDuplicates.valueSets.length > 10) {
      results.urlDuplicates.valueSets = results.urlDuplicates.valueSets.slice(0, 10);
    }
    if (results.urlDuplicates.oids.length > 10) {
      results.urlDuplicates.oids = results.urlDuplicates.oids.slice(0, 10);
    }
    
    const logMessage = `[TERMINOLOGY] Vérification des doublons terminée. ${results.summary.totalDuplicates} doublons identifiés.`;
    console.log(logMessage);
    
    // Insertion du message dans la réponse pour l'affichage dans le journal des mises à jour
    res.json({
      success: true,
      data: {
        ...results,
        message: logMessage.replace('[TERMINOLOGY] ', '')
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de la vérification des doublons :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des doublons',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/remove-duplicates:
 *   post:
 *     summary: Supprimer les fichiers de terminologie en doublon
 *     description: Supprime automatiquement les fichiers de terminologie en doublon en gardant les plus récents
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Suppression terminée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/remove-duplicates', adminAuthMiddleware, async (req, res) => {
  try {
    // Réutiliser la logique de détection des doublons
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const stats = fs.statSync(path.join(TERMINOLOGY_DIR, file));
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        };
      });
    
    // Regrouper les fichiers par taille similaire (taille à ±10%)
    const sizeGroups = {};
    files.forEach(file => {
      const sizeKey = Math.floor(file.size / 1000) * 1000; // Arrondir à 1KB près
      sizeGroups[sizeKey] = sizeGroups[sizeKey] || [];
      sizeGroups[sizeKey].push(file);
    });
    
    // Garder uniquement les groupes avec plus d'un fichier
    const potentialDuplicateGroups = Object.values(sizeGroups)
      .filter(group => group.length > 1);
    
    // Fichiers à supprimer
    const filesToDelete = [];
    
    for (const group of potentialDuplicateGroups) {
      // Grouper par noms similaires
      const nameGroups = {};
      
      group.forEach(file => {
        // Créer une clé de base de nom sans dates/nombres
        const baseNameKey = file.name
          .replace(/\d+/g, 'X')
          .replace(/[-_\.]/g, '')
          .toLowerCase();
        
        nameGroups[baseNameKey] = nameGroups[baseNameKey] || [];
        nameGroups[baseNameKey].push(file);
      });
      
      // Garder les groupes avec plusieurs fichiers
      const duplicateNameGroups = Object.values(nameGroups)
        .filter(nameGroup => nameGroup.length > 1);
      
      for (const nameGroup of duplicateNameGroups) {
        // Trier par date de dernière modification (du plus récent au plus ancien)
        nameGroup.sort((a, b) => 
          new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
        );
        
        // Conserver le fichier le plus récent, supprimer les autres
        const [newest, ...others] = nameGroup;
        filesToDelete.push(...others);
      }
    }
    
    // Vérifier et ne pas supprimer les fichiers système essentiels
    const systemFiles = ['ans_oids.json', 'ans_common_codes.json', 'ans_terminology_systems.json'];
    const safeFilesToDelete = filesToDelete.filter(file => !systemFiles.includes(file.name));
    
    // Effectuer la suppression
    let deletedCount = 0;
    for (const file of safeFilesToDelete) {
      const filePath = path.join(TERMINOLOGY_DIR, file.name);
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`[TERMINOLOGY] Fichier en doublon supprimé: ${file.name}`);
    }
    
    const logMessage = `[TERMINOLOGY] ${deletedCount} fichiers en doublon supprimés sur ${safeFilesToDelete.length} identifiés.`;
    console.log(logMessage);
    
    res.json({
      success: true,
      data: {
        duplicatesFound: safeFilesToDelete.length,
        deleted: deletedCount,
        message: logMessage.replace('[TERMINOLOGY] ', '')
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de la suppression des doublons :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des doublons',
      error: error.message
    });
  }
});

module.exports = router;