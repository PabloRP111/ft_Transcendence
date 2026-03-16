/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: { // custom colors for the app, can be reused
        gridBlue: "#00f2ff",
        gridOrange: "#ff8c00",
        voidBlack: "#0a0a0a",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Share Tech Mono"', "monospace"],
      },
      boxShadow: {
        neonBlue:
          "0 0 10px rgba(0, 242, 255, 0.7), 0 0 24px rgba(0, 242, 255, 0.35)",
        neonOrange:
          "0 0 8px rgba(255, 140, 0, 0.65), 0 0 22px rgba(255, 140, 0, 0.3)",
      },
    },
  },
  plugins: [],
};
