import { $app, enterContext } from "../src/context";
import { Cache } from "../src/cli/cache";
import { Worker } from "../src/resources/cloudflare/worker";
import { requireCloudflareAccountId } from "../src/resources/cloudflare/api";
import { z } from "zod";
process.on("SIGINT", async () => {
  console.log("SIGINT");
  cache.save();
  process.exit(0);
});

const cache = new Cache(
  `${process.cwd()}/.functional/worker-script/.cache.json`
);

enterContext({
  name: "test",
  environment: "test",
  cwd: process.cwd(),
  out: `${process.cwd()}/.functional/worker-script`,
  cache,
});

console.time("load");
await cache.load();
console.timeEnd("load");

process.on("beforeExit", async () => {
  console.log("beforeExit");
  cache.save();
});

const worker = new Worker("test", {
  entry: "./test/worker-script.ts",
  environment: z.object({
    TEST_PLAIN_TEXT: z.string(),
  }),
});
const script = await worker.dev();
// const script = await worker.create();
console.log(script);

const server = Bun.serve({
  fetch: script.fetch,
  port: 3000,
});

console.log(`Server is running on ${server.url}`);
