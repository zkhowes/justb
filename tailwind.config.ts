import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', '"DM Serif Display"', "Georgia", "serif"],
        serif: ['var(--font-serif)', '"Source Serif 4"', "Georgia", "serif"],
        sans: ['var(--font-sans)', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        accent: "var(--accent)",
      },
    },
  },
  plugins: [],
};
export default config;
