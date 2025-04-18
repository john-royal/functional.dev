import assert from "assert";
import type Cloudflare from "cloudflare";
import { createHash } from "crypto";
import { watch, type FSWatcher } from "fs";
import { readdir } from "fs/promises";
import type { MiniflareOptions } from "miniflare";
import path from "path";
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
  type WorkersBindingKindService,
} from "./binding";

interface WorkerOptions {
  name?: string;
  entry: string;
  format?: "esm" | "cjs";
  bindings?: AnyBinding[];
  url?: "workers.dev";
  assets?: {
    directory: string;
    config?: {
      htmlHandling?:
        | "auto-trailing-slash"
        | "force-trailing-slash"
        | "drop-trailing-slash"
        | "none";
      notFoundHandling?: "none" | "404-page" | "single-page-application";
      runWorkerFirst?: boolean;
    };
  };
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
  dev: async ({ self, options }) => {
    const { Miniflare } = await import("miniflare");
    const watchers = new Map<string, FSWatcher>();

    const build = async () => {
      const { scriptPath, files } = await dev.build(self, options);
      const miniflareOptions = dev.formatMiniflareOptions({
        name: options.name ?? self.name,
        bindings: options.bindings ?? [],
        assets: options.assets,
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
    await util.writeTypesToFile(self, util.resolveBindings(options));
  },
  binding: ({
    bindingNameOverride,
    self,
    options,
  }): WorkersBindingKindService => ({
    name: bindingNameOverride ?? self.name,
    type: "service",
    environment: "",
    service: normalizeCloudflareName(options.name ?? self.globalId),
  }),
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
    assets: WorkerOptions["assets"];
    format: "esm" | "cjs";
    entry: string;
  }): MiniflareOptions => {
    const options: MiniflareOptions = {
      name: input.name,
      scriptPath: input.entry,
      modules: input.format === "esm",
    };
    const bindings = util.resolveBindings({
      bindings: input.bindings ?? [],
      assets: input.assets,
    });
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

const readAssets = async (directory: string) => {
  const fileNames = await readdir(directory, {
    recursive: true,
  });
  const manifest: Record<string, { hash: string; size: number }> = {};
  const files = new Map<string, Blob>();
  await Promise.all(
    fileNames.map(async (fileName) => {
      const file = Bun.file(path.join(directory, fileName));
      if ((await file.stat()).isDirectory()) {
        return;
      }
      const content = await file.bytes();
      const hash = createHash("sha256")
        .update(content)
        .digest("hex")
        .slice(0, 32);
      // For some reason, the file name has to start with a slash, otherwise Cloudflare won't let us upload.
      // They really should show an error message, but instead they just return a 200 with a null JWT.
      if (!fileName.startsWith("/")) {
        fileName = `/${fileName}`;
      }
      manifest[fileName] = {
        hash,
        size: content.length,
      };
      files.set(hash, new Blob([content.toBase64()], { type: file.type }));
    })
  );
  return { manifest, files };
};

const putScript = async (self: FunctionalScope, options: WorkerOptions) => {
  const bindings = util.resolveBindings(options);
  await util.writeTypesToFile(self, bindings);
  const name = normalizeCloudflareName(options.name ?? self.globalId);
  const script = await build(self, options);
  const formattedScript = Object.assign(
    {},
    format.script({
      format: options.format ?? "esm",
      script: await script.entrypoint.text(),
    }),
    {
      sourcemap: script.sourcemap
        ? {
            name: path.parse(script.sourcemap.path).name,
            type: "application/source-map",
            content: await script.sourcemap.text(),
          }
        : undefined,
    }
  );
  let assetsMetadata: Metadata["assets"] | undefined;
  let assetManifest: Record<string, { hash: string; size: number }> | undefined;
  if (options.assets) {
    const { manifest, files } = await readAssets(
      self.resolvePath(options.assets.directory)
    );
    const { jwt } = await api.uploadAssets(name, manifest, files);
    assetsMetadata = {
      jwt,
      config: {
        html_handling: options.assets?.config?.htmlHandling,
        not_found_handling: options.assets?.config?.notFoundHandling,
        run_worker_first: options.assets?.config?.runWorkerFirst,
      },
    };
    assetManifest = manifest;
  }
  const metadata = format.metadata({
    format: options.format ?? "esm",
    bindings,
    assets: assetsMetadata,
  });
  const result = await api.putScript({
    name,
    script: formattedScript,
    metadata,
  });
  return {
    name,
    bindings,
    result,
    assets: assetManifest,
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
    external: ["node:*", "cloudflare:workers"],
    minify: false,
    sourcemap: "external",
    define: {
      // The `require` function polyfill, createRequire, uses import.meta.url as the base path.
      // However, import.meta.url is undefined on Cloudflare Workers, so we need to set it to "/" manually.
      // Seems like a common practice: https://github.com/sst/sst/blob/3fc45526fcf751b382d4f886443e2b0766c91180/pkg/runtime/worker/worker.go#L128
      "import.meta.url": "/",
      "navigator.userAgent": "Functional.dev",
      "process.env.NODE_ENV": "production",
    },
    plugins: [
      {
        name: "node-http-polyfill",
        setup: (builder) => {
          const resolved = new Map<string, string>();
          const hybridNodeCompatModules = [
            "async_hooks",
            "console",
            "crypto",
            "process",
            // "module",
            "tls",
            "util",
          ];
          builder.onResolve(
            {
              filter: /^(node:)?(async_hooks|console|crypto|process|tls|util)$/,
            },
            (args) => {
              const mod = args.path.replace("node:", "");
              if (args.importer.includes("@cloudflare/unenv-preset")) {
                console.log(
                  `skipping unenv polyfill for ${args.path} at ${resolved.get(
                    mod
                  )} by ${args.importer}`
                );
                return null;
              }
              if (resolved.has(mod)) {
                return {
                  path: resolved.get(mod)!,
                };
              }
              const unenv = Bun.fileURLToPath(
                import.meta.resolve(`@cloudflare/unenv-preset/node/${mod}`)
              );
              resolved.set(mod, unenv);
              console.log(
                `using cloudflare unenv polyfill for ${args.path} at ${unenv}`
              );
              return {
                path: unenv,
              };
            }
          );
          builder.onResolve(
            {
              filter:
                /^(node:)?(fs|fs\/promises|http|https|child_process|os|tty)$/,
            },
            (args) => {
              const mod = args.path.replace("node:", "");
              if (resolved.has(mod)) {
                return {
                  path: resolved.get(mod)!,
                };
              }
              const unenv = Bun.fileURLToPath(
                import.meta.resolve(`unenv/node/${mod}`)
              );
              if (!unenv) {
                console.warn(`cannot find polyfill for ${args.path}`);
              }
              resolved.set(mod, unenv);
              console.log(`using unenv polyfill for ${args.path} at ${unenv}`);
              return {
                path: unenv,
              };
            }
          );
        },
      },
    ],
    ...buildConfig,
  });
  const entrypoint = result.outputs.find((o) => o.kind === "entry-point");
  const sourcemap = result.outputs.find((o) => o.kind === "sourcemap");
  assert(entrypoint, "Expected entry point");
  return { entrypoint, sourcemap };
};

const util = {
  TYPES: {
    kv_namespace: "KVNamespace",
    hyperdrive: "Hyperdrive",
    service: "Service",
    r2_bucket: "R2Bucket",
    plain_text: "string",
    secret_text: "string",
    assets: "{ fetch: typeof fetch }",

    json: "unknown",
    ai: "unknown",
    analytics_engine: "unknown",
    browser_rendering: "unknown",
    d1: "unknown",
    dispatch_namespace: "unknown",
    durable_object_namespace: "unknown",
    mtls_certificate: "unknown",
    pipelines: "unknown",
    queue: "unknown",
    tail_consumer: "unknown",
    vectorize: "unknown",
    version_metadata: "unknown",
    secrets_store_secret: "unknown",
    secret_key: "unknown",
  } satisfies Record<WorkersBindingKind["type"], string>,
  resolveBindings: (
    options: Pick<WorkerOptions, "bindings" | "assets">
  ): WorkersBindingKind[] => {
    const bindings = (options.bindings ?? []).map((binding) => {
      if (kFunctionalCreateBinding in binding) {
        return binding[kFunctionalCreateBinding]();
      }
      return binding;
    });
    if (options.assets) {
      bindings.push({
        name: "ASSETS",
        type: "assets",
      });
    }
    return bindings;
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
    assets?: Metadata["assets"];
  }): Metadata => {
    return {
      compatibility_date: "2025-04-10",
      compatibility_flags: ["nodejs_compat_v2"],
      main_module: input.format === "esm" ? "worker.js" : undefined,
      body_part: input.format === "cjs" ? "script" : undefined,
      bindings: input.bindings as Metadata["bindings"],
      assets: input.assets,
      observability: {
        enabled: true,
      },
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
      sourcemap?: {
        name: string;
        type: "application/source-map";
        content: string;
      };
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
    if (input.script.sourcemap) {
      formData.append(
        input.script.sourcemap.name,
        new File(
          [input.script.sourcemap.content],
          input.script.sourcemap.name,
          {
            type: input.script.sourcemap.type,
          }
        )
      );
    }

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
    scriptName: string,
    manifest: Record<string, { hash: string; size: number }>,
    files: Map<string, Blob>
  ) => {
    const accountId = await requireCloudflareAccountId();

    const res = await cfFetch<{
      jwt: string;
      buckets?: string[][];
    } | null>(
      `/accounts/${accountId}/workers/scripts/${scriptName}/assets-upload-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ manifest }),
      }
    );
    if (!res) {
      throw new Error(
        [
          "Internal error: failed to create assets upload session, but the server returned a non-error response.",
          "This is likely a problem with the asset manifest generated by Functional, but it sure would help if Cloudflare would actually return an error message.",
        ].join("\n")
      );
    }
    const { jwt, buckets } = res;

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
        formData.append(fileHash, file, fileHash);
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
