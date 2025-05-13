/**
 * Script pour tester l'intégration du chatbot avec la base de connaissances
 * Ce script simule une requête au chatbot et affiche les étapes d'enrichissement du prompt
 */

const chatbotKnowledgeService = require('./utils/chatbotKnowledgeService');

// Prompt système de base pour le test 
const baseSystemPrompt = `Tu es FHIRChatbot, un assistant virtuel spécialisé dans l'application FHIRHub.
Ta mission est d'aider les utilisateurs à comprendre et utiliser l'application FHIRHub.
Tu dois être précis, informatif et utile.`;

// Fonction de test principale
async function testChatbotKnowledge() {
    try {
        // Test avec différentes requêtes utilisateur
        const testQueries = [
            "Comment puis-je convertir un message HL7 vers FHIR ?",
            "Comment configurer un fournisseur d'IA ?",
            "Comment fonctionne le visualiseur patient ?"
        ];

        console.log("====== DÉBUT DU TEST D'INTÉGRATION DU CHATBOT AVEC LA BASE DE CONNAISSANCES ======\n");
        
        // Tester chaque requête
        for (const query of testQueries) {
            console.log(`\n\n--- TEST AVEC LA REQUÊTE: "${query}" ---\n`);
            
            console.log("1. Chargement de la base de connaissances");
            const knowledgeBase = await chatbotKnowledgeService.loadKnowledgeBase();
            console.log(`   Base chargée: ${knowledgeBase.faq.length} FAQs, ${knowledgeBase.features.length} fonctionnalités, ${knowledgeBase.commands?.length || 0} commandes`);
            
            console.log("\n2. Recherche d'informations pertinentes");
            const relevantInfo = await chatbotKnowledgeService.findRelevantKnowledge(query);
            console.log(`   ${relevantInfo.length} informations pertinentes trouvées`);
            
            if (relevantInfo.length > 0) {
                console.log("   Détails des informations trouvées:");
                relevantInfo.forEach((info, i) => {
                    const title = info.type === 'faq' ? info.question : info.name;
                    console.log(`   [${i+1}] Type: ${info.type}, Titre: "${title}", Score: ${info.score}`);
                });
            }
            
            console.log("\n3. Formatage des informations pour le prompt");
            const formattedKnowledge = chatbotKnowledgeService.formatKnowledgeForPrompt(relevantInfo);
            console.log(`   Texte formaté de ${formattedKnowledge.length} caractères généré`);
            
            console.log("\n4. Génération du prompt enrichi complet");
            const enhancedPrompt = await chatbotKnowledgeService.getEnhancedPrompt(baseSystemPrompt, query);
            console.log(`   Prompt enrichi de ${enhancedPrompt.length} caractères généré`);
            
            // Afficher un aperçu du prompt enrichi (premiers et derniers caractères)
            const previewLength = 150;
            const promptPreview = enhancedPrompt.length > previewLength * 2 
                ? enhancedPrompt.substring(0, previewLength) + "\n[...]\n" + enhancedPrompt.substring(enhancedPrompt.length - previewLength)
                : enhancedPrompt;
            
            console.log("\nAperçu du prompt enrichi:");
            console.log("```");
            console.log(promptPreview);
            console.log("```");
        }
        
        console.log("\n\n====== FIN DU TEST D'INTÉGRATION ======");
        
    } catch (error) {
        console.error("ERREUR LORS DU TEST:", error);
    }
}

// Exécuter le test
testChatbotKnowledge().then(() => {
    console.log("Test terminé!");
}).catch(err => {
    console.error("Erreur globale:", err);
});