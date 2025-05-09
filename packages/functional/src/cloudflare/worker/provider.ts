import assert from "node:assert";
import path from "node:path";
import * as v from "valibot";
import { $app, $cloudflare } from "~/core/app";
import type { Resource } from "~/core/resource";
import type { DurableObjectNamespace } from "../durable-object-namespace";
import type { WorkerAssetsManifest } from "./assets";
import {
  type SingleStepMigration,
  type WorkerMetadataInput,
  WorkerMetadataOutput,
} from "./types";
import type { WorkerProperties } from "./worker";
import { Log, LogLevel, Miniflare, type MiniflareOptions } from "miniflare";

export class WorkerProvider implements Resource.Provider<WorkerProperties> {
  async create(input: Resource.Input<WorkerProperties>) {
    return {
      providerId: input.name,
      output: await this.put(input),
    };
  }

  async diff(
    input: Resource.Input<WorkerProperties>,
    state: Resource.State<WorkerProperties>,
  ): Promise<Resource.Diff> {
    if (!Bun.deepEquals(input, state.input)) {
      return "update";
    }
    return "none";
  }

  async update(
    input: Resource.Input<WorkerProperties>,
    state: Resource.State<WorkerProperties>,
  ) {
    return await this.put(input, state);
  }

  async delete(state: Resource.State<WorkerProperties>) {
    await $cloudflare.delete(
      `/accounts/${$cloudflare.accountId}/workers/scripts/${state.providerId}`,
    );
  }

  private async put(
    input: Resource.Input<WorkerProperties>,
    state?: Resource.State<WorkerProperties>,
  ): Promise<WorkerMetadataOutput> {
    const entry = input.bundle.find((file) => file.kind === "entry-point");
    assert(entry, "No entry point found");
    const metadata: WorkerMetadataInput = {
      main_module: entry.name,
      bindings: input.bindings,
      migrations: this.resolveMigrations(
        input.durableObjectNamespaces ?? [],
        state,
      ),
      compatibility_flags: ["nodejs_compat"],
      compatibility_date: "2025-05-01",
    };
    if (input.assets) {
      const jwt = await this.uploadAssets(
        input.name,
        input.assets.path,
        input.assets.manifest,
      );
      metadata.assets = {
        jwt,
        config: {
          _headers: input.assets.headers,
          _redirects: input.assets.redirects,
        },
      };
    }
    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], {
        type: "application/json",
      }),
    );
    for (const file of input.bundle) {
      formData.append(
        file.name,
        new File([await file.text()], file.name, {
          type:
            file.kind === "entry-point" || file.kind === "chunk"
              ? "application/javascript+module"
              : file.kind === "sourcemap"
                ? "application/source-map"
                : "application/octet-stream",
        }),
      );
    }
    return await $cloudflare.put(
      `/accounts/${$cloudflare.accountId}/workers/scripts/${input.name}`,
      {
        body: {
          type: "form",
          value: formData,
        },
        responseSchema: WorkerMetadataOutput,
      },
    );
  }

  private resolveMigrations(
    durableObjectNamespaces: DurableObjectNamespace[],
    state?: Resource.State<WorkerProperties>,
  ) {
    const migrations: SingleStepMigration = {};
    const existingObjects = state?.input.durableObjectNamespaces ?? [];
    for (const binding of durableObjectNamespaces) {
      const existing = existingObjects.find(
        (existingBinding) => existingBinding.id === binding.id,
      );
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
      const current = durableObjectNamespaces.find(
        (currentBinding) => currentBinding.id === binding.id,
      );
      if (current) {
        continue;
      }
      migrations.deleted_classes = (migrations.deleted_classes ?? []).concat(
        binding.className,
      );
    }
    return Object.keys(migrations).length === 0 ? undefined : migrations;
  }

  private async uploadAssets(
    scriptName: string,
    assetsPath: string,
    manifest: WorkerAssetsManifest,
  ) {
    const uploadSessionResponse = await $cloudflare.post(
      `/accounts/${$cloudflare.accountId}/workers/scripts/${scriptName}/assets-upload-session`,
      {
        body: {
          type: "json",
          value: {
            manifest,
          },
        },
        responseSchema: v.object({
          jwt: v.optional(v.string()),
          buckets: v.optional(v.array(v.array(v.string()))),
        }),
      },
    );
    if (!uploadSessionResponse.jwt || !uploadSessionResponse.buckets) {
      return uploadSessionResponse.jwt;
    }
    const files = new Map(
      Object.entries(manifest).map(([name, { hash }]) => [
        hash,
        Bun.file(path.join(process.cwd(), assetsPath, name)),
      ]),
    );
    let completionToken = uploadSessionResponse.jwt;
    await Promise.all(
      uploadSessionResponse.buckets.map(async (bucket) => {
        const formData = new FormData();
        await Promise.all(
          bucket.map(async (fileHash) => {
            const file = files.get(fileHash);
            assert(file, `File ${fileHash} not found`);
            const bytes = await file.bytes();
            formData.append(
              fileHash,
              new File([bytes.toBase64()], fileHash, { type: file.type }),
            );
          }),
        );
        const res = await $cloudflare.post(
          `/accounts/${$cloudflare.accountId}/workers/assets/upload?base64=true`,
          {
            headers: {
              Authorization: `Bearer ${uploadSessionResponse.jwt}`,
            },
            body: {
              type: "form",
              value: formData,
            },
            responseSchema: v.object({
              jwt: v.optional(v.string()),
            }),
          },
        );
        if (res.jwt) {
          completionToken = res.jwt;
        }
      }),
    );
    return completionToken;
  }

  dev(): Resource.DevCommand<WorkerProperties> {
    let mf: Miniflare | undefined;
    return {
      run: async (_, input) => {
        const options = this.buildMiniflareOptions(input);
        if (mf) {
          await mf.setOptions(options);
        } else {
          mf = new Miniflare(options);
          await mf.ready;
        }
        return null;
      },
      stop: async () => {
        if (mf) {
          await mf.dispose();
          mf = undefined;
        }
      },
    };
  }

  private buildMiniflareOptions(input: Resource.Input<WorkerProperties>) {
    const entry = input.bundle.find((file) => file.kind === "entry-point");
    assert(entry, "No entry point found");
    const options: MiniflareOptions = {
      name: input.name,
      scriptPath: entry.path,
      modules: true,
      port: 8787,
      compatibilityFlags: ["nodejs_compat"],
      compatibilityDate: "2025-05-01",
      logRequests: true,
      verbose: true,
      log: new Log(LogLevel.VERBOSE),
      cache: true,
      cachePersist: $app.path.scope(input.name, "mf", "cache"),
      durableObjectsPersist: $app.path.scope(input.name, "mf", "do"),
      kvPersist: $app.path.scope(input.name, "mf", "kv"),
      r2Persist: $app.path.scope(input.name, "mf", "r2"),
    };
    for (const binding of input.bindings ?? []) {
      switch (binding.type) {
        case "kv_namespace": {
          options.kvNamespaces ??= [];
          (options.kvNamespaces as string[]).push(binding.name);
          break;
        }
        case "r2_bucket": {
          options.r2Buckets ??= [];
          (options.r2Buckets as string[]).push(binding.name);
          break;
        }
        case "durable_object_namespace": {
          options.durableObjects ??= {};
          options.durableObjects[binding.name] = {
            className: binding.class_name,
            scriptName: input.name,
            useSQLite:
              input.durableObjectNamespaces?.find(
                (namespace) => namespace.className === binding.class_name,
              )?.sqlite ?? false,
            unsafeUniqueKey: binding.class_name,
          };
          break;
        }
        case "secret_text": {
          options.bindings ??= {};
          options.bindings[binding.name] = binding.text.toString();
          break;
        }
        case "assets": {
          options.assets = {
            binding: binding.name,
            directory: input.assets?.path ?? "",
            routerConfig: {
              has_user_worker: true,
              invoke_user_worker_ahead_of_assets: true,
            },
          };
          break;
        }
        default: {
          console.warn(
            `Binding "${binding.name}" of type "${binding.type}" is not supported in dev mode`,
          );
        }
      }
    }
    return options;
  }
}
