/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#F06A2A', // Buttons/Hover: Orange
          dark: '#D3541B',    // Darker shade for interaction
          light: '#F58B57',   // Lighter shade
        },
        deep: '#121212',      // Background: Negro profundo
        secondary: '#1E1E1E', // Sections: Gris oscuro
        surface: '#1E1E1E',   // Surface mapped to secondary for consistency
        text: {
          main: '#FFFFFF',    // Texto principal: Blanco
          muted: '#B3B3B3',   // Texto secundario: Gris claro
        },
        border: '#333333',    // General borders: Dark Grey for dark mode
        accent: '#F5B32F',    // Details/Fine lines: Gold
        details: '#F5B32F',   // Explicit 'details' key for clarity
      },
      fontFamily: {
        sans: ['Spline Sans', 'sans-serif'],
      },
      borderRadius: {
        'custom': '8px',
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
