/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: '#0b1220',
        panel: '#111827',
        line: '#1f2937',
        muted: '#9ca3af',
        accent: '#10b981',
        warn: '#f59e0b',
        bad: '#ef4444'
      }
    }
  },
  plugins: []
}
