package com.fhirhub.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * Entité représentant un journal de conversion HL7 vers FHIR
 */
@Entity
@Table(name = "conversion_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String inputFile;
    
    @Column
    private String outputFile;
    
    @Column(nullable = false)
    private Boolean success;
    
    @Column(length = 2000)
    private String message;
    
    @Column
    private String messageType;
    
    @Column
    private String patientId;
    
    @Column
    private String fhirResourceCount;
    
    @Column(nullable = false, length = 50)
    private String sourceType;  // API, FILE, UPLOAD
    
    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}