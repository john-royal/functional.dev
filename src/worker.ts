import { cloudflareApi, type CloudflareResponse } from "./api";
import { Bundle } from "./bundle";
import { Resource } from "./resource";
import assert from "node:assert";

interface WorkerInput {
  name: string;
  handler: string;
}

type WorkerOutput = {
  name: string;
  metadata: Record<string, string>;
};

export const Worker = Resource<"worker", WorkerInput, WorkerOutput>(
  "worker",
  async (ctx) => {
    if (ctx.phase === "delete") {
      return ctx.result("delete", () => deleteWorker(ctx.output.name));
    }
    const bundle = await ctx.use(Bundle, {
      entrypoints: [ctx.input.handler],
      format: "esm",
    });
    if (bundle.type === "none" && ctx.phase === "update") {
      return ctx.result("none");
    }
    return ctx.result(ctx.phase, async () => {
      const entryPoint = bundle.output.artifacts.find(
        (artifact) => artifact.kind === "entry-point",
      );
      assert(entryPoint, "No entry point found");
      const metadata = {
        main_module: entryPoint.name,
      };
      const files = await Promise.all(
        bundle.output.artifacts.map(async (file) => ({
          name: file.name,
          type: file.kind,
          content: await file.text(),
        })),
      );
      return putWorker(ctx.input.name, metadata, files);
    });
  },
);

const putWorker = async (
  name: string,
  metadata: Record<string, string>,
  files: { name: string; type: string; content: string }[],
) => {
  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], {
      type: "application/json",
    }),
  );
  for (const file of files) {
    formData.append(
      file.name,
      new Blob([file.content], { type: file.type }),
      file.name,
    );
  }
  const res = await cloudflareApi.put(
    `/accounts/${cloudflareApi.accountId}/workers/scripts/${name}`,
    {
      body: {
        type: "form",
        value: formData,
      },
    },
  );
  const json = await res.json<CloudflareResponse<Record<string, string>>>();
  if (!res.ok || !json.success) {
    throw new Error(json.errors[0]?.message ?? "Unknown error");
  }
  return {
    name,
    metadata: json.result,
  };
};

const deleteWorker = async (name: string) => {
  const res = await cloudflareApi.delete(
    `/accounts/${cloudflareApi.accountId}/workers/scripts/${name}`,
  );
  const json = await res.json<CloudflareResponse<never>>();
  if (!res.ok || !json.success) {
    throw new Error(json.errors[0]?.message ?? "Unknown error");
  }
};
