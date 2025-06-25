#!/bin/bash

# Script d'installation simplifié pour FHIRHub
# Version 2.0 - Corrigé pour les erreurs identifiées

echo "=========================================================="
echo "     Installation de FHIRHub - Convertisseur HL7 vers FHIR"
echo "     Version 2.0 - ANS Compatible"
echo "=========================================================="

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Fonction pour afficher les messages
log() {
    case "$1" in
        "ERROR") echo -e "${RED}❌ $2${NC}" ;;
        "SUCCESS") echo -e "${GREEN}✅ $2${NC}" ;;
        "WARN") echo -e "${YELLOW}⚠️ $2${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️ $2${NC}" ;;
    esac
}

# Fonction d'erreur et sortie
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# [1/6] Vérification de l'environnement
log "INFO" "[1/6] Vérification de l'environnement..."

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    error_exit "Node.js non installé. Veuillez installer Node.js v16+ avant de continuer."
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    error_exit "Node.js v16+ requis. Version actuelle: $(node -v)"
fi

log "SUCCESS" "Node.js $(node -v) détecté"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    error_exit "npm non installé"
fi

log "SUCCESS" "npm $(npm -v) détecté"

# [2/6] Création des répertoires
log "INFO" "[2/6] Création des répertoires..."
mkdir -p ./data/conversions ./data/history ./data/outputs ./data/test ./logs ./backups
mkdir -p ./hapi-fhir ./storage/uploads ./storage/exports ./storage/imports ./storage/terminologies
mkdir -p ./storage/db ./french_terminology
log "SUCCESS" "Structure des dossiers créée"

# [3/6] Installation des dépendances npm
log "INFO" "[3/6] Installation des dépendances npm..."

# Vérifier si package.json existe
if [ ! -f "package.json" ]; then
    error_exit "package.json non trouvé. Assurez-vous d'être dans le bon répertoire."
fi

# Installation des dépendances avec gestion d'erreur
log "INFO" "Installation des modules critiques d'abord..."
CRITICAL_MODULES=("axios" "express" "cors" "better-sqlite3" "jsonwebtoken" "uuid")
for module in "${CRITICAL_MODULES[@]}"; do
    if ! node -e "require('$module')" 2>/dev/null; then
        log "INFO" "Installation de $module..."
        npm install "$module" --silent 2>/dev/null || log "WARN" "Échec installation de $module"
    fi
done

# Installation complète des dépendances
if npm ci --silent 2>/dev/null; then
    log "SUCCESS" "Dépendances installées avec npm ci"
elif npm install --silent 2>/dev/null; then
    log "SUCCESS" "Dépendances installées avec npm install"
else
    log "WARN" "Installation standard échouée, tentative de correction..."
    rm -rf node_modules package-lock.json 2>/dev/null
    if npm install --silent 2>/dev/null; then
        log "SUCCESS" "Dépendances installées après nettoyage"
    else
        error_exit "Échec de l'installation des dépendances npm"
    fi
fi

# Rebuild spécifique pour better-sqlite3
log "INFO" "Reconstruction de better-sqlite3..."
if npm rebuild better-sqlite3 --build-from-source --silent 2>/dev/null; then
    log "SUCCESS" "better-sqlite3 recompilé avec succès"
else
    log "WARN" "Échec de la recompilation de better-sqlite3 (peut fonctionner quand même)"
fi

# [4/6] Configuration de l'environnement
log "INFO" "[4/6] Configuration de l'environnement..."

# Créer .env s'il n'existe pas
if [ ! -f ".env" ]; then
    log "INFO" "Création du fichier .env..."
    cat > .env << EOF
# Configuration FHIRHub
NODE_ENV=development
PORT=5000
DATABASE_URL=sqlite:./storage/db/fhirhub.db
DB_PATH=./storage/db/fhirhub.db
LOG_LEVEL=info
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change-this-secret-key-$(date +%s)")
METRICS_ENABLED=true
METRICS_PORT=9091

# FHIR Server
FHIR_SERVER_URL=https://hapi.fhir.org/baseR4

# AI Providers (optionnel)
# MISTRAL_API_KEY=your-key-here
# OPENAI_API_KEY=your-key-here
EOF
    log "SUCCESS" "Fichier .env créé"
else
    log "SUCCESS" "Fichier .env existant conservé"
fi

# [5/6] Vérification des dépendances optionnelles
log "INFO" "[5/6] Vérification des dépendances optionnelles..."

# Vérifier Python pour les terminologies
if command -v python3 &> /dev/null; then
    log "SUCCESS" "Python 3 trouvé: $(python3 --version)"
    
    # Installation des modules Python nécessaires si Python est disponible
    PIP_CMD=""
    if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
        log "SUCCESS" "pip3 trouvé"
    elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
        log "SUCCESS" "pip trouvé"
    fi
    
    # Installation des modules requis si pip est disponible
    if [ ! -z "$PIP_CMD" ]; then
        log "INFO" "Installation des modules hl7 et requests..."
        
        # Essayer différentes méthodes d'installation
        if $PIP_CMD install hl7 requests --quiet 2>/dev/null; then
            log "SUCCESS" "Modules Python installés avec pip standard"
        elif $PIP_CMD install hl7 requests --user --quiet 2>/dev/null; then
            log "SUCCESS" "Modules Python installés avec --user"
        else
            log "WARN" "Installation des modules Python échouée (fonctionnalités limitées)"
        fi
        
        # Vérifier l'installation
        if python3 -c "import hl7, requests" 2>/dev/null; then
            log "SUCCESS" "Modules Python fonctionnels"
        fi
    fi
else
    log "WARN" "Python non trouvé (optionnel pour les terminologies)"
fi

# Vérifier les outils système optionnels
for tool in curl wget; do
    if command -v $tool &> /dev/null; then
        log "SUCCESS" "$tool disponible"
        break
    fi
done

# [6/6] Tests finaux
log "INFO" "[6/6] Tests de validation..."

# Test de la base de données
DB_PATH="./storage/db/fhirhub.db"
DB_DIR=$(dirname "$DB_PATH")
mkdir -p "$DB_DIR"

# Test simple de création de fichier
if touch "$DB_PATH" 2>/dev/null; then
    log "SUCCESS" "Permissions de base de données OK"
else
    error_exit "Impossible d'accéder au répertoire de base de données"
fi

# Test de Node.js avec un module critique
if node -e "require('better-sqlite3')" 2>/dev/null; then
    log "SUCCESS" "Module better-sqlite3 fonctionnel"
else
    log "WARN" "Problème potentiel avec better-sqlite3, tentative de correction..."
    # Tentative de recompilation
    if npm rebuild better-sqlite3 --silent 2>/dev/null; then
        log "SUCCESS" "better-sqlite3 recompilé avec succès"
    else
        log "WARN" "Impossible de recompiler better-sqlite3"
    fi
fi

# Vérifier la structure des services si elle existe
if [ -d "src/services" ]; then
    log "SUCCESS" "Structure src/services détectée"
else
    log "INFO" "Pas de structure src/services (architecture directe utilisée)"
fi

# Vérifier les fichiers essentiels
REQUIRED_FILES=("app.js" "package.json")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log "SUCCESS" "Fichier $file présent"
    else
        error_exit "Fichier requis manquant: $file"
    fi
done

# Test des modules critiques
log "INFO" "Test des modules critiques..."
CRITICAL_MODULES=("axios" "express" "cors" "better-sqlite3")
for module in "${CRITICAL_MODULES[@]}"; do
    if node -e "require('$module')" 2>/dev/null; then
        log "SUCCESS" "Module $module OK"
    else
        log "WARN" "Module $module problématique, tentative de réinstallation..."
        npm install "$module" --silent 2>/dev/null || log "WARN" "Impossible de réinstaller $module"
    fi
done

# Résumé final
echo
echo "=========================================================="
log "SUCCESS" "Installation terminée avec succès!"
echo "=========================================================="
echo
echo "Prochaines étapes:"
echo "1. Vérifiez votre fichier .env si nécessaire"
echo "2. Démarrez l'application avec: ./start-simple.sh"
echo "3. Accédez à http://localhost:5000"
echo
echo "Pour le serveur FHIR local (optionnel):"
echo "- Utilisez: ./start-hapi-fhir.sh"
echo "- URL: http://localhost:8080/fhir"
echo
echo "Documentation: README.md"
echo "=========================================================="