import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
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
