/**
 * Nœud Node-RED pour la sortie FHIR dans FHIRHub
 */
module.exports = function(RED) {
    function FhirOutputNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Configuration du nœud
        this.name = config.name;
        
        // Réception d'un message
        this.on('input', function(msg) {
            try {
                // Vérifier si les données FHIR sont présentes
                if (!msg.fhir && !msg.payload) {
                    throw new Error("Aucune donnée FHIR à traiter");
                }
                
                // Utiliser les données FHIR de la charge utile ou de la propriété fhir
                const fhirData = msg.fhir || msg.payload;
                
                // Afficher l'état de sortie en cours
                node.status({fill:"green", shape:"dot", text:"Données FHIR traitées"});
                
                // Vérifier le type des données FHIR
                let resourceType = "Inconnu";
                if (typeof fhirData === 'object') {
                    if (fhirData.resourceType) {
                        resourceType = fhirData.resourceType;
                    } else if (fhirData.type === 'transaction' || fhirData.type === 'batch') {
                        resourceType = `Bundle (${fhirData.type})`;
                    }
                }
                
                // Compter les ressources si c'est un Bundle
                let resourceCount = 1;
                if (fhirData.resourceType === 'Bundle' && Array.isArray(fhirData.entry)) {
                    resourceCount = fhirData.entry.length;
                }
                
                // Mettre à jour le statut avec le type de ressource
                node.status({fill:"green", shape:"dot", text:`${resourceType} (${resourceCount} ressource(s))`});
                
                // Enregistrer un message de log pour indiquer que les données FHIR ont été traitées
                node.log(`Données FHIR traitées: ${resourceType} contenant ${resourceCount} ressource(s)`);
                
                setTimeout(() => {
                    node.status({});
                }, 3000);
            } catch (error) {
                node.error("Erreur lors du traitement des données FHIR: " + error.message, msg);
                node.status({fill:"red", shape:"ring", text:"Erreur: " + error.message});
            }
        });
        
        // Nettoyage lors de la fermeture du nœud
        this.on('close', function() {
            node.status({});
        });
    }
    
    // Enregistrer le nœud
    RED.nodes.registerType("fhirhub-fhir-output", FhirOutputNode);
};