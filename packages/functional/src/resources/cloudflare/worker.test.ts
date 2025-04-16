import { createContext } from "../../context";
import { Worker } from "./worker";
import { describe, it } from "bun:test";

describe("Worker", () => {
  it("should create a worker", async () => {
    await createContext(
      {
        name: "test",
        environment: "test",
        cwd: process.cwd(),
        out: `${process.cwd()}/.functional/worker-script`,
      },
      async () => {
        const worker = new Worker("test", {
          entry: "./test/worker-script.ts",
        });
        const script = await worker.create();
        console.log(script);
      }
    );
  });
});
