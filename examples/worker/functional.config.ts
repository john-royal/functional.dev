import functional from "functional.dev";

export default functional.defineConfig({
  app: {
    name: "functional-config",
  },
  env: {
    TEST_ENV_VAR: "123",
  },
  setup: ({ env }) => {
    new functional.Worker({
      name: "worker",
      entry: "./index.ts",
      bindings: [env.TEST_ENV_VAR],
    });
  },
});
