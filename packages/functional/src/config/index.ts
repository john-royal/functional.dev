import { defineConfig } from "./config";
import { Worker } from "./worker";

export { defineConfig, Worker };

export type Resource = Worker;

export default {
  defineConfig,
  Worker,
};
