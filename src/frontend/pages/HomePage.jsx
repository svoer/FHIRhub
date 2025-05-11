import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRightIcon, 
  DocumentTextIcon, 
  ServerIcon, 
  CogIcon,
  ChartBarIcon,
  ArrowUpOnSquareIcon
} from '@heroicons/react/24/outline';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

// Import du logo flamme pour l'animation
import flamme from '../assets/flamme.svg';

/**
 * Page d'accueil de l'application
 */
const HomePage = () => {
  return (
    <div className="space-y-8">
      {/* Bannière principale */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-fhir-red-500 to-fhir-orange-500 shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 bg-[size:16px] [mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.6))]"></div>
        <div className="relative px-6 py-12 sm:px-12 sm:py-16">
          <div className="md:flex md:items-center md:justify-between">
            <div className="md:flex-1">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                <span className="block">FHIRHub</span>
                <span className="block text-xl mt-1 font-medium">Convertisseur HL7 vers FHIR</span>
              </h1>
              <p className="mt-4 max-w-lg text-lg text-white/90">
                Solution complète de conversion de messages HL7 v2.5 vers FHIR R4 
                compatible avec les terminologies françaises de santé.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                <Link to="/convert">
                  <Button variant="secondary" size="lg" className="flex items-center justify-center sm:justify-start">
                    Commencer une conversion
                    <ArrowRightIcon className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/applications">
                  <Button variant="outline" size="lg" className="flex items-center justify-center sm:justify-start bg-white/10 text-white border-white/20 hover:bg-white/20">
                    Gérer les applications
                    <CogIcon className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden md:block md:flex-shrink-0">
              <img
                src={flamme}
                alt="Flamme e-Santé"
                className="h-40 w-40 animate-pulse-slow"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Caractéristiques principales */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card withHover>
          <Card.Body>
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gradient-to-r from-fhir-red-500 to-fhir-orange-500 text-white">
              <DocumentTextIcon className="h-6 w-6" />
            </div>
            <Card.Title className="mt-4">Conversion HL7 vers FHIR</Card.Title>
            <Card.Subtitle className="mt-2">
              Convertit les messages HL7 v2.5 au format FHIR R4 compatible avec les spécifications de l'ANS.
            </Card.Subtitle>
            <div className="mt-4">
              <Link to="/convert">
                <Button variant="outline" size="sm" className="flex items-center">
                  Convertir un message
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card.Body>
        </Card>

        <Card withHover>
          <Card.Body>
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gradient-to-r from-fhir-red-500 to-fhir-orange-500 text-white">
              <ServerIcon className="h-6 w-6" />
            </div>
            <Card.Title className="mt-4">API REST sécurisée</Card.Title>
            <Card.Subtitle className="mt-2">
              API complète pour intégrer la conversion HL7 vers FHIR dans vos applications et services.
            </Card.Subtitle>
            <div className="mt-4">
              <Link to="/api-docs">
                <Button variant="outline" size="sm" className="flex items-center">
                  Documentation API
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card.Body>
        </Card>

        <Card withHover>
          <Card.Body>
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gradient-to-r from-fhir-red-500 to-fhir-orange-500 text-white">
              <ArrowUpOnSquareIcon className="h-6 w-6" />
            </div>
            <Card.Title className="mt-4">Surveillance de fichiers</Card.Title>
            <Card.Subtitle className="mt-2">
              Conversion automatique des nouveaux fichiers HL7 déposés dans des répertoires surveillés.
            </Card.Subtitle>
            <div className="mt-4">
              <Link to="/monitor">
                <Button variant="outline" size="sm" className="flex items-center">
                  Configurer la surveillance
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Statistiques */}
      <Card className="mt-8">
        <Card.Header className="bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <Card.Title>Statistiques de conversion</Card.Title>
            <Badge variant="health">Temps réel</Badge>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-fhir-red-600">158</div>
              <div className="text-xs text-gray-500 mt-1">Conversions aujourd'hui</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-fhir-red-600">98.5%</div>
              <div className="text-xs text-gray-500 mt-1">Taux de réussite</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-fhir-red-600">1250</div>
              <div className="text-xs text-gray-500 mt-1">Ressources générées</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-fhir-red-600">250 ms</div>
              <div className="text-xs text-gray-500 mt-1">Temps moyen</div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Link to="/stats">
              <Button variant="secondary" size="sm" className="flex items-center mx-auto">
                <ChartBarIcon className="mr-2 h-4 w-4" />
                Voir les statistiques détaillées
              </Button>
            </Link>
          </div>
        </Card.Body>
      </Card>

      {/* Appel à l'action */}
      <div className="mt-8 bg-gradient-to-r from-fhir-red-50 to-fhir-orange-50 rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-fhir-red-900">Prêt à intégrer FHIRHub ?</h3>
            <p className="mt-2 text-sm text-fhir-red-700">
              Créez une application et obtenez une clé API pour commencer à utiliser notre service de conversion.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link to="/applications/new">
              <Button variant="primary" size="md" className="w-full sm:w-auto">
                Créer une application
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;