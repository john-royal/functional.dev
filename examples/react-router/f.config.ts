import Worker from "functional/src/resources/cloudflare/worker";
import { App, appStorage } from "functional/src/core/app";

const proc = process.argv.slice(2);

const app = new App({
  name: "test",
  cwd: process.cwd(),
});
appStorage.enterWith(app);
console.time("init");
await app.init();
console.timeEnd("init");
new Worker("react-router", {
  name: "react-router",
  handler: "build/server/index.js",
  assets: "build/client",
  url: true,
});

const handler = app.handler();
if (proc.includes("up")) {
  console.time("up");
  await handler.up();
  console.timeEnd("up");
} else if (proc.includes("down")) {
  console.time("down");
  await handler.down();
  console.timeEnd("down");
} else {
  console.log("Usage: bun run test.ts [up|down]");
}
