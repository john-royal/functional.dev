import { defineConfig } from "functional.dev/config";
import cloudflare from "functional.dev/cloudflare";

export default defineConfig({
  name: "react-router",
  setup() {
    new cloudflare.Worker("react-router", {
      name: "react-router",
      handler: "build/server/index.js",
      assets: "build/client",
      url: true,
    });
  },
});
