/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      { DEFAULT: '#0a0a0f', surface: '#0d0d14', card: '#13131c', border: '#1e1e2a' },
        orange:  { DEFAULT: '#E8601C', dim: '#2a1208', border: '#E8601C44' },
        purple:  { DEFAULT: '#7F77DD', light: '#AFA9EC', dim: '#14122a', border: '#7F77DD44' },
        teal:    { DEFAULT: '#1D9E75', light: '#5DCAA5', dim: '#071a12', border: '#1D9E7544' },
        blue:    { DEFAULT: '#378ADD', light: '#85B7EB', dim: '#08101e', border: '#378ADD44' },
        amber:   { DEFAULT: '#BA7517', light: '#EF9F27', dim: '#1f1a08' },
        red:     { DEFAULT: '#A32D2D', light: '#F09595', dim: '#1f0808' },
        green:   { DEFAULT: '#3B6D11', light: '#97C459', dim: '#0d1a0d' },
        txt:     { primary: '#e8e8f0', secondary: '#b8b8d0', muted: '#5a5a7a' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
