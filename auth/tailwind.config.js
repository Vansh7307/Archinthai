/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Mirrors the :root custom properties in static/css/styles.css
        // so the auth app matches the rest of the ArchinthAI site.
        archinth: {
          bg: "#f4f1e8",
          bg2: "#e7efe1",
          panel: "#fffcf6",
          panel2: "#f7f5ee",
          text: "#243127",
          muted: "#607062",
          border: "#5f7a59",
          primary: "#6f9b6d",
          secondary: "#a7be8f",
          success: "#4f7c50",
          danger: "#b8644d"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        card: "0 24px 52px rgba(82, 104, 79, .12)"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        "slide-right": {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.25s ease-out both",
        "slide-right": "slide-right 0.3s ease-out both"
      }
    }
  },
  plugins: []
};
