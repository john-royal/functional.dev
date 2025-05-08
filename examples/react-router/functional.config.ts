import { defineConfig } from "functional.dev/config";
import cloudflare from "functional.dev/cloudflare";
import { Command } from "functional.dev/command";

export default defineConfig({
  name: "react-router",
  setup() {
    new Command("build", {
      command: "bun run build",
      triggers: ["app/**", "public/**", "*.config.ts", "package.json"],
    });
    new cloudflare.Worker(
      "react-router",
      {
        name: "react-router",
        handler: "build/server/index.js",
        assets: "build/client",
        url: true,
        bundle: false,
      },
      {
        dependsOn: ["build"],
      },
    );
  },
});
