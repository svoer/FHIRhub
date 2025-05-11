package com.fhirhub.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Contrôleur pour les pages web principales
 */
@Controller
public class HomeController {

    /**
     * Page d'accueil
     */
    @GetMapping("/")
    public String home() {
        return "index";
    }
}