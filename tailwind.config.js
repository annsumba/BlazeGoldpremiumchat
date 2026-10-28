/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FFFBE6',
          100: '#FFF3BF',
          200: '#FFE680',
          300: '#FFD700',
          400: '#FFC700',
          500: '#FFA500',
          600: '#CC8400',
          700: '#996300',
          800: '#664200',
          900: '#332100',
        },
        ink: {
          950: '#050505',
          900: '#0A0A0A',
          850: '#121212',
          800: '#1A1A1A',
          750: '#222222',
          700: '#2A2A2A',
          600: '#333333',
          500: '#444444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 20px rgba(255, 215, 0, 0.35)',
        'gold-lg': '0 0 40px rgba(255, 215, 0, 0.45)',
        'gold-sm': '0 0 10px rgba(255, 215, 0, 0.3)',
        'inner-gold': 'inset 0 0 12px rgba(255, 215, 0, 0.25)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
        'gold-gradient-soft': 'linear-gradient(135deg, rgba(255,215,0,0.18) 0%, rgba(255,165,0,0.12) 100%)',
        'gold-radial': 'radial-gradient(circle at 30% 20%, rgba(255,215,0,0.15), transparent 60%)',
      },
      borderRadius: {
        xl2: '16px',
      },
      keyframes: {
        'gold-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,215,0,0.5)' },
          '50%': { boxShadow: '0 0 0 8px rgba(255,215,0,0)' },
        },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        typing: { '0%, 60%, 100%': { transform: 'translateY(0)', opacity: 0.4 }, '30%': { transform: 'translateY(-4px)', opacity: 1 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'gold-pulse': 'gold-pulse 2s infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        typing: 'typing 1.2s infinite ease-in-out',
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [],
};
