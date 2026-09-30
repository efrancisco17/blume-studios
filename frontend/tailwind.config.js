/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#ffffff',
          100: '#f9f9f9',
          150: '#f5f5f5',
          200: '#eeeeee',
          300: '#e0e0e0',
          400: '#c0c0c0',
          500: '#999999',
          600: '#666666',
          700: '#444444',
          800: '#222222',
          900: '#000000',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      borderColor: {
        light: '#e0e0e0',
      },
    },
  },
  plugins: [],
};
