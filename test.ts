import { App, appStorage } from "./src/core/app";
import DurableObjectNamespace from "./src/resources/durable-object-namespace";
import { KVNamespace } from "./src/resources/kv-namespace";
import { R2Bucket } from "./src/resources/r2-bucket";
import { Worker } from "./src/resources/worker";

const proc = process.argv.slice(2);

const app = new App({
  name: "test",
  cwd: process.cwd(),
});
appStorage.enterWith(app);
console.time("init");
await app.init();
console.timeEnd("init");

const kvNamespace = new KVNamespace("test-kv-namespace", {
  title: "test-kv-namespace",
});
const r2Bucket = new R2Bucket("test-r2-bucket", {
  name: "test-r2-bucket",
});
const durableObjectNamespace = new DurableObjectNamespace("test-do", {
  className: "MyDurableObject",
});
new Worker("test-worker", {
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
if (proc.includes("up")) {
  console.time("up");
  await handler.up();
  console.timeEnd("up");
} else if (proc.includes("down")) {
  console.time("down");
  await handler.down();
  console.timeEnd("down");
} else {
  console.log("Usage: bun run test.ts [up|down]");
}
