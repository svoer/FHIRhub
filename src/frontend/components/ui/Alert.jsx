import React from 'react';
import { 
  InformationCircleIcon, 
  ExclamationCircleIcon, 
  XCircleIcon, 
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

/**
 * Composant Alert pour afficher des messages d'information, d'erreur, etc.
 * @param {Object} props - Propriétés du composant
 * @param {string} props.variant - Variante de l'alerte (info, success, warning, error)
 * @param {React.ReactNode} props.children - Contenu de l'alerte
 * @param {string} props.className - Classes supplémentaires
 * @param {string} props.title - Titre de l'alerte
 * @param {boolean} props.dismissible - Si l'alerte peut être fermée
 * @param {function} props.onDismiss - Fonction appelée quand l'alerte est fermée
 */
const Alert = ({ 
  variant = 'info', 
  children, 
  className = '',
  title = '',
  dismissible = false,
  onDismiss,
  ...rest 
}) => {
  // Styles de base pour toutes les alertes
  const baseStyles = 'p-4 rounded-lg border';
  
  // Styles et icônes pour chaque variante
  const variantConfig = {
    info: {
      styles: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: <InformationCircleIcon className="h-5 w-5 text-blue-500" />
    },
    success: {
      styles: 'bg-green-50 border-green-200 text-green-800',
      icon: <CheckCircleIcon className="h-5 w-5 text-green-500" />
    },
    warning: {
      styles: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />
    },
    error: {
      styles: 'bg-red-50 border-red-200 text-red-800',
      icon: <XCircleIcon className="h-5 w-5 text-red-500" />
    },
    // Variante spéciale santé
    health: {
      styles: 'bg-gradient-to-r from-fhir-red-50 to-fhir-orange-50 border-fhir-red-200 text-fhir-red-800',
      icon: <InformationCircleIcon className="h-5 w-5 text-fhir-red-500" />
    },
  };
  
  // Vérifier si la variante existe
  const { styles, icon } = variantConfig[variant] || variantConfig.info;
  
  // Combiner tous les styles
  const alertStyles = `
    ${baseStyles}
    ${styles}
    ${className}
  `;
  
  return (
    <div className={alertStyles} role="alert" {...rest}>
      <div className="flex">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium">{title}</h3>
          )}
          <div className={`text-sm ${title ? 'mt-2' : ''}`}>
            {children}
          </div>
        </div>
        {dismissible && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  variant === 'info' ? 'text-blue-500 hover:bg-blue-100 focus:ring-blue-600' :
                  variant === 'success' ? 'text-green-500 hover:bg-green-100 focus:ring-green-600' :
                  variant === 'warning' ? 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600' :
                  variant === 'error' ? 'text-red-500 hover:bg-red-100 focus:ring-red-600' :
                  'text-fhir-red-500 hover:bg-fhir-red-100 focus:ring-fhir-red-600'
                }`}
                onClick={onDismiss}
              >
                <span className="sr-only">Fermer</span>
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alert;