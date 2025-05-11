import React from 'react';
import NavBar from './NavBar';
import Footer from './Footer';

/**
 * Layout principal de l'application
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Contenu de la page
 * @param {Object} props.user - Utilisateur connecté
 * @param {function} props.onLogout - Fonction de déconnexion
 */
const MainLayout = ({ children, user, onLogout }) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <NavBar user={user} onLogout={onLogout} />
      
      <main className="flex-grow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default MainLayout;