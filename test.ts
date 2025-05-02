import { Context } from "./src/context";
import Worker from "./src/resources/worker";
import KVNamespace from "./src/resources/kv-namespace";

const ctx = new Context("down");
Context.enter(ctx);

const kv = new KVNamespace("test-kv", { title: "test" });
const worker = new Worker("test-worker", {
  name: "test-worker",
  handler: "test-worker.ts",
});
await ctx.run();
