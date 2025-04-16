import { $app } from "../../context";
import { Resource, type IResource } from "../base";
import path from "node:path";
import { cf, requireCloudflareAccountId } from "./api";
import assert from "node:assert";
import type Cloudflare from "cloudflare";
import crypto from "node:crypto";
import type { UploadCreateParams } from "cloudflare/resources/workers/scripts/assets.mjs";

export interface IWorker extends IResource {
  kind: "worker";
  options: {
    entry: string;
  };
}

export class Worker extends Resource<IWorker> {
  readonly kind = "worker";

  async create() {
    const bundle = await this.build();
    const { manifest, files, entrypoint } = await this.prepareUpload(bundle);
    console.dir({
      manifest,
      files,
      entrypoint,
    });
    const accountId = await requireCloudflareAccountId();
    let completionToken: string | undefined;
    const upload = await cf.workers.scripts.assets.upload.create(this.id, {
      account_id: accountId,
      manifest,
    });
    console.log(upload);
    if (files.size > 1) {
      assert(upload.jwt, "No JWT found");
      assert(upload.buckets, "No buckets found");
      completionToken = upload.jwt;
      for (const bucket of upload.buckets) {
        const formData = new FormData();
        for (const fileHash of bucket) {
          const file = files.get(fileHash);
          assert(file, "File not found");
          formData.append(fileHash, file, fileHash);
        }
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/assets/upload?base64=true`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${completionToken}`,
            },
            body: formData,
          }
        );
        assert(response.ok, "Failed to upload asset");
        const data = (await response.json()) as {
          result?: {
            jwt?: string;
          };
        };
        console.log(data);
        if (data.result?.jwt) {
          completionToken = data.result.jwt;
        }
      }
    }
    const metadata: Cloudflare.Workers.Scripts.ScriptUpdateParams.Metadata = {
      compatibility_date: "2025-04-10",
      compatibility_flags: ["nodejs_compat_v2"],
      main_module: entrypoint.name,
      assets: completionToken ? { jwt: completionToken } : undefined,
    };
    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], {
        type: "application/json",
      })
    );
    formData.append(entrypoint.name, entrypoint.content, entrypoint.name);
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${this.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        },
        body: formData,
      }
    );
    const data = await res.json();
    console.log(data);
    return data;
  }

  update() {
    return Promise.resolve({});
  }

  delete() {
    return Promise.resolve({});
  }

  private async build() {
    const result = await Bun.build({
      entrypoints: [path.join($app.cwd, this.options.entry)],
      target: "node",
      format: "esm",
      outdir: this.outdir,
    });
    return result.outputs;
  }

  get outdir() {
    return path.join($app.out, this.id);
  }

  private async prepareUpload(outputs: Bun.BuildArtifact[]) {
    const manifest: Record<string, UploadCreateParams.Manifest> = {};
    const files = new Map<string, Blob>();
    let entrypoint:
      | {
          name: string;
          content: Blob;
        }
      | undefined;
    await Promise.all(
      outputs.map(async (output) => {
        const path = "worker.js";
        const content = await output.text();
        const hash = crypto
          .createHash("sha256")
          .update(content)
          .digest("hex")
          .slice(0, 32);
        manifest[path] = { hash, size: content.length };
        files.set(
          hash,
          new Blob([Buffer.from(content).toString("base64")], {
            type: "application/javascript+module",
          })
        );
        console.log(files.get(hash), {
          path,
          hash,
          size: output.size,
          length: content.length,
        });
        if (output.kind === "entry-point") {
          entrypoint = {
            name: path,
            content: new Blob([content], {
              type: "application/javascript+module",
            }),
          };
        }
      })
    );
    assert(entrypoint, "No entry point found");
    return { manifest, files, entrypoint };
  }
}
