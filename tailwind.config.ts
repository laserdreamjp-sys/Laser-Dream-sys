import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        gold: {
          50: "#FBF6EA",
          100: "#F5E7C4",
          200: "#EFD79A",
          300: "#E6C066",
          400: "#D9A93E",
          500: "#C4922B",
          600: "#A67820",
          700: "#7D5A18",
          800: "#553D10",
          900: "#332408",
        },
        ink: {
          50: "#F7F6F3",
          100: "#EAE8E2",
          300: "#B7B3A8",
          500: "#7A7568",
          700: "#48453C",
          900: "#242219",
        },
        primary: {
          DEFAULT: "#C4922B",
          foreground: "#332408",
        },
        muted: {
          DEFAULT: "#F7F6F3",
          foreground: "#7A7568",
        },
        destructive: {
          DEFAULT: "#B3432E",
          foreground: "#FFFFFF",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
      },
    },
  },
  plugins: [],
};

export default config;
