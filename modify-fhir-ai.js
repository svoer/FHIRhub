/**
 * Script de mise à jour du fichier routes/fhir-ai.js pour utiliser aiService au lieu de mistralClient
 */

const fs = require('fs');
const path = require('path');

// Chemin du fichier à modifier
const filePath = path.join(__dirname, 'routes/fhir-ai.js');

// Lire le contenu du fichier
let content = fs.readFileSync(filePath, 'utf8');

// Remplacer les vérifications de disponibilité
content = content.replace(
  /\/\/ Vérification de la disponibilité de l'API Mistral\s+if \(!mistralClient\) {\s+return res\.status\(503\)\.json\({\s+success: false,\s+message: 'API Mistral non configurée\. Veuillez définir la variable d\\'environnement MISTRAL_API_KEY'\s+}\);\s+}/g,
  `// Vérification de la disponibilité d'un fournisseur d'IA
    if (!(await aiService.isAvailable())) {
      return res.status(503).json({
        success: false,
        message: 'Aucun fournisseur d\\'IA n\\'est configuré ou actif. Veuillez configurer un fournisseur d\\'IA dans les paramètres.'
      });
    }`
);

// Remplacer les appels à mistralClient.chat
content = content.replace(
  /const summaryResponse = await mistralClient\.chat\(\{\s+model: model,\s+messages: \[\s+{ role: 'user', content: summaryPrompt }\s+\],\s+temperature: 0\.3,\s+max_tokens: 2000\s+}\);/g,
  `const summaryResponse = await aiService.generateResponse({
        prompt: summaryPrompt,
        maxTokens: 2000,
        temperature: 0.3
      });`
);

content = content.replace(
  /const analysisResponse = await mistralClient\.chat\(\{\s+model: model,\s+messages: \[\s+{ role: 'user', content: analysisPrompt }\s+\],\s+temperature: 0\.3,\s+max_tokens: 1000\s+}\);/g,
  `const analysisResponse = await aiService.generateResponse({
        prompt: analysisPrompt,
        maxTokens: 1000,
        temperature: 0.3
      });`
);

content = content.replace(
  /const trendsResponse = await mistralClient\.chat\(\{\s+model: model,\s+messages: \[\s+{ role: 'user', content: trendsPrompt }\s+\],\s+temperature: 0\.3,\s+max_tokens: 1000\s+}\);/g,
  `const trendsResponse = await aiService.generateResponse({
        prompt: trendsPrompt,
        maxTokens: 1000,
        temperature: 0.3
      });`
);

// Adapter les références au résultat
content = content.replace(/summaryResponse\.choices\[0\]\.message\.content/g, 'summaryResponse');
content = content.replace(/analysisResponse\.choices\[0\]\.message\.content/g, 'analysisResponse');
content = content.replace(/trendsResponse\.choices\[0\]\.message\.content/g, 'trendsResponse');

// Écrire le contenu mis à jour dans le fichier
fs.writeFileSync(filePath, content, 'utf8');

console.log('Le fichier routes/fhir-ai.js a été mis à jour avec succès pour utiliser aiService.');