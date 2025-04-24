import { App, context } from "./src/app";
import { KVNamespace } from "./src/components/kv-namespace";
import { R2Bucket } from "./src/components/r2-bucket";
import { defineConfig } from "./src/config";

const config = defineConfig({
  name: "test",
  setup: () => {
    console.log("setup kv");
    const kv = new KVNamespace("test-kv");
    console.log("setup r2");
    const r2 = new R2Bucket("test-r2");
    console.log("setup done");
  },
});

const phase = process.argv[2];
console.log(`[functional] Phase: ${phase}`);

if (!phase || !["up", "down"].includes(phase)) {
  throw new Error(`Invalid phase (expected 'up' or 'down', received ${phase})`);
}

const app = new App({
  name: config.name,
  stage: config.environment ?? "dev",
});
context.enterWith(app);
await app.store.load();
config.setup();
await app.run(phase as "up" | "down").then((result) => {
  if (result.isErr()) {
    console.error(result.error);
  } else {
    console.log("done");
  }
});
