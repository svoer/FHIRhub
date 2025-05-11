package com.fhirhub.service;

import com.fhirhub.model.ConversionLog;
import com.fhirhub.repository.ConversionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service pour gérer les logs de conversion
 */
@Service
@RequiredArgsConstructor
public class ConversionLogService {

    private final ConversionLogRepository conversionLogRepository;

    /**
     * Enregistrer un log de conversion
     */
    public ConversionLog logConversion(ConversionLog conversionLog) {
        conversionLog.setTimestamp(LocalDateTime.now());
        return conversionLogRepository.save(conversionLog);
    }

    /**
     * Obtenir les logs de conversion de manière paginée
     */
    public Page<ConversionLog> getConversions(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return conversionLogRepository.findAllByOrderByTimestampDesc(pageable);
    }

    /**
     * Obtenir un log de conversion par son ID
     */
    public Optional<ConversionLog> getConversionById(Long id) {
        return conversionLogRepository.findById(id);
    }

    /**
     * Obtenir les statistiques de conversion
     */
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        
        long totalConversions = conversionLogRepository.count();
        long successfulConversions = conversionLogRepository.countSuccessfulConversions();
        long failedConversions = conversionLogRepository.countFailedConversions();
        
        // Calculer le taux de réussite
        int successRate = totalConversions > 0 
            ? (int) Math.round((double) successfulConversions / totalConversions * 100)
            : 0;
        
        // Calculer les conversions des dernières 24 heures
        LocalDateTime last24Hours = LocalDateTime.now().minusHours(24);
        long conversionsLast24Hours = conversionLogRepository.countConversionsLast24Hours(last24Hours);
        
        stats.put("totalConversions", totalConversions);
        stats.put("successfulConversions", successfulConversions);
        stats.put("failedConversions", failedConversions);
        stats.put("successRate", successRate);
        stats.put("conversionsLast24Hours", conversionsLast24Hours);
        
        return stats;
    }
}