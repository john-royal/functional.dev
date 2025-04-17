import { defineConfig, Worker } from "functional.dev";

export default defineConfig({
  name: "my-functional-app",
  setup: () => {
    const worker = Worker("Main", {
      entry: "./index.ts",
    });
    return [worker];
  },
});
