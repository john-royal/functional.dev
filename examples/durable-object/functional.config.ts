import { defineConfig } from "functional.dev/config";
import cloudflare from "functional.dev/cloudflare";
import { Command } from "functional.dev/command";

export default defineConfig({
  name: "durable-object",
  setup() {
    new Command("build", {
      command: "bun run build",
      triggers: ["public/**", "src/**", "*.config.ts", "package.json"],
    });
    const durableObject = new cloudflare.DurableObjectNamespace(
      "durable-object",
      {
        className: "Counter",
      },
    );
    new cloudflare.Worker(
      "vite-durable-object",
      {
        name: "vite-durable-object",
        handler: "handler.ts",
        url: true,
        assets: "dist",
        bindings: {
          DURABLE_OBJECT: durableObject,
        },
      },
      {
        dependsOn: ["build"],
      },
    );
  },
});
