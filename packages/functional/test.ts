import { defineConfig } from "./src/config";

declare module "./src/config" {
  interface Context {
    bucket: R2Resource;
    kv: KVResource;
    worker1: WorkerResource;
    worker2: WorkerResource;
  }
}

export default defineConfig({
  name: "test",
  resources: {
    bucket: { type: "r2" },

    kv: { type: "kv" },

    worker1: (ctx) => ({
      type: "worker",
      path: "worker.ts",
      env: {
        BUCKET: ctx.bucket,
        KV: ctx.kv,
      },
    }),

    worker2: (ctx) => ({
      type: "worker",
      path: "worker.ts",
      env: {
        WORKER1: ctx.worker1,
      },
    }),
  },
});
