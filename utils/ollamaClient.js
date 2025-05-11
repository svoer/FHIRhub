/**
 * Module client pour interagir avec l'API Ollama
 * Fournit une intégration avec les modèles LLM locaux via Ollama
 */

const axios = require('axios');
const logger = require('./logger');

// Configuration par défaut
const DEFAULT_ENDPOINT = 'http://localhost:11434';
const API_ENDPOINT = process.env.OLLAMA_API_ENDPOINT || DEFAULT_ENDPOINT;

class OllamaClient {
  constructor(endpoint = API_ENDPOINT) {
    this.endpoint = endpoint;
    logger.info(`Client Ollama initialisé avec point de terminaison: ${this.endpoint}`);
  }

  /**
   * Vérifie si le serveur Ollama est disponible
   * @returns {Promise<boolean>} true si le serveur est disponible, false sinon
   */
  async isAvailable() {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.error(`Erreur lors de la vérification du statut d'Ollama: ${error.message}`);
      return false;
    }
  }

  /**
   * Récupère la liste des modèles disponibles sur le serveur Ollama
   * @returns {Promise<Array>} Liste des modèles avec leurs détails
   */
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`, {
        timeout: 5000
      });

      if (response.status === 200 && response.data && response.data.models) {
        return response.data.models.map(model => ({
          id: model.name,
          name: model.name,
          size: model.size,
          modified_at: model.modified_at
        }));
      }
      
      return [];
    } catch (error) {
      logger.error(`Erreur lors de la récupération des modèles Ollama: ${error.message}`);
      return [];
    }
  }

  /**
   * Récupère un modèle spécifique par son ID
   * @param {string} modelId L'identifiant du modèle
   * @returns {Promise<Object|null>} Les détails du modèle ou null si non trouvé
   */
  async getModel(modelId) {
    try {
      const models = await this.getAvailableModels();
      return models.find(model => model.id === modelId) || null;
    } catch (error) {
      logger.error(`Erreur lors de la récupération du modèle ${modelId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Convertit les messages au format OpenAI vers le format Ollama
   * @param {Array} messages Messages au format OpenAI
   * @returns {Object} Messages au format Ollama
   */
  _formatMessagesForOllama(messages) {
    // Ollama utilise un format similaire au format ChatML utilisé par OpenAI
    return messages;
  }

  /**
   * Génère un texte à partir d'un prompt simple
   * @param {string} prompt Le texte du prompt
   * @param {string} [model='llama3'] Le modèle à utiliser
   * @returns {Promise<string>} Le texte généré
   */
  async generateText(prompt, model = 'llama3') {
    const messages = [
      { role: 'user', content: prompt }
    ];
    
    try {
      const result = await this.generateCompletion({
        messages,
        model,
        temperature: 0.3,
        maxTokens: 1500
      });
      
      return result.content;
    } catch (error) {
      logger.error(`Erreur lors de la génération de texte: ${error.message}`);
      return "Désolé, je n'ai pas pu générer de réponse.";
    }
  }

  /**
   * Génère un texte à partir d'une requête Ollama
   * @param {Object} options Options de génération
   * @param {Array} options.messages Messages au format OpenAI
   * @param {string} options.model Le modèle à utiliser
   * @param {number} options.temperature La température (créativité)
   * @param {number} options.maxTokens Nombre maximal de tokens à générer
   * @returns {Promise<Object>} La complétion générée
   */
  async generateCompletion(options) {
    const { messages, model = 'llama3', temperature = 0.5, maxTokens = 500 } = options;
    
    try {
      const formattedMessages = this._formatMessagesForOllama(messages);

      const response = await axios.post(`${this.endpoint}/api/chat`, {
        model: model,
        messages: formattedMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: false
      }, {
        timeout: 60000  // Délai de 60 secondes pour les modèles lents
      });

      if (response.status === 200 && response.data) {
        return {
          id: `ollama-${Date.now()}`,
          model: model,
          content: response.data.message.content,
          created: Math.floor(Date.now() / 1000)
        };
      } else {
        throw new Error('Réponse invalide du serveur Ollama');
      }
    } catch (error) {
      logger.error(`Erreur lors de la génération de texte via Ollama: ${error.message}`);
      throw new Error(`Échec de la génération via Ollama: ${error.message}`);
    }
  }

  /**
   * Génère un texte à partir d'une requête Ollama en mode streaming
   * @param {Object} options Options de génération
   * @param {Array} options.messages Messages au format OpenAI
   * @param {string} options.model Le modèle à utiliser
   * @param {number} options.temperature La température (créativité)
   * @param {number} options.maxTokens Nombre maximal de tokens à générer
   * @param {function} options.onToken Callback appelé pour chaque token
   * @param {function} options.onComplete Callback appelé lorsque la génération est terminée
   * @returns {Promise<void>}
   */
  async generateCompletionStream(options) {
    const { 
      messages, 
      model = 'llama3', 
      temperature = 0.5, 
      maxTokens = 500,
      onToken = () => {},
      onComplete = () => {}
    } = options;
    
    try {
      const formattedMessages = this._formatMessagesForOllama(messages);

      const response = await axios.post(`${this.endpoint}/api/chat`, {
        model: model,
        messages: formattedMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: true
      }, {
        timeout: 60000,
        responseType: 'stream'
      });

      let fullResponse = '';
      
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              const data = JSON.parse(line);
              
              if (data.message && typeof data.message.content === 'string') {
                fullResponse += data.message.content;
                onToken(data.message.content);
              }
            }
          } catch (e) {
            logger.warn(`Erreur lors du traitement d'un chunk streaming: ${e.message}`);
          }
        });

        response.data.on('end', () => {
          const result = {
            id: `ollama-${Date.now()}`,
            model: model,
            content: fullResponse,
            created: Math.floor(Date.now() / 1000)
          };
          
          onComplete(result);
          resolve(result);
        });

        response.data.on('error', (err) => {
          logger.error(`Erreur de streaming Ollama: ${err.message}`);
          reject(err);
        });
      });
    } catch (error) {
      logger.error(`Erreur lors de la génération en streaming via Ollama: ${error.message}`);
      throw new Error(`Échec de la génération en streaming via Ollama: ${error.message}`);
    }
  }

  /**
   * Exécute une analyse FHIR en utilisant Ollama
   * @param {Object} options Options d'analyse
   * @param {Object} options.resource Ressource FHIR à analyser
   * @param {string} options.prompt Instructions pour l'analyse
   * @param {string} options.model Modèle à utiliser
   * @returns {Promise<Object>} Résultat de l'analyse
   */
  async analyzeFhirResource(options) {
    const { resource, prompt, model = 'llama3' } = options;
    
    if (!resource || !prompt) {
      throw new Error('Resource FHIR et prompt requis pour l\'analyse');
    }

    const resourceStr = JSON.stringify(resource, null, 2);
    const messages = [
      { role: 'system', content: 'Vous êtes un assistant médical spécialisé dans l\'analyse des données FHIR. Analysez les ressources FHIR de manière factuelle et précise.' },
      { role: 'user', content: `${prompt}\nAnalysez la ressource FHIR suivante:\n\n${resourceStr}\n\nConcentrez-vous sur les informations médicales pertinentes et restez factuel.` }
    ];

    try {
      return await this.generateCompletion({
        messages,
        model,
        temperature: 0.2, // Température basse pour des réponses factuelles
        maxTokens: 1000
      });
    } catch (error) {
      logger.error(`Erreur lors de l'analyse FHIR via Ollama: ${error.message}`);
      throw new Error(`Échec de l'analyse FHIR: ${error.message}`);
    }
  }
  
  /**
   * Récupère la liste des modèles disponibles sur le serveur Ollama
   * @returns {Promise<Array>} Liste des modèles disponibles
   */
  async listModels() {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`, {
        timeout: 10000
      });
      
      if (response.status === 200 && response.data && response.data.models) {
        // Transforme le format Ollama en un format standardisé
        return response.data.models.map(model => ({
          id: model.name,
          name: model.name,
          created: Math.floor(Date.now() / 1000),
          description: `Modèle Ollama: ${model.name}`,
          usage_type: 'chat',
          provider: 'ollama',
          context_length: model.parameter_size || 4096,
          size: model.size || 'N/A'
        }));
      } else {
        logger.warn('Format de réponse inattendu de l\'API Ollama pour les modèles');
        return [];
      }
    } catch (error) {
      logger.error(`Erreur lors de la récupération des modèles Ollama: ${error.message}`);
      return []; // Retourner une liste vide en cas d'erreur
    }
  }
}

// Exporter une instance unique du client
module.exports = new OllamaClient();