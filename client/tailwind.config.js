/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Live Kshetra brand ───────────────────────────────────
        live: {
          saffron:     '#FF9933',   // primary brand
          saffronDark: '#e6821a',
          saffronGlow: '#FF993340',
          indigo:      '#4F46E5',
          indigoDark:  '#3730a3',
          bg:          '#0f1117',   // darker canvas
          surface:     '#1e2129',
          surfaceLight:'#282d38',
          tile:        '#252830',
          text:        '#f0f2f5',
          textSoft:    '#9ca3af',
          border:      '#3a3f4b',
        },
        // ── Functional meet colors (kept for UI elements) ────────
        meet: {
          bg:          '#0f1117',
          surface:     '#1e2129',
          surfaceLight:'#282d38',
          tile:        '#252830',
          blue:        '#8ab4f8',
          blueDark:    '#1a73e8',
          red:         '#ea4335',
          green:       '#34a853',
          yellow:      '#fbbc04',
          text:        '#f0f2f5',
          textSoft:    '#9ca3af',
          border:      '#3a3f4b',
        },
      },
      fontFamily: {
        google: ['Google Sans', 'Roboto', 'sans-serif'],
      },
      animation: {
        'float-up':       'float-up 3s ease-out forwards',
        'speaking-ring':  'speaking-ring 1s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-in-up':    'slide-in-up 0.2s ease-out',
        'fade-in':        'fade-in 0.2s ease-out',
        'pop-in':         'pop-in 0.15s ease-out',
        'saffron-pulse':  'saffron-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'float-up':       { '0%': { opacity:'1', transform:'translateY(0) scale(1)' }, '100%': { opacity:'0', transform:'translateY(-120px) scale(1.4)' } },
        'speaking-ring':  { '0%,100%': { boxShadow:'0 0 0 2px #FF9933' }, '50%': { boxShadow:'0 0 0 5px #FF993355' } },
        'slide-in-right': { from: { transform:'translateX(100%)', opacity:'0' }, to: { transform:'translateX(0)', opacity:'1' } },
        'slide-in-up':    { from: { transform:'translateY(20px)', opacity:'0' }, to: { transform:'translateY(0)', opacity:'1' } },
        'fade-in':        { from: { opacity:'0' }, to: { opacity:'1' } },
        'pop-in':         { '0%': { transform:'scale(0.8)', opacity:'0' }, '100%': { transform:'scale(1)', opacity:'1' } },
        'saffron-pulse':  { '0%,100%': { boxShadow:'0 0 0 0 #FF993340' }, '50%': { boxShadow:'0 0 0 12px #FF993310' } },
      },
    },
  },
  plugins: [],
};
