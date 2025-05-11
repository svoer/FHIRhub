import React from 'react';

/**
 * Bouton personnalisé avec plusieurs variantes
 * @param {Object} props - Propriétés du bouton
 * @param {string} props.variant - Variante du bouton (primary, secondary, outline, danger)
 * @param {string} props.size - Taille du bouton (sm, md, lg)
 * @param {boolean} props.fullWidth - Si le bouton doit prendre toute la largeur
 * @param {React.ReactNode} props.children - Contenu du bouton
 * @param {function} props.onClick - Fonction appelée au clic
 * @param {boolean} props.disabled - Si le bouton est désactivé
 * @param {string} props.type - Type du bouton (button, submit, reset)
 * @param {string} props.className - Classes supplémentaires
 */
const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false, 
  children, 
  onClick, 
  disabled = false, 
  type = 'button',
  className = '',
  ...rest
}) => {
  // Styles de base pour tous les boutons
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  // Styles pour chaque variante
  const variantStyles = {
    primary: 'bg-gradient-to-r from-fhir-red-500 to-fhir-orange-500 text-white hover:from-fhir-red-600 hover:to-fhir-orange-600 focus:ring-fhir-red-400',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400',
    outline: 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-400',
    // Variante spéciale e-Santé avec flamme
    health: 'bg-health-blue-500 text-white hover:bg-health-blue-600 focus:ring-health-blue-400',
  };
  
  // Styles pour chaque taille
  const sizeStyles = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  // Styles pour la largeur
  const widthStyles = fullWidth ? 'w-full' : '';
  
  // Styles pour l'état désactivé
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
  
  // Combiner tous les styles
  const buttonStyles = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${widthStyles}
    ${disabledStyles}
    ${className}
  `;
  
  return (
    <button
      type={type}
      className={buttonStyles}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;