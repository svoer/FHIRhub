/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/frontend/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        'fhir-red': {
          50: '#FFF5F5',
          100: '#FED7D7',
          200: '#FEB2B2',
          300: '#FC8181',
          400: '#F56565',
          500: '#E53E3E',
          600: '#C53030',
          700: '#9B2C2C',
          800: '#822727',
          900: '#63171B',
        },
        'fhir-orange': {
          50: '#FFFAF0',
          100: '#FEECDC',
          200: '#FCD9BD',
          300: '#FDBA8C',
          400: '#FF8A4C',
          500: '#FF5722',
          600: '#DD4B1A',
          700: '#B43C12',
          800: '#8C2E0A',
          900: '#73230D',
        },
        'health-blue': {
          50: '#EBF8FF',
          100: '#BEE3F8',
          200: '#90CDF4',
          300: '#63B3ED',
          400: '#4299E1',
          500: '#3182CE',
          600: '#2B6CB0',
          700: '#2C5282',
          800: '#2A4365',
          900: '#1A365D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-health': 'linear-gradient(135deg, var(--tw-gradient-stops))',
      },
      gradientColorStops: (theme) => ({
        'fhir-red': theme('colors.fhir-red.500'),
        'fhir-orange': theme('colors.fhir-orange.500'),
      }),
      boxShadow: {
        'health': '0 4px 14px 0 rgba(0, 0, 0, 0.1)',
        'health-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}