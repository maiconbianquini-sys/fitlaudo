/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#e8f7f5',
          100: '#c5ebe7',
          200: '#9edad3',
          300: '#6dc9be',
          400: '#4ab9aa',
          500: '#2D9D8F',
          600: '#238f82',
          700: '#1a7d71',
          800: '#116c61',
          900: '#054e46',
        },
      },
    },
  },
  plugins: [],
}
