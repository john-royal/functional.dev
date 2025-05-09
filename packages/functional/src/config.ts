import { App, type Phase } from "./core/app";
import type { MaybePromise } from "./lib/types";

interface Config {
  name: string;
  setup: () => MaybePromise<void>;
}

const validatePhase = (phase?: string): phase is Phase => {
  if (!phase || !["up", "down", "dev"].includes(phase)) {
    return false;
  }
  return true;
};

export async function defineConfig(config: Config) {
  const phase = process.argv[2];
  if (!validatePhase(phase)) {
    console.log("Usage: bun run functional.config.ts [up|down|dev]");
    return;
  }
  const app = await App.init({
    name: config.name,
    cwd: process.cwd(),
    phase,
  });
  await config.setup();
  await app.run();
}
