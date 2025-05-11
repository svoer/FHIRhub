package com.fhirhub.service;

import com.fhirhub.model.ConversionLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hl7.fhir.r4.model.Bundle;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service de surveillance des fichiers HL7 dans un répertoire
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FileMonitorService {

    private final Hl7ToFhirConverter converter;
    private final ConversionLogService logService;
    
    @Value("${fhirhub.paths.input-dir}")
    private String inputDirPath;
    
    @Value("${fhirhub.paths.output-dir}")
    private String outputDirPath;
    
    @Value("${fhirhub.monitoring.enabled}")
    private boolean monitoringEnabled;
    
    @Value("${fhirhub.monitoring.file-extensions}")
    private List<String> fileExtensions;
    
    // Map pour suivre les fichiers déjà traités
    private final Map<String, Long> processedFiles = new ConcurrentHashMap<>();
    
    /**
     * Initialiser le service
     */
    public void init() {
        // Créer les répertoires s'ils n'existent pas
        createDirectories();
        
        if (monitoringEnabled) {
            log.info("Surveillance de fichiers activée pour le répertoire: {}", inputDirPath);
            log.info("Extensions de fichiers surveillées: {}", fileExtensions);
        } else {
            log.info("Surveillance de fichiers désactivée");
        }
    }
    
    /**
     * Analyser le répertoire d'entrée pour les nouveaux fichiers HL7
     */
    @Scheduled(fixedDelayString = "${fhirhub.monitoring.polling-interval-ms:5000}")
    public void scanDirectory() {
        if (!monitoringEnabled) {
            return;
        }
        
        try {
            Path inputDir = Paths.get(inputDirPath);
            
            // Vérifier que le répertoire existe
            if (!Files.exists(inputDir)) {
                log.warn("Répertoire d'entrée non trouvé: {}", inputDirPath);
                return;
            }
            
            // Lister tous les fichiers HL7 du répertoire
            List<File> hl7Files = Files.list(inputDir)
                .filter(Files::isRegularFile)
                .filter(this::isHl7File)
                .map(Path::toFile)
                .collect(Collectors.toList());
            
            // Traiter chaque nouveau fichier
            for (File file : hl7Files) {
                String filePath = file.getAbsolutePath();
                long lastModified = file.lastModified();
                
                // Vérifier si le fichier a déjà été traité
                if (!processedFiles.containsKey(filePath) || processedFiles.get(filePath) < lastModified) {
                    // Marquer le fichier comme traité
                    processedFiles.put(filePath, lastModified);
                    
                    // Traiter le fichier
                    processFile(file);
                }
            }
        } catch (IOException e) {
            log.error("Erreur lors de l'analyse du répertoire", e);
        }
    }
    
    /**
     * Traiter un fichier HL7
     */
    public void processFile(File file) {
        log.info("Traitement du fichier: {}", file.getName());
        
        try {
            // Lire le contenu du fichier
            String content = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            
            // Convertir HL7 en FHIR
            Map<String, Object> result = converter.convertHl7ToFhir(content);
            
            // Nom du fichier de sortie
            String outputFileName = getOutputFileName(file.getName());
            String outputPath = Paths.get(outputDirPath, outputFileName).toString();
            
            // Créer l'entrée de log
            Boolean success = (Boolean) result.get("success");
            ConversionLog conversionLog = ConversionLog.builder()
                .inputFile(file.getName())
                .outputFile(outputFileName)
                .success(success != null && success)
                .message(success != null && success ? "Conversion réussie" : "Erreur: " + result.get("error"))
                .build();
            
            // Ajouter des métadonnées supplémentaires au log si disponibles
            if (result.get("messageType") != null) {
                conversionLog.setMessageType((String) result.get("messageType"));
            }
            
            if (result.get("resourceCount") != null) {
                conversionLog.setFhirResourceCount(result.get("resourceCount").toString());
            }
            
            // Définir le type de source
            conversionLog.setSourceType("FILE");
            
            // Enregistrer le log
            logService.logConversion(conversionLog);
            
            if (success != null && success) {
                // Créer le répertoire de sortie s'il n'existe pas
                Files.createDirectories(Paths.get(outputDirPath));
                
                // Écrire le résultat FHIR dans un fichier JSON
                Files.writeString(
                    Paths.get(outputPath), 
                    (String) result.get("fhirJson"), 
                    StandardCharsets.UTF_8
                );
                
                log.info("Conversion réussie, fichier de sortie: {}", outputPath);
            } else {
                log.error("Échec de la conversion: {}", result.get("error"));
            }
            
        } catch (Exception e) {
            log.error("Erreur lors du traitement du fichier: {}", file.getName(), e);
            
            // Enregistrer l'échec dans les logs
            ConversionLog errorLog = ConversionLog.builder()
                .inputFile(file.getName())
                .success(false)
                .message("Erreur: " + e.getMessage())
                .sourceType("FILE")
                .build();
            
            logService.logConversion(errorLog);
        }
    }
    
    /**
     * Vérifier si un fichier est un fichier HL7 valide
     */
    private boolean isHl7File(Path path) {
        String fileName = path.getFileName().toString().toLowerCase();
        return fileExtensions.stream()
            .anyMatch(ext -> fileName.endsWith(ext.startsWith(".") ? ext : "." + ext));
    }
    
    /**
     * Obtenir le nom du fichier de sortie pour un fichier HL7
     */
    private String getOutputFileName(String inputFileName) {
        // Remplacer l'extension par .json
        return inputFileName.replaceAll("\\.[^.]+$", ".json");
    }
    
    /**
     * Créer les répertoires d'entrée et de sortie s'ils n'existent pas
     */
    private void createDirectories() {
        try {
            Path inputDir = Paths.get(inputDirPath);
            Path outputDir = Paths.get(outputDirPath);
            
            if (!Files.exists(inputDir)) {
                Files.createDirectories(inputDir);
                log.info("Répertoire d'entrée créé: {}", inputDirPath);
            }
            
            if (!Files.exists(outputDir)) {
                Files.createDirectories(outputDir);
                log.info("Répertoire de sortie créé: {}", outputDirPath);
            }
        } catch (IOException e) {
            log.error("Erreur lors de la création des répertoires", e);
        }
    }
}