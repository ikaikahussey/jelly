/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        koa: {
          50: '#f6f5f0',
          100: '#e8e5d8',
          200: '#d4ceb5',
          300: '#bdb28c',
          400: '#a99a6e',
          500: '#968458',
          600: '#7d6c49',
          700: '#65553c',
          800: '#554835',
          900: '#4a3f30',
        },
        kai: {
          50: '#eff8ff',
          100: '#dbeffe',
          200: '#bfe3fe',
          300: '#93d2fd',
          400: '#60b8fa',
          500: '#3b9af6',
          600: '#257ceb',
          700: '#1d65d8',
          800: '#1e52af',
          900: '#1e478a',
        },
        lehua: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
    },
  },
  plugins: [],
};
