#!/bin/bash

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${BLUE}   Installation des services systemd pour FHIRHub${NC}"
echo -e "${CYAN}=====================================================================${NC}"

# Vérifier si l'utilisateur est root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Ce script doit être exécuté en tant que superutilisateur (root)${NC}"
  echo -e "Utilisez: ${YELLOW}sudo $0${NC}"
  exit 1
fi

# Obtenir le chemin absolu du répertoire de l'application
APP_DIR=$(dirname "$(readlink -f "$0")")
echo -e "${YELLOW}Répertoire de l'application: ${APP_DIR}${NC}"

# Créer l'utilisateur fhirhub s'il n'existe pas déjà
if ! id -u fhirhub &>/dev/null; then
  echo -e "${YELLOW}Création de l'utilisateur fhirhub...${NC}"
  useradd -r -s /bin/bash -d /opt/fhirhub -m fhirhub || {
    echo -e "${RED}Erreur lors de la création de l'utilisateur fhirhub${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ Utilisateur fhirhub créé${NC}"
else
  echo -e "${YELLOW}L'utilisateur fhirhub existe déjà${NC}"
fi

# Créer le répertoire de l'application s'il n'existe pas
if [ ! -d "/opt/fhirhub" ]; then
  echo -e "${YELLOW}Création du répertoire /opt/fhirhub...${NC}"
  mkdir -p /opt/fhirhub || {
    echo -e "${RED}Erreur lors de la création du répertoire /opt/fhirhub${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ Répertoire /opt/fhirhub créé${NC}"
fi

# Copier les fichiers de l'application
echo -e "${YELLOW}Copie des fichiers de l'application vers /opt/fhirhub...${NC}"
cp -rf "$APP_DIR"/* /opt/fhirhub/ || {
  echo -e "${RED}Erreur lors de la copie des fichiers${NC}"
  exit 1
}
echo -e "${GREEN}✓ Fichiers copiés${NC}"

# Définir les permissions
echo -e "${YELLOW}Configuration des permissions...${NC}"
chown -R fhirhub:fhirhub /opt/fhirhub || {
  echo -e "${RED}Erreur lors de la configuration des permissions${NC}"
  exit 1
}
chmod -R 755 /opt/fhirhub || {
  echo -e "${RED}Erreur lors de la configuration des permissions${NC}"
  exit 1
}
chmod +x /opt/fhirhub/start.sh || {
  echo -e "${RED}Erreur lors de la configuration des permissions du script de démarrage${NC}"
  exit 1
}
chmod +x /opt/fhirhub/start-hapi-fhir.sh || {
  echo -e "${RED}Erreur lors de la configuration des permissions du script HAPI FHIR${NC}"
  exit 1
}
echo -e "${GREEN}✓ Permissions configurées${NC}"

# Copier les fichiers des services systemd
echo -e "${YELLOW}Installation des services systemd...${NC}"
cp "$APP_DIR/fhirhub.service" /etc/systemd/system/ || {
  echo -e "${RED}Erreur lors de la copie du fichier fhirhub.service${NC}"
  exit 1
}
cp "$APP_DIR/hapi-fhir.service" /etc/systemd/system/ || {
  echo -e "${RED}Erreur lors de la copie du fichier hapi-fhir.service${NC}"
  exit 1
}
echo -e "${GREEN}✓ Fichiers de service copiés${NC}"

# Recharger systemd
echo -e "${YELLOW}Rechargement de systemd...${NC}"
systemctl daemon-reload || {
  echo -e "${RED}Erreur lors du rechargement de systemd${NC}"
  exit 1
}
echo -e "${GREEN}✓ Systemd rechargé${NC}"

# Activer et démarrer les services
echo -e "${YELLOW}Activation et démarrage des services...${NC}"

# D'abord HAPI FHIR
echo -e "${YELLOW}Activation du service HAPI FHIR...${NC}"
systemctl enable hapi-fhir.service || {
  echo -e "${RED}Erreur lors de l'activation du service HAPI FHIR${NC}"
  exit 1
}
echo -e "${GREEN}✓ Service HAPI FHIR activé${NC}"

echo -e "${YELLOW}Démarrage du service HAPI FHIR...${NC}"
systemctl start hapi-fhir.service || {
  echo -e "${RED}Erreur lors du démarrage du service HAPI FHIR${NC}"
  exit 1
}
echo -e "${GREEN}✓ Service HAPI FHIR démarré${NC}"

# Puis FHIRHub
echo -e "${YELLOW}Activation du service FHIRHub...${NC}"
systemctl enable fhirhub.service || {
  echo -e "${RED}Erreur lors de l'activation du service FHIRHub${NC}"
  exit 1
}
echo -e "${GREEN}✓ Service FHIRHub activé${NC}"

echo -e "${YELLOW}Démarrage du service FHIRHub...${NC}"
systemctl start fhirhub.service || {
  echo -e "${RED}Erreur lors du démarrage du service FHIRHub${NC}"
  exit 1
}
echo -e "${GREEN}✓ Service FHIRHub démarré${NC}"

# Afficher le statut des services
echo -e "${YELLOW}Vérification du statut des services...${NC}"
systemctl status hapi-fhir.service --no-pager || true
systemctl status fhirhub.service --no-pager || true

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${GREEN}Installation des services terminée avec succès !${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${YELLOW}Pour gérer les services, utilisez les commandes suivantes :${NC}"
echo -e "  ${BLUE}sudo systemctl start|stop|restart|status hapi-fhir.service${NC}"
echo -e "  ${BLUE}sudo systemctl start|stop|restart|status fhirhub.service${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${YELLOW}Accès à l'application :${NC}"
echo -e "  ${BLUE}FHIRHub : http://localhost:5001${NC}"
echo -e "  ${BLUE}HAPI FHIR : http://localhost:8080/fhir${NC}"
echo -e "${CYAN}=====================================================================${NC}"