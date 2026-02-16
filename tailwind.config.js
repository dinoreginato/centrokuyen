/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        medical: {
          blue: '#0066CC',
          green: '#00AA44',
          light: '#F5F5F5',
          dark: '#666666'
        }
      }
    },
  },
  plugins: [],
}