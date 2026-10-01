/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          light: '#F7F6F3',
          dark: '#0F0F12',
          DEFAULT: '#F7F6F3',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#17171B',
          DEFAULT: '#FFFFFF',
        },
        border: {
          light: '#ECEAE5',
          dark: '#26262F',
          DEFAULT: '#ECEAE5',
        },
        text: {
          light: '#1C1C1E',
          dark: '#F2F2F7',
          DEFAULT: '#1C1C1E',
        },
        muted: {
          light: '#6B6B70',
          dark: '#98989F',
          DEFAULT: '#6B6B70',
        },
        accent: {
          DEFAULT: '#6C63FF',
          hover: '#5A52E0',
          light: '#EEEDFF',
        },
        success: {
          DEFAULT: '#8FB8A8',
          light: '#EBF3F0',
        },
        friction: {
          DEFAULT: '#F08A7E',
          light: '#FDF0EE',
        },
      },
      fontFamily: {
        heading: ['"Inter Tight"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'card': '24px',
        '3xl': '24px',
      },
      boxShadow: {
        'soft': '0 8px 30px rgba(0, 0, 0, 0.04)',
        'float': '0 20px 40px rgba(0, 0, 0, 0.08)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
    },
  },
  plugins: [],
};
