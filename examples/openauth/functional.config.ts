import { defineConfig, KVNamespace, Worker } from "functional.dev";

export default defineConfig({
  name: "openauth",
  setup: () => {
    const kv = KVNamespace("AuthKV", {});
    const issuer = Worker("Issuer", {
      entry: "issuer.ts",
      bindings: [kv],
      url: "workers.dev",
    });
    return [kv, issuer];
  },
});
