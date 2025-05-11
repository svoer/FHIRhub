package com.fhirhub.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Filtre pour l'authentification par clé API
 */
@Component
@Slf4j
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    @Value("${fhirhub.api.key}")
    private String apiKey;
    
    // Chemins exemptés de l'authentification par clé API
    private final List<String> excludedPaths = Arrays.asList(
        "/api/public/health",
        "/",
        "/css/", 
        "/js/", 
        "/images/",
        "/favicon.ico",
        "/error"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        
        // Vérifier si le chemin est exempté
        for (String excludedPath : excludedPaths) {
            if (path.startsWith(excludedPath)) {
                return true;
            }
        }
        
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
            
        // Extraire la clé API de l'en-tête
        String requestApiKey = request.getHeader("X-API-Key");
        
        if (apiKey.equals(requestApiKey)) {
            // Clé API valide, continuer la chaîne de filtres
            filterChain.doFilter(request, response);
        } else {
            // Clé API invalide ou manquante
            log.warn("Tentative d'accès non autorisée. Chemin: {}, IP: {}", 
                request.getRequestURI(), 
                request.getRemoteAddr());
                
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"success\":false,\"error\":\"Clé API non valide ou manquante\"}");
        }
    }
}