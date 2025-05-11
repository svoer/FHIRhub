package com.fhirhub.config;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.hl7v2.DefaultHapiContext;
import ca.uhn.hl7v2.HapiContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuration principale de l'application
 */
@Configuration
@EnableScheduling
@Slf4j
public class AppConfig implements WebMvcConfigurer {

    /**
     * Créer le contexte FHIR R4
     */
    @Bean
    public FhirContext fhirContext() {
        log.info("Initialisation du contexte FHIR R4");
        return FhirContext.forR4();
    }
    
    /**
     * Créer le contexte HAPI HL7
     */
    @Bean
    public HapiContext hapiContext() {
        log.info("Initialisation du contexte HAPI HL7");
        HapiContext context = new DefaultHapiContext();
        // Configuration supplémentaire du contexte si nécessaire
        return context;
    }
}