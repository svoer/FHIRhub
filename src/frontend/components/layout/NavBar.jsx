import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Bars3Icon, 
  XMarkIcon, 
  UserCircleIcon, 
  ArrowRightOnRectangleIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

// Importation du logo SVG
import logo from '../../assets/logo.svg';
import flamme from '../../assets/flamme.svg';

/**
 * Barre de navigation principale de l'application
 * @param {Object} props - Propriétés du composant
 * @param {Object} props.user - Utilisateur connecté
 * @param {function} props.onLogout - Fonction appelée à la déconnexion
 */
const NavBar = ({ user, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const location = useLocation();
  
  // Toggle le menu mobile
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  
  // Toggle le menu profil
  const toggleProfileMenu = () => setIsProfileMenuOpen(!isProfileMenuOpen);
  
  // Fermer les menus
  const closeAllMenus = () => {
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  };
  
  // Liens de navigation
  const navLinks = [
    { name: 'Accueil', path: '/' },
    { name: 'Convertisseur', path: '/convert' },
    { name: 'Statistiques', path: '/stats' },
    { name: 'Applications', path: '/applications' },
    { name: 'Configuration', path: '/settings' },
  ];
  
  // Vérifier si un lien est actif
  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };
  
  return (
    <nav className="bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          
          {/* Logo et liens de navigation (desktop) */}
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link to="/" onClick={closeAllMenus}>
                <img
                  className="h-10 w-auto"
                  src={logo}
                  alt="FHIRHub Logo"
                />
              </Link>
              <img
                className="h-8 w-auto ml-2 animate-pulse-slow"
                src={flamme}
                alt="Flamme"
              />
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                    isActive(link.path)
                      ? 'text-fhir-red-500 border-b-2 border-fhir-red-500'
                      : 'text-gray-600 hover:text-fhir-red-500 hover:border-b-2 hover:border-fhir-red-200'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Menu profil et bouton mobile */}
          <div className="flex items-center">
            {/* Informations utilisateur */}
            {user ? (
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                <div className="relative ml-3">
                  <div>
                    <button
                      type="button"
                      className="flex items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-fhir-red-500 focus:ring-offset-2"
                      onClick={toggleProfileMenu}
                    >
                      <span className="sr-only">Open user menu</span>
                      <UserCircleIcon className="h-8 w-8 text-gray-400" />
                      <span className="ml-2 text-gray-700">{user.fullName || user.username}</span>
                      <ChevronDownIcon className="ml-1 h-5 w-5 text-gray-400" />
                    </button>
                  </div>
                  
                  {/* Menu profil dropdown */}
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={closeAllMenus}
                      >
                        Mon profil
                      </Link>
                      <button
                        className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          closeAllMenus();
                          onLogout();
                        }}
                      >
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                <Link
                  to="/login"
                  className="flex items-center rounded-md bg-gradient-health from-fhir-red-500 to-fhir-orange-500 px-4 py-2 text-sm font-medium text-white hover:from-fhir-red-600 hover:to-fhir-orange-600 focus:outline-none focus:ring-2 focus:ring-fhir-red-500 focus:ring-offset-2"
                >
                  <ArrowRightOnRectangleIcon className="mr-2 h-5 w-5" />
                  Connexion
                </Link>
              </div>
            )}
            
            {/* Bouton menu mobile */}
            <div className="flex items-center sm:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-fhir-red-500"
                onClick={toggleMobileMenu}
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Menu mobile */}
      {isMobileMenuOpen && (
        <div className="sm:hidden">
          <div className="space-y-1 pt-2 pb-3">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`block px-3 py-2 text-base font-medium ${
                  isActive(link.path)
                    ? 'bg-gradient-to-r from-fhir-red-50 to-fhir-orange-50 border-l-4 border-fhir-red-500 text-fhir-red-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:border-l-4 hover:border-fhir-red-200 hover:text-fhir-red-700'
                }`}
                onClick={closeAllMenus}
              >
                {link.name}
              </Link>
            ))}
          </div>
          
          {/* Informations utilisateur mobile */}
          {user ? (
            <div className="border-t border-gray-200 pt-4 pb-3">
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <UserCircleIcon className="h-10 w-10 text-gray-400" />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">{user.fullName || user.username}</div>
                  {user.email && (
                    <div className="text-sm font-medium text-gray-500">{user.email}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  onClick={closeAllMenus}
                >
                  Mon profil
                </Link>
                <button
                  className="w-full text-left block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  onClick={() => {
                    closeAllMenus();
                    onLogout();
                  }}
                >
                  Déconnexion
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200 pt-4 pb-3">
              <div className="px-4">
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center rounded-md bg-gradient-health from-fhir-red-500 to-fhir-orange-500 px-4 py-2 text-base font-medium text-white hover:from-fhir-red-600 hover:to-fhir-orange-600 focus:outline-none focus:ring-2 focus:ring-fhir-red-500 focus:ring-offset-2"
                  onClick={closeAllMenus}
                >
                  <ArrowRightOnRectangleIcon className="mr-2 h-5 w-5" />
                  Connexion
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default NavBar;