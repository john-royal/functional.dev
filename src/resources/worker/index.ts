import assert from "node:assert";
import { cloudflareApi } from "../../providers/cloudflare";
import { Resource } from "../../resource";
import Bundle from "../bundle";
import KVNamespace from "../kv-namespace";
import R2Bucket from "../r2-bucket";
import WorkerAssets from "./assets";
import {
  type WorkerMetadataInput,
  WorkerMetadataOutput,
  type WorkersBindingKind,
} from "./types";
import WorkerURL from "./url";

interface WorkerInput {
  name: string;
  handler: string;
  url?: boolean;
  assets?: string;
  bindings?: Record<string, KVNamespace | R2Bucket>;
}

export default class Worker extends Resource<
  "worker",
  WorkerInput,
  WorkerMetadataOutput
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
    context: Resource.Context<WorkerInput, WorkerMetadataOutput>,
  ): Promise<Resource.Action<WorkerMetadataOutput>> {
    if (context.status === "delete") {
      return {
        status: "delete",
        apply: async () => {
          await deleteWorker(context.input.name);
        },
      };
    }
    const dependencies = await Promise.all([
      this.use(this.bundle),
      this.assets ? this.use(this.assets) : undefined,
    ]);
    if (
      context.status === "update" &&
      Bun.deepEquals(this.input, context.input) &&
      dependencies.every(
        (dependency) => !dependency || dependency.status === "none",
      )
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
        const metadata: WorkerMetadataInput = {
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
          bindings: [
            ...(assets
              ? [{ name: "ASSETS", type: "assets" } as WorkersBindingKind]
              : []),
            ...(await this.resolveBindings()),
          ],
        };
        return putWorker(this.input.name, metadata, artifacts);
      },
    };
  }

  private async resolveBindings(): Promise<WorkersBindingKind[]> {
    return Promise.all(
      Object.entries(this.input.bindings ?? {}).map(
        async ([name, resource]) => {
          if (resource instanceof KVNamespace) {
            const output = await this.use(resource);
            return {
              name,
              type: "kv_namespace",
              namespace_id: output.output.id,
            };
          }
          if (resource instanceof R2Bucket) {
            return {
              name,
              type: "r2_bucket",
              bucket_name: resource.input.name,
            };
          }
          throw new Error(`Unsupported binding type: ${resource}`);
        },
      ),
    );
  }
}

const putWorker = async (
  name: string,
  metadata: WorkerMetadataInput,
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
  return await cloudflareApi.put(
    `/accounts/${cloudflareApi.accountId}/workers/scripts/${name}`,
    {
      body: {
        type: "form",
        value: formData,
      },
      responseSchema: WorkerMetadataOutput,
    },
  );
};

const deleteWorker = async (name: string) => {
  return await cloudflareApi.delete(
    `/accounts/${cloudflareApi.accountId}/workers/scripts/${name}`,
  );
};
