import {
  defineConfig,
  Worker,
  R2Bucket,
  KVNamespace,
  HyperdriveConfig,
} from "functional.dev";

export default defineConfig({
  name: "my-functional-app",
  setup: () => {
    const hyperdrive = HyperdriveConfig("MyHyperdrive", {
      origin: process.env.DATABASE_URL,
    });
    const bucket = R2Bucket("MyBucket", {});
    const kv = KVNamespace("MyKV", {});
    const auxiliary = Worker("Auxiliary", {
      entry: "./auxiliary.ts",
      url: "workers.dev",
      bindings: [],
    });
    const worker = Worker("Main", {
      entry: "./index.ts",
      url: "workers.dev",
      bindings: [
        hyperdrive,
        bucket,
        kv.binding("KV_WITH_CUSTOM_BINDING_NAME"),
        auxiliary,
      ],
    });
    return [hyperdrive, bucket, kv, auxiliary, worker];
  },
});
