import React from 'react';

/**
 * Composant Badge pour afficher un statut ou une étiquette
 * @param {Object} props - Propriétés du composant
 * @param {string} props.variant - Variante du badge (default, success, warning, error, info)
 * @param {React.ReactNode} props.children - Contenu du badge
 * @param {string} props.className - Classes supplémentaires
 */
const Badge = ({ 
  variant = 'default', 
  children, 
  className = '',
  ...rest 
}) => {
  // Styles de base pour tous les badges
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  
  // Styles pour chaque variante
  const variantStyles = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    // Variante spéciale pour la santé (rouge-orange)
    health: 'bg-gradient-to-r from-fhir-red-100 to-fhir-orange-100 text-fhir-red-800',
  };
  
  // Combiner tous les styles
  const badgeStyles = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${className}
  `;
  
  return (
    <span className={badgeStyles} {...rest}>
      {children}
    </span>
  );
};

export default Badge;