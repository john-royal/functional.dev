import type { ResourceOutput } from "./resources/resource";

export * from "./resources/cloudflare";

export interface Config {
  name: string;
  environment?: string;
  setup: () => ResourceOutput<string, any, any, any>[];
}

export const defineConfig = (config: Config): Config => config;
