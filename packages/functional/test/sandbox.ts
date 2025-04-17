import { enterContext } from "../src/context";
import { Worker } from "../src/resources/cloudflare/worker";

process.on("SIGINT", () => {
  console.log("SIGINT");
  script.stop();
  process.exit(0);
});

enterContext({
  name: "test",
  environment: "test",
  cwd: process.cwd(),
  out: `${process.cwd()}/.functional/worker-script`,
});

const worker = new Worker("test", {
  entry: "./test/worker-script.ts",
});
const script = await worker.dev();

const server = Bun.serve({
  fetch: script.fetch,
  port: 3000,
});

console.log(`Server is running on ${server.url}`);
