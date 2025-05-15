#!/bin/bash

# Script d'installation pour l'application FHIRHub
# Convertisseur HL7 v2.5 vers FHIR R4 avec terminologies françaises
# Version 1.2.0

echo "=========================================================="
echo "     Installation de FHIRHub - Convertisseur HL7 vers FHIR"
echo "     Version 1.2.0 - ANS Compatible"
echo "=========================================================="

# Définir les variables pour Node.js intégré
NODE_VERSION="20.15.1"
NODE_DIR="node-v${NODE_VERSION}-linux-x64"
NODE_ARCHIVE="${NODE_DIR}.tar.gz"
NODE_URL="https://nodejs.org/download/release/v${NODE_VERSION}/${NODE_ARCHIVE}"
NODE_LOCAL_PATH="./vendor/nodejs"

# Créer le répertoire vendor s'il n'existe pas
mkdir -p ./vendor ./storage/db ./data/db

# Vérification de l'environnement
echo "[1/7] Vérification de l'environnement..."

# Fonction pour désinstaller complètement Node.js du système
uninstall_nodejs() {
  echo "🧹 Désinstallation des versions existantes de Node.js..."
  
  # Désinstallation de Node.js selon le gestionnaire de paquets disponible
  if command -v apt-get &> /dev/null; then
    echo "   Utilisation d'apt-get pour désinstaller Node.js..."
    sudo apt-get remove -y nodejs npm || true
    sudo apt-get purge -y nodejs npm || true
    sudo apt-get autoremove -y || true
  elif command -v dnf &> /dev/null; then
    echo "   Utilisation de dnf pour désinstaller Node.js..."
    sudo dnf remove -y nodejs npm || true
    sudo dnf autoremove -y || true
  elif command -v yum &> /dev/null; then
    echo "   Utilisation de yum pour désinstaller Node.js..."
    sudo yum remove -y nodejs npm || true
    sudo yum autoremove -y || true
  fi

  # Suppression des répertoires Node.js locaux
  echo "   Suppression des répertoires Node.js locaux..."
  rm -rf ~/.npm
  rm -rf ~/.node-gyp
  rm -rf ./vendor/nodejs
  
  # Suppression des liens symboliques
  if [ -L "/usr/bin/node" ]; then
    sudo rm -f /usr/bin/node
  fi
  if [ -L "/usr/bin/npm" ]; then
    sudo rm -f /usr/bin/npm
  fi
  
  # Vérification de la désinstallation
  if command -v node &> /dev/null; then
    echo "⚠️ Impossible de désinstaller Node.js complètement du système."
    echo "   Certains chemins de Node.js restent accessibles : $(which node)"
    echo "   L'installation locale sera quand même utilisée."
  else
    echo "✅ Node.js a été complètement désinstallé du système."
  fi
}

# Désinstallation automatique de Node.js
echo "🧹 Désinstallation automatique des versions existantes de Node.js..."
uninstall_nodejs

# Vérifier et installer les mises à jour système sur AlmaLinux/RHEL
if command -v dnf &> /dev/null; then
  echo "Vérification et installation des mises à jour système avec dnf..."
  echo "Exécution de sudo dnf update..."
  sudo dnf update -y || true
  echo "Exécution de sudo dnf upgrade..."
  sudo dnf upgrade -y || true
  echo "✅ Mise à jour système terminée"
fi

# Fonction pour télécharger et installer Node.js localement
install_local_nodejs() {
  echo "📦 Installation locale de Node.js v${NODE_VERSION}..."
  
  # Toujours nettoyer les installations précédentes pour éviter les conflits
  echo "   Nettoyage des installations précédentes..."
  rm -rf "${NODE_LOCAL_PATH}"
  rm -rf "./vendor/${NODE_DIR}"
  
  # Re-créer le répertoire vendor
  mkdir -p "./vendor"
  
  # Vérifier si l'archive existe déjà et si elle est valide
  if [ ! -f "./vendor/${NODE_ARCHIVE}" ] || [ ! -s "./vendor/${NODE_ARCHIVE}" ]; then
    echo "   Téléchargement de Node.js v${NODE_VERSION}..."
    rm -f "./vendor/${NODE_ARCHIVE}"  # Supprimer le fichier s'il existe mais est vide
    
    # Vérifier si curl ou wget est disponible
    if command -v curl &> /dev/null; then
      curl -L -o "./vendor/${NODE_ARCHIVE}" "${NODE_URL}" --progress-bar
    elif command -v wget &> /dev/null; then
      wget -O "./vendor/${NODE_ARCHIVE}" "${NODE_URL}" --show-progress
    else
      echo "❌ Ni curl ni wget n'est installé. Impossible de télécharger Node.js."
      echo "   Veuillez installer curl ou wget, ou installer Node.js manuellement."
      exit 1
    fi
    
    if [ $? -ne 0 ] || [ ! -s "./vendor/${NODE_ARCHIVE}" ]; then
      echo "❌ Échec du téléchargement de Node.js."
      exit 1
    fi
  else
    echo "   Archive Node.js trouvée, vérification..."
    # Vérifier si l'archive est valide
    if ! tar -tzf "./vendor/${NODE_ARCHIVE}" &> /dev/null; then
      echo "   Archive Node.js corrompue, nouvelle tentative de téléchargement..."
      rm -f "./vendor/${NODE_ARCHIVE}"
      if command -v curl &> /dev/null; then
        curl -L -o "./vendor/${NODE_ARCHIVE}" "${NODE_URL}" --progress-bar
      elif command -v wget &> /dev/null; then
        wget -O "./vendor/${NODE_ARCHIVE}" "${NODE_URL}" --show-progress
      fi
    else
      echo "   Archive Node.js validée."
    fi
  fi
  
  # Extraire l'archive
  echo "   Extraction de Node.js..."
  mkdir -p "${NODE_LOCAL_PATH}"
  
  # Extraction avec gestion d'erreur détaillée
  if ! tar -xzf "./vendor/${NODE_ARCHIVE}" -C "./vendor/"; then
    echo "❌ Échec de l'extraction de l'archive Node.js. Vérification des permissions..."
    # Vérifier si c'est un problème de permissions
    chmod -R 755 "./vendor"
    if ! tar -xzf "./vendor/${NODE_ARCHIVE}" -C "./vendor/"; then
      echo "❌ L'extraction a échoué même avec les permissions corrigées."
      exit 1
    fi
  fi
  
  if [ ! -d "./vendor/${NODE_DIR}" ]; then
    echo "❌ Le répertoire extrait n'existe pas. L'extraction a probablement échoué."
    exit 1
  fi
  
  # Déplacer les fichiers avec gestion d'erreur
  echo "   Déplacement des fichiers Node.js..."
  if ! cp -rf "./vendor/${NODE_DIR}"/* "${NODE_LOCAL_PATH}/"; then
    echo "❌ Impossible de copier les fichiers Node.js. Vérification des permissions..."
    chmod -R 755 "./vendor/${NODE_DIR}"
    if ! cp -rf "./vendor/${NODE_DIR}"/* "${NODE_LOCAL_PATH}/"; then
      echo "❌ La copie a échoué même avec les permissions corrigées."
      exit 1
    fi
  fi
  
  # Nettoyer
  rm -rf "./vendor/${NODE_DIR}"
  
  # Rendre les binaires exécutables
  echo "   Configuration des permissions des binaires..."
  chmod +x "${NODE_LOCAL_PATH}/bin/node"
  chmod +x "${NODE_LOCAL_PATH}/bin/npm"
  
  # Exporter les variables d'environnement pour utiliser la version locale
  export PATH="${PWD}/${NODE_LOCAL_PATH}/bin:$PATH"
  export USE_LOCAL_NODEJS=1
  
  # Vérifier l'installation
  if [ ! -f "${PWD}/${NODE_LOCAL_PATH}/bin/node" ]; then
    echo "❌ Fichier binaire node introuvable dans ${PWD}/${NODE_LOCAL_PATH}/bin/"
    ls -la "${PWD}/${NODE_LOCAL_PATH}/bin/" || echo "Impossible de lister le répertoire"
    exit 1
  fi
  
  if ! "${PWD}/${NODE_LOCAL_PATH}/bin/node" --version &> /dev/null; then
    echo "❌ Le binaire node existe mais ne peut pas être exécuté."
    file "${PWD}/${NODE_LOCAL_PATH}/bin/node" || echo "Impossible d'examiner le fichier"
    exit 1
  fi
  
  echo "✅ Node.js v${NODE_VERSION} installé localement avec succès."
  echo "   Version locale de Node.js utilisée: $("${PWD}/${NODE_LOCAL_PATH}/bin/node" --version)"
}

# Déterminer si Node.js est déjà installé sur le système
use_system_nodejs=false
use_local_nodejs=true

# Installation automatique de Node.js local pour une meilleure portabilité
echo "📦 Installation automatique de Node.js v${NODE_VERSION} localement..."
install_local_nodejs

# Modification du script de démarrage pour utiliser le Node.js local
if [ "$use_local_nodejs" = true ]; then
  # Sauvegarder une copie du script de démarrage original si nécessaire
  if [ ! -f "./start.sh.orig" ]; then
    cp ./start.sh ./start.sh.orig
  fi
  
  # Modifier le script de démarrage pour utiliser le Node.js local
  sed -i "s|^node app.js|\"${PWD}/${NODE_LOCAL_PATH}/bin/node\" app.js|g" ./start.sh
  echo "   ✓ Script de démarrage modifié pour utiliser Node.js local."
  
  # S'assurer que le script HAPI FHIR est exécutable
  chmod +x ./start-hapi-fhir.sh
  echo "   ✓ Script HAPI FHIR rendu exécutable."
fi

# Utiliser le Node.js local pour le reste de l'installation si nécessaire
if [ "$use_local_nodejs" = true ]; then
  NODE_CMD="${PWD}/${NODE_LOCAL_PATH}/bin/node"
  NPM_CMD="${PWD}/${NODE_LOCAL_PATH}/bin/npm"
else
  NODE_CMD="node"
  NPM_CMD="npm"
fi

echo "✅ Environnement compatible (Node.js $(${NODE_CMD} -v))"

# Création des répertoires nécessaires
echo "[2/7] Création des répertoires..."
mkdir -p ./data/conversions ./data/history ./data/outputs ./data/test ./logs ./backups
mkdir -p ./hapi-fhir ./storage/uploads ./storage/exports ./storage/imports ./storage/terminologies
echo "✅ Structure des dossiers de données créée"

# Téléchargement automatique des dépendances volumineuses
echo "[2.1/7] Vérification des dépendances volumineuses..."
if [ -f "./download-dependencies.sh" ]; then
  echo "   Exécution du script de téléchargement des dépendances..."
  chmod +x ./download-dependencies.sh
  bash ./download-dependencies.sh
else
  # Vérifier et configurer HAPI FHIR manuellement si le script n'existe pas
  echo "   Script download-dependencies.sh non trouvé. Vérification manuelle..."
  
  HAPI_JAR="./hapi-fhir/hapi-fhir-server-starter-5.4.0.jar"
  if [ ! -f "$HAPI_JAR" ]; then
    echo "   Le serveur HAPI FHIR n'existe pas encore."
    echo "   Il sera téléchargé automatiquement lors du premier démarrage du serveur FHIR."
    echo "   Utilisez le script start-hapi-fhir.sh pour démarrer le serveur FHIR quand nécessaire."
  else
    echo "   ✅ Le serveur HAPI FHIR existe déjà ($HAPI_JAR)."
  fi
fi

# Installation des dépendances
echo "[3/7] Installation des dépendances..."

# Vérifier si Python est disponible
echo "   Vérification de Python..."
if command -v python3 &> /dev/null; then
  PYTHON_CMD="python3"
  echo "   ✅ Python 3 trouvé: $(python3 --version)"
elif command -v python &> /dev/null; then
  PYTHON_VERSION=$(python --version 2>&1)
  if [[ $PYTHON_VERSION == Python\ 3* ]]; then
    PYTHON_CMD="python"
    echo "   ✅ Python 3 trouvé: $PYTHON_VERSION"
  else
    echo "   ⚠️ Python $PYTHON_VERSION trouvé, mais Python 3 est recommandé"
    PYTHON_CMD="python"
  fi
else
  echo "   ⚠️ Python non trouvé. Certaines fonctionnalités pourraient ne pas être disponibles."
  PYTHON_CMD=""
fi

# Installation des modules Python nécessaires si Python est disponible
if [ ! -z "$PYTHON_CMD" ]; then
  echo "   Installation des modules Python requis..."
  
  # Vérifier si pip est disponible
  PIP_CMD=""
  if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
    echo "   ✅ pip3 trouvé"
  elif command -v pip &> /dev/null; then
    PIP_CMD="pip"
    echo "   ✅ pip trouvé"
  else
    echo "   ⚠️ pip non trouvé, tentative d'installation..."
    
    # Tentative d'installation de pip
    if [ "$PYTHON_CMD" = "python3" ]; then
      # Pour les distributions basées sur Debian/Ubuntu
      if command -v apt-get &> /dev/null; then
        echo "   Tentative d'installation de pip avec apt-get..."
        apt-get update -qq && apt-get install -y python3-pip >/dev/null 2>&1
      # Pour les distributions basées sur RHEL/CentOS/Fedora/AlmaLinux
      elif command -v dnf &> /dev/null; then
        echo "   Tentative d'installation de pip avec dnf (AlmaLinux/RHEL/CentOS)..."
        sudo dnf install -y python3-pip || true
      elif command -v yum &> /dev/null; then
        echo "   Tentative d'installation de pip avec yum..."
        yum install -y python3-pip >/dev/null 2>&1
      # Installation manuelle de pip si les gestionnaires de paquets ne sont pas disponibles
      else
        echo "   Tentative d'installation manuelle de pip..."
        curl -s https://bootstrap.pypa.io/get-pip.py -o get-pip.py
        $PYTHON_CMD get-pip.py --quiet
        rm -f get-pip.py
      fi
      
      # Vérifier si l'installation a réussi
      if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
        echo "   ✅ pip3 installé avec succès"
      elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
        echo "   ✅ pip installé avec succès"
      fi
    fi
  fi
  
  # Installation des modules requis si pip est disponible
  if [ ! -z "$PIP_CMD" ]; then
    echo "   Installation des modules hl7 et requests..."
    # Tentative d'installation avec la nouvelle approche pour Python 3.12+
    # --break-system-packages est nécessaire pour Python 3.12+ 
    $PIP_CMD install hl7 requests --quiet --break-system-packages || $PIP_CMD install hl7 requests --quiet || true
    
    # Vérifier si l'installation a réussi
    if $PYTHON_CMD -c "import hl7" &> /dev/null && $PYTHON_CMD -c "import requests" &> /dev/null; then
      echo "   ✅ Modules Python installés avec succès"
    else
      echo "   ⚠️ Impossible d'installer les modules Python. Utilisez un environnement virtuel si nécessaire."
      echo "   Commande: python3 -m venv .venv && source .venv/bin/activate && pip install hl7 requests"
    fi
  else
    echo "   ⚠️ Impossible d'installer pip. Les modules Python requis n'ont pas été installés."
    echo "   Pour installer manuellement, exécutez: $PYTHON_CMD -m pip install hl7 requests"
  fi
fi

# Installation des dépendances Node.js
echo "   Installation des modules Node.js..."
$NPM_CMD install

# Configuration de l'environnement
echo "[4/7] Configuration de l'environnement..."

# Création du répertoire storage pour la nouvelle structure
echo "   Création des répertoires de stockage pour la structure optimisée..."
mkdir -p ./storage/db ./storage/logs ./storage/backups ./storage/data
echo "   ✅ Structure de répertoires optimisée créée"

if [ ! -f "./.env" ]; then
  cat > ./.env << EOF
# Configuration FHIRHub
PORT=5001
DB_PATH=./storage/db/fhirhub.db
DB_FILE=./storage/db/fhirhub.db
LOG_LEVEL=info
JWT_SECRET=$(openssl rand -hex 32)
METRICS_ENABLED=true
METRICS_PORT=9091
# Installation locale de Prometheus et Grafana
PROMETHEUS_LOCAL=false
GRAFANA_LOCAL=false
EOF
  echo "✅ Fichier .env créé avec succès"
else
  # Mettre à jour .env existant avec les nouveaux chemins
  echo "   Mise à jour du fichier .env existant avec les nouveaux chemins..."
  if grep -q "PORT=5000" ./.env; then
    sed -i 's/PORT=5000/PORT=5001/g' ./.env
    echo "   ✅ Port mis à jour de 5000 à 5001"
  fi
  
  if grep -q "DB_PATH=./data/" ./.env; then
    sed -i 's|DB_PATH=./data/|DB_PATH=./storage/db/|g' ./.env
    echo "   ✅ Chemin DB_PATH mis à jour"
  fi
  
  if grep -q "DB_FILE=./data/" ./.env; then
    sed -i 's|DB_FILE=./data/|DB_FILE=./storage/db/|g' ./.env
    echo "   ✅ Chemin DB_FILE mis à jour"
  fi
  
  if ! grep -q "METRICS_ENABLED" ./.env; then
    echo "METRICS_ENABLED=true" >> ./.env
    echo "   ✅ METRICS_ENABLED ajouté"
  fi
  
  if ! grep -q "METRICS_PORT" ./.env; then
    echo "METRICS_PORT=9091" >> ./.env
    echo "   ✅ METRICS_PORT ajouté"
  fi
  
  # Ajouter les options d'installation locale de Prometheus et Grafana
  if ! grep -q "PROMETHEUS_LOCAL" ./.env; then
    echo "# Installation locale de Prometheus et Grafana" >> ./.env
    echo "PROMETHEUS_LOCAL=false" >> ./.env
    echo "   ✅ Option PROMETHEUS_LOCAL ajoutée"
  fi
  
  if ! grep -q "GRAFANA_LOCAL" ./.env; then
    echo "GRAFANA_LOCAL=false" >> ./.env
    echo "   ✅ Option GRAFANA_LOCAL ajoutée"
  fi
  
  echo "✅ Fichier .env mis à jour avec succès"
fi

# Initialisation de la base de données
echo "[5/7] Initialisation de la base de données..."
echo "[DB] Création des tables dans la base de données SQLite..."

# Récupérer le chemin de la base de données depuis .env
DB_PATH=$(grep -oP "(?<=DB_PATH=).*" .env 2>/dev/null || echo "./storage/db/fhirhub.db")
echo "   Utilisation du chemin de base de données: $DB_PATH"

# Vérifier si le répertoire parent existe
DB_DIR=$(dirname "$DB_PATH")
if [ ! -d "$DB_DIR" ]; then
  echo "   Création du répertoire pour la base de données: $DB_DIR"
  mkdir -p "$DB_DIR"
fi

# Vérifier si le fichier de base de données existe
if [ ! -f "$DB_PATH" ]; then
  echo "   Création d'une nouvelle base de données: $DB_PATH"
  touch "$DB_PATH"
  chmod 644 "$DB_PATH"  # Assurer les permissions correctes
fi

# Exécuter l'initialisation de la base de données avec Node.js
echo "   Initialisation des schémas de tables..."

# Créer un script temporaire pour initialiser la base de données
cat > ./init-db.js << 'EOL'
const dbService = require('./src/services/dbService');
const schema = require('./src/db/schema');

async function initializeDatabase() {
  console.log("[DB] Démarrage de l'initialisation de la base de données...");
  
  try {
    // Initialiser le service de base de données
    await dbService.initialize();
    
    // Vérifier si createTables existe (fonction existante dans certaines versions)
    if (typeof dbService.createTables === 'function') {
      // Utiliser la fonction createTables existante
      console.log(`[DB] Utilisation de dbService.createTables()...`);
      await dbService.createTables();
    } else {
      // Créer toutes les tables définies dans le schéma manuellement
      for (const table of schema.ALL_SCHEMAS) {
        console.log(`[DB] Création de la table ${table.tableName}...`);
        await dbService.run(`CREATE TABLE IF NOT EXISTS ${table.tableName} (${table.columns})`);
      }
    }
    
    // Vérifier si l'utilisateur admin existe déjà
    const adminExists = await dbService.get(
      'SELECT COUNT(*) as count FROM users WHERE username = ?',
      ['admin']
    );
    
    // Créer l'utilisateur admin par défaut si nécessaire
    if (adminExists && adminExists.count === 0) {
      console.log("[DB] Création de l'utilisateur admin par défaut...");
      // Hash pour admin123 avec PBKDF2
      await dbService.run(
        'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
        ['admin', '$pbkdf2-sha512$i=210000,l=64$fgj+8H+oPbUyW0BtYUMnfw$MtYAMZS/G0P5XBtJJWLqGpgGVIQdPZg7gFi7MRbLf1Gx3LeC7YzNaOiNCs5zlVLcHGZVrOQdSYnT5MAcYQBm1g', 'admin', 'admin@example.com']
      );
    }
    
    // Vérifier si l'application par défaut existe déjà
    const defaultAppExists = await dbService.get(
      'SELECT COUNT(*) as count FROM applications WHERE name = ?',
      ['Default']
    );
    
    // Créer l'application par défaut si nécessaire
    if (defaultAppExists && defaultAppExists.count === 0) {
      console.log("[DB] Création de l'application par défaut...");
      try {
        // Utiliser une requête SQL paramétrique pour éviter les problèmes de citation
        await dbService.run(
          'INSERT INTO applications (name, description) VALUES (?, ?)',
          ['Default', 'Application par défaut pour le convertisseur HL7 v2.5 vers FHIR R4']
        );
        console.log("[DB] Application par défaut créée avec succès");
      } catch (err) {
        console.error("[DB] Erreur lors de la création de l'application par défaut:", err.message);
        
        // Tentative de correction pour les anciennes versions
        try {
          console.log("[DB] Tentative alternative de création d'application...");
          await dbService.run(
            "INSERT INTO applications (name, description) VALUES ('Default', 'Application par défaut')"
          );
          console.log("[DB] Application par défaut créée avec succès (méthode alternative)");
        } catch (fallbackErr) {
          console.error("[DB] Échec de la création d'application:", fallbackErr.message);
        }
      }
    }
    
    // Vérifier quelles colonnes sont disponibles dans la table api_keys
    // PRAGMA retourne normalement plusieurs lignes, donc on utilise query/all au lieu de get
    let tableInfo;
    if (typeof dbService.query === 'function') {
      tableInfo = await dbService.query("PRAGMA table_info(api_keys)");
    } else {
      // Fallback en utilisant run
      tableInfo = await dbService.run("PRAGMA table_info(api_keys)");
    }
    
    console.log("[DB] Structure de la table api_keys vérifiée");
    
    // Vérifier si la clé API de développement existe déjà
    const devKeyExists = await dbService.get(
      'SELECT COUNT(*) as count FROM api_keys WHERE key = ?',
      ['dev-key']
    );
    
    // Créer la clé API de développement si nécessaire
    if (devKeyExists && devKeyExists.count === 0) {
      console.log("[DB] Création de la clé API de développement...");
      
      try {
        // D'abord, récupérer l'ID de l'application "Default"
        const defaultApp = await dbService.get('SELECT id FROM applications WHERE name = ?', ['Default']);
        
        if (defaultApp && defaultApp.id) {
          // Insérer la clé en utilisant l'ID récupéré
          await dbService.run(
            'INSERT INTO api_keys (application_id, key, name, environment) VALUES (?, ?, ?, ?)',
            [defaultApp.id, 'dev-key', 'Clé de développement', 'development']
          );
          console.log("[DB] Clé API de développement créée avec succès");
        } else {
          // Méthode alternative si on ne peut pas récupérer l'ID
          console.log("[DB] Tentative alternative de création de clé API...");
          await dbService.run(
            "INSERT INTO api_keys (application_id, key, name, environment) VALUES (1, 'dev-key', 'Clé de développement', 'development')"
          );
          console.log("[DB] Clé API de développement créée avec succès (méthode alternative)");
        }
      } catch (err) {
        console.error("[DB] Erreur lors de la création de la clé API:", err.message);
      }
    }
    
    console.log("[DB] Initialisation de la base de données terminée avec succès!");
  } catch (error) {
    console.error("[DB] Erreur lors de l'initialisation de la base de données:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

initializeDatabase();
EOL

# Exécuter le script avec Node.js
echo "   Initialisation de la base de données avec Node.js..."
${NODE_CMD} init-db.js

# Vérifier si l'initialisation a réussi
if [ $? -ne 0 ]; then
  echo "❌ Erreur lors de l'initialisation de la base de données. Vérifiez les logs pour plus de détails."
else
  echo "✅ Base de données initialisée avec succès"
  # Supprimer le script temporaire
  rm -f ./init-db.js
fi

echo "[TERMINOLOGY] Préparation des terminologies françaises..."

# Vérifier que le dossier french_terminology existe et contient les fichiers nécessaires
if [ ! -d "./french_terminology" ]; then
  echo "⚠️ Le dossier french_terminology n'existe pas. Création..."
  mkdir -p ./french_terminology
  mkdir -p ./french_terminology/cache
fi

# Créer ou vérifier le fichier de configuration des OIDs
if [ ! -f "./french_terminology/ans_oids.json" ]; then
  echo "⚠️ Création du fichier ans_oids.json par défaut..."
  cat > ./french_terminology/ans_oids.json << EOF
{
  "version": "1.0.0",
  "lastUpdated": "2025-04-28T10:15:30Z",
  "systems": {
    "ins": "urn:oid:1.2.250.1.213.1.4.8",
    "rpps": "urn:oid:1.2.250.1.71.4.2.1",
    "adeli": "urn:oid:1.2.250.1.71.4.2.2",
    "finess": "urn:oid:1.2.250.1.71.4.2.2"
  }
}
EOF
fi

# Créer ou vérifier le fichier de codes communs
if [ ! -f "./french_terminology/ans_common_codes.json" ]; then
  echo "⚠️ Création du fichier ans_common_codes.json par défaut..."
  cat > ./french_terminology/ans_common_codes.json << EOF
{
  "version": "1.0.0",
  "lastUpdated": "2025-04-28T10:15:30Z",
  "codeSystemMap": {
    "profession": "https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante",
    "specialite": "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale"
  }
}
EOF
fi

# Créer ou vérifier le fichier des systèmes de terminologie
if [ ! -f "./french_terminology/ans_terminology_systems.json" ]; then
  echo "⚠️ Création du fichier ans_terminology_systems.json par défaut..."
  cat > ./french_terminology/ans_terminology_systems.json << EOF
{
  "version": "1.0.0",
  "lastUpdated": "2025-04-28T10:15:30Z",
  "systems": {
    "LOINC": "http://loinc.org",
    "UCUM": "http://unitsofmeasure.org",
    "SNOMED-CT": "http://snomed.info/sct"
  }
}
EOF
fi

# Vérifier que la configuration est complète
if [ ! -f "./french_terminology/config.json" ]; then
  echo "⚠️ Création du fichier config.json par défaut..."
  cat > ./french_terminology/config.json << EOF
{
  "version": "1.0.0",
  "lastUpdated": "2025-04-28T10:15:30Z",
  "cacheEnabled": true,
  "cacheDuration": 86400,
  "defaultLanguage": "fr"
}
EOF
fi

# Finalisation
echo "[6/7] Finalisation de l'installation..."
chmod +x ./start.sh

# Sauvegarder les informations sur le Node.js utilisé
echo "[7/7] Enregistrement des informations d'environnement..."
if [ "$use_local_nodejs" = true ]; then
  echo "✅ Node.js local intégré: v${NODE_VERSION}"
  cat > ./.nodejsrc << EOF
# FHIRHub Node.js Configuration
NODE_VERSION=${NODE_VERSION}
NODE_PATH=${PWD}/${NODE_LOCAL_PATH}/bin
USE_LOCAL_NODEJS=1
EOF
  echo "✅ Fichier .nodejsrc créé pour utiliser le Node.js intégré"
else
  echo "✅ Node.js système utilisé: $(node -v)"
  cat > ./.nodejsrc << EOF
# FHIRHub Node.js Configuration
NODE_VERSION=$(node -v)
NODE_PATH=
USE_LOCAL_NODEJS=0
EOF
  echo "✅ Fichier .nodejsrc créé pour utiliser le Node.js système"
fi

echo "=========================================================="
echo "     ✅ Installation de FHIRHub terminée avec succès"
echo "=========================================================="
echo ""
echo "Pour démarrer l'application :"
echo "  ./start.sh"
echo ""
echo "Pour démarrer avec Prometheus et Grafana locaux (sans Docker) :"
echo "  1. Modifiez le fichier .env pour activer l'installation locale :"
echo "     PROMETHEUS_LOCAL=true"
echo "     GRAFANA_LOCAL=true"
echo "  2. Ou utilisez directement : PROMETHEUS_LOCAL=true GRAFANA_LOCAL=true ./start.sh"
echo ""
echo "Site web accessible sur : http://localhost:5001"
echo "Identifiants par défaut :"
echo "  Utilisateur : admin"
echo "  Mot de passe : admin123"
echo ""
echo "Clé API de test : dev-key"
echo "Documentation API : http://localhost:5001/api-docs"
echo "=========================================================="