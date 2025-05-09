import type { Bindable } from "~/binding";
import { Bundle } from "~/bundle";
import { BundleFile } from "~/bundle/bundle-file";
import { TraceInputPlugin } from "~/bundle/plugins";
import { $app } from "~/core/app";
import { $run } from "~/core/lifecycle";
import { Resource } from "~/core/resource";
import { computeFileHash } from "~/lib/file";
import { DurableObjectNamespace } from "../durable-object-namespace";
import { WorkerAssets, type WorkerAssetsOutput } from "./assets";
import { WorkerProvider } from "./provider";
import type {
  WorkerMetadataOutput,
  WorkersBindingInput,
  WorkersBindingKind,
} from "./types";
import { WorkerURL } from "./url";

export interface WorkerInput {
  name: string;
  handler: string;
  url?: boolean;
  assets?: string;
  bindings?: Record<string, Bindable | WorkersBindingInput>;
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
    in: WorkerMetadataOutput | null;
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
  url?: WorkerURL;

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
    const url =
      input.url && $app.phase !== "dev"
        ? new WorkerURL(
            `${name}.url`,
            {
              scriptName: input.name,
              enabled: true,
            },
            {
              dependsOn: [name],
            },
          )
        : undefined;

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
      $run.use(this.assets),
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
      hyperdrive: "Hyperdrive",
      r2_bucket: "R2Bucket",
      plain_text: "string",
      secret_text: "string",
      json: "string",
      version_metadata: "WorkerVersionMetadata",

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
        async ([name, binding]): Promise<WorkersBindingKind> => {
          const value =
            "getBinding" in binding ? await binding.getBinding() : binding;
          return {
            ...value,
            name,
          };
        },
      ),
    );
  }

  private async resolveBundle() {
    return $run.use(this.bundle).then((bundle) => bundle.artifacts);
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
    const diffs = await Promise.all(
      state.output.artifacts.map(async (artifact) => {
        const hash = await computeFileHash(artifact).catch(() => undefined);
        return hash === artifact.hash;
      }),
    );
    if (diffs.includes(false)) {
      return "replace";
    }
    return "none";
  };

  private async readBundle(input: Resource.Input<RawBundleProperties>) {
    // Originally this used @vercel/nft to trace the bundle, but a fake Bun.build
    // actually ends up being faster.
    const files = new TraceInputPlugin();
    await Bun.build({
      entrypoints: [input.entry],
      plugins: [files],
    });
    const manifest = await files.getManifest();
    return Object.entries(manifest).map(([name, hash]) => {
      return new BundleFile({
        name,
        kind: name === input.entry ? "entry-point" : "chunk",
        hash,
        directory: "..",
      });
    });
  }
}
