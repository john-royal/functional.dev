import { defineConfig } from "./config";
import { Worker } from "./worker";
import { secret } from "./binding";

export { defineConfig, Worker, secret };

export type Resource = Worker;

export default {
  defineConfig,
  Worker,
  secret,
};
