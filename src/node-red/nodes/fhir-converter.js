/**
 * Nœud Node-RED pour la conversion de messages HL7 vers FHIR dans FHIRHub
 */
module.exports = function(RED) {
    // Charger le convertisseur HL7 vers FHIR
    const path = require('path');
    const appRoot = path.resolve(__dirname, '../../../');
    
    function FhirConverterNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Configuration du nœud
        this.name = config.name;
        this.messageType = config.messageType || 'ADT';
        
        // Importer le convertisseur
        try {
            const hl7ToFhirConverter = require(path.join(appRoot, 'hl7ToFhirAdvancedConverter.js'));
            this.converter = hl7ToFhirConverter;
            
            node.debug("Convertisseur HL7 vers FHIR chargé avec succès");
        } catch (error) {
            node.error("Impossible de charger le convertisseur HL7 vers FHIR: " + error.message);
            this.converter = null;
        }
        
        // Réception d'un message
        this.on('input', async function(msg) {
            try {
                // Vérifier si le convertisseur est disponible
                if (!this.converter) {
                    throw new Error("Convertisseur HL7 vers FHIR non disponible");
                }
                
                // Vérifier si le message HL7 est présent
                if (!msg.hl7 && !msg.payload) {
                    throw new Error("Aucun message HL7 à convertir");
                }
                
                // Utiliser le message HL7 de la charge utile ou de la propriété hl7
                const hl7Message = msg.hl7 || msg.payload;
                
                // Afficher l'état de conversion en cours
                node.status({fill:"blue", shape:"dot", text:"Conversion en cours..."});
                
                // Convertir le message HL7 en FHIR
                const result = await this.converter.convertHL7ToFHIR(hl7Message, {
                    messageType: this.messageType
                });
                
                // Ajouter le résultat FHIR au message
                msg.fhir = result.fhir;
                
                // Garder une copie du message HL7 d'origine
                msg.originalHl7 = hl7Message;
                
                // Remplacer le payload par le résultat FHIR
                msg.payload = result.fhir;
                
                // Ajouter des métadonnées sur la conversion
                msg.conversionStats = {
                    startTime: result.startTime,
                    endTime: result.endTime,
                    duration: result.duration
                };
                
                // Afficher l'état de conversion réussie
                node.status({fill:"green", shape:"dot", text:"Converti en " + Math.round(result.duration) + "ms"});
                setTimeout(() => {
                    node.status({});
                }, 3000);
                
                // Envoyer le message au nœud suivant
                node.send(msg);
            } catch (error) {
                node.error("Erreur lors de la conversion HL7 vers FHIR: " + error.message, msg);
                node.status({fill:"red", shape:"ring", text:"Erreur: " + error.message});
                
                // Ajouter l'erreur au message et l'envoyer quand même
                msg.error = error.message;
                node.send(msg);
            }
        });
        
        // Nettoyage lors de la fermeture du nœud
        this.on('close', function() {
            node.status({});
        });
    }
    
    // Enregistrer le nœud
    RED.nodes.registerType("fhirhub-fhir-converter", FhirConverterNode);
};