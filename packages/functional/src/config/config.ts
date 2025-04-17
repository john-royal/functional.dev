export interface Config {
  name: string;
  setup: () => void;
}

export const defineConfig = (config: Config): Config => config;
