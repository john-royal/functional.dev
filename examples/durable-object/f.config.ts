import { App, appStorage } from "functional.dev/src/core/app";
import DurableObjectNamespace from "functional.dev/src/resources/cloudflare/durable-object-namespace";
import Worker from "functional.dev/src/resources/cloudflare/worker";

const app = new App({
  name: "test",
  cwd: process.cwd(),
});
appStorage.enterWith(app);
await app.init();

const durableObject = new DurableObjectNamespace("durable-object", {
  className: "Counter",
});

new Worker("vite-durable-object", {
  name: "vite-durable-object",
  handler: "handler.ts",
  url: true,
  assets: "dist",
  bindings: {
    DURABLE_OBJECT: durableObject,
  },
});

const proc = process.argv[2] as "up" | "down";
if (["up", "down"].includes(proc)) {
  await app.handler()[proc]();
} else {
  console.log("Usage: bun run f.config.ts [up|down]");
}
