import { defineConfig } from "functional.dev/config";
import cloudflare from "functional.dev/cloudflare";

export default defineConfig({
  name: "openauth",
  setup() {
    const kv = new cloudflare.KVNamespace("auth-kv", {
      title: "auth-kv",
    });
    new cloudflare.Worker("issuer", {
      name: "issuer",
      handler: "src/issuer.ts",
      url: true,
      bindings: {
        AUTH_KV: kv,
      },
    });
  },
});
