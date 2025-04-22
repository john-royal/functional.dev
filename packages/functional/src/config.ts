interface Config {
  name: string;
  environment?: string;
  setup: () => void;
}

export const defineConfig = (config: Config): Config => config;
