/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        barber: {
          black: '#1A1A1A',
          dark: '#0F0F0F',
          red: '#D92525',
          blue: '#1E40AF',
          white: '#F5F5F5',
          gray: '#808080',
          gold: '#C5A059',
        }
      }
    },
  },
  plugins: [],
}