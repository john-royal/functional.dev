import { defineConfig, Worker, R2Bucket } from "functional.dev";

export default defineConfig({
  name: "my-functional-app",
  setup: () => {
    const bucket = R2Bucket("MyBucket", {});
    const worker = Worker("Main", {
      entry: "./index.ts",
      url: "workers.dev",
      bindings: [bucket],
    });
    return [bucket, worker];
  },
});
