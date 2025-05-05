import { useResourceOutput } from "../../core/output";
import { Resource } from "../../core/resource";
import { Bundle } from "../bundle";
import type { BundleFile } from "../bundle/bundle-file";
import DurableObjectNamespace from "../durable-object-namespace";
import { KVNamespace } from "../kv-namespace";
import { R2Bucket } from "../r2-bucket";
import type { WorkerAssetsOutput } from "./assets";
import { WorkerAssets } from "./assets";
import { WorkerProvider } from "./provider";
import type { WorkerMetadataOutput, WorkersBindingKind } from "./types";
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
      assets?: WorkerAssetsOutput;
      durableObjectNamespaces?: DurableObjectNamespace[];
      bindings?: WorkersBindingKind[];
      bundle: BundleFile[];
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
      outdir: name,
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

  async getDerivedInput() {
    const [assets, bindings, bundle] = await Promise.all([
      useResourceOutput(this.assets),
      this.resolveBindings(),
      useResourceOutput(this.bundle).then((bundle) => bundle.artifacts),
    ]);

    if (assets) {
      bindings.push({
        name: "ASSETS",
        type: "assets",
      });
    }

    return {
      name: this.input.name,
      assets,
      durableObjectNamespaces: Object.values(this.input.bindings ?? {}).filter(
        (binding) => binding instanceof DurableObjectNamespace,
      ),
      bindings,
      bundle,
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
}
