/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aesthetic clinic color palette
        bg: '#F6F1EA',
        'bg-alt': '#EFE6DC',
        ink: '#2A1E1A',
        'ink-light': '#4A342E',
        'ink-dark': '#2A1E1A',
        'off-white': '#EFE6DC',
        white: '#FFFFFF',
        gold: '#C9AE7E',
        'gold-hover': '#BFA16E',
        'gold-dim': 'rgba(201,174,126,0.5)',
        sand: '#D9C7B5',
        taupe: '#D9C7B5',
        cocoa: '#4A342E',
        'rose-start': '#D9C7B5',
        'rose-mid': '#C9AE7E',
        'rose-end': '#BFA16E',
        border: 'rgba(42,30,26,0.14)',
        'border-md': 'rgba(42,30,26,0.22)',
        error: '#C0392B',
        success: '#5D7A5F',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'Palatino Linotype', 'serif'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        md: '6px',
        sm: '4px',
      },
      spacing: {
        'header-h': '76px',
      },
      maxWidth: {
        container: '1160px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.05)',
        md: '0 4px 20px rgba(0,0,0,0.07)',
        lg: '0 12px 44px rgba(0,0,0,0.10)',
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
    },
  },
  plugins: [],
}
