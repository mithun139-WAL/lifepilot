import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}", // Adjust paths based on your project structure
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1D4ED8",
        secondary: "#9333EA",
      },
      spacing: {
        "128": "32rem",
        "144": "36rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      dropShadow: {
        glow: "0 0 8px rgba(59, 130, 246, 0.75)",
      },
      fontFamily: {
        orbitron: ["Orbitron", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        roboto: ["Roboto", "sans-serif"],
      },
      animation: {
        liquid: "liquid 10s infinite ease-in-out",
      },
      keyframes: {
        liquid: {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-5%) translateX(5%)" },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
    },
  },
  
  plugins: [typography],
};

export default config;
