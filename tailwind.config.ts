import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#15325b", 900: "#0e2444", 700: "#1b4079", 100: "#e7eef8" },
        brand: { DEFAULT: "#2563eb" },
      },
      fontFamily: { sans: ["var(--font-sans)", "Sarabun", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
