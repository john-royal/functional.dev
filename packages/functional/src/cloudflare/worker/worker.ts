import { useResourceOutput } from "~/core/output";
import { Resource } from "~/core/resource";
import { Bundle } from "~/bundle";
import { BundleFile } from "~/bundle/bundle-file";
import { DurableObjectNamespace } from "../durable-object-namespace";
import { KVNamespace } from "../kv-namespace";
import { R2Bucket } from "../r2-bucket";
import { type WorkerAssetsOutput, WorkerAssets } from "./assets";
import { WorkerProvider } from "./provider";
import type {
  WorkerMetadataOutput,
  WorkersBindingInput,
  WorkersBindingKind,
} from "./types";
import { WorkerURL } from "./url";
import { nodeFileTrace } from "@vercel/nft";
import { computeFileHash } from "~/lib/file";

export interface WorkerInput {
  name: string;
  handler: string;
  url?: boolean;
  assets?: string;
  bindings?: Record<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: required for binding types
    Resource<any> | DurableObjectNamespace | WorkersBindingInput
  >;
  bundle?: boolean;
}

export interface WorkerProperties extends Resource.Properties {
  provider: "cloudflare";
  kind: "worker";
  input: {
    in: WorkerInput;
    out: {
      name: string;
      assets?: WorkerAssetsOutput & {
        path: string;
      };
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

  static readonly provider: Resource.Provider<WorkerProperties> =
    new WorkerProvider();

  bundle: Bundle | RawBundle;
  assets?: WorkerAssets;
  url: WorkerURL;

  constructor(name: string, input: WorkerInput, metadata?: Resource.Metadata) {
    const bundle =
      input.bundle === false
        ? new RawBundle(
            `${name}.handler-archive`,
            {
              entry: input.handler,
            },
            metadata,
          )
        : new Bundle(
            `${name}.bundle`,
            {
              entrypoints: [input.handler],
              sourcemap: "external",
              outdir: name,
              format: "esm",
              minify: { whitespace: true, syntax: true, identifiers: false },
            },
            metadata,
          );
    const assets = input.assets
      ? new WorkerAssets(
          `${name}.assets`,
          {
            scriptName: input.name,
            path: input.assets,
          },
          metadata,
        )
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

    super(Worker.provider, name, input, {
      ...metadata,
      dependsOn: [
        ...(metadata?.dependsOn ?? []),
        bundle?.name,
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
      this.resolveBundle(),
    ]);

    if (assets) {
      bindings.push({
        name: "ASSETS",
        type: "assets",
      });
    }

    void this.generateTypes(bindings);

    return {
      name: this.input.name,
      assets: assets
        ? {
            ...assets,
            path: this.input.assets as string,
          }
        : undefined,
      durableObjectNamespaces: Object.values(this.input.bindings ?? {}).filter(
        (binding) => binding instanceof DurableObjectNamespace,
      ),
      bindings,
      bundle,
    };
  }

  private async generateTypes(bindings: WorkersBindingKind[]) {
    const types = {
      assets: "Fetcher",
      kv_namespace: "KVNamespace",
      durable_object_namespace: "DurableObjectNamespace",
      hyperdrive: "HyperdriveConfig",
      r2_bucket: "R2Bucket",
      plain_text: "string",
      secret_text: "string",
      json: "string",

      ai: "unknown",
      analytics_engine: "unknown",
      browser_rendering: "unknown",
      d1: "unknown",
      dispatch_namespace: "unknown",
      mtls_certificate: "unknown",
      pipelines: "unknown",
      queue: "unknown",
      service: "unknown",
      tail_consumer: "unknown",
      vectorize: "unknown",
      version_metadata: "unknown",
      secrets_store_secret: "unknown",
      secret_key: "unknown",
    };
    const typeDefinition = [
      '/// <reference types="@cloudflare/workers-types" />',
      "",
      "interface CloudflareEnv {",
      ...bindings.map((binding) => {
        const type = types[binding.type];
        return `  ${binding.name}: ${type};`;
      }),
      "}",
      "",
      'declare module "cloudflare:workers" {',
      "  interface Env extends CloudflareEnv {}",
      "}",
      "",
      "type Env = CloudflareEnv;",
      "",
    ];
    await Bun.write("env.d.ts", typeDefinition.join("\n"));
  }

  private async resolveBindings() {
    return await Promise.all(
      Object.entries(this.input.bindings ?? {}).map(
        async ([name, resource]): Promise<WorkersBindingKind> => {
          if (
            !(resource instanceof Resource) &&
            !(resource instanceof DurableObjectNamespace)
          ) {
            return {
              name,
              ...resource,
            };
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
    if (this.bundle instanceof RawBundle) {
      return useResourceOutput(this.bundle).then((bundle) => bundle.artifacts);
    }
    return useResourceOutput(this.bundle).then((bundle) => bundle.artifacts);
  }
}

type RawBundleProperties = Resource.CRUDProperties<
  {
    entry: string;
  },
  {
    artifacts: BundleFile[];
  }
>;

export class RawBundle extends Resource<RawBundleProperties> {
  readonly kind = "raw-bundle";

  static get provider() {
    return new RawBundleProvider();
  }

  constructor(
    name: string,
    input: { entry: string },
    metadata?: Resource.Metadata,
  ) {
    super(RawBundle.provider, name, input, metadata);
  }
}

class RawBundleProvider implements Resource.Provider<RawBundleProperties> {
  create = async (input: Resource.Input<RawBundleProperties>) => {
    const artifacts = await this.readBundle(input);
    return {
      output: {
        artifacts,
      },
    };
  };

  diff = async (
    input: Resource.Input<RawBundleProperties>,
    state: Resource.State<RawBundleProperties>,
  ) => {
    if (!Bun.deepEquals(input, state.input)) {
      return "replace";
    }
    const artifacts = await this.readBundle(input);
    if (!Bun.deepEquals(artifacts, state.output.artifacts)) {
      return "replace";
    }
    return "none";
  };

  private async readBundle(input: Resource.Input<RawBundleProperties>) {
    const { entry: path } = input;
    const artifacts = await nodeFileTrace([path]);
    return await Promise.all(
      Array.from(artifacts.esmFileList.values()).map(async (fileName) => {
        return new BundleFile({
          name: fileName,
          kind: fileName === path ? "entry-point" : "chunk",
          hash: await computeFileHash(Bun.file(fileName)),
          directory: "..",
        });
      }),
    );
  }
}
