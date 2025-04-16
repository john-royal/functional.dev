import type { BindingValue, Binding } from "./binding";

export type BaseEnv = Record<string, BindingValue | Binding>;

export interface Config<Env extends BaseEnv = BaseEnv> {
  name: string;
  env: Env;
  setup: (ctx: { env: Record<keyof Env, Binding> }) => void;
}

export const defineConfig = <Env extends BaseEnv>(
  config: Config<Env>
): Config<Env> => config;
