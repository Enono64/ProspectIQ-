/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#05050a',
          surface: '#0a0a12',
          card:    '#0f0f18',
          hover:   '#14141e',
          border:  '#1e1e2c',
          border2: '#28283a',
        },
        acc:    '#ff4500',
        teal:   '#00c896',
        blue:   '#4488ff',
        purple: '#9966ff',
        amber:  '#ffaa00',
        red:    '#ff4466',
        green:  '#44dd88',
        txt: {
          primary:   '#eeeef8',
          secondary: '#8888a8',
          muted:     '#44446a',
        },
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
        sans:    ['Outfit', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
