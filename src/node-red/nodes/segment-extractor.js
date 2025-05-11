/**
 * Nœud Node-RED pour l'extraction de segments HL7 dans FHIRHub
 */
module.exports = function(RED) {
    function SegmentExtractorNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Configuration du nœud
        this.name = config.name;
        this.segment = config.segment || 'PID';
        
        // Réception d'un message
        this.on('input', function(msg) {
            try {
                // Vérifier si le message HL7 est présent
                if (!msg.hl7 && !msg.payload) {
                    throw new Error("Aucun message HL7 à analyser");
                }
                
                // Utiliser le message HL7 de la charge utile ou de la propriété hl7
                const hl7Message = (msg.hl7 || msg.payload).toString();
                
                // Afficher l'état d'extraction en cours
                node.status({fill:"blue", shape:"dot", text:"Extraction en cours..."});
                
                // Diviser le message en segments
                const segments = hl7Message.split(/\r?\n/);
                
                // Rechercher tous les segments correspondants
                const matchingSegments = segments.filter(seg => {
                    return seg.startsWith(this.segment + '|');
                });
                
                // Ajouter les segments extraits au message
                msg.extractedSegments = matchingSegments;
                
                // Si aucun segment correspondant n'est trouvé
                if (matchingSegments.length === 0) {
                    node.warn(`Aucun segment ${this.segment} trouvé dans le message HL7`);
                    node.status({fill:"yellow", shape:"ring", text:`Aucun segment ${this.segment} trouvé`});
                } else {
                    // Afficher l'état d'extraction réussie
                    node.status({fill:"green", shape:"dot", text:`${matchingSegments.length} segment(s) ${this.segment} extrait(s)`});
                    
                    // Extraire tous les champs du premier segment correspondant
                    const fields = matchingSegments[0].split('|');
                    const segmentFields = {};
                    
                    // Stocker les champs dans un objet
                    for (let i = 1; i < fields.length; i++) {
                        segmentFields['field' + i] = fields[i];
                    }
                    
                    // Ajouter l'objet de champs au message
                    msg.segmentFields = segmentFields;
                }
                
                setTimeout(() => {
                    node.status({});
                }, 3000);
                
                // Envoyer le message au nœud suivant
                node.send(msg);
            } catch (error) {
                node.error("Erreur lors de l'extraction de segments: " + error.message, msg);
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
    RED.nodes.registerType("fhirhub-segment-extractor", SegmentExtractorNode);
};