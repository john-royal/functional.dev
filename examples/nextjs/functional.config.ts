import { defineConfig, KVNamespace, Worker } from "functional.dev";

export default defineConfig({
  name: "nextjs",
  setup: () => {
    return [
      Worker("NextJS", {
        entry: "./.open-next/worker.js",
        assets: {
          directory: "./.open-next/assets",
        },
        url: "workers.dev",
      }),
    ];
  },
});
