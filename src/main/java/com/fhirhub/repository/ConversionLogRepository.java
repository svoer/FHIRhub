package com.fhirhub.repository;

import com.fhirhub.model.ConversionLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository pour accéder aux logs de conversion
 */
@Repository
public interface ConversionLogRepository extends JpaRepository<ConversionLog, Long> {

    /**
     * Trouver les logs de conversion par statut de succès
     */
    List<ConversionLog> findBySuccess(boolean success);
    
    /**
     * Trouver les logs de conversion par nom de fichier d'entrée
     */
    List<ConversionLog> findByInputFileContainingIgnoreCase(String inputFile);
    
    /**
     * Trouver les logs de conversion par ID patient
     */
    List<ConversionLog> findByPatientId(String patientId);
    
    /**
     * Trouver les logs de conversion dans une plage de temps
     */
    List<ConversionLog> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
    
    /**
     * Compter le nombre de conversions réussies
     */
    @Query("SELECT COUNT(c) FROM ConversionLog c WHERE c.success = true")
    long countSuccessfulConversions();
    
    /**
     * Compter le nombre de conversions échouées
     */
    @Query("SELECT COUNT(c) FROM ConversionLog c WHERE c.success = false")
    long countFailedConversions();
    
    /**
     * Compter les conversions effectuées durant les dernières 24 heures
     */
    @Query("SELECT COUNT(c) FROM ConversionLog c WHERE c.timestamp >= :timestamp")
    long countConversionsLast24Hours(LocalDateTime timestamp);
    
    /**
     * Récupérer les logs de conversion paginés par ordre chronologique inversé
     */
    Page<ConversionLog> findAllByOrderByTimestampDesc(Pageable pageable);
}