/**
 * Service d'IA optimisé avec gestion robuste des erreurs et fallbacks
 * Version corrigée pour éviter les timeouts et gérer les limites d'API
 * @module utils/aiServiceOptimized
 */

const { getActiveAIProvider, getAIProviderByName, getAllAIProviders } = require('./aiProviderService');
const mistralClient = require('./mistralClient');
const ollamaClient = require('./ollamaClient');

/**
 * Gestion intelligente des fournisseurs IA avec fallbacks
 */
class OptimizedAIService {
    constructor() {
        this.lastSuccessfulProvider = null;
        this.providerFailures = new Map(); // Compteur d'échecs par fournisseur
        this.rateLimitBackoff = new Map(); // Backoff pour rate limiting
    }

    /**
     * Valide et sanitise les paramètres d'entrée
     */
    validateInputs({ prompt, maxTokens = 1000, temperature = 0.7, retryCount = 2 }) {
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            throw new Error('Le prompt est requis et doit être une chaîne non vide');
        }
        
        // Limites strictes pour éviter les abus
        if (prompt.length > 30000) { // Réduit de 50k à 30k
            throw new Error('Le prompt dépasse la limite de 30 000 caractères');
        }
        
        // Limites optimisées
        maxTokens = Math.min(maxTokens, 3000); // Réduit de 4k à 3k
        temperature = Math.max(0, Math.min(1.5, temperature)); // Plage réduite
        retryCount = Math.min(retryCount, 3); // Maximum 3 tentatives
        
        return { prompt, maxTokens, temperature, retryCount };
    }

    /**
     * Vérifie si un fournisseur est en backoff (suite à rate limiting)
     */
    isProviderInBackoff(providerType) {
        const backoffUntil = this.rateLimitBackoff.get(providerType);
        if (backoffUntil && Date.now() < backoffUntil) {
            const remainingSeconds = Math.ceil((backoffUntil - Date.now()) / 1000);
            console.log(`[AI-OPT] Fournisseur ${providerType} en backoff pour ${remainingSeconds}s`);
            return true;
        }
        return false;
    }

    /**
     * Marque un fournisseur comme en backoff suite à un rate limit
     */
    setProviderBackoff(providerType, durationMs = 60000) {
        const backoffUntil = Date.now() + durationMs;
        this.rateLimitBackoff.set(providerType, backoffUntil);
        console.log(`[AI-OPT] Fournisseur ${providerType} mis en backoff pour ${durationMs/1000}s`);
    }

    /**
     * Incrémente le compteur d'échecs pour un fournisseur
     */
    recordProviderFailure(providerType) {
        const failures = (this.providerFailures.get(providerType) || 0) + 1;
        this.providerFailures.set(providerType, failures);
        console.log(`[AI-OPT] Fournisseur ${providerType} - échecs: ${failures}`);
        return failures;
    }

    /**
     * Obtient la liste des fournisseurs disponibles dans l'ordre de préférence
     */
    async getAvailableProviders() {
        try {
            // Essayer d'abord le fournisseur actif
            const activeProvider = await getActiveAIProvider();
            if (activeProvider) {
                console.log(`[AI-OPT] Fournisseur actif trouvé: ${activeProvider.provider_type}`);
                return [activeProvider];
            }
            
            // Fallback vers tous les fournisseurs
            const allProviders = await getAllAIProviders();
            const activeProviders = allProviders.filter(p => p.is_active);
            
            // Trier par préférence et fiabilité
            return activeProviders.sort((a, b) => {
                // Priorité au dernier fournisseur qui a réussi
                if (this.lastSuccessfulProvider) {
                    if (a.provider_type === this.lastSuccessfulProvider) return -1;
                    if (b.provider_type === this.lastSuccessfulProvider) return 1;
                }
                
                // Éviter les fournisseurs avec trop d'échecs
                const aFailures = this.providerFailures.get(a.provider_type) || 0;
                const bFailures = this.providerFailures.get(b.provider_type) || 0;
                
                if (aFailures !== bFailures) {
                    return aFailures - bFailures;
                }
                
                // Préférence par défaut : Ollama (local) > Mistral > OpenAI > Anthropic
                const preferenceOrder = { ollama: 0, mistral: 1, openai: 2, anthropic: 3 };
                return (preferenceOrder[a.provider_type] || 99) - (preferenceOrder[b.provider_type] || 99);
            });
        } catch (error) {
            console.error('[AI-OPT] Erreur lors de la récupération des fournisseurs:', error);
            return [];
        }
    }

    /**
     * Tente d'utiliser un fournisseur spécifique avec gestion d'erreurs
     */
    async tryProvider(provider, prompt, maxTokens, temperature) {
        const providerType = provider.provider_type;
        
        // Vérifier le backoff
        if (this.isProviderInBackoff(providerType)) {
            throw new Error(`Fournisseur ${providerType} temporairement indisponible (rate limit)`);
        }
        
        console.log(`[AI-OPT] Tentative avec fournisseur: ${providerType} (${provider.model_name})`);
        
        try {
            let response;
            const startTime = Date.now();
            
            switch (providerType) {
                case 'mistral':
                    console.log(`[AI-OPT] Appel Mistral avec modèle: ${provider.model_name}`);
                    if (!mistralClient) {
                        throw new Error('Client Mistral non disponible');
                    }
                    console.log(`[AI-OPT] Méthodes disponibles:`, Object.keys(mistralClient));
                    response = await mistralClient.generateResponse(prompt, {
                        model: provider.model_name,
                        maxTokens,
                        temperature,
                        retryCount: 2
                    });
                    break;
                    
                case 'ollama':
                    console.log(`[AI-OPT] Appel Ollama avec modèle: ${provider.model_name}`);
                    if (!ollamaClient || !ollamaClient.generateText) {
                        throw new Error('Client Ollama non disponible ou mal configuré');
                    }
                    response = await ollamaClient.generateText(prompt, {
                        model: provider.model_name,
                        maxTokens,
                        temperature,
                        timeout: 60000 // Ollama peut être plus lent (local)
                    });
                    break;
                    
                case 'openai':
                    // Implémentation OpenAI avec timeout réduit
                    response = await this.callOpenAI(provider, prompt, maxTokens, temperature);
                    break;
                    
                case 'anthropic':
                    // Implémentation Anthropic avec timeout réduit  
                    response = await this.callAnthropic(provider, prompt, maxTokens, temperature);
                    break;
                    
                default:
                    throw new Error(`Type de fournisseur non supporté: ${providerType}`);
            }
            
            const duration = Date.now() - startTime;
            console.log(`[AI-OPT] Succès avec ${providerType} en ${duration}ms`);
            
            // Marquer comme dernier fournisseur réussi
            this.lastSuccessfulProvider = providerType;
            
            // Réinitialiser le compteur d'échecs en cas de succès
            this.providerFailures.delete(providerType);
            
            return response;
            
        } catch (error) {
            console.error(`[AI-OPT] Erreur avec fournisseur ${providerType}:`, error.message);
            
            // Gestion spécifique des erreurs de rate limiting
            if (error.message.includes('429') || 
                error.message.includes('rate limit') || 
                error.message.includes('capacity exceeded')) {
                console.log(`[AI-OPT] Rate limit détecté pour ${providerType}`);
                this.setProviderBackoff(providerType, 120000); // 2 minutes de backoff
            }
            
            // Enregistrer l'échec
            this.recordProviderFailure(providerType);
            
            throw error;
        }
    }

    /**
     * Appel OpenAI avec gestion d'erreurs optimisée
     */
    async callOpenAI(provider, prompt, maxTokens, temperature) {
        // Implémentation simplifiée - à compléter selon vos besoins
        throw new Error('OpenAI non encore implémenté dans la version optimisée');
    }

    /**
     * Appel Anthropic avec gestion d'erreurs optimisée
     */
    async callAnthropic(provider, prompt, maxTokens, temperature) {
        // Implémentation simplifiée - à compléter selon vos besoins
        throw new Error('Anthropic non encore implémenté dans la version optimisée');
    }

    /**
     * Méthode principale avec fallbacks intelligents
     */
    async generateResponse({ prompt, systemPrompt = '', maxTokens = 1000, temperature = 0.7, retryCount = 2, providerName = null }) {
        const validated = this.validateInputs({ prompt, maxTokens, temperature, retryCount });
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${validated.prompt}` : validated.prompt;
        
        console.log(`[AI-OPT] Génération de réponse - tokens: ${validated.maxTokens}, temp: ${validated.temperature}`);
        
        let providers;
        
        if (providerName) {
            // Utiliser un fournisseur spécifique
            try {
                const specificProvider = await getAIProviderByName(providerName);
                if (!specificProvider) {
                    throw new Error(`Fournisseur spécifié introuvable: ${providerName}`);
                }
                providers = [specificProvider];
            } catch (error) {
                console.error(`[AI-OPT] Erreur fournisseur spécifique ${providerName}:`, error.message);
                throw error;
            }
        } else {
            // Utiliser tous les fournisseurs disponibles
            providers = await this.getAvailableProviders();
            console.log(`[AI-OPT] Providers récupérés:`, providers.length);
        }
        
        if (providers.length === 0) {
            throw new Error('Aucun fournisseur d\'IA disponible');
        }
        
        console.log(`[AI-OPT] ${providers.length} fournisseur(s) disponible(s):`, 
                   providers.map(p => `${p.provider_type}(${p.model_name})`).join(', '));
        
        let lastError = null;
        
        // Essayer chaque fournisseur dans l'ordre de préférence
        for (const provider of providers) {
            try {
                console.log(`[AI-OPT] Tentative avec fournisseur: ${provider.provider_type}`);
                
                // Vérifier d'abord si le fournisseur a une clé API valide
                if (!provider.api_key || provider.api_key.trim() === '') {
                    console.warn(`[AI-OPT] Fournisseur ${provider.provider_type} sans clé API - ignoré`);
                    continue;
                }
                
                const response = await this.tryProvider(
                    provider, 
                    fullPrompt, 
                    validated.maxTokens, 
                    validated.temperature
                );
                
                if (response && response.trim().length > 0) {
                    console.log(`[AI-OPT] Réponse générée avec succès (${response.length} caractères)`);
                    return response;
                }
                
            } catch (error) {
                lastError = error;
                console.warn(`[AI-OPT] Échec avec ${provider.provider_type}: ${error.message}`);
                
                // Si c'est une erreur d'authentification, marquer le fournisseur comme défaillant
                if (error.message.includes('401') || error.message.includes('unauthorized') || error.message.includes('api_key')) {
                    console.error(`[AI-OPT] Erreur d'authentification pour ${provider.provider_type} - clé API invalide`);
                    this.recordProviderFailure(provider.provider_type);
                }
                
                // Continuer avec le fournisseur suivant sauf en cas d'erreur critique
                if (error.message.includes('timeout') && providers.length === 1) {
                    // Si c'est le seul fournisseur et qu'il timeout, arrêter
                    throw error;
                }
                
                continue;
            }
        }
        
        // Tous les fournisseurs ont échoué
        if (lastError) {
            console.error('[AI-OPT] Tous les fournisseurs ont échoué');
            throw new Error(`Échec de tous les fournisseurs d'IA. Dernière erreur: ${lastError.message}`);
        } else {
            throw new Error('Réponse vide de tous les fournisseurs d\'IA');
        }
    }

    /**
     * Nettoie les données de cache et compteurs (maintenance)
     */
    resetStats() {
        this.providerFailures.clear();
        this.rateLimitBackoff.clear();
        this.lastSuccessfulProvider = null;
        console.log('[AI-OPT] Statistiques réinitialisées');
    }
}

// Instance singleton
const optimizedAIService = new OptimizedAIService();

module.exports = {
    generateResponse: optimizedAIService.generateResponse.bind(optimizedAIService),
    resetStats: optimizedAIService.resetStats.bind(optimizedAIService)
};