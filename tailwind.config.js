/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./src/renderer/index.html", "./src/renderer/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- ROUTELENS BRAND BACKGROUND TOKENS ---
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",

        // --- BRIDGE: MAPPING LEGACY NAMES TO NEW THEME ---
        bg: "hsl(var(--background))",
        "bg-darker": "hsl(var(--background))", // or map to secondary if needed
        "bg-card": "hsl(var(--card))",
        "bg-hover": "hsl(var(--accent))",
        "border-main": "hsl(var(--border))",
        "text-main": "hsl(var(--foreground))",
        "text-alt": "hsl(var(--muted-foreground))",
        "accent-hover": "hsl(var(--accent))", // fallback

        // --- STANDARD SHADCN COLORS ---
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
