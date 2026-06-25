import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0f766e",
          fg: "#ecfdf5",
          muted: "#5eead4",
        },
        severity: {
          1: "#22c55e",
          2: "#84cc16",
          3: "#eab308",
          4: "#f97316",
          5: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
