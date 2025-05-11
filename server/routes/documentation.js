/**
 * Routes pour la documentation technique de FHIRHub
 * @module routes/documentation
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const marked = require('marked');

// Configurer marked pour la syntaxe markdown
marked.setOptions({
  renderer: new marked.Renderer(),
  highlight: function(code, lang) {
    return code;
  },
  pedantic: false,
  gfm: true,
  breaks: true,
  sanitize: false,
  smartLists: true,
  smartypants: false,
  xhtml: false
});

/**
 * Convertit un document Markdown en HTML
 * @param {string} markdownContent - Contenu Markdown à convertir
 * @returns {string} Contenu HTML
 */
function renderMarkdown(markdownContent) {
  return marked.parse(markdownContent);
}

/**
 * Menu de navigation standardisé
 * @returns {string} HTML du menu de navigation
 */
function getNavMenu() {
  return `
  <ul class="nav-menu">
    <li><a href="/dashboard.html"><i class="fas fa-chart-line"></i> Tableau de bord</a></li>
    <li><a href="/convert.html"><i class="fas fa-exchange-alt"></i> Conversion</a></li>
    <li><a href="/applications.html"><i class="fas fa-th"></i> Applications</a></li>
    <li><a href="/api-keys.html"><i class="fas fa-key"></i> Clés API</a></li>
    <li><a href="/users.html"><i class="fas fa-users"></i> Utilisateurs</a></li>
    <li><a href="/terminologies.html"><i class="fas fa-book-medical"></i> Terminologies</a></li>
    <li><a href="/workflows.html"><i class="fas fa-project-diagram"></i> Workflows</a></li>
    <li><a href="/ai-settings.html"><i class="fas fa-robot"></i> Paramètres IA</a></li>
    <li><a href="/documentation.html"><i class="fas fa-file-alt"></i> Documentation</a></li>
    <li><a href="/api-docs/"><i class="fas fa-code"></i> API</a></li>
    <li><a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Déconnexion</a></li>
  </ul>
  `;
}

/**
 * CSS commun pour les pages de documentation
 * @returns {string} CSS pour les pages de documentation
 */
function getDocumentationCSS() {
  return `
  <style>
    .markdown-content {
      margin: 20px 0;
      padding: 20px;
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      line-height: 1.6;
    }
    
    .markdown-content h1 {
      color: #e74c3c;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #eee;
    }
    
    .markdown-content h2 {
      margin-top: 30px;
      color: #333;
      padding-bottom: 5px;
      border-bottom: 1px solid #eee;
    }
    
    .markdown-content h3 {
      margin-top: 25px;
      color: #444;
    }
    
    .markdown-content code {
      background-color: #f8f9fa;
      padding: 2px 5px;
      border-radius: 3px;
      font-family: monospace;
      color: #e74c3c;
    }
    
    .markdown-content pre {
      background-color: #272822;
      color: #f8f8f2;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 15px 0;
    }
    
    .markdown-content pre code {
      color: #f8f8f2;
      background-color: transparent;
      padding: 0;
    }
    
    .markdown-content ul, .markdown-content ol {
      padding-left: 25px;
      margin: 15px 0;
    }
    
    .markdown-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    
    .markdown-content th, .markdown-content td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    
    .markdown-content th {
      background-color: #f1f1f1;
    }
    
    .markdown-content tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    .breadcrumbs {
      margin-bottom: 20px;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    
    .breadcrumbs a {
      color: #e74c3c;
      text-decoration: none;
    }
    
    .breadcrumbs a:hover {
      text-decoration: underline;
    }
    
    .back-link {
      display: inline-block;
      margin-top: 20px;
      color: #e74c3c;
      text-decoration: none;
      font-weight: 500;
    }
    
    .back-link:hover {
      text-decoration: underline;
    }
  </style>
  `;
}

/**
 * Script de déconnexion
 * @returns {string} JavaScript pour la déconnexion
 */
function getLogoutScript() {
  return `
  <script>
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
      e.preventDefault();
      fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin'
      })
      .then(response => {
        if (response.ok) {
          window.location.href = '/login.html';
        }
      });
    });
  </script>
  `;
}

/**
 * Affiche un fichier markdown depuis le dossier docs
 */
router.get('/message_types/:type', (req, res) => {
  const messageType = req.params.type;
  const filePath = path.join(__dirname, '../../docs/message_types', messageType, 'README.md');
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Erreur lors de la lecture du fichier ${filePath}:`, err);
      return res.status(404).send('Documentation non trouvée');
    }
    
    const htmlContent = renderMarkdown(data);
    
    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Documentation ${messageType} - FHIRHub</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/css/styles.css">
        ${getDocumentationCSS()}
      </head>
      <body>
        <header class="header">
          <div class="container">
            <div class="logo">
              <img src="/img/flame-icon-white.svg" alt="FHIRHub Logo">
              <span>FHIRHub</span>
            </div>
            ${getNavMenu()}
          </div>
        </header>
      
        <div class="main-content">
          <div class="container">
            <div class="breadcrumbs">
              <a href="/documentation.html">Documentation</a> &gt; 
              <a href="/documentation.html#message-types">Types de messages</a> &gt; 
              ${messageType}
            </div>
            
            <div class="markdown-content">
              ${htmlContent}
            </div>
            
            <a href="/documentation.html#message-types" class="back-link">
              <i class="fas fa-arrow-left"></i> Retour à la documentation
            </a>
          </div>
        </div>
        ${getLogoutScript()}
      </body>
      </html>
    `);
  });
});

/**
 * Affiche un fichier markdown spécifique du dossier docs
 */
router.get('/message_types/:type/:doc', (req, res) => {
  const messageType = req.params.type;
  const docFile = req.params.doc;
  const filePath = path.join(__dirname, '../../docs/message_types', messageType, `${docFile}.md`);
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Erreur lors de la lecture du fichier ${filePath}:`, err);
      return res.status(404).send('Documentation non trouvée');
    }
    
    const htmlContent = renderMarkdown(data);
    
    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Documentation ${messageType}/${docFile} - FHIRHub</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/css/styles.css">
        ${getDocumentationCSS()}
      </head>
      <body>
        <header class="header">
          <div class="container">
            <div class="logo">
              <img src="/img/flame-icon-white.svg" alt="FHIRHub Logo">
              <span>FHIRHub</span>
            </div>
            ${getNavMenu()}
          </div>
        </header>
      
        <div class="main-content">
          <div class="container">
            <div class="breadcrumbs">
              <a href="/documentation.html">Documentation</a> &gt; 
              <a href="/documentation.html#message-types">Types de messages</a> &gt; 
              <a href="/docs/message_types/${messageType}">${messageType}</a> &gt;
              ${docFile}
            </div>
            
            <div class="markdown-content">
              ${htmlContent}
            </div>
            
            <a href="/docs/message_types/${messageType}" class="back-link">
              <i class="fas fa-arrow-left"></i> Retour à la documentation ${messageType}
            </a>
          </div>
        </div>
        ${getLogoutScript()}
      </body>
      </html>
    `);
  });
});

/**
 * Affiche un fichier markdown général (pas spécifique à un type de message)
 */
router.get('/:doc', (req, res) => {
  const docFile = req.params.doc;
  const filePath = path.join(__dirname, '../../docs', `${docFile}.md`);
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Erreur lors de la lecture du fichier ${filePath}:`, err);
      return res.status(404).send('Documentation non trouvée');
    }
    
    const htmlContent = renderMarkdown(data);
    const docTitle = data.split('\n')[0].replace(/^#\s+/, '');
    
    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${docTitle} - FHIRHub</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/css/styles.css">
        ${getDocumentationCSS()}
      </head>
      <body>
        <header class="header">
          <div class="container">
            <div class="logo">
              <img src="/img/flame-icon-white.svg" alt="FHIRHub Logo">
              <span>FHIRHub</span>
            </div>
            ${getNavMenu()}
          </div>
        </header>
      
        <div class="main-content">
          <div class="container">
            <div class="breadcrumbs">
              <a href="/documentation.html">Documentation</a> &gt; 
              ${docTitle}
            </div>
            
            <div class="markdown-content">
              ${htmlContent}
            </div>
            
            <a href="/documentation.html" class="back-link">
              <i class="fas fa-arrow-left"></i> Retour à la documentation
            </a>
          </div>
        </div>
        ${getLogoutScript()}
      </body>
      </html>
    `);
  });
});

module.exports = router;