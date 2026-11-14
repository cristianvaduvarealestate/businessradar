/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        titanium: {
          950: "#090a0f",
          900: "#111318",
          850: "#161922",
          800: "#1d212c",
          700: "#2d3345",
          600: "#444d66",
          500: "#606b8b",
          400: "#8a95b3",
          300: "#b5bed4",
          200: "#dce1ee",
          100: "#f0f3fa",
        },
        radar: {
          green: "#10b981",
          emerald: "#059669",
          cyan: "#06b6d4",
          amber: "#f59e0b",
          rose: "#f43f5e",
        }
      },
    },
  },
  plugins: [],
};
