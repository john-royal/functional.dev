import { Context } from "./src/context";
import { cloudflareApi } from "./src/providers/cloudflare";
import R2Bucket from "./src/resources/r2-bucket";
import KVNamespace from "./src/resources/kv-namespace";
import Worker from "./src/resources/worker";

const ctx = new Context("down");
await cloudflareApi.init();
Context.enter(ctx);

const worker = new Worker("test-worker", {
  name: "test-worker",
  handler: "test-worker.ts",
  url: true,
});
const kvNamespace = new KVNamespace("test-kv-namespace", {
  title: "test-kv-namespace",
});
const r2Bucket = new R2Bucket("test-r2-bucket", {
  name: "test-r2-bucket",
});
console.time("test-worker");
await ctx.run();
console.timeEnd("test-worker");
