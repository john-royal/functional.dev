import { defineConfig, Worker } from "functional.dev";

export default defineConfig({
  name: "tanstack-start",
  setup: () => [
    Worker("TanstackStart", {
      entry: "./.output/server/index.mjs",
      assets: {
        directory: "./.output/public",
      },
      bindings: [
        {
          type: "plain_text",
          name: "APP_URL",
          text: "https://tanstack-start-development-worker-tanstackstart.johnroyal.workers.dev",
        },
      ],
      url: "workers.dev",
    }),
  ],
});
