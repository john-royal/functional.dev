import ignore from "ignore";
import { ok, okAsync, ResultAsync } from "neverthrow";
import assert from "node:assert";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { CFClient } from "../cloudflare/client";
import type { CFError } from "../cloudflare/error";
import type {
  ResourceDiff,
  ResourceProvider,
  ResourceState,
} from "../providers/provider";
import { ResourceComponent } from "../providers/provider";
import type { Scope } from "../scope";

const WorkerAssetsInput = z.object({
  scriptName: z.string(),
  path: z.string(),
});
type WorkerAssetsInput = z.infer<typeof WorkerAssetsInput>;

const FileState = z.object({
  hash: z.string(),
  size: z.number(),
});
type FileState = z.infer<typeof FileState>;

const Manifest = z.record(z.string(), FileState);
type Manifest = z.infer<typeof Manifest>;

const WorkerAssetsOutput = z.object({
  jwt: z.string().optional(),
  manifest: Manifest,
  headers: z.string().optional(),
  redirects: z.string().optional(),
});
type WorkerAssetsOutput = z.infer<typeof WorkerAssetsOutput>;

class WorkerAssetsProvider
  implements ResourceProvider<WorkerAssetsInput, WorkerAssetsOutput, CFError>
{
  constructor(readonly client: CFClient) {}

  create(input: WorkerAssetsInput): ResultAsync<WorkerAssetsOutput, CFError> {
    return this.put(input);
  }

  diff(
    state: ResourceState<WorkerAssetsInput, WorkerAssetsOutput>,
    input: WorkerAssetsInput
  ): ResultAsync<ResourceDiff, CFError> {
    if (Bun.deepEquals(state.input, input)) {
      return okAsync("noop");
    }
    return this.read(input.path).map(({ manifest, headers, redirects }) => {
      if (
        Bun.deepEquals(state.output.manifest, manifest) &&
        state.output.headers === headers &&
        state.output.redirects === redirects
      ) {
        return "noop";
      }
      return "update";
    });
  }

  update(
    _: ResourceState<WorkerAssetsInput, WorkerAssetsOutput>,
    input: WorkerAssetsInput
  ): ResultAsync<WorkerAssetsOutput, CFError> {
    return this.put(input);
  }

  private put(
    input: WorkerAssetsInput
  ): ResultAsync<WorkerAssetsOutput, CFError> {
    return this.read(input.path).andThen(
      ({ files, manifest, headers, redirects }) =>
        this.upload(input.scriptName, {
          files,
          manifest,
          headers,
          redirects,
        })
    );
  }

  private upload(
    scriptName: string,
    data: {
      files: Map<string, Blob>;
      manifest: Manifest;
      headers: string | undefined;
      redirects: string | undefined;
    }
  ): ResultAsync<WorkerAssetsOutput, CFError> {
    return this.client
      .fetchWithAccount({
        method: "POST",
        path: `/workers/scripts/${scriptName}/assets-upload-session`,
        body: { format: "json", data: { manifest: data.manifest } },
        responseSchema: z
          .object({
            jwt: z.string().optional(),
            buckets: z.array(z.array(z.string())).optional(),
          })
          .nullable(),
      })
      .andThen((response) => {
        if (!response?.buckets) {
          return ok({
            jwt: response?.jwt,
            manifest: data.manifest,
            headers: data.headers,
            redirects: data.redirects,
          });
        }
        assert(response.jwt, "JWT is required");
        return this.uploadFiles({
          buckets: response.buckets,
          jwt: response.jwt,
          files: data.files,
        }).map(({ jwt }) => ({
          jwt,
          manifest: data.manifest,
          headers: data.headers,
          redirects: data.redirects,
        }));
      });
  }

  private uploadFiles(input: {
    buckets: string[][];
    jwt: string;
    files: Map<string, Blob>;
  }) {
    return ResultAsync.combine(
      input.buckets.map((bucket) => {
        const formData = new FormData();
        for (const fileHash of bucket) {
          const file = input.files.get(fileHash);
          assert(file, `File ${fileHash} not found`);
          formData.append(fileHash, file, fileHash);
        }
        return this.client.fetchWithAccount({
          method: "POST",
          path: "/workers/assets/upload?base64=true",
          headers: {
            Authorization: `Bearer ${input.jwt}`,
          },
          body: { format: "form", data: formData },
          responseSchema: z.object({
            jwt: z.string().optional(),
          }),
        });
      })
    ).map((responses) => ({
      jwt: responses.find((res) => res.jwt)?.jwt ?? input.jwt,
    }));
  }

  private read(path: string) {
    return ResultAsync.combine([
      ResultAsync.fromSafePromise(readdir(path, { recursive: true })),
      this.readText(join(path, ".assetsignore")),
      this.readText(join(path, "_headers")),
      this.readText(join(path, "_redirects")),
    ]).map(async ([fileNames, ignorePaths, headers, redirects]) => {
      const ingoreMatcher = ignore().add([
        ".assetsignore",
        "_headers",
        "_redirects",
        ...(ignorePaths ? ignorePaths.split("\n") : []),
      ]);
      const manifest: Manifest = {};
      const files = new Map<string, Blob>();
      await Promise.all(
        fileNames.map(async (fileName) => {
          if (ingoreMatcher.ignores(fileName)) {
            return;
          }
          const filePath = join(path, fileName);
          const file = Bun.file(filePath);
          const stat = await file.stat();
          if (stat.isDirectory()) {
            return;
          }
          if (!fileName.startsWith("/")) {
            fileName = `/${fileName}`;
          }
          const bytes = await file.bytes();
          const hash = createHash("sha256").update(bytes).digest("hex");
          manifest[fileName] = {
            size: bytes.length,
            hash,
          };
          files.set(hash, new Blob([bytes.toBase64()], { type: file.type }));
        })
      );
      return {
        files,
        manifest,
        headers,
        redirects,
      };
    });
  }

  private readText(path: string): ResultAsync<string | undefined, never> {
    const file = Bun.file(path);
    return ResultAsync.fromSafePromise(file.exists()).map((exists) =>
      exists ? file.text() : undefined
    );
  }
}

export class WorkerAssets extends ResourceComponent<
  WorkerAssetsInput,
  WorkerAssetsOutput,
  CFError
> {
  constructor(scope: Scope, name: string, input: WorkerAssetsInput) {
    super(scope, new WorkerAssetsProvider(scope.client), name, input);
  }
}
