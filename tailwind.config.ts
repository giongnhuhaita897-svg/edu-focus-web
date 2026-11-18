import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        edtech: {
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          text: "#1E293B",
          muted: "#64748B",
          primary: "#2563EB",
          primaryHover: "#1D4ED8",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
          border: "#E2E8F0",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
