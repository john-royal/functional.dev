import { App, appStorage } from "functional.dev/src/core/app";
import KVNamespace from "functional.dev/src/resources/cloudflare/kv-namespace";
import Worker from "functional.dev/src/resources/cloudflare/worker";

const proc = process.argv.slice(2);

const app = new App({
  name: "test",
  cwd: process.cwd(),
});
appStorage.enterWith(app);
await app.init();
const kv = new KVNamespace("auth-kv", {
  title: "auth-kv",
});
new Worker("issuer", {
  name: "issuer",
  handler: "src/issuer.ts",
  url: true,
  bindings: {
    AUTH_KV: kv,
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
  console.log("Usage: bun run f.config.ts [up|down]");
}
