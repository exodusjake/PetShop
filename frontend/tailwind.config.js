/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#E86A16', dark: '#C95A0F', light: '#F08A3C' },
        link: '#B34D0D', // AA-contrast orange for small text on light backgrounds
        choco: { DEFAULT: '#4A2515', soft: '#7A5A46' },
        cream: '#FFF8F2',
        peach: '#FFE1CC',
        beige: '#F8EDE3',
        softgreen: '#EAF5E5',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['Fredoka', 'Nunito', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 3px 14px rgba(91,42,10,.08)',
        lift: '0 12px 28px rgba(91,42,10,.16)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
