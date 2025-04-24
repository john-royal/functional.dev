import type { App } from "./app";
import { createApp } from "./app";

interface Config {
  name: string;
  environment?: string;
  setup: () => void | Promise<void>;
}

export const defineConfig = (config: Config) => {
  return config;
};
