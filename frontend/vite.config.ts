import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Partner domains (jicama.tech/events, etc.) reverse-proxy HTML from
  // eventsh.com but cannot serve our hashed asset bundles. Setting an
  // absolute base in production makes the HTML reference
  // https://eventsh.com/assets/*, so browsers load JS/CSS directly from
  // the canonical origin regardless of which domain rendered the page.
  // Override via VITE_PUBLIC_BASE in .env if you ever rehost the bundle.
  const productionBase = env.VITE_PUBLIC_BASE || "https://eventsh.com/";

  return {
    base: mode === "production" ? productionBase : "/",
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(
      Boolean,
    ),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL),
    },
    build: {
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "query-vendor": ["@tanstack/react-query"],
            "ui-vendor": [
              "@radix-ui/react-tooltip",
              "@radix-ui/react-dialog",
              "@radix-ui/react-tabs",
              "@radix-ui/react-select",
              "@radix-ui/react-popover",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-switch",
              "@radix-ui/react-label",
            ],
            "helmet-vendor": ["react-helmet-async"],
            "date-vendor": ["date-fns"],
          },
        },
      },
    },
  };
});
