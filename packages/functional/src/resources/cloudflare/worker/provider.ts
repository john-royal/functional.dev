import assert from "node:assert";
import path from "node:path";
import * as v from "valibot";
import { $cloudflare } from "~/core/app";
import type { Resource } from "~/core/resource";
import type DurableObjectNamespace from "../durable-object-namespace";
import type { WorkerAssetsManifest } from "./assets";
import {
  type SingleStepMigration,
  type WorkerMetadataInput,
  WorkerMetadataOutput,
} from "./types";
import type { WorkerProperties } from "./worker";

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
}
