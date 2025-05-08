import { defineConfig } from "functional.dev/config";
import cloudflare from "functional.dev/cloudflare";

export default defineConfig({
  name: "durable-object",
  setup() {
    const durableObject = new cloudflare.DurableObjectNamespace(
      "durable-object",
      {
        className: "Counter",
      },
    );
    new cloudflare.Worker("vite-durable-object", {
      name: "vite-durable-object",
      handler: "handler.ts",
      url: true,
      assets: "dist",
      bindings: {
        DURABLE_OBJECT: durableObject,
      },
    });
  },
});
