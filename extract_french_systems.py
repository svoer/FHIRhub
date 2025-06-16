#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os

"""
Script pour extraire et organiser les systèmes de terminologie français
pertinents pour l'adaptation du convertisseur HL7 vers FHIR
"""

# Chemins des fichiers
CODESYSTEMS_FILE = "french_terminology/fhir_codesystems.json"
VALUESETS_FILE = "french_terminology/fhir_valuesets.json"
SYSTEM_URLS_FILE = "french_terminology/system_urls.json"
OUTPUT_FILE = "french_terminology/fhir_r5_french_systems.json"

# Identifiants intéressants pour FHIR R5 et la santé française
IMPORTANT_SYSTEMS = [
    "SNOMED CT",
    "LOINC",
    "CIM-10", 
    "CIM-11",
    "CCAM",
    "NABM",
    "ATC",
    "CIP",
    "UCD",
    "TA",
    "JDV",
    "INS",
    "ROL",
    "CPS"
]

def load_json_file(file_path):
    """Charger un fichier JSON"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Erreur lors du chargement de {file_path}: {str(e)}")
        return None

def extract_important_systems():
    """Extraire les systèmes importants pour la France à partir des CodeSystems"""
    system_urls = load_json_file(SYSTEM_URLS_FILE)
    codesystems = load_json_file(CODESYSTEMS_FILE)
    
    french_systems = {}
    french_codes = {}
    
    # Extraire les URL des systèmes importants
    if system_urls:
        for name, url in system_urls.items():
            for important in IMPORTANT_SYSTEMS:
                if important.lower() in name.lower():
                    french_systems[important] = {
                        "name": name,
                        "url": url
                    }
    
    # Extraire quelques codes d'exemple pour chaque système
    if codesystems and "entry" in codesystems:
        for entry in codesystems["entry"]:
            resource = entry.get("resource", {})
            name = resource.get("name", "")
            url = resource.get("url", "")
            
            for important in IMPORTANT_SYSTEMS:
                if important.lower() in name.lower():
                    # Chercher quelques concepts/codes d'exemple
                    concepts = resource.get("concept", [])[:5]  # Limiter à 5 exemples
                    codes = [{"code": c.get("code"), "display": c.get("display")} for c in concepts if "code" in c]
                    
                    if codes:
                        french_codes[important] = {
                            "url": url,
                            "example_codes": codes
                        }
    
    # Combiner les résultats
    result = {
        "french_terminology_systems": french_systems,
        "example_codes": french_codes,
        "recommended_mappings": create_recommended_mappings(french_systems)
    }
    
    # Sauvegarder les résultats
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"Systèmes français extraits et sauvegardés dans {OUTPUT_FILE}")
    return result

def create_recommended_mappings(french_systems):
    """Créer des recommandations de mappings pour les problèmes identifiés"""
    mappings = {
        "identifier_types": {
            "INS-C": {
                "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                "code": "PPN",  # Passeport en FHIR R5
                "display": "Passport Number"
            },
            "INS-NIR": {
                "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                "code": "SN",  # Numéro de sécurité sociale en FHIR R5
                "display": "Subscriber Number"
            },
            "Numéro RPPS": {
                "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                "code": "PRN",  # Numéro professionnel en FHIR R5
                "display": "Provider number"
            }
        },
        "encounter_status": {
            "finished": {
                "fhir_r5_code": "completed",
                "display": "Completed"
            }
        },
        "practitioner_roles": {
            "ODRP": {
                "system": "http://terminology.hl7.org/CodeSystem/v2-0443",
                "code": "GENPHYS",  # Médecin généraliste
                "display": "General Practitioner"
            }
        }
    }
    
    # Ajouter les URL spécifiques pour la France si disponibles
    for system_id, system_data in french_systems.items():
        if system_id == "INS":
            mappings["identifier_systems"] = {
                "ins": system_data["url"]
            }
        elif system_id == "ROL" or "role" in system_id.lower():
            mappings["role_systems"] = {
                "role": system_data["url"]
            }
        elif system_id == "CPS":
            mappings["professional_systems"] = {
                "cps": system_data["url"]
            }
    
    return mappings

if __name__ == "__main__":
    extract_important_systems()