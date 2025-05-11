#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import os
from datetime import datetime

"""
Script pour récupérer les informations sur les terminologies françaises
depuis le Serveur Multi-Terminologies (SMT) de l'Agence du Numérique en Santé (ANS)
"""

# URLs et endpoints
BASE_URL = "https://smt.esante.gouv.fr"
SSO_TOKEN_ENDPOINT = f"{BASE_URL}/ans/sso/auth/realms/ANS/protocol/openid-connect/token"
TERMINOLOGY_LIST_ENDPOINT = f"{BASE_URL}/api/terminologies/list"
FHIR_CODESYSTEM_ENDPOINT = f"{BASE_URL}/fhir/CodeSystem"
FHIR_VALUESET_ENDPOINT = f"{BASE_URL}/fhir/ValueSet"

# Répertoire pour sauvegarder les résultats
OUTPUT_DIR = "french_terminology"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_access_token():
    """Obtenir un token d'accès pour les API du SMT"""
    try:
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {
            "grant_type": "client_credentials",
            "client_id": "user-api"
        }
        
        response = requests.post(SSO_TOKEN_ENDPOINT, headers=headers, data=data)
        
        if response.status_code == 200:
            token_data = response.json()
            return token_data.get("access_token")
        else:
            print(f"Erreur d'authentification: {response.status_code} {response.text}")
            # Continuer sans authentification pour les endpoints publics
            return None
    except Exception as e:
        print(f"Erreur lors de l'authentification: {str(e)}")
        return None

def get_terminology_list(token=None):
    """Récupérer la liste des terminologies disponibles"""
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.get(TERMINOLOGY_LIST_ENDPOINT, headers=headers)
        if response.status_code == 200:
            terminologies = response.json()
            
            # Sauvegarder la liste complète
            with open(f"{OUTPUT_DIR}/terminologies_list.json", "w", encoding="utf-8") as f:
                json.dump(terminologies, f, ensure_ascii=False, indent=2)
                
            print(f"Liste de {len(terminologies['terminologies'])} terminologies récupérée.")
            return terminologies
        else:
            print(f"Erreur lors de la récupération des terminologies: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print(f"Erreur lors de la récupération des terminologies: {str(e)}")
        return None

def get_fhir_codesystems(token=None):
    """Récupérer les CodeSystems FHIR"""
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.get(FHIR_CODESYSTEM_ENDPOINT, headers=headers)
        if response.status_code == 200:
            codesystems = response.json()
            
            # Sauvegarder les CodeSystems
            with open(f"{OUTPUT_DIR}/fhir_codesystems.json", "w", encoding="utf-8") as f:
                json.dump(codesystems, f, ensure_ascii=False, indent=2)
                
            print(f"Liste de CodeSystems FHIR récupérée.")
            return codesystems
        else:
            print(f"Erreur lors de la récupération des CodeSystems: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print(f"Erreur lors de la récupération des CodeSystems: {str(e)}")
        return None

def get_fhir_valuesets(token=None):
    """Récupérer les ValueSets FHIR"""
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.get(FHIR_VALUESET_ENDPOINT, headers=headers)
        if response.status_code == 200:
            valuesets = response.json()
            
            # Sauvegarder les ValueSets
            with open(f"{OUTPUT_DIR}/fhir_valuesets.json", "w", encoding="utf-8") as f:
                json.dump(valuesets, f, ensure_ascii=False, indent=2)
                
            print(f"Liste de ValueSets FHIR récupérée.")
            return valuesets
        else:
            print(f"Erreur lors de la récupération des ValueSets: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print(f"Erreur lors de la récupération des ValueSets: {str(e)}")
        return None

def extract_common_system_urls(codesystems, valuesets):
    """Extraire les URLs de systèmes les plus courants pour les mappings"""
    system_urls = {}
    
    if codesystems and "entry" in codesystems:
        for entry in codesystems["entry"]:
            if "resource" in entry and "url" in entry["resource"]:
                name = entry["resource"].get("name", "Inconnu")
                url = entry["resource"]["url"]
                system_urls[name] = url
    
    with open(f"{OUTPUT_DIR}/system_urls.json", "w", encoding="utf-8") as f:
        json.dump(system_urls, f, ensure_ascii=False, indent=2)
    
    return system_urls

def main():
    print("Récupération des informations sur les terminologies françaises...")
    
    # Obtenir un token d'accès (peut être None pour les endpoints publics)
    token = get_access_token()
    
    # Récupérer les données
    terminologies = get_terminology_list(token)
    codesystems = get_fhir_codesystems(token)
    valuesets = get_fhir_valuesets(token)
    
    # Extraire les URLs de systèmes
    if codesystems and valuesets:
        system_urls = extract_common_system_urls(codesystems, valuesets)
        print(f"{len(system_urls)} URLs de systèmes extraites.")
    
    # Générer un rapport de synthèse
    generate_summary_report(terminologies, codesystems, valuesets)
    
    print(f"Données sauvegardées dans le répertoire '{OUTPUT_DIR}'")

def generate_summary_report(terminologies, codesystems, valuesets):
    """Générer un rapport de synthèse des terminologies françaises"""
    report = {
        "date_generation": datetime.now().isoformat(),
        "statistics": {
            "terminologies_count": len(terminologies["terminologies"]) if terminologies and "terminologies" in terminologies else 0,
            "codesystems_count": len(codesystems["entry"]) if codesystems and "entry" in codesystems else 0,
            "valuesets_count": len(valuesets["entry"]) if valuesets and "entry" in valuesets else 0
        },
        "key_french_terminologies": []
    }
    
    # Ajouter les terminologies françaises clés
    if terminologies and "terminologies" in terminologies:
        french_terminologies = [
            t for t in terminologies["terminologies"] 
            if "fr" in t.get("label", {}).keys()
        ]
        
        for term in french_terminologies[:20]:  # Limiter aux 20 premières pour le rapport
            report["key_french_terminologies"].append({
                "id": term.get("id", ""),
                "name": term.get("label", {}).get("fr", term.get("label", {}).get("en", "Inconnu")),
                "version": term.get("version", "")
            })
    
    with open(f"{OUTPUT_DIR}/rapport_synthese.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()