import {
  cloudflareApi,
  type CloudflareResponse,
} from "../providers/cloudflare";
import { Resource } from "../resource";
import Bundle from "./bundle";
import assert from "node:assert";

interface WorkerInput {
  name: string;
  handler: string;
}

type WorkerOutput = Record<string, string>;

export default class Worker extends Resource<
  "worker",
  WorkerInput,
  WorkerOutput
> {
  readonly kind = "worker";

  async run(
    context: Resource.Context<WorkerInput, WorkerOutput>,
  ): Promise<Resource.Action<WorkerOutput>> {
    if (context.status === "delete") {
      return {
        status: "delete",
        apply: () => deleteWorker(context.input.name),
      };
    }
    const bundle = await this.use(Bundle, "bundle", {
      entrypoints: [this.input.handler],
      outdir: "dist",
      format: "esm",
    });
    if (bundle.status === "none" && context.status === "update") {
      return {
        status: "none",
      };
    }
    return {
      status: context.status,
      apply: async () => {
        const artifacts = await Promise.all(
          bundle.output.artifacts.map(async (artifact) => ({
            name: artifact.name.replace("dist/", ""),
            type:
              artifact.kind === "entry-point" || artifact.kind === "chunk"
                ? "application/javascript+module"
                : artifact.kind === "sourcemap"
                  ? "application/sourcemap"
                  : "application/octet-stream",
            content: await artifact.text(),
            kind: artifact.kind,
          })),
        );
        const entryPoint = artifacts.find(
          (artifact) => artifact.kind === "entry-point",
        );
        assert(entryPoint, "No entry point found");
        const metadata = {
          main_module: entryPoint.name,
        };
        return putWorker(this.input.name, metadata, artifacts);
      },
    };
  }
}

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
    console.log({
      status: res.status,
      statusText: res.statusText,
      errors: json.errors,
    });
    throw new Error(json.errors[0]?.message ?? "Unknown error", {
      cause: json.errors,
    });
  }
  return metadata;
};

const deleteWorker = async (name: string) => {
  const res = await cloudflareApi.delete(
    `/accounts/${cloudflareApi.accountId}/workers/scripts/${name}`,
  );
  const json = await res.json<CloudflareResponse<never>>();
  if (!res.ok || !json.success) {
    console.log({
      status: res.status,
      statusText: res.statusText,
      errors: json.errors,
    });
    throw new Error(json.errors[0]?.message ?? "Unknown error", {
      cause: json.errors,
    });
  }
};
