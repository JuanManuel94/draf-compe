/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arena: '#0a0e1a',
        panel: '#111827',
        ally: '#2563eb',
        enemy: '#dc2626'
      }
    }
  },
  plugins: []
};
