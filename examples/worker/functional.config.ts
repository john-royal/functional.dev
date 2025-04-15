import functional from "functional.dev";

export default functional.defineConfig({
  name: "functional-config",
  environment: "development",
  setup: () => {
    const worker = new functional.Worker({
      name: "worker",
      entry: "./index.ts",
    });
  },
});
