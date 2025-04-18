import assert from "assert";
import type Cloudflare from "cloudflare";
import { createHash } from "crypto";
import { watch, type FSWatcher } from "fs";
import type { MiniflareOptions } from "miniflare";
import { defineResource, type CreateResourceContext } from "../resource";
import { $functional, type FunctionalScope } from "../util";
import {
  cfFetch,
  normalizeCloudflareName,
  requireCloudflareAccountId,
} from "./api";
import {
  kFunctionalCreateBinding,
  type AnyBinding,
  type WorkersBindingKind,
} from "./binding";

interface WorkerOptions {
  name?: string;
  entry: string;
  format?: "esm" | "cjs";
  bindings?: AnyBinding[];
  url?: "workers.dev";
}

export const Worker = defineResource({
  kind: "worker",
  create: async ({ self, options }: CreateResourceContext<WorkerOptions>) => {
    const result = await putScript(self, options);
    let url: string | null = null;
    if (options.url === "workers.dev") {
      const res = await api.setWorkersDevEnabled(result.name, true);
      url = res.url;
    }
    return {
      ...result,
      url,
    };
  },
  update: async ({ self, options, state }) => {
    const result = await putScript(self, options);
    let url = state.url;
    if (!!url !== (options.url === "workers.dev")) {
      const res = await api.setWorkersDevEnabled(
        result.name,
        options.url === "workers.dev"
      );
      url = res.url;
    }
    return {
      ...result,
      url,
    };
  },
  delete: async ({ state }) => {
    await api.deleteScript(state.name);
  },
  dev: async ({ self, options, state }) => {
    const { Miniflare } = await import("miniflare");
    const watchers = new Map<string, FSWatcher>();

    const build = async () => {
      const { scriptPath, files } = await dev.build(self, options);
      const miniflareOptions = dev.formatMiniflareOptions({
        name: options.name ?? self.name,
        bindings: options.bindings ?? [],
        format: options.format ?? "esm",
        entry: scriptPath,
      });
      for (const file of files) {
        if (!watchers.has(file)) {
          watchers.set(file, watch(file, rebuild));
        }
      }
      return miniflareOptions;
    };

    const rebuild = async () => {
      const miniflareOptions = await build();
      await miniflare.setOptions(miniflareOptions);
    };

    const miniflareOptions = await build();
    const miniflare = new Miniflare(miniflareOptions);

    await miniflare.ready;

    return {
      fetch: async (request: Request) => {
        // Cloudflare response type doesn't match global.Response
        return (await miniflare.dispatchFetch(request)) as any;
      },
      reload: async () => {
        await rebuild();
      },
      stop: async () => {
        for (const watcher of watchers.values()) {
          watcher.close();
        }
        await miniflare.dispose();
      },
    };
  },
  types: async ({ self, options }) => {
    const bindings = util.resolveBindings(options.bindings ?? []);
    await util.writeTypesToFile(self, bindings);
  },
});

const dev = {
  build: async (self: FunctionalScope, options: WorkerOptions) => {
    const files = new Set<string>();
    const script = await build(self, options, {
      plugins: [
        {
          name: "dev",
          setup: (builder) => {
            builder.onLoad({ filter: /\.(ts|js)$/ }, (args) => {
              files.add(args.path);
            });
          },
        },
      ],
    });
    return {
      scriptPath: script.path,
      files,
    };
  },
  formatMiniflareOptions: (input: {
    name: string;
    bindings: AnyBinding[];
    format: "esm" | "cjs";
    entry: string;
  }): MiniflareOptions => {
    const options: MiniflareOptions = {
      name: input.name,
      scriptPath: input.entry,
      modules: input.format === "esm",
    };
    const bindings = util.resolveBindings(input.bindings ?? []);
    for (const binding of bindings) {
      switch (binding.type) {
        case "hyperdrive":
          options.hyperdrives = {
            ...options.hyperdrives,
            [binding.name]: binding.id,
          };
          break;
        case "kv_namespace":
          options.kvNamespaces = {
            ...options.kvNamespaces,
            [binding.name]: binding.namespace_id,
          };
          break;
        case "r2_bucket":
          options.r2Buckets = {
            ...options.r2Buckets,
            [binding.name]: binding.bucket_name,
          };
          break;
        default:
          throw new Error(`Unsupported binding type: ${binding.type}`);
      }
    }
    return options;
  },
};

const putScript = async (self: FunctionalScope, options: WorkerOptions) => {
  const bindings = util.resolveBindings(options.bindings ?? []);
  await util.writeTypesToFile(self, bindings);
  const script = await build(self, options);
  const formattedScript = format.script({
    format: options.format ?? "esm",
    script: await script.text(),
  });
  const metadata = format.metadata({
    format: options.format ?? "esm",
    bindings,
  });
  const name = normalizeCloudflareName(options.name ?? self.globalId);
  const result = await api.putScript({
    name,
    script: formattedScript,
    metadata,
  });
  return {
    name,
    bindings,
    result,
  };
};

const build = async (
  self: FunctionalScope,
  workerOptions: WorkerOptions,
  buildConfig?: Partial<Bun.BuildConfig>
) => {
  const result = await Bun.build({
    entrypoints: [self.resolvePath(workerOptions.entry)],
    outdir: self.output,
    format: workerOptions.format ?? "esm",
    target: "node",
    conditions: ["workerd", "worker", "browser"],
    external: ["cloudflare:workers"],
    minify: true,
    sourcemap: "inline",
    define: {
      // The `require` function polyfill, createRequire, uses import.meta.url as the base path.
      // However, import.meta.url is undefined on Cloudflare Workers, so we need to set it to "/" manually.
      // Seems like a common practice: https://github.com/sst/sst/blob/3fc45526fcf751b382d4f886443e2b0766c91180/pkg/runtime/worker/worker.go#L128
      "import.meta.url": "/",
    },
    ...buildConfig,
  });
  const output = result.outputs[0];
  assert(output?.kind === "entry-point", "Expected entry point");
  assert(result.outputs.length === 1, "Expected exactly one output");
  return output;
};

const util = {
  TYPES: {
    kv_namespace: "KVNamespace",
    hyperdrive: "Hyperdrive",
    r2_bucket: "R2Bucket",
    plain_text: "string",
    secret_text: "string",

    json: "unknown",
    ai: "unknown",
    analytics_engine: "unknown",
    assets: "unknown",
    browser_rendering: "unknown",
    d1: "unknown",
    dispatch_namespace: "unknown",
    durable_object_namespace: "unknown",
    mtls_certificate: "unknown",
    pipelines: "unknown",
    queue: "unknown",
    service: "unknown",
    tail_consumer: "unknown",
    vectorize: "unknown",
    version_metadata: "unknown",
    secrets_store_secret: "unknown",
    secret_key: "unknown",
  } satisfies Record<WorkersBindingKind["type"], string>,
  resolveBindings: (bindings: AnyBinding[]) => {
    return bindings.map((binding) => {
      if (kFunctionalCreateBinding in binding) {
        return binding[kFunctionalCreateBinding]();
      }
      return binding;
    });
  },
  writeTypesToFile: async (
    scope: FunctionalScope,
    items: WorkersBindingKind[]
  ) => {
    const isValidPropName = (name: string) =>
      !!name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    const file = [
      "// Generated by functional.dev",
      "//",
      "// biome-ignore lint/style: auto-generated file",
      "// eslint-disable",
      "// prettier-ignore",
      "",
      '/// <reference types="@cloudflare/workers-types" />',
      "",
      "interface Env {",
      ...items.map(
        ({ name, type }) =>
          `  ${isValidPropName(name) ? name : `"${name}"`}: ${
            util.TYPES[type]
          };`
      ),
      "}",
    ];
    await Bun.write(scope.resolvePath("functional-env.d.ts"), file.join("\n"));
  },
};

type Metadata = Cloudflare.Workers.Scripts.ScriptUpdateParams.Metadata;

const format = {
  metadata: (input: {
    format: "esm" | "cjs";
    bindings: WorkersBindingKind[];
  }): Metadata => {
    return {
      compatibility_date: "2025-04-10",
      compatibility_flags: ["nodejs_compat_v2"],
      main_module: input.format === "esm" ? "worker.js" : undefined,
      body_part: input.format === "cjs" ? "script" : undefined,
      bindings: input.bindings as Metadata["bindings"],
    } satisfies Metadata;
  },
  script: (input: { format: "esm" | "cjs"; script: string }) => {
    switch (input.format) {
      case "esm":
        return {
          name: "worker.js",
          type: "application/javascript+module",
          content: input.script,
        };
      case "cjs":
        return {
          name: "script",
          type: "application/javascript",
          content: input.script,
        };
    }
  },
};

const api = {
  putScript: async (input: {
    name: string;
    script: {
      name: string;
      type: string;
      content: string;
    };
    metadata: Metadata;
  }) => {
    const accountId = await requireCloudflareAccountId();
    const formData = new FormData();

    formData.append(
      "metadata",
      new Blob([JSON.stringify(input.metadata)], {
        type: "application/json",
      })
    );
    formData.append(
      input.script.name,
      new Blob([input.script.content], {
        type: input.script.type,
      }),
      input.script.name
    );

    return await cfFetch(
      `/accounts/${accountId}/workers/scripts/${input.name}`,
      {
        method: "PUT",
        body: formData,
      }
    );
  },
  deleteScript: async (name: string) => {
    const accountId = await requireCloudflareAccountId();
    return await cfFetch(`/accounts/${accountId}/workers/scripts/${name}`, {
      method: "DELETE",
    });
  },
  uploadAssets: async (
    assets: {
      name: string;
      content: string;
      type: string;
    }[]
  ) => {
    const accountId = await requireCloudflareAccountId();

    const manifest: Record<string, { hash: string; size: number }> = {};
    const files = new Map<string, Blob>();
    for (const asset of assets) {
      const hash = createHash("sha256")
        .update(asset.content)
        .digest("hex")
        .slice(0, 32);
      manifest[asset.name] = {
        hash,
        size: asset.content.length,
      };
      files.set(
        hash,
        new Blob([Buffer.from(asset.content).toString("base64")], {
          type: asset.type,
        })
      );
    }

    const { jwt, buckets } = await cfFetch<{
      jwt: string;
      buckets?: string[][];
    }>(`/accounts/${accountId}/workers/assets-upload-session`, {
      method: "POST",
      body: JSON.stringify({ manifest }),
    });

    if (!buckets || buckets.length === 0) {
      return {
        jwt,
      };
    }

    let completionToken = jwt;

    for (const bucket of buckets) {
      const formData = new FormData();
      for (const fileHash of bucket) {
        const file = files.get(fileHash);
        if (!file) {
          throw new Error(`File ${fileHash} not found`);
        }
        formData.append("files", file);
      }
      const uploadResponse = await cfFetch<{
        jwt?: string;
      }>(`/accounts/${accountId}/workers/assets/upload?base64=true`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${completionToken}`,
        },
        body: formData,
      });
      completionToken = uploadResponse.jwt ?? completionToken;
    }

    return {
      jwt: completionToken,
    };
  },
  getWorkersDevSubdomain: async () => {
    const accountId = await requireCloudflareAccountId();
    const res = await cfFetch<{
      subdomain: string;
    }>(`/accounts/${accountId}/workers/subdomain`, {
      method: "GET",
    });
    return res.subdomain;
  },
  setWorkersDevEnabled: async (scriptName: string, enabled: boolean) => {
    console.log("setting workers dev enabled", scriptName, enabled);
    const accountId = await requireCloudflareAccountId();
    await cfFetch(
      `/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          enabled
            ? { enabled: true, previews_enabled: true }
            : { enabled: false }
        ),
      }
    );
    if (enabled) {
      const subdomain = await $functional.store.fetch(
        "cache:workers-dev-subdomain",
        async () => api.getWorkersDevSubdomain()
      );
      return {
        url: `https://${scriptName}.${subdomain}.workers.dev`,
      };
    } else {
      return {
        url: null,
      };
    }
  },
};
