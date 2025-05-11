package com.fhirhub;

import com.fhirhub.service.FileMonitorService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;

import javax.annotation.PostConstruct;

/**
 * Point d'entrée principal de l'application FHIRHub
 */
@SpringBootApplication
public class FhirHubApplication {

    private final FileMonitorService fileMonitorService;

    public FhirHubApplication(FileMonitorService fileMonitorService) {
        this.fileMonitorService = fileMonitorService;
    }

    public static void main(String[] args) {
        ApplicationContext context = SpringApplication.run(FhirHubApplication.class, args);
    }
    
    /**
     * Initialiser les services après le démarrage de l'application
     */
    @PostConstruct
    public void init() {
        // Initialiser le service de surveillance de fichiers
        fileMonitorService.init();
    }
}