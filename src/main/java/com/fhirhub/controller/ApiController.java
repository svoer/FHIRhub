package com.fhirhub.controller;

import com.fhirhub.model.ConversionLog;
import com.fhirhub.service.ConversionLogService;
import com.fhirhub.service.Hl7ToFhirConverter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Contrôleur pour l'API REST
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class ApiController {

    private final Hl7ToFhirConverter converter;
    private final ConversionLogService logService;

    /**
     * Point d'entrée pour la conversion HL7 vers FHIR
     */
    @PostMapping("/convert")
    public ResponseEntity<Map<String, Object>> convertHl7ToFhir(@RequestBody Map<String, String> request) {
        String hl7Content = request.get("hl7");
        String filename = request.getOrDefault("filename", "direct_input_" + System.currentTimeMillis() + ".hl7");
        
        if (hl7Content == null || hl7Content.trim().isEmpty()) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Le contenu HL7 est requis");
            return ResponseEntity.badRequest().body(errorResponse);
        }
        
        // Convertir le message HL7
        Map<String, Object> result = converter.convertHl7ToFhir(hl7Content);
        
        // Enregistrer le log de conversion
        Boolean success = (Boolean) result.get("success");
        ConversionLog conversionLog = ConversionLog.builder()
                .inputFile(filename)
                .outputFile(success != null && success ? filename.replaceAll("\\.[^.]+$", ".json") : null)
                .success(success != null && success)
                .message(success != null && success ? "Conversion réussie" : "Erreur: " + result.get("error"))
                .sourceType("API")
                .messageType((String) result.get("messageType"))
                .build();
        
        if (result.get("resourceCount") != null) {
            conversionLog.setFhirResourceCount(result.get("resourceCount").toString());
        }
        
        ConversionLog savedLog = logService.logConversion(conversionLog);
        
        // Ajouter l'ID du log à la réponse
        result.put("logId", savedLog.getId());
        
        return ResponseEntity.ok(result);
    }
    
    /**
     * Télécharger et convertir un fichier HL7
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadAndConvert(@RequestParam("file") MultipartFile file) {
        Map<String, Object> response = new HashMap<>();
        
        if (file.isEmpty()) {
            response.put("success", false);
            response.put("error", "Fichier vide");
            return ResponseEntity.badRequest().body(response);
        }
        
        try {
            // Lire le contenu du fichier
            String hl7Content = new String(file.getBytes(), StandardCharsets.UTF_8);
            String filename = file.getOriginalFilename();
            
            // Convertir le message HL7
            Map<String, Object> result = converter.convertHl7ToFhir(hl7Content);
            
            // Enregistrer le log de conversion
            Boolean success = (Boolean) result.get("success");
            ConversionLog conversionLog = ConversionLog.builder()
                    .inputFile(filename)
                    .outputFile(success != null && success ? filename.replaceAll("\\.[^.]+$", ".json") : null)
                    .success(success != null && success)
                    .message(success != null && success ? "Conversion réussie" : "Erreur: " + result.get("error"))
                    .sourceType("UPLOAD")
                    .messageType((String) result.get("messageType"))
                    .build();
            
            if (result.get("resourceCount") != null) {
                conversionLog.setFhirResourceCount(result.get("resourceCount").toString());
            }
            
            ConversionLog savedLog = logService.logConversion(conversionLog);
            
            // Ajouter l'ID du log à la réponse
            result.put("logId", savedLog.getId());
            
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            log.error("Erreur lors de la lecture du fichier", e);
            response.put("success", false);
            response.put("error", "Erreur lors de la lecture du fichier: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Obtenir l'historique des conversions
     */
    @GetMapping("/conversions")
    public ResponseEntity<Map<String, Object>> getConversions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        Page<ConversionLog> conversions = logService.getConversions(page, size);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", conversions.getContent());
        response.put("currentPage", conversions.getNumber());
        response.put("totalItems", conversions.getTotalElements());
        response.put("totalPages", conversions.getTotalPages());
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Obtenir un log de conversion spécifique
     */
    @GetMapping("/conversions/{id}")
    public ResponseEntity<Map<String, Object>> getConversion(@PathVariable Long id) {
        Map<String, Object> response = new HashMap<>();
        
        return logService.getConversionById(id)
                .map(conversionLog -> {
                    response.put("success", true);
                    response.put("data", conversionLog);
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> {
                    response.put("success", false);
                    response.put("error", "Log de conversion non trouvé");
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
                });
    }
    
    /**
     * Obtenir les statistiques de conversion
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> stats = logService.getStats();
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", stats);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Vérifier l'état de l'API
     */
    @GetMapping("/public/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("service", "FHIRHub API");
        
        return ResponseEntity.ok(response);
    }
}