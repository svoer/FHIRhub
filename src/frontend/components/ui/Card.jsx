import React from 'react';

/**
 * Composant Card pour afficher du contenu dans une boîte stylisée
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Contenu de la carte
 * @param {string} props.className - Classes supplémentaires
 * @param {boolean} props.withShadow - Si la carte doit avoir une ombre
 * @param {boolean} props.withBorder - Si la carte doit avoir une bordure
 * @param {boolean} props.withHover - Si la carte doit avoir un effet au survol
 */
const Card = ({ 
  children, 
  className = '', 
  withShadow = true, 
  withBorder = false,
  withHover = false,
  ...rest 
}) => {
  // Styles de base pour toutes les cartes
  const baseStyles = 'bg-white rounded-xl overflow-hidden';
  
  // Styles pour l'ombre
  const shadowStyles = withShadow ? 'shadow-health' : '';
  
  // Styles pour la bordure
  const borderStyles = withBorder ? 'border border-gray-200' : '';
  
  // Styles pour l'effet au survol
  const hoverStyles = withHover ? 'transition-shadow duration-300 hover:shadow-health-hover' : '';
  
  // Combiner tous les styles
  const cardStyles = `
    ${baseStyles}
    ${shadowStyles}
    ${borderStyles}
    ${hoverStyles}
    ${className}
  `;
  
  return (
    <div className={cardStyles} {...rest}>
      {children}
    </div>
  );
};

/**
 * En-tête de la carte
 */
Card.Header = ({ children, className = '', ...rest }) => (
  <div className={`p-5 border-b border-gray-100 ${className}`} {...rest}>
    {children}
  </div>
);

/**
 * Corps de la carte
 */
Card.Body = ({ children, className = '', ...rest }) => (
  <div className={`p-5 ${className}`} {...rest}>
    {children}
  </div>
);

/**
 * Pied de la carte
 */
Card.Footer = ({ children, className = '', ...rest }) => (
  <div className={`p-5 bg-gray-50 border-t border-gray-100 ${className}`} {...rest}>
    {children}
  </div>
);

/**
 * Titre de la carte
 */
Card.Title = ({ children, className = '', ...rest }) => (
  <h3 className={`text-lg font-semibold text-gray-900 ${className}`} {...rest}>
    {children}
  </h3>
);

/**
 * Sous-titre de la carte
 */
Card.Subtitle = ({ children, className = '', ...rest }) => (
  <p className={`text-sm text-gray-500 mt-1 ${className}`} {...rest}>
    {children}
  </p>
);

export default Card;