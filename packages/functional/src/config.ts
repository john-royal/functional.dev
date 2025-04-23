import type { App } from "./app";
import { createApp } from "./app";

interface Config {
  name: string;
  environment?: string;
  setup: () => void | Promise<void>;
}

export const defineConfig = (config: Config): (() => Promise<App>) => {
  return () =>
    createApp(
      {
        name: config.name,
        stage: config.environment ?? "dev",
      },
      config.setup
    );
};
