import { App } from "./core/app";
import type { MaybePromise } from "./lib/types";

interface Config {
  name: string;
  setup: () => MaybePromise<void>;
}

export async function defineConfig(config: Config) {
  const app = await App.init({
    name: config.name,
    cwd: process.cwd(),
  });
  await config.setup();
  const proc = process.argv[2] as "up" | "down";
  if (["up", "down"].includes(proc)) {
    await app.handler()[proc]();
  } else {
    console.log("Usage: bun run functional.config.ts [up|down]");
  }
}
