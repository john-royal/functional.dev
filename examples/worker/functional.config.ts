import functional from "functional.dev";

export default functional.defineConfig({
  name: "my-functional-app",
  env: {
    TEST_ENV_VAR: "123",
    TEST_SECRET_VAR: functional.secret(),
  },
  setup: ({ env }) => {
    new functional.Worker({
      name: "worker",
      entry: "./index.ts",
      bindings: [env.TEST_ENV_VAR, env.TEST_SECRET_VAR],
    });
  },
});
