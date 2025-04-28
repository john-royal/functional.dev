import { defineConfig } from "./src/config";

declare module "./src/config" {
  interface Context {
    bucket: R2Resource;
    kv: KVNamespaceResource;
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
})
  .andTee((res) => {
    console.dir(res, { depth: null });
  })
  .mapErr((err) => {
    console.error(err);
    return err;
  });
