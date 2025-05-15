#!/bin/bash

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${BLUE}   Désinstallation des services systemd pour FHIRHub${NC}"
echo -e "${CYAN}=====================================================================${NC}"

# Vérifier si l'utilisateur est root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Ce script doit être exécuté en tant que superutilisateur (root)${NC}"
  echo -e "Utilisez: ${YELLOW}sudo $0${NC}"
  exit 1
fi

# Arrêter et désactiver les services
echo -e "${YELLOW}Arrêt des services...${NC}"

# D'abord FHIRHub
if systemctl is-active --quiet fhirhub.service; then
  echo -e "${YELLOW}Arrêt du service FHIRHub...${NC}"
  systemctl stop fhirhub.service || {
    echo -e "${RED}Erreur lors de l'arrêt du service FHIRHub${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ Service FHIRHub arrêté${NC}"
else
  echo -e "${YELLOW}Le service FHIRHub n'est pas actif${NC}"
fi

echo -e "${YELLOW}Désactivation du service FHIRHub...${NC}"
systemctl disable fhirhub.service || {
  echo -e "${RED}Erreur lors de la désactivation du service FHIRHub${NC}"
  exit 1
}
echo -e "${GREEN}✓ Service FHIRHub désactivé${NC}"

# Puis HAPI FHIR
if systemctl is-active --quiet hapi-fhir.service; then
  echo -e "${YELLOW}Arrêt du service HAPI FHIR...${NC}"
  systemctl stop hapi-fhir.service || {
    echo -e "${RED}Erreur lors de l'arrêt du service HAPI FHIR${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ Service HAPI FHIR arrêté${NC}"
else
  echo -e "${YELLOW}Le service HAPI FHIR n'est pas actif${NC}"
fi

echo -e "${YELLOW}Désactivation du service HAPI FHIR...${NC}"
systemctl disable hapi-fhir.service || {
  echo -e "${RED}Erreur lors de la désactivation du service HAPI FHIR${NC}"
  exit 1
}
echo -e "${GREEN}✓ Service HAPI FHIR désactivé${NC}"

# Supprimer les fichiers de service
echo -e "${YELLOW}Suppression des fichiers de service...${NC}"
rm -f /etc/systemd/system/fhirhub.service || {
  echo -e "${RED}Erreur lors de la suppression du fichier fhirhub.service${NC}"
  exit 1
}
rm -f /etc/systemd/system/hapi-fhir.service || {
  echo -e "${RED}Erreur lors de la suppression du fichier hapi-fhir.service${NC}"
  exit 1
}
echo -e "${GREEN}✓ Fichiers de service supprimés${NC}"

# Recharger systemd
echo -e "${YELLOW}Rechargement de systemd...${NC}"
systemctl daemon-reload || {
  echo -e "${RED}Erreur lors du rechargement de systemd${NC}"
  exit 1
}
echo -e "${GREEN}✓ Systemd rechargé${NC}"

echo -e "${YELLOW}Faut-il supprimer les fichiers d'application et l'utilisateur fhirhub ?${NC}"
read -p "Supprimer les fichiers d'application et l'utilisateur (o/n) ? " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
  # Supprimer les fichiers d'application
  echo -e "${YELLOW}Suppression des fichiers d'application...${NC}"
  rm -rf /opt/fhirhub || {
    echo -e "${RED}Erreur lors de la suppression des fichiers d'application${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ Fichiers d'application supprimés${NC}"

  # Supprimer l'utilisateur fhirhub
  echo -e "${YELLOW}Suppression de l'utilisateur fhirhub...${NC}"
  userdel -r fhirhub || {
    echo -e "${RED}Erreur lors de la suppression de l'utilisateur fhirhub${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ Utilisateur fhirhub supprimé${NC}"
else
  echo -e "${YELLOW}Les fichiers d'application et l'utilisateur fhirhub sont conservés${NC}"
fi

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${GREEN}Désinstallation des services terminée avec succès !${NC}"
echo -e "${CYAN}=====================================================================${NC}"