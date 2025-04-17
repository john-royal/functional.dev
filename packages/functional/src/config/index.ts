import { defineConfig } from "./config";
import { secret } from "./binding";
import { Worker } from "../resources/cloudflare/worker";

export { defineConfig, Worker, secret };

export type Resource = Worker;

export default {
  defineConfig,
  Worker,
  secret,
};
