import { defineConfig, Worker } from "functional.dev";

export default defineConfig({
  name: "nextjs",
  setup: () => [
    Worker("Main", {
      entry: "./.open-next/worker.js",
      assets: {
        directory: "./.open-next/assets",
      },
      bindings: [
        // {
        //   name: "WORKER_SELF_REFERENCE",
        //   type: "service",
        //   service: "nextjs-development-worker-main",
        // },
        {
          name: "NEXTJS_ENV",
          type: "plain_text",
          text: "production",
        },
      ],
      url: "workers.dev",
    }),
  ],
});
