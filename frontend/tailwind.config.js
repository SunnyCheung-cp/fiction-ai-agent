/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0d0f17',
        surface: '#161a28',
        'surface-hover': '#1f2438',
        rim: '#2e3354',
      },
    },
  },
  plugins: [],
}

