import type { Config } from 'tailwindcss'

const config: Config = {
  // Scan all renderer source files for class usage.
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],

  // Enable class-based dark mode so Electron can toggle themes at runtime.
  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        // Slate-based neutral palette with a warm paper tone for reading.
        paper: {
          50: '#faf9f7',
          100: '#f2f0ec',
          200: '#e8e4dd',
          900: '#1c1917',
        },
      },
      fontFamily: {
        // Inter for UI chrome; will be loaded via next/font.
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        // Lora for reading body text — serif with good screen rendering.
        serif: ['var(--font-lora)', 'Georgia', 'serif'],
      },
      typography: {
        // Prose styles tuned for comfortable long-form reading.
        DEFAULT: {
          css: {
            maxWidth: '65ch',
            lineHeight: '1.75',
          },
        },
      },
    },
  },

  plugins: [],
}

export default config
