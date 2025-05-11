import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Pied de page de l'application
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:flex md:items-center md:justify-between">
          <div className="text-center md:text-left">
            <p className="text-sm text-gray-500">
              &copy; {currentYear} FHIRHub - Convertisseur HL7 vers FHIR R4
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Compatible avec les terminologies françaises de santé
            </p>
          </div>
          
          <div className="mt-4 flex justify-center md:mt-0">
            <div className="flex space-x-6">
              <Link to="/about" className="text-sm text-gray-500 hover:text-fhir-red-500">
                À propos
              </Link>
              <Link to="/help" className="text-sm text-gray-500 hover:text-fhir-red-500">
                Aide
              </Link>
              <Link to="/legal" className="text-sm text-gray-500 hover:text-fhir-red-500">
                Mentions légales
              </Link>
              <a 
                href="https://hl7.org/fhir/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm text-gray-500 hover:text-fhir-red-500"
              >
                FHIR
              </a>
              <a 
                href="https://esante.gouv.fr/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm text-gray-500 hover:text-fhir-red-500"
              >
                ANS
              </a>
            </div>
          </div>
        </div>
        
        {/* Bannière spéciale e-Santé */}
        <div className="py-4 border-t border-gray-100">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="inline-block w-3 h-3 bg-gradient-to-r from-fhir-red-500 to-fhir-orange-500 rounded-full"></span>
              <span>Solution compatible avec les référentiels d'interopérabilité de l'ANS</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;