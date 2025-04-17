import type { ResourceOutput } from "./resources/resource";

export * from "./resources/cloudflare";

export interface Config {
  name: string;
  environment?: string;
  setup: <
    Resource extends ResourceOutput<string, any, any, any>
  >() => Resource[];
}

export const defineConfig = (config: Config): Config => config;
