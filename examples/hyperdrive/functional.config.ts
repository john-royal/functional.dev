import { defineConfig } from "functional.dev/config";
import cloudflare from "functional.dev/cloudflare";

export default defineConfig({
  name: "hyperdrive",
  setup() {
    const hyperdrive = new cloudflare.Hyperdrive("hyperdrive", {
      name: "hyperdrive",
      origin: {
        host: process.env.PGHOST as string,
        port: Number(process.env.PGPORT ?? 5432),
        scheme: "postgresql",
        database: process.env.PGDATABASE as string,
        user: process.env.PGUSER as string,
        password: process.env.PGPASSWORD as string,
      },
    });
    new cloudflare.Worker("worker", {
      name: "hyperdrive-test-worker",
      handler: "index.ts",
      url: true,
      bindings: {
        HYPERDRIVE: hyperdrive,
      },
    });
  },
});
