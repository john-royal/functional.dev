import assert from "node:assert";
import { readdir } from "node:fs/promises";
import path from "node:path";
import Ignore from "ignore";
import sha256 from "../lib/sha256";
import {
  type CloudflareResponse,
  cloudflareApi,
} from "../providers/cloudflare";
import { Resource } from "../resource";

export interface WorkerAssetsInput {
  scriptName: string;
  path: string;
}

export type WorkerAssetsManifest = Record<
  string,
  {
    size: number;
    hash: string;
  }
>;

export interface WorkerAssetsOutput {
  jwt?: string;
  headers?: string;
  redirects?: string;
  manifest: WorkerAssetsManifest;
}

export default class WorkerAssets extends Resource<
  "worker-assets",
  WorkerAssetsInput,
  WorkerAssetsOutput
> {
  readonly kind = "worker-assets";

  async run(
    context: Resource.Context<WorkerAssetsInput, WorkerAssetsOutput>,
  ): Promise<Resource.Action<WorkerAssetsOutput>> {
    if (context.status === "delete") {
      return { status: "delete" };
    }
    const { files, headers, redirects, manifest } = await this.read();
    if (
      context.status === "update" &&
      headers === context.output.headers &&
      redirects === context.output.redirects &&
      Bun.deepEquals(manifest, context.output.manifest)
    ) {
      return { status: "none" };
    }
    return {
      status: context.status === "create" ? "create" : "update",
      apply: async () => {
        const uploadSession = await this.createAssetUploadSession(manifest);
        if (!uploadSession.jwt || !uploadSession.buckets) {
          return {
            jwt: uploadSession.jwt,
            headers,
            redirects,
            manifest,
          };
        }
        const jwt = await this.uploadAssets(
          uploadSession.jwt,
          uploadSession.buckets,
          files,
        );
        return {
          jwt,
          headers,
          redirects,
          manifest,
        };
      },
    };
  }

  private async createAssetUploadSession(manifest: WorkerAssetsManifest) {
    const res = await cloudflareApi.post(
      `/accounts/${cloudflareApi.accountId}/workers/scripts/${this.input.scriptName}/assets-upload-session`,
      {
        body: {
          type: "json",
          value: { manifest },
        },
      },
    );
    const text = await res.text();
    const json = JSON.parse(text) as CloudflareResponse<{
      jwt?: string;
      buckets?: string[][];
    }>;
    if (!res.ok || !json.success) {
      throw new Error(json.errors[0]?.message ?? "Unknown error");
    }
    return json.result;
  }

  private async uploadAssets(
    jwt: string,
    buckets: string[][],
    files: Map<string, File>,
  ) {
    let completionToken = jwt;
    await Promise.all(
      buckets.map(async (bucket) => {
        const formData = new FormData();
        for (const fileHash of bucket) {
          const file = files.get(fileHash);
          assert(file, `File ${fileHash} not found`);
          formData.append(fileHash, file);
        }
        const res = await cloudflareApi.post(
          `/accounts/${cloudflareApi.accountId}/workers/assets/upload?base64=true`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
            body: {
              type: "form",
              value: formData,
            },
          },
        );
        const json = await res.json<CloudflareResponse<{ jwt?: string }>>();
        if (!res.ok || !json.success) {
          throw new Error(json.errors[0]?.message ?? "Unknown error");
        }
        if (json.result.jwt) {
          completionToken = json.result.jwt;
        }
      }),
    );
    return completionToken;
  }

  private async read() {
    const [fileNames, ignore, headers, redirects] = await Promise.all([
      readdir(path.join(process.cwd(), this.input.path), { recursive: true }),
      this.readText(".assetsignore"),
      this.readText("_headers"),
      this.readText("_redirects"),
    ]);
    const matcher = Ignore().add([
      ".assetsignore",
      "_headers",
      "_redirects",
      ...(ignore?.split("\n") ?? []),
    ]);
    const manifest: WorkerAssetsManifest = {};
    const files = new Map<string, File>();
    await Promise.all(
      fileNames.map(async (fileName) => {
        if (matcher.ignores(fileName)) {
          return;
        }
        const filePath = path.join(this.input.path, fileName);
        const file = Bun.file(filePath);
        const stat = await file.stat();
        if (!stat.isDirectory()) {
          if (!fileName.startsWith("/")) {
            // biome-ignore lint/style/noParameterAssign: Cloudflare requires paths to start with a slash
            fileName = `/${fileName}`;
          }
          const bytes = await file.bytes();
          const hash = sha256(bytes).slice(0, 32);
          manifest[fileName] = {
            size: stat.size,
            hash,
          };
          files.set(
            hash,
            new File([bytes.toBase64()], hash, { type: file.type }),
          );
        }
      }),
    );
    return {
      files,
      headers,
      redirects,
      manifest,
    };
  }

  private async readText(name: string) {
    return await Bun.file(path.join(process.cwd(), this.input.path, name))
      .text()
      .catch(() => undefined);
  }
}
