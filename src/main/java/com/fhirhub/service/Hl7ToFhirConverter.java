package com.fhirhub.service;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import ca.uhn.hl7v2.HL7Exception;
import ca.uhn.hl7v2.HapiContext;
import ca.uhn.hl7v2.model.Message;
import ca.uhn.hl7v2.model.v25.datatype.XPN;
import ca.uhn.hl7v2.model.v25.message.ADT_A01;
import ca.uhn.hl7v2.model.v25.segment.MSH;
import ca.uhn.hl7v2.model.v25.segment.PID;
import ca.uhn.hl7v2.parser.Parser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hl7.fhir.r4.model.*;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * Service de conversion des messages HL7v2.5 vers FHIR R4
 * Utilise HAPI FHIR pour la conversion
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class Hl7ToFhirConverter {

    private final FhirContext fhirContext;
    private final HapiContext hapiContext;

    /**
     * Convertir un message HL7 en ressource FHIR
     * @param hl7Message Le message HL7 à convertir
     * @return Résultat de la conversion avec les données FHIR
     */
    public Map<String, Object> convertHl7ToFhir(String hl7Message) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            // Parser le message HL7
            Parser parser = hapiContext.getGenericParser();
            Message message = parser.parse(hl7Message);
            
            // Déterminer le type de message
            String messageType = determineMessageType(message);
            log.info("Message type detected: {}", messageType);
            
            // Créer le bundle FHIR
            Bundle bundle = new Bundle();
            bundle.setType(Bundle.BundleType.TRANSACTION);
            bundle.setTimestamp(new Date());
            
            // Convertir en fonction du type de message
            if (messageType.startsWith("ADT")) {
                processAdtMessage(message, bundle);
            } else {
                // Support pour autres types à ajouter selon besoin
                throw new UnsupportedOperationException("Type de message non supporté: " + messageType);
            }
            
            // Convertir le bundle en JSON
            IParser jsonParser = fhirContext.newJsonParser().setPrettyPrint(true);
            String fhirJson = jsonParser.encodeResourceToString(bundle);
            
            // Construire le résultat
            result.put("success", true);
            result.put("messageType", messageType);
            result.put("resourceCount", bundle.getEntry().size());
            result.put("data", bundle);
            result.put("fhirJson", fhirJson);
            
            return result;
            
        } catch (Exception e) {
            log.error("Erreur lors de la conversion HL7 vers FHIR", e);
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }
    
    /**
     * Déterminer le type de message HL7
     */
    private String determineMessageType(Message message) throws HL7Exception {
        MSH msh = (MSH) message.get("MSH");
        String messageType = msh.getMessageType().getMessageCode().getValue();
        String triggerEvent = msh.getMessageType().getTriggerEvent().getValue();
        return messageType + "_" + triggerEvent;
    }
    
    /**
     * Traiter un message ADT (Admission, Discharge, Transfer)
     */
    private void processAdtMessage(Message message, Bundle bundle) throws HL7Exception {
        if (message instanceof ADT_A01) {
            ADT_A01 adtMessage = (ADT_A01) message;
            
            // Extraire le PID (Patient Identification)
            PID pid = adtMessage.getPID();
            
            // Créer la ressource Patient
            Patient patient = createPatientFromPid(pid);
            
            // Ajouter le patient au bundle
            bundle.addEntry()
                .setResource(patient)
                .setFullUrl("urn:uuid:" + patient.getId())
                .getRequest()
                    .setMethod(Bundle.HTTPVerb.POST)
                    .setUrl("Patient");
            
            // TODO: Ajouter d'autres ressources comme Encounter, Observation, etc.
        }
    }
    
    /**
     * Créer une ressource Patient FHIR à partir d'un segment PID HL7
     */
    private Patient createPatientFromPid(PID pid) throws HL7Exception {
        Patient patient = new Patient();
        
        // Générer un ID
        patient.setId(generateUuid());
        
        // Identifier (MRN, INS, etc.)
        if (pid.getPatientIdentifierList().length > 0) {
            String id = pid.getPatientIdentifierList(0).getIDNumber().getValue();
            String system = pid.getPatientIdentifierList(0).getAssigningAuthority().getNamespaceID().getValue();
            
            if (id != null && !id.isEmpty()) {
                Identifier identifier = new Identifier()
                    .setSystem("http://example.org/fhir/identifier/" + (system != null ? system.toLowerCase() : "mrn"))
                    .setValue(id);
                patient.addIdentifier(identifier);
                
                // Vérifier si c'est un INS (spécifique au format français)
                if (system != null && "INS".equalsIgnoreCase(system)) {
                    identifier.setSystem("https://annuaire.sante.fr/fhir/NOS/INS-NIR");
                }
            }
        }
        
        // Nom et prénom
        if (pid.getPatientName().length > 0) {
            XPN patientName = pid.getPatientName(0);
            
            HumanName humanName = new HumanName();
            humanName.setUse(HumanName.NameUse.OFFICIAL);
            
            String familyName = patientName.getFamilyName().getSurname().getValue();
            String givenName = patientName.getGivenName().getValue();
            
            if (familyName != null && !familyName.isEmpty()) {
                humanName.setFamily(familyName);
            }
            
            if (givenName != null && !givenName.isEmpty()) {
                humanName.addGiven(givenName);
            }
            
            patient.addName(humanName);
        }
        
        // Genre
        String gender = pid.getAdministrativeSex().getValue();
        if (gender != null) {
            switch (gender) {
                case "M":
                    patient.setGender(Enumerations.AdministrativeGender.MALE);
                    break;
                case "F":
                    patient.setGender(Enumerations.AdministrativeGender.FEMALE);
                    break;
                case "O":
                    patient.setGender(Enumerations.AdministrativeGender.OTHER);
                    break;
                default:
                    patient.setGender(Enumerations.AdministrativeGender.UNKNOWN);
            }
        }
        
        // Date de naissance
        String birthDateString = pid.getDateTimeOfBirth().getTime().getValue();
        if (birthDateString != null && !birthDateString.isEmpty()) {
            try {
                // Formatter la date selon le format HL7
                Date birthDate = parseHl7Date(birthDateString);
                patient.setBirthDate(birthDate);
            } catch (Exception e) {
                log.warn("Impossible de parser la date de naissance: {}", birthDateString);
            }
        }
        
        // Adresse
        if (pid.getPatientAddress().length > 0) {
            String street = pid.getPatientAddress(0).getStreetAddress().getStreetOrMailingAddress().getValue();
            String city = pid.getPatientAddress(0).getCity().getValue();
            String state = pid.getPatientAddress(0).getStateOrProvince().getValue();
            String zip = pid.getPatientAddress(0).getZipOrPostalCode().getValue();
            String country = pid.getPatientAddress(0).getCountry().getValue();
            
            if (street != null || city != null || state != null || zip != null || country != null) {
                Address address = new Address();
                
                if (street != null && !street.isEmpty()) {
                    address.addLine(street);
                }
                
                if (city != null && !city.isEmpty()) {
                    address.setCity(city);
                }
                
                if (state != null && !state.isEmpty()) {
                    address.setState(state);
                }
                
                if (zip != null && !zip.isEmpty()) {
                    address.setPostalCode(zip);
                }
                
                if (country != null && !country.isEmpty()) {
                    address.setCountry(country);
                }
                
                patient.addAddress(address);
            }
        }
        
        // Téléphone
        if (pid.getPhoneNumberHome().length > 0) {
            String phoneNumber = pid.getPhoneNumberHome(0).getTelephoneNumber().getValue();
            if (phoneNumber != null && !phoneNumber.isEmpty()) {
                ContactPoint contactPoint = new ContactPoint()
                    .setSystem(ContactPoint.ContactPointSystem.PHONE)
                    .setValue(phoneNumber)
                    .setUse(ContactPoint.ContactPointUse.HOME);
                patient.addTelecom(contactPoint);
            }
        }
        
        return patient;
    }
    
    /**
     * Générer un UUID pour les ressources
     */
    private String generateUuid() {
        return java.util.UUID.randomUUID().toString();
    }
    
    /**
     * Parser une date HL7 au format FHIR
     */
    private Date parseHl7Date(String hl7Date) throws Exception {
        if (hl7Date == null || hl7Date.isEmpty()) {
            return null;
        }
        
        // Différents formats de date possibles en HL7
        String format;
        if (hl7Date.length() == 8) {
            format = "yyyyMMdd";
        } else if (hl7Date.length() == 12) {
            format = "yyyyMMddHHmm";
        } else if (hl7Date.length() == 14) {
            format = "yyyyMMddHHmmss";
        } else {
            throw new IllegalArgumentException("Format de date non reconnu: " + hl7Date);
        }
        
        SimpleDateFormat sdf = new SimpleDateFormat(format);
        return sdf.parse(hl7Date);
    }
}