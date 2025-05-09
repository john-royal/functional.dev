import { defineConfig } from "functional.dev/config";
import cloudflare from "functional.dev/cloudflare";
import { Secret } from "functional.dev/secret";

export default defineConfig({
  name: "openauth",
  setup() {
    const kv = new cloudflare.KVNamespace("auth-kv", {
      title: "auth-kv",
    });
    const mySecret = new Secret("hahahahaha");
    new cloudflare.Worker("issuer", {
      name: "issuer",
      handler: "src/issuer.ts",
      url: true,
      bindings: {
        AUTH_KV: kv,
        SECRET: mySecret,
        METADATA: { type: "version_metadata" },
      },
    });
  },
});
