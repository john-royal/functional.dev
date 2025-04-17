import functional from "functional.dev";
import { z } from "zod";

export default functional.defineConfig({
  name: "my-functional-app",
  setup: () => {
    new functional.Worker("worker", {
      entry: "./index.ts",
      environment: z.object({
        TEST_PLAIN_TEXT: z.string(),
      }),
    });
  },
});
