import { Context } from "./src/context";
import { cloudflareApi } from "./src/providers/cloudflare";
// import KVNamespace from "./src/resources/kv-namespace";
import Worker from "./src/resources/worker";

const ctx = new Context("down");
await cloudflareApi.init();
Context.enter(ctx);

const worker = new Worker("test-worker", {
  name: "test-worker",
  handler: "test-worker.ts",
  url: true,
  assets: "./assets",
});
await ctx.run();
