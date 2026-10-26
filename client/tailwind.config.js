/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { ink:'#181713', ivory:'#f7f3ea', sand:'#e8ddca', gold:'#b59155', wine:'#6d2338' },
      fontFamily: { serif:['Italiana','serif'], sans:['DM Sans','sans-serif'] },
      boxShadow: { soft:'0 18px 60px rgba(24,23,19,.10)' }
    }
  },
  plugins: []
};
