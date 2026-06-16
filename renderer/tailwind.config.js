const path = require('path')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, './app/**/*.{ts,tsx}'),
    path.join(__dirname, './components/**/*.{ts,tsx}'),
    path.join(__dirname, './lib/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        serif:   ['var(--font-source-serif)', 'Georgia', 'serif'],
      },
      colors: {
        parchment: {
          50:  '#faf7f2',
          100: '#f5efe6',
          200: '#ede5d8',
          300: '#e0d5c4',
          400: '#c8b99a',
        },
        ink: {
          DEFAULT: '#2c1810',
          light:   '#6b4c3b',
          muted:   '#a08060',
          deep:    '#3d2b1f',
        },
        teal: {
          DEFAULT: '#4a7c6f',
          dark:    '#3d6760',
        },
        amber: {
          warm: '#c8964a',
        },
      },
    },
  },
  plugins: [],
}
