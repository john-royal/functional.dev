import assert from "node:assert";
import z from "zod";
import type { Resource } from "../../core/resource";
import { cloudflareApi } from "../../providers/cloudflare";
import type { WorkerAssetsManifest } from "./assets";
import { type WorkerMetadataInput, WorkerMetadataOutput } from "./types";
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
    console.log("diff", input, state);
    if (!Bun.deepEquals(input, state.input)) {
      return "update";
    }
    return "none";
  }

  async update(input: Resource.Input<WorkerProperties>) {
    return await this.put(input);
  }

  async delete(state: Resource.State<WorkerProperties>) {
    await cloudflareApi.delete(
      `/accounts/${cloudflareApi.accountId}/workers/scripts/${state.providerId}`,
    );
  }

  private async put(
    input: Resource.Input<WorkerProperties>,
  ): Promise<WorkerMetadataOutput> {
    const metadata: WorkerMetadataInput = {
      ...input.metadata,
    };
    if (input.assets) {
      const jwt = await this.uploadAssets(input.name, input.assets.manifest);
      metadata.assets = {
        jwt,
        config: {
          _headers: input.assets.headers,
          _redirects: input.assets.redirects,
        },
      };
    }
    console.log("Uploading worker", metadata);
    console.log("Uploading files", input.files);
    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], {
        type: "application/json",
      }),
    );
    for (const file of input.files) {
      formData.append(
        file.name,
        new Blob([file.content], { type: file.type }),
        file.name,
      );
    }
    return await cloudflareApi.put(
      `/accounts/${cloudflareApi.accountId}/workers/scripts/${input.name}`,
      {
        body: {
          type: "form",
          value: formData,
        },
        responseSchema: WorkerMetadataOutput,
      },
    );
  }

  private async uploadAssets(
    scriptName: string,
    manifest: WorkerAssetsManifest,
  ) {
    const uploadSessionResponse = await cloudflareApi.post(
      `/accounts/${cloudflareApi.accountId}/workers/scripts/${scriptName}/assets-upload-session`,
      {
        body: {
          type: "json",
          value: {
            manifest,
          },
        },
        responseSchema: z.object({
          jwt: z.string().optional(),
          buckets: z.array(z.array(z.string())).optional(),
        }),
      },
    );
    if (!uploadSessionResponse.jwt || !uploadSessionResponse.buckets) {
      return uploadSessionResponse.jwt;
    }
    const files = new Map(
      Object.entries(manifest).map(([name, { hash }]) => [
        hash,
        Bun.file(name),
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
        const res = await cloudflareApi.post(
          `/accounts/${cloudflareApi.accountId}/workers/assets/upload?base64=true`,
          {
            headers: {
              Authorization: `Bearer ${uploadSessionResponse.jwt}`,
            },
            body: {
              type: "form",
              value: formData,
            },
            responseSchema: z.object({
              jwt: z.string().optional(),
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
