import { Context } from "./src/context";
import { App, appStorage } from "./src/core/app";
import { cloudflareApi } from "./src/providers/cloudflare";
import DurableObjectNamespace from "./src/resources/durable-object-namespace";
import { KVNamespace } from "./src/resources/kv-namespace";
import { R2Bucket } from "./src/resources/r2-bucket";
import { Worker } from "./src/resources/worker";

const app = new App({
  name: "test",
  cwd: process.cwd(),
});
appStorage.enterWith(app);
await cloudflareApi.init();

const kvNamespace = new KVNamespace("test-kv-namespace", {
  title: "test-kv-namespace",
});
const r2Bucket = new R2Bucket("test-r2-bucket", {
  name: "test-r2-bucket",
});
const durableObjectNamespace = new DurableObjectNamespace("test-do", {
  className: "MyDurableObject",
});
const worker = new Worker("test-worker", {
  name: "test-worker",
  handler: "test-worker.ts",
  url: true,
  bindings: {
    KV_NAMESPACE: kvNamespace,
    R2_BUCKET: r2Bucket,
    DO_NAMESPACE: durableObjectNamespace,
  },
});
const handler = app.handler();
console.time("run");
await handler.down();
console.timeEnd("run");
