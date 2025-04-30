import { CFClient } from "../src/cloudflare/client";
import { Worker } from "../src/components/worker";
import { Store } from "../src/lib/store";
import { Scope, App } from "../src/scope";
import { join } from "path";

const root = __dirname;

const app = new App("my-test-app", root);
await app.store.load();
const scope = new Scope(app, "my-test-app");

const worker = new Worker(scope, "my-worker", {
  path: join(root, "worker.ts"),
  url: true,
});
app.prepare("up").mapErr((error) => {
  console.error(error);
});
