import assert from "node:assert";
import { Resource } from "../../core/resource";
import { useResourceOutput } from "../../core/use-output";
import { Bundle } from "../bundle";
import DurableObjectNamespace from "../durable-object-namespace";
import { KVNamespace } from "../kv-namespace";
import { R2Bucket } from "../r2-bucket";
import type { WorkerAssetsOutput } from "./assets";
import { WorkerAssets } from "./assets";
import { WorkerProvider } from "./provider";
import type {
  SingleStepMigration,
  WorkerMetadataInput,
  WorkerMetadataOutput,
  WorkersBindingKind,
} from "./types";
import { WorkerURL } from "./url";

export interface WorkerInput {
  name: string;
  handler: string;
  url?: boolean;
  assets?: string;
  bindings?: Record<
    string,
    Resource<Resource.Properties> | DurableObjectNamespace | WorkersBindingKind
  >;
}

export interface WorkerProperties extends Resource.Properties {
  provider: "cloudflare";
  kind: "worker";
  input: {
    in: WorkerInput;
    out: {
      name: string;
      metadata: Omit<WorkerMetadataInput, "assets">;
      assets?: WorkerAssetsOutput;
      durableObjectNamespaces?: DurableObjectNamespace[];
      files: {
        name: string;
        content: string;
        type: string;
      }[];
    };
  };
  output: {
    providerId: string;
    in: WorkerMetadataOutput;
    out: {
      url?: string;
    };
  };
}

export class Worker extends Resource<WorkerProperties> {
  readonly kind = "cloudflare:worker";

  bundle: Bundle;
  assets?: WorkerAssets;
  url: WorkerURL;

  constructor(name: string, input: WorkerInput) {
    const bundle = new Bundle(`${name}.bundle`, {
      entrypoints: [input.handler],
      sourcemap: "none",
      outdir: "dist",
      format: "esm",
    });
    const assets = input.assets
      ? new WorkerAssets(`${name}.assets`, {
          scriptName: input.name,
          path: input.assets,
        })
      : undefined;
    const url = new WorkerURL(
      `${name}.url`,
      {
        scriptName: input.name,
        enabled: input.url ?? false,
      },
      {
        dependsOn: [name],
      },
    );

    super(new WorkerProvider(), name, input, {
      dependsOn: [
        bundle.name,
        assets?.name,
        ...Object.values(input.bindings ?? {})
          .filter((binding) => binding instanceof Resource)
          .map((binding) => binding.name),
      ].filter((name) => name !== undefined),
    });

    this.bundle = bundle;
    this.assets = assets;
    this.url = url;
  }

  async getDerivedInput(state?: Resource.State<WorkerProperties>) {
    const [assets, bindings, bundle, durableObjects] = await Promise.all([
      useResourceOutput(this.assets),
      this.resolveBindings(),
      this.resolveBundle(),
      this.resolveDurableObjects(state),
    ]);

    if (this.assets) {
      bindings.push({
        name: "ASSETS",
        type: "assets",
      });
    }

    return {
      name: this.input.name,
      metadata: {
        main_module: bundle.entryPointName,
        bindings,
        migrations: durableObjects.migrations,
        compatibility_date: "2025-05-04",
        compatibility_flags: ["nodejs_compat"],
      },
      assets,
      durableObjectNamespaces: durableObjects.durableObjectNamespaces,
      files: bundle.files,
    };
  }

  private async resolveBindings() {
    return await Promise.all(
      Object.entries(this.input.bindings ?? {}).map(
        async ([name, resource]): Promise<WorkersBindingKind> => {
          if (
            !(resource instanceof Resource) &&
            !(resource instanceof DurableObjectNamespace)
          ) {
            return resource;
          }
          if (resource instanceof KVNamespace) {
            const output = await useResourceOutput(resource);
            return {
              name,
              type: "kv_namespace",
              namespace_id: output.id,
            };
          }
          if (resource instanceof R2Bucket) {
            return {
              name,
              type: "r2_bucket",
              bucket_name: resource.input.name,
            };
          }
          if (resource instanceof DurableObjectNamespace) {
            return {
              name,
              type: "durable_object_namespace",
              class_name: resource.className,
              environment: resource.environment,
              namespace_id: resource.namespaceId,
              script_name: resource.scriptName,
            };
          }
          throw new Error(`Unsupported binding type: ${resource}`);
        },
      ),
    );
  }

  private async resolveBundle() {
    const bundle = await useResourceOutput(this.bundle);
    const entryPoint = bundle.artifacts.find(
      (artifact) => artifact.kind === "entry-point",
    );
    assert(entryPoint, "No entry point found");
    return {
      entryPointName: entryPoint.name,
      files: await Promise.all(
        bundle.artifacts.map(async (artifact) => ({
          name: artifact.name,
          content: await artifact.text(),
          type: "application/javascript+module",
        })),
      ),
    };
  }

  private resolveDurableObjects(state?: Resource.State<WorkerProperties>) {
    const migrations: SingleStepMigration = {};
    const existingObjects = state?.input.durableObjectNamespaces ?? [];
    const currentObjects = Object.values(this.input.bindings ?? {}).filter(
      (binding) => binding instanceof DurableObjectNamespace,
    );
    console.log("existingObjects", existingObjects);
    console.log("currentObjects", currentObjects);
    for (const binding of currentObjects) {
      const existing = existingObjects.find(
        (existingBinding) => existingBinding.id === binding.id,
      );
      console.log("existing", existing);
      if (existing) {
        if (binding.className !== existing.className) {
          migrations.renamed_classes = (
            migrations.renamed_classes ?? []
          ).concat({
            from: existing.className,
            to: binding.className,
          });
        }
        continue;
      }
      if (binding.sqlite) {
        migrations.new_sqlite_classes = (
          migrations.new_sqlite_classes ?? []
        ).concat(binding.className);
      } else {
        migrations.new_classes = (migrations.new_classes ?? []).concat(
          binding.className,
        );
      }
    }
    for (const binding of existingObjects) {
      const current = currentObjects.find(
        (currentBinding) => currentBinding.id === binding.id,
      );
      if (current) {
        continue;
      }
      migrations.deleted_classes = (migrations.deleted_classes ?? []).concat(
        binding.className,
      );
    }
    return {
      migrations: Object.keys(migrations).length === 0 ? undefined : migrations,
      durableObjectNamespaces: currentObjects,
    };
  }
}
