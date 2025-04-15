import { z } from "zod";
import type { Binding } from "./binding";

export const Environment = z.enum(["development", "staging", "production"]);
export type Environment = z.infer<typeof Environment>;

export const AppConfig = z.object({
  name: z.string(),
  environment: Environment.default("development"),
});
export type AppConfig = z.infer<typeof AppConfig>;
export type AppConfigInput = z.input<typeof AppConfig>;

export const Literal = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type Literal = z.infer<typeof Literal>;

const BaseConfig = z.object({
  app: AppConfig,
  env: z.record(z.string(), Literal),
});
export type BaseConfig = z.infer<typeof BaseConfig>;

export const Config = BaseConfig.extend({
  setup: z.function().args(
    z.object({
      app: AppConfig,
      env: z.record(z.string(), z.any()),
    })
  ),
});
export type Config = z.infer<typeof Config>;

export interface ConfigInput<Env extends Record<string, Literal>> {
  app: AppConfigInput;
  env: Env;
  setup: (ctx: { app: AppConfig; env: Record<keyof Env, Binding> }) => void;
}

export const defineConfig = <Env extends Record<string, Literal>>(
  config: ConfigInput<Env>
): Config => {
  return Config.parse({
    app: AppConfig.parse(config.app),
    env: config.env,
    setup: config.setup,
  });
};
