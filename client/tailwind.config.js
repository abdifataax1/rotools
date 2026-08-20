export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: '#07090f',
        panel: '#0d111b',
        line: 'rgba(255,255,255,.1)',
        neon: '#65e4ff',
        mint: '#74f6b1',
        rose: '#ff5ea8'
      },
      boxShadow: {
        glow: '0 0 60px rgba(101, 228, 255, .18)',
        card: '0 22px 80px rgba(0, 0, 0, .35)'
      }
    }
  },
  plugins: []
};
