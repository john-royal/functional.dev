import functional from "functional.dev";

export default functional.defineConfig({
  name: "my-functional-app",
  env: {
    TEST_PLAIN_TEXT: "123",
  },
  setup: ({ env }) => {
    new functional.Worker({
      name: "worker",
      entry: "./index.ts",
      bindings: [env.TEST_PLAIN_TEXT],
    });
  },
});
