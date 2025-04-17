import { defineConfig, Worker, R2Bucket, KVNamespace } from "functional.dev";

export default defineConfig({
  name: "my-functional-app",
  setup: () => {
    const bucket = R2Bucket("MyBucket", {});
    const kv = KVNamespace("MyKV", {});
    const worker = Worker("Main", {
      entry: "./index.ts",
      url: "workers.dev",
      bindings: [bucket, kv.binding("KV_WITH_CUSTOM_BINDING_NAME")],
    });
    return [bucket, kv, worker];
  },
});
