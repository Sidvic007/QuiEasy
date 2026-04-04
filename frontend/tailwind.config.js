/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Poppins"', 'sans-serif'],
        body: ['"Poppins"', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#ecfeff',
          100: '#cffafe',
          500: '#7dd3fc',
          600: '#38bdf8',
          700: '#0ea5e9',
          900: '#134e5e',
        },
        surface: '#101f2a',
        card: '#16313d',
        border: '#2f4f62',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        pulse2: 'pulse2 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulse2: { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.05)' } },
      },
    },
  },
  plugins: [],
};
