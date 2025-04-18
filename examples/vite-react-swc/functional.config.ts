import { defineConfig, Worker } from "functional.dev";

export default defineConfig({
  name: "vite-react-swc",
  environment: "dev",
  setup: () => [
    Worker("Vite", {
      entry: "./worker.ts",
      assets: {
        directory: "./dist",
        config: {
          notFoundHandling: "single-page-application",
        },
      },
      url: "workers.dev",
    }),
  ],
});
