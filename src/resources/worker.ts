import assert from "node:assert";
import {
  type CloudflareResponse,
  cloudflareApi,
} from "../providers/cloudflare";
import { Resource } from "../resource";
import Bundle from "./bundle";
import type KVNamespace from "./kv-namespace";
import WorkerAssets from "./worker-assets";
import WorkerURL from "./worker-url";

interface WorkerInput {
  name: string;
  handler: string;
  url?: boolean;
  assets?: string;
  bindings?: Record<string, KVNamespace>;
}

type WorkerOutput = Record<string, string>;

export default class Worker extends Resource<
  "worker",
  WorkerInput,
  WorkerOutput
> {
  readonly kind = "worker";

  bundle: Bundle;
  assets?: WorkerAssets;
  url: WorkerURL;

  constructor(name: string, input: WorkerInput) {
    super(name, input);
    this.bundle = new Bundle(`${this.name}.bundle`, {
      entrypoints: [this.input.handler],
      sourcemap: "external",
      outdir: "dist",
      format: "esm",
      target: "node",
    });
    this.assets = this.input.assets
      ? new WorkerAssets(`${this.name}.assets`, {
          scriptName: this.input.name,
          path: this.input.assets,
        })
      : undefined;
    this.url = new WorkerURL(
      `${this.name}.url`,
      {
        scriptName: this.input.name,
        enabled: this.input.url ?? false,
      },
      { dependencies: [this.name] },
    );
    this.dependencies.push(this.bundle.name);
  }

  async run(
    context: Resource.Context<WorkerInput, WorkerOutput>,
  ): Promise<Resource.Action<WorkerOutput>> {
    if (context.status === "delete") {
      return {
        status: "delete",
        apply: () => deleteWorker(context.input.name),
      };
    }
    const dependencies = await Promise.all([
      this.use(this.bundle),
      this.assets ? this.use(this.assets) : undefined,
    ]);
    if (
      context.status === "update" &&
      Bun.deepEquals(this.input, context.input) &&
      dependencies.every((dependency) => dependency?.status === "none")
    ) {
      return {
        status: "none",
      };
    }
    return {
      status: context.status,
      apply: async () => {
        const [bundle, assets] = dependencies;
        const artifacts = await Promise.all(
          bundle.output.artifacts.map(async (artifact) => ({
            name: artifact.name.replace("dist/", ""),
            type:
              artifact.kind === "entry-point" || artifact.kind === "chunk"
                ? "application/javascript+module"
                : artifact.kind === "sourcemap"
                  ? "application/source-map"
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
          assets: assets
            ? {
                jwt: assets.output.jwt,
                config: {
                  _headers: assets.output.headers,
                  _redirects: assets.output.redirects,
                  run_worker_first: false,
                  html_handling: "drop-trailing-slash",
                  not_found_handling: "404-page",
                },
              }
            : undefined,
          main_module: entryPoint.name,
          observability: { enabled: true },
          compatibility_flags: ["nodejs_compat"],
          compatibility_date: "2025-05-01",
          bindings: assets ? [{ name: "ASSETS", type: "assets" }] : undefined,
        };
        return putWorker(this.input.name, metadata, artifacts);
      },
    };
  }
}

const putWorker = async (
  name: string,
  metadata: Record<string, unknown>,
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
  return json.result;
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
