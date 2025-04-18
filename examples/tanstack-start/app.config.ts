import { defineConfig } from "@tanstack/react-start/config";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "unenv";

export default defineConfig({
  tsr: {
    appDirectory: "src",
  },
  server: {
    preset: "cloudflare-module",
    unenv: cloudflare,
  },
  vite: {
    plugins: [
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
    define: {
      "import.meta.env.APP_URL": JSON.stringify(
        "https://tanstack-start-development-worker-tanstackstart.johnroyal.workers.dev"
      ),
    },
  },
});
