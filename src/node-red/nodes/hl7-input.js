/**
 * Nœud Node-RED pour l'entrée de messages HL7 dans FHIRHub
 */
module.exports = function(RED) {
    function Hl7InputNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Configuration du nœud
        this.name = config.name;
        
        // Réception d'un message
        this.on('input', function(msg) {
            try {
                // Si aucun message HL7 n'est défini dans la charge utile, utiliser le payload comme message HL7
                if (!msg.hl7) {
                    msg.hl7 = msg.payload;
                }
                
                // Vérifier si le message HL7 est présent
                if (!msg.hl7) {
                    node.error("Aucun message HL7 reçu", msg);
                    return;
                }
                
                // Définir l'état du nœud comme actif temporairement
                node.status({fill:"green", shape:"dot", text:"Message reçu"});
                setTimeout(() => {
                    node.status({});
                }, 3000);
                
                // Envoyer le message au nœud suivant
                node.send(msg);
            } catch (error) {
                node.error("Erreur lors du traitement du message HL7: " + error.message, msg);
                node.status({fill:"red", shape:"ring", text:"Erreur"});
            }
        });
        
        // Nettoyage lors de la fermeture du nœud
        this.on('close', function() {
            node.status({});
        });
    }
    
    // Enregistrer le nœud
    RED.nodes.registerType("fhirhub-hl7-input", Hl7InputNode);
};