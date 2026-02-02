import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // =========================================
        // CASA LEÑA OFFICIAL BRAND COLORS
        // =========================================

        // Primary Brand Color (Orange)
        primary: {
          DEFAULT: '#F7941D',
          hover: '#e8891a',
          light: '#ffc107',
        },

        // Background Colors
        background: {
          DEFAULT: '#F9F7F2', // Beige suave - fondo general
          white: '#FFFFFF',   // Tarjetas, modales, inputs
        },

        // Text Colors
        text: {
          dark: '#2D2D2D',    // Títulos principales
          medium: '#757575',   // Texto secundario
          light: '#9E9E9E',   // Deshabilitado
        },

        // Status Colors
        success: '#27AE60',   // Verde - Completado, Pagado
        error: '#EB5757',     // Rojo - Cancelar, Eliminar
        warning: '#F2C94C',   // Amarillo - Preparando, Stock bajo

        // Border & Dividers
        border: {
          DEFAULT: '#E0E0E0', // Bordes finos, líneas divisorias
          light: '#F0F0F0',
        },

        // Legacy colors (keep for backward compatibility)
        secondary: '#1F2937',
        surface: '#ffffff',
        'surface-dark': '#2d2318',
        'background-light': '#F9F7F2',
        'background-dark': '#231a0f',
        'text-main': '#2D2D2D',
        'text-sub': '#757575',
        'border-light': '#E0E0E0',
      },
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
        pill: "9999px",
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;

