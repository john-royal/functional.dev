import { defineConfig } from "./src/config";
import { KVNamespace } from "./src/components/kv-namespace";
import { R2Bucket } from "./src/components/r2-bucket";

const config = defineConfig({
  name: "test",
  setup: () => {
    const kv = new KVNamespace("test-kv");
    const r2 = new R2Bucket("test-r2");
  },
});

const app = await config();
console.log(Object.fromEntries(await app.plan("up")));
