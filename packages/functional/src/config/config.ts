import { z } from "zod";

export const Environment = z.enum(["development", "staging", "production"]);
export type Environment = z.infer<typeof Environment>;

export const Config = z.object({
  name: z.string(),
  environment: Environment.default("development"),
  setup: z.function().args(),
});
export type Config = z.infer<typeof Config>;
export type ConfigInput = z.input<typeof Config>;

export const defineConfig = (config: ConfigInput): Config =>
  Config.parse(config);
