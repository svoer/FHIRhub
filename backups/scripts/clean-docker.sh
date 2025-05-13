#!/bin/bash

# Script de nettoyage pour l'environnement Docker
# Utile pour résoudre les problèmes de conteneurs redémarrés continuellement

# Définition des couleurs pour une meilleure lisibilité des logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================================="
echo -e "   Nettoyage de l'environnement Docker FHIRHub"
echo -e "   $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "==========================================================${NC}"

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Erreur: Docker n'est pas installé.${NC}"
  exit 1
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}Erreur: Docker Compose n'est pas installé.${NC}"
  exit 1
fi

echo -e "${YELLOW}⚠️ Ce script va arrêter et supprimer tous les conteneurs, volumes et images liés à FHIRHub.${NC}"
echo -e "${YELLOW}⚠️ Cette action est irréversible et va nettoyer complètement l'environnement Docker.${NC}"
read -p "Êtes-vous sûr de vouloir continuer? [y/N] " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${BLUE}Opération annulée.${NC}"
  exit 0
fi

echo -e "${BLUE}[1/5] Arrêt des conteneurs en cours...${NC}"
# Arrêt de tous les conteneurs docker-compose
if [ -f "./docker-compose.yml" ]; then
  docker-compose down -v
fi

echo -e "${GREEN}✅ Conteneurs docker-compose arrêtés et volumes supprimés${NC}"

echo -e "${BLUE}[2/5] Nettoyage des conteneurs liés à FHIRHub...${NC}"
# Arrêt et suppression de tous les conteneurs FHIRHub spécifiques
for container in $(docker ps -a | grep -i "fhirhub\|grafana\|prometheus\|loki\|promtail" | awk '{print $1}'); do
  echo -e "   Arrêt et suppression du conteneur: $container"
  docker stop $container 2>/dev/null || true
  docker rm -f $container 2>/dev/null || true
done
echo -e "${GREEN}✅ Conteneurs FHIRHub nettoyés${NC}"

echo -e "${BLUE}[3/5] Nettoyage des volumes Docker...${NC}"
# Suppression des volumes Docker
for volume in $(docker volume ls -q | grep -i "fhirhub\|grafana\|prometheus\|loki"); do
  echo -e "   Suppression du volume: $volume"
  docker volume rm $volume 2>/dev/null || true
done
echo -e "${GREEN}✅ Volumes Docker nettoyés${NC}"

echo -e "${BLUE}[4/5] Nettoyage des répertoires locaux pour configuration propre...${NC}"
# Supprimer les répertoires de configuration Grafana et Prometheus
rm -rf ./grafana/provisioning
rm -rf ./grafana/dashboards
rm -rf ./prometheus

# Nettoyer le répertoire de données
read -p "Voulez-vous également nettoyer le répertoire 'data'? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Suppression du répertoire data...${NC}"
  rm -rf ./data
  mkdir -p ./data
  echo -e "${GREEN}✅ Répertoire data nettoyé${NC}"
else
  echo -e "${BLUE}Le répertoire data a été conservé${NC}"
fi

# Nettoyage du répertoire volumes (utilisé dans certaines configurations)
if [ -d "./volumes" ]; then
  read -p "Voulez-vous également nettoyer le répertoire 'volumes'? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Suppression du répertoire volumes...${NC}"
    rm -rf ./volumes
    mkdir -p ./volumes
    echo -e "${GREEN}✅ Répertoire volumes nettoyé${NC}"
  else
    echo -e "${BLUE}Le répertoire volumes a été conservé${NC}"
  fi
fi

echo -e "${BLUE}[5/5] Nettoyage du réseau Docker...${NC}"
# Nettoyage du réseau Docker
for network in $(docker network ls | grep -i "fhirhub" | awk '{print $1}'); do
  echo -e "   Suppression du réseau: $network"
  docker network rm $network 2>/dev/null || true
done
echo -e "${GREEN}✅ Réseau Docker nettoyé${NC}"

echo -e "${CYAN}=========================================================="
echo -e "   ✅ Nettoyage terminé avec succès!"
echo -e ""
echo -e "   Pour réinstaller l'application:"
echo -e "   docker-compose up -d"
echo -e "==========================================================${NC}"