/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0f',
        surface: '#12121c',
        'surface-hover': '#1a1a2e',
        rim: '#1e1e30',
      },
    },
  },
  plugins: [],
}

